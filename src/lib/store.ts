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
};

// Cache across hot reloads in dev via globalThis.
const g = globalThis as unknown as { __pbtDb?: Database; __pbtLoaded?: boolean };

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function load(): Promise<Database> {
  if (g.__pbtDb && g.__pbtLoaded) return g.__pbtDb;
  await ensureDir();
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    g.__pbtDb = { ...EMPTY, ...(JSON.parse(raw) as Database) };
  } catch {
    g.__pbtDb = structuredClone(EMPTY);
  }
  g.__pbtLoaded = true;
  return g.__pbtDb;
}

export async function save(db: Database): Promise<void> {
  await ensureDir();
  g.__pbtDb = db;
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

export async function resetDb(): Promise<void> {
  g.__pbtDb = structuredClone(EMPTY);
  g.__pbtLoaded = true;
  await save(g.__pbtDb);
}

// ---------- Campaigns ----------
export async function listCampaigns(): Promise<Campaign[]> {
  return (await load()).campaigns;
}
export async function getCampaign(id: string): Promise<Campaign | undefined> {
  return (await load()).campaigns.find((c) => c.id === id);
}
export async function upsertCampaign(c: Campaign): Promise<Campaign> {
  const db = await load();
  const i = db.campaigns.findIndex((x) => x.id === c.id);
  if (i >= 0) db.campaigns[i] = c;
  else db.campaigns.push(c);
  await save(db);
  return c;
}

// ---------- Rules ----------
export async function rulesFor(campaignId: string): Promise<Rule[]> {
  return (await load()).rules.filter((r) => r.campaignId === campaignId);
}
export async function replaceRules(campaignId: string, rules: Rule[]): Promise<void> {
  const db = await load();
  db.rules = db.rules.filter((r) => r.campaignId !== campaignId).concat(rules);
  await save(db);
}

// ---------- Funds ----------
export async function fundsFor(campaignId: string): Promise<Fund[]> {
  return (await load()).funds.filter((f) => f.campaignId === campaignId);
}
export async function addFund(f: Fund): Promise<Fund> {
  const db = await load();
  db.funds.push(f);
  await save(db);
  return f;
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
  const db = await load();
  const i = db.expenses.findIndex((x) => x.id === e.id);
  if (i >= 0) db.expenses[i] = e;
  else db.expenses.push(e);
  await save(db);
  return e;
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
  const db = await load();
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
  db.anchors.push(a);
  await save(db);
  return a;
}
