// Google Drive integration (OAuth 2.0 + Drive v3), via fetch — no SDK install.
//
// The private documents (agreements, invoices, receipts, photos, reports) live
// in the organiser's Google Drive; only their SHA-256 hashes are anchored.
//
// Requires GCP console setup (one-time, by the account owner):
//   • Enable the Google Drive API
//   • OAuth consent screen: External, add test users, scope drive.file
//   • Authorised redirect URI = GOOGLE_DRIVE_REDIRECT_URI
// Then "Connect Google Drive" in the app runs the flow below.

import { getGoogle, setGoogle } from "./store";
import type { GoogleConnection } from "./types";

const SCOPE = "https://www.googleapis.com/auth/drive.file";
const SUBFOLDERS = ["Agreements", "Budgets", "Invoices", "Evidence", "Reports"];

export function driveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_ID &&
      process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
      process.env.GOOGLE_DRIVE_REDIRECT_URI,
  );
}

export function authUrl(state = "pbt"): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_DRIVE_REDIRECT_URI!,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

export async function exchangeCode(code: string): Promise<GoogleConnection> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_DRIVE_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });
  const t = (await res.json()) as TokenResponse;
  if (!res.ok || !t.access_token) {
    throw new Error(`token exchange failed: ${t.error_description || t.error || res.status}`);
  }
  const conn: GoogleConnection = {
    accessToken: t.access_token,
    refreshToken: t.refresh_token || "",
    expiry: Date.now() + (t.expires_in - 60) * 1000,
    connectedAt: new Date().toISOString(),
  };
  // Fetch the user's email (best-effort).
  try {
    const u = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { authorization: `Bearer ${conn.accessToken}` },
    });
    if (u.ok) conn.email = ((await u.json()) as { email?: string }).email;
  } catch {
    /* ignore */
  }
  await setGoogle(conn);
  return conn;
}

async function refresh(conn: GoogleConnection): Promise<GoogleConnection> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: conn.refreshToken,
      client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  const t = (await res.json()) as TokenResponse;
  if (!res.ok || !t.access_token) {
    throw new Error(`token refresh failed: ${t.error_description || t.error || res.status}`);
  }
  const updated: GoogleConnection = {
    ...conn,
    accessToken: t.access_token,
    expiry: Date.now() + (t.expires_in - 60) * 1000,
  };
  await setGoogle(updated);
  return updated;
}

// Return a valid access token, refreshing if expired. Null if not connected.
export async function getAccessToken(): Promise<{ token: string; conn: GoogleConnection } | null> {
  let conn = await getGoogle();
  if (!conn) return null;
  if (Date.now() >= conn.expiry && conn.refreshToken) {
    conn = await refresh(conn);
  }
  return { token: conn.accessToken, conn };
}

async function createFolder(token: string, name: string, parent?: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parent ? { parents: [parent] } : {}),
    }),
  });
  if (!res.ok) throw new Error(`folder create failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { id: string }).id;
}

// Ensure the "PurposeBound Treasury" folder tree exists; cache ids on the conn.
export async function ensureFolders(): Promise<Record<string, string>> {
  const auth = await getAccessToken();
  if (!auth) throw new Error("Google Drive not connected");
  if (auth.conn.folders && auth.conn.rootFolderId) return auth.conn.folders;

  const root = await createFolder(auth.token, "PurposeBound Treasury");
  const folders: Record<string, string> = { root };
  for (const sub of SUBFOLDERS) {
    folders[sub] = await createFolder(auth.token, sub, root);
  }
  await setGoogle({ ...auth.conn, rootFolderId: root, folders });
  return folders;
}

export interface DriveUpload {
  fileId: string;
  webViewLink?: string;
  folder: string;
}

// Upload bytes to a named subfolder (default "Evidence") via multipart.
export async function uploadToDrive(
  name: string,
  mimeType: string,
  bytes: Uint8Array,
  subfolder = "Evidence",
): Promise<DriveUpload> {
  const auth = await getAccessToken();
  if (!auth) throw new Error("Google Drive not connected");
  const folders = await ensureFolders();
  const parent = folders[subfolder] || folders.root;

  const boundary = "pbt" + Math.random().toString(16).slice(2);
  const metadata = JSON.stringify({ name, parents: [parent] });
  const pre = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const post = `\r\n--${boundary}--`;
  const body = Buffer.concat([Buffer.from(pre, "utf8"), Buffer.from(bytes), Buffer.from(post, "utf8")]);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${auth.token}`,
        "content-type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) throw new Error(`drive upload failed: ${res.status} ${await res.text()}`);
  const f = (await res.json()) as { id: string; webViewLink?: string };
  return { fileId: f.id, webViewLink: f.webViewLink, folder: subfolder };
}
