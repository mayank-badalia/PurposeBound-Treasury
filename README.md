# PurposeBound Treasury

This is the ppt link: https://docs.google.com/presentation/d/1im1jMk_kfsf1cOfq1SbmkWUobZm_gxXy/edit?usp=sharing&ouid=105289269091882012248&rtpof=true&sd=true

**Every rupee connected to its promised purpose.**

An AI-powered transparency and fund control platform for NGOs, student bodies, communities and sponsored events. It turns funding promises into enforceable spending rules, verifies invoices and photo evidence with **Gemma**, guards the live budget, and releases **Razorpay** transfers only when an expense matches its declared purpose — with every step hash-anchored.

> Built for Track 2 (Gemma). Runs **fully offline** out of the box with deterministic, clearly-labelled fallbacks; add API keys to turn each integration live.

---

## The verified chain

```
Declared purpose → Spending rule → Submitted evidence → AI review → Human approval → Razorpay transfer → Verifiable report
```

Each important step writes a tamper-proof **SHA-256 anchor**. Only hashes are anchored — the private documents stay in Google Drive.

## Five core features

1. **Purpose Rule Builder** (`src/lib/rules.ts`) — Gemma reads a funding agreement and converts it into enforceable rules (min % per category, category caps, invoice requirement, manual-approval threshold, forbidden categories, refund-unused). The organiser reviews and locks them; the confirmed set is hash-anchored.
2. **AI Evidence & Expense Verifier** (`src/lib/evidence.ts`, `src/lib/fingerprint.ts`) — reads invoices/receipts/photos, checks amount & vendor consistency, detects duplicate receipts (exact SHA-256 + near-duplicate byte fingerprint), and classifies evidence as *Verified / Missing / Suspicious / Not permitted*.
3. **Live Budget Guard** (`src/lib/budget.ts`) — maintains `available = collected − transferred − approved-unpaid − reserved − refunds` and computes the effect of each expense on every protected allocation (e.g. *“would drop the prize allocation from 40% to 32%”*). **All arithmetic is plain code — the LLM never does the math.**
4. **Multi-Agent Spending Approval** (`src/lib/agents.ts`) — four agents (Policy → Evidence → Budget → Auditor) coordinated as a typed state graph, with separation of duties. The Auditor only recommends; **an authorised human confirms before any Razorpay transfer**.
5. **Verifiable Transparency Report** (`src/lib/report.ts`) — live spend vs. remaining, category utilisation, compliance with the declared purpose, a plain-language Gemma narrative, and the full hash-anchor chain of custody.

## Synthetic Data Engine (`src/lib/synthetic.ts`, `/synthetic`)

- **Fixed dataset** — 6 named scenarios, always identical, each with a **stored expected outcome**:
  1. Clean vendor payment → *Approve fully*
  2. Prize allocation at risk → *Approve partially*
  3. Duplicate receipt → *Suspicious → Reject*
  4. Above manual-approval limit → *Hold*
  5. Forbidden category (alcohol) → *Reject*
  6. Missing invoice → *Request evidence*
- **Seeded generator** — fresh, reproducible data (same seed → same dataset), selectable size and scenario mix.
- **Validation** — runs every scenario through the *real* 4-agent pipeline and asserts `input → output → expected`. A run passes only when the result is **correct**, not merely error-free. (Current fixed dataset: **6/6 pass**.)
- Download fixed or generated datasets as JSON. Everything is flagged `synthetic: true` — no real people, credentials or confidential data.

## Tech

- **Next.js 15 (App Router) + TypeScript + Tailwind** — one full-stack app.
- **Gemma** via the Google Generative Language API (multimodal) with deterministic offline fallback.
- **Razorpay** Orders (collect) + Route transfers (pay vendors) in Sandbox, with a mock fallback.
- **EvidenceRegistry.sol** (`contracts/`) — one tiny Solidity contract for on-chain hash anchoring; simulated deterministically when no chain is configured.
- **Storage** — file-backed JSON repository (`src/lib/store.ts`), swappable for Postgres/Prisma behind the same interface.

### Pragmatic hackathon choices (honestly labelled)
- No external orchestration/DB/vision libs are installed — the LangGraph-style graph, the repository store and the perceptual hash are implemented in-house behind clean interfaces, so the app always boots. The UI header shows each integration's live/fallback mode at all times.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000  (this repo was tested on PORT=3300)
```

1. Open **Synthetic Data → Reset & load fixed dataset**, then **Run validation** (expect 6/6 pass).
2. **Dashboard** shows the live budget position and protected allocations.
3. **Approvals** — run the 4-agent review on an expense, read the findings, then approve/reject (approval fires the Razorpay transfer).
4. **Submit Expense** — upload a photo or PDF; Gemma reads it and the agents verify it.
5. **Transparency report** — the sponsor/donor view with the hash-anchor chain.

### Optional live keys
Copy `.env.example` → `.env.local`. Anything left blank stays on its labelled fallback; the header shows each integration's live/fallback state.

## Integrations & backend endpoints

**Gemma 4** (`gemma-4-26b-a4b-it`, Google AI Studio) — set `GEMINI_API_KEY`. The model id goes in the request path (`models/gemma-4-26b-a4b-it:generateContent`), configured via `GEMMA_MODEL`. It's a reasoning model (returns hidden `thought` parts, which the provider strips). Powers rule extraction, evidence analysis, review rationale, report narrative, and `POST /api/ai/analyse`. Automated tests/validation force deterministic mode (`llm:false`) so they make **zero** API calls; the report narrative is cached per financial state.

**Razorpay Sandbox** — set `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`.
- `POST /api/razorpay/order` `{campaign_id, amount}` → creates an order + returns the public key for Checkout (**live**).
- `POST /api/razorpay/verify` → HMAC-SHA256 signature check; records the contribution only when valid.
- `POST /api/razorpay/transfer` → Route transfer to a linked account (**needs Route enabled** on the account; labeled mock otherwise).
- `POST /api/razorpay/refund` → refund a captured payment.
- `POST /api/webhooks/razorpay` → verifies `X-Razorpay-Signature` over the raw body (set `RAZORPAY_WEBHOOK_SECRET`; expose via ngrok for local dev).

**Google Drive** (OAuth 2.0, `drive.file` scope) — set `GOOGLE_DRIVE_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI`, then **one-time GCP console setup**:
1. Enable the **Google Drive API**.
2. OAuth consent screen: **External**, add your Gmail as a **test user**, add scope `https://www.googleapis.com/auth/drive.file`.
3. Authorised redirect URI = `http://localhost:3000/api/auth/google/callback`.

Then click **Connect Google Drive** in the header. Routes: `GET /api/auth/google`, `GET /api/auth/google/callback`, `GET /api/drive/status`, `POST /api/drive/upload`. On connect it creates the folder tree (`PurposeBound Treasury/{Agreements,Budgets,Invoices,Evidence,Reports}`); evidence uploads then store the real document in Drive and anchor only its hash.

**Self-test:** `GET /api/selftest` runs 89 exact-number assertions (deterministic, no API calls).
