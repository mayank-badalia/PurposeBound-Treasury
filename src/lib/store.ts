// File-backed JSON store with a repository layer.
//
// DESIGN NOTE: This reads and writes like a database repository but persists to
// a single JSON file under .data/. It is a deliberate hackathon choice — zero
// external services, always boots. Every access goes through these functions,
// so swapping in Postgres/Prisma later means reimplementing this module only.

import { promises as fs } from "fs";
import path from "path";
import type {
  Campaign,
  Database,
  Evidence,
  Expense,
  Fund,
  GoogleConnection,
  HashAnchor,
  Rule,
} from "./types";
import { sha256, shortId, simulatedTxRef, chainConfigured } from "./hash";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "store.json");

const EMPTY: Database = {
  campaigns: [],
  rules: [],
  funds: [],
  expenses: [],
  anchors: [],
  google: null,
};

// Cache across hot reloads in dev via globalThis.
const g = globalThis as unknown as { __pbtDb?: Database; __pbtLoaded?: boolean };

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function load(): Promise<Database> {
  // ALWAYS read from disk — the file is the source of truth. A long-lived
  // in-memory cache gets stale across requests/workers and causes numbers to
  // drift (a write from one request isn't seen by the next). Data is tiny, so
  // a fresh read per call is cheap and correct. The in-memory copy is only a
  // fallback for the very first run before the file exists.
  await ensureDir();
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    g.__pbtDb = { ...EMPTY, ...(JSON.parse(raw) as Database) };
  } catch {
    if (!g.__pbtDb) g.__pbtDb = structuredClone(EMPTY);
  }
  g.__pbtLoaded = true;
  return g.__pbtDb;
}

export async function save(db: Database): Promise<void> {
  await ensureDir();
  g.__pbtDb = db;
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

// Serialise every read-modify-write so concurrent requests can't clobber each
// other's changes (the classic lost-update that wiped a review and made the
// expense look "not reviewed"). Single process, so an in-process lock suffices.
let __lock: Promise<unknown> = Promise.resolve();
export async function mutate<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const prev = __lock;
  let release!: () => void;
  __lock = new Promise<void>((r) => (release = r));
  try {
    await prev;
  } catch {
    /* previous mutation's error is its own concern */
  }
  try {
    const db = await load();
    const result = await fn(db);
    await save(db);
    return result;
  } finally {
    release();
  }
}

export async function resetDb(): Promise<void> {
  // Preserve the Google Drive connection across data resets so a connected
  // account survives demo re-seeds.
  await mutate((db) => {
    const google = db.google ?? null;
    const fresh = { ...structuredClone(EMPTY), google };
    Object.assign(db, fresh);
  });
}

export async function getGoogle(): Promise<GoogleConnection | null> {
  return (await load()).google ?? null;
}

export async function setGoogle(conn: GoogleConnection | null): Promise<void> {
  await mutate((db) => {
    db.google = conn;
  });
}

// ---------- Campaigns ----------
export async function listCampaigns(): Promise<Campaign[]> {
  return (await load()).campaigns;
}
export async function getCampaign(id: string): Promise<Campaign | undefined> {
  return (await load()).campaigns.find((c) => c.id === id);
}
export async function upsertCampaign(c: Campaign): Promise<Campaign> {
  return mutate((db) => {
    const i = db.campaigns.findIndex((x) => x.id === c.id);
    if (i >= 0) db.campaigns[i] = c;
    else db.campaigns.push(c);
    return c;
  });
}

// ---------- Rules ----------
export async function rulesFor(campaignId: string): Promise<Rule[]> {
  return (await load()).rules.filter((r) => r.campaignId === campaignId);
}
export async function replaceRules(campaignId: string, rules: Rule[]): Promise<void> {
  await mutate((db) => {
    db.rules = db.rules.filter((r) => r.campaignId !== campaignId).concat(rules);
  });
}

// ---------- Funds ----------
export async function fundsFor(campaignId: string): Promise<Fund[]> {
  return (await load()).funds.filter((f) => f.campaignId === campaignId);
}
export async function addFund(f: Fund): Promise<Fund> {
  return mutate((db) => {
    db.funds.push(f);
    return f;
  });
}

// Replace all funds for a campaign (keeps re-seeding idempotent).
export async function replaceFunds(campaignId: string, funds: Fund[]): Promise<void> {
  await mutate((db) => {
    db.funds = db.funds.filter((f) => f.campaignId !== campaignId).concat(funds);
  });
}

// Drop a campaign's anchors (so re-seeding the same campaign doesn't pile up).
export async function clearAnchors(campaignId: string): Promise<void> {
  await mutate((db) => {
    db.anchors = db.anchors.filter((a) => a.campaignId !== campaignId);
  });
}

// Replace all expenses for a campaign.
export async function replaceExpenses(campaignId: string, expenses: Expense[]): Promise<void> {
  await mutate((db) => {
    db.expenses = db.expenses.filter((e) => e.campaignId !== campaignId).concat(expenses);
  });
}

// ---------- Expenses ----------
export async function expensesFor(campaignId: string): Promise<Expense[]> {
  return (await load()).expenses.filter((e) => e.campaignId === campaignId);
}
export async function allExpenses(): Promise<Expense[]> {
  return (await load()).expenses;
}
export async function getExpense(id: string): Promise<Expense | undefined> {
  return (await load()).expenses.find((e) => e.id === id);
}
export async function upsertExpense(e: Expense): Promise<Expense> {
  return mutate((db) => {
    const i = db.expenses.findIndex((x) => x.id === e.id);
    if (i >= 0) db.expenses[i] = e;
    else db.expenses.push(e);
    return e;
  });
}

// All evidence across a campaign — used for duplicate detection.
export async function evidenceFor(campaignId: string): Promise<Evidence[]> {
  const db = await load();
  return db.expenses
    .filter((e) => e.campaignId === campaignId)
    .flatMap((e) => e.evidence);
}

// ---------- Hash anchors ----------
export async function anchorsFor(campaignId: string): Promise<HashAnchor[]> {
  return (await load()).anchors.filter((a) => a.campaignId === campaignId);
}

// Create + persist a tamper-proof anchor for a piece of content.
export async function anchor(
  campaignId: string,
  kind: HashAnchor["kind"],
  refId: string,
  content: string,
): Promise<HashAnchor> {
  const digest = sha256(content);
  const a: HashAnchor = {
    id: shortId("anchor"),
    campaignId,
    kind,
    refId,
    sha256: digest,
    txRef: simulatedTxRef(digest),
    onChain: chainConfigured(),
    createdAt: new Date().toISOString(),
  };
  return mutate((db) => {
    db.anchors.push(a);
    return a;
  });
}
