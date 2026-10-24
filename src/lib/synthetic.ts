// Synthetic Data Engine.
//
// Produces the fixtures this project needs to demonstrate the verified chain:
//   • a stable FIXED dataset — 6 named scenarios, always identical, each with a
//     stored expected outcome so we can assert input -> output -> expected.
//   • a SEEDED generator — fresh, outcome-preserving variations, reproducible
//     from a seed, for larger / performance runs.
//
// Everything is deterministic code (amounts, identifiers, relationships,
// fingerprints). No real people, no real credentials. All records are flagged
// `synthetic: true`.

import { makeRng, seedFromString, pick, intBetween, roundRupees, type Rng } from "./rng";
import { contentHash, visualFingerprint } from "./fingerprint";
import { shortId } from "./hash";
import type {
  Campaign,
  Evidence,
  EvidenceType,
  Expense,
  ExpectedOutcome,
  Fund,
  Rule,
} from "./types";

// Deterministic synthetic file bytes from a seed — stands in for an uploaded
// invoice/receipt/photo so fingerprints and duplicate detection are real.
function synthBytes(seed: number, len = 512): Uint8Array {
  const rng = makeRng(seed);
  const b = new Uint8Array(len);
  for (let i = 0; i < len; i++) b[i] = Math.floor(rng() * 256);
  return b;
}

interface EvidenceSpec {
  type: EvidenceType;
  filename: string;
  mimeType: string;
  seed: number; // same seed => identical bytes => exact duplicate
  extracted?: Evidence["extracted"];
}

function makeEvidence(expenseId: string, spec: EvidenceSpec, uploadedAt: string): Evidence {
  const bytes = synthBytes(spec.seed);
  return {
    id: shortId("ev"),
    expenseId,
    type: spec.type,
    filename: spec.filename,
    mimeType: spec.mimeType,
    size: bytes.length,
    contentHash: contentHash(bytes),
    visualFingerprint: visualFingerprint(bytes),
    uploadedAt,
    driveFileId: `drive_sim_${shortId("f").slice(2)}`,
    extracted: spec.extracted,
  };
}

// The campaign + rules every synthetic dataset is built against.
export const CAMPAIGN_COLLECTED = 200000;

export function buildRules(campaignId: string): Rule[] {
  const r = (
    kind: Rule["kind"],
    label: string,
    extra: Partial<Rule> = {},
  ): Rule => ({
    id: shortId("rule"),
    campaignId,
    kind,
    label,
    confirmed: true,
    source: "fallback",
    ...extra,
  });
  return [
    r("min_category_pct", "At least 40% must be used for prizes", { category: "prizes", pct: 40 }),
    r("max_category_amount", "Marketing expenses cannot exceed ₹20,000", { category: "marketing", amount: 20000 }),
    r("requires_invoice", "Vendor payments require a valid invoice"),
    r("manual_approval_above", "Expenses above ₹25,000 require manual approval", { amount: 25000 }),
    r("refund_unused", "Unused funds must be refunded to the sponsor"),
    r("forbidden_category", "Alcohol is not a permitted expense", { category: "alcohol" }),
  ];
}

// ---- scenario templates: each returns an expense + its expected outcome ----
type ScenarioKey =
  | "clean"
  | "prize_breach"
  | "duplicate"
  | "over_limit"
  | "not_permitted"
  | "missing_invoice";

export const SCENARIO_META: { key: ScenarioKey; title: string; purpose: string }[] = [
  { key: "clean", title: "Clean vendor payment", purpose: "Normal, fully-compliant spend → Approve fully." },
  { key: "prize_breach", title: "Prize allocation at risk", purpose: "Affordable, but would break the 40% prize promise → Approve partially." },
  { key: "duplicate", title: "Duplicate receipt", purpose: "A receipt resubmitted → Suspicious → Reject." },
  { key: "over_limit", title: "Above manual-approval limit", purpose: "Clean but > ₹25,000 → Hold for a human." },
  { key: "not_permitted", title: "Forbidden category", purpose: "Alcohol is banned by the rules → Reject." },
  { key: "missing_invoice", title: "Missing invoice", purpose: "Vendor payment with no invoice → Request evidence." },
];

interface BuiltExpense {
  expense: Expense;
  // The seed of the invoice this one should duplicate (resolved after build).
  duplicateOfSeed?: number;
}

function baseExpense(
  campaignId: string,
  fields: Partial<Expense>,
  expected: ExpectedOutcome,
  createdAt: string,
): Expense {
  return {
    id: shortId("exp"),
    campaignId,
    category: "general",
    amount: 0,
    vendor: "",
    recipient: "",
    description: "",
    status: "submitted",
    createdAt,
    evidence: [],
    synthetic: true,
    expected,
    ...fields,
  };
}

// Build one scenario. `cleanInvoiceSeed` lets the duplicate scenario copy the
// clean scenario's invoice bytes exactly.
function buildScenario(
  key: ScenarioKey,
  campaignId: string,
  rng: Rng,
  order: number,
  cleanInvoiceSeed: number,
): BuiltExpense {
  const createdAt = new Date(Date.UTC(2026, 9, 20, 9, order)).toISOString(); // ordered
  const uploadedAt = createdAt;

  switch (key) {
    case "clean": {
      const vendor = pick(rng, ["FreshBite Catering", "CityEats Co", "MealWorks"]);
      const amount = roundRupees(intBetween(rng, 8000, 15000));
      const e = baseExpense(
        campaignId,
        {
          category: "catering",
          amount,
          vendor,
          recipient: vendor,
          description: "Lunch catering for 120 participants",
        },
        { scenario: "Clean vendor payment", verification: "verified", recommendation: "approve_full", note: "Everything checks out." },
        createdAt,
      );
      e.evidence = [
        makeEvidence(e.id, {
          type: "invoice",
          filename: "catering_invoice.pdf",
          mimeType: "application/pdf",
          seed: cleanInvoiceSeed,
          extracted: { vendor, amount, date: "2026-10-20", description: "Catering services", supportsClaim: true },
        }, uploadedAt),
        makeEvidence(e.id, {
          type: "photo",
          filename: "event_lunch.jpg",
          mimeType: "image/jpeg",
          seed: cleanInvoiceSeed + 1,
          extracted: { supportsClaim: true, notes: "Photo of catered lunch area" },
        }, uploadedAt),
      ];
      return { expense: e };
    }

    case "prize_breach": {
      const vendor = pick(rng, ["GrandHall Venues", "Skyline Convention", "MetroArena"]);
      const amount = roundRupees(intBetween(rng, 130000, 150000)); // breaks 40% prize floor
      const e = baseExpense(
        campaignId,
        {
          category: "venue",
          amount,
          vendor,
          recipient: vendor,
          description: "Main venue booking for 2 days",
        },
        { scenario: "Prize allocation at risk", verification: "verified", recommendation: "approve_partial", note: "Would drop prize allocation below 40%." },
        createdAt,
      );
      e.evidence = [
        makeEvidence(e.id, {
          type: "invoice",
          filename: "venue_invoice.pdf",
          mimeType: "application/pdf",
          seed: Math.floor(rng() * 1e9),
          extracted: { vendor, amount, date: "2026-10-20", description: "Venue rental", supportsClaim: true },
        }, uploadedAt),
      ];
      return { expense: e };
    }

    case "duplicate": {
      const vendor = "FreshBite Catering"; // same vendor as the clean payment
      const amount = roundRupees(intBetween(rng, 6000, 9000));
      const e = baseExpense(
        campaignId,
        {
          category: "catering",
          amount,
          vendor,
          recipient: vendor,
          description: "Catering (second claim)",
        },
        { scenario: "Duplicate receipt", verification: "suspicious", recommendation: "reject", note: "Same invoice submitted earlier." },
        createdAt,
      );
      // Reuse the CLEAN scenario's invoice bytes => exact duplicate, and its
      // extracted amount (12k-ish) will mismatch this smaller claim too.
      e.evidence = [
        makeEvidence(e.id, {
          type: "invoice",
          filename: "catering_invoice_copy.pdf",
          mimeType: "application/pdf",
          seed: cleanInvoiceSeed, // <-- identical bytes to the clean invoice
          extracted: { vendor, amount: 12000, date: "2026-10-20", description: "Catering services", supportsClaim: true },
        }, uploadedAt),
      ];
      return { expense: e, duplicateOfSeed: cleanInvoiceSeed };
    }

    case "over_limit": {
      const vendor = pick(rng, ["SwiftLogistics", "HaulPro", "MoveIt Logistics"]);
      const amount = roundRupees(intBetween(rng, 28000, 45000)); // > 25k threshold
      const e = baseExpense(
        campaignId,
        {
          category: "logistics",
          amount,
          vendor,
          recipient: vendor,
          description: "Equipment transport and setup",
        },
        { scenario: "Above manual-approval limit", verification: "verified", recommendation: "hold", note: "Exceeds ₹25,000 — needs a human." },
        createdAt,
      );
      e.evidence = [
        makeEvidence(e.id, {
          type: "invoice",
          filename: "logistics_invoice.pdf",
          mimeType: "application/pdf",
          seed: Math.floor(rng() * 1e9),
          extracted: { vendor, amount, date: "2026-10-20", description: "Logistics", supportsClaim: true },
        }, uploadedAt),
      ];
      return { expense: e };
    }

    case "not_permitted": {
      const vendor = pick(rng, ["PartySupplies Co", "The Wine Shop"]);
      const amount = roundRupees(intBetween(rng, 4000, 9000));
      const e = baseExpense(
        campaignId,
        {
          category: "alcohol",
          amount,
          vendor,
          recipient: vendor,
          description: "Celebration drinks",
        },
        { scenario: "Forbidden category", verification: "not_permitted", recommendation: "reject", note: "Alcohol is explicitly banned." },
        createdAt,
      );
      e.evidence = [
        makeEvidence(e.id, {
          type: "invoice",
          filename: "misc_invoice.pdf",
          mimeType: "application/pdf",
          seed: Math.floor(rng() * 1e9),
          extracted: { vendor, amount, date: "2026-10-20", description: "Beverages", supportsClaim: true },
        }, uploadedAt),
      ];
      return { expense: e };
    }

    case "missing_invoice": {
      const vendor = pick(rng, ["BrandBoost", "AdReach", "PromoWorks"]);
      const amount = roundRupees(intBetween(rng, 6000, 18000));
      const e = baseExpense(
        campaignId,
        {
          category: "marketing",
          amount,
          vendor,
          recipient: vendor,
          description: "Social media promotion",
        },
        { scenario: "Missing invoice", verification: "missing_evidence", recommendation: "request_evidence", note: "No invoice attached." },
        createdAt,
      );
      // Photo only — no invoice, which the rules require.
      e.evidence = [
        makeEvidence(e.id, {
          type: "photo",
          filename: "campaign_screenshot.jpg",
          mimeType: "image/jpeg",
          seed: Math.floor(rng() * 1e9),
          extracted: { supportsClaim: true, notes: "Screenshot of promoted post" },
        }, uploadedAt),
      ];
      return { expense: e };
    }
  }
}

export interface Dataset {
  campaign: Campaign;
  rules: Rule[];
  funds: Fund[];
  expenses: Expense[];
}

function makeCampaign(name: string, seedLabel: string): Campaign {
  return {
    id: `camp_${seedFromString(seedLabel).toString(16)}`,
    name,
    organiser: "Innovate Student Council",
    description:
      "Sponsored 2-day student hackathon. Sponsor funds prizes, venue, catering, logistics and limited marketing.",
    sourceDocument:
      "SPONSORSHIP AGREEMENT. TechCorp sponsors ₹2,00,000 for Innovate Hackathon 2026. At least 40% of funds must be used for prizes. Marketing expenses cannot exceed ₹20,000. All vendor payments require a valid invoice. Expenses above ₹25,000 require manual approval. Alcohol is not a permitted expense. Unused funds must be refunded to the sponsor.",
    status: "active",
    rulesLocked: true,
    createdAt: new Date(Date.UTC(2026, 9, 19, 12, 0)).toISOString(),
    synthetic: true,
  };
}

function makeFunds(campaignId: string, amount: number): Fund[] {
  return [
    {
      id: shortId("fund"),
      campaignId,
      amount,
      source: "TechCorp Sponsorship",
      razorpayOrderId: shortId("order"),
      razorpayPaymentId: shortId("pay"),
      status: "captured",
      createdAt: new Date(Date.UTC(2026, 9, 19, 12, 30)).toISOString(),
    },
  ];
}

// The stable, always-identical demonstration dataset (6 scenarios).
export function buildFixedDataset(): Dataset {
  const campaign = makeCampaign("Innovate Hackathon 2026 (Demo)", "fixed-demo-v1");
  const rules = buildRules(campaign.id);
  const funds = makeFunds(campaign.id, CAMPAIGN_COLLECTED);
  const rng = makeRng(seedFromString("fixed-demo-v1"));
  const cleanInvoiceSeed = 424242; // shared so the duplicate scenario can copy it

  const order = SCENARIO_META.map((m) => m.key);
  const expenses = order.map((key, i) =>
    buildScenario(key, campaign.id, rng, i + 1, cleanInvoiceSeed).expense,
  );
  return { campaign, rules, funds, expenses };
}

export interface GenerateOptions {
  seed?: string;
  size?: number; // number of expenses
  scenarioTypes?: ScenarioKey[];
}

// Fresh, reproducible dataset. Same seed => same data.
export function generateDataset(opts: GenerateOptions = {}): Dataset {
  const seed = opts.seed ?? `gen-${Date.now()}`;
  const size = Math.max(1, Math.min(200, opts.size ?? 12));
  const types = opts.scenarioTypes?.length
    ? opts.scenarioTypes
    : (SCENARIO_META.map((m) => m.key) as ScenarioKey[]);

  const campaign = makeCampaign(`Generated Campaign (${seed})`, seed);
  const rules = buildRules(campaign.id);
  const funds = makeFunds(campaign.id, CAMPAIGN_COLLECTED);
  const rng = makeRng(seedFromString(seed));
  const cleanInvoiceSeed = Math.floor(rng() * 1e9);

  const expenses: Expense[] = [];
  // Always include one clean payment first so duplicate scenarios have a source.
  expenses.push(buildScenario("clean", campaign.id, rng, 1, cleanInvoiceSeed).expense);
  for (let i = 1; i < size; i++) {
    const key = pick(rng, types);
    expenses.push(buildScenario(key, campaign.id, rng, i + 1, cleanInvoiceSeed).expense);
  }
  return { campaign, rules, funds, expenses };
}
