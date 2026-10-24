// Tamper-proof hash anchoring.
//
// Blockchain stores only HASHES, never the private documents. The documents
// live in Google Drive; here we compute the SHA-256 and record an anchor.
//
// If CHAIN_RPC_URL + a deployed EvidenceRegistry are configured, we would send
// the hash on-chain. Otherwise we simulate a tx reference deterministically so
// the demo shows the full chain-of-custody without a live chain.

import { createHash, randomBytes } from "crypto";

export function sha256(input: string | Buffer | Uint8Array): string {
  return createHash("sha256")
    .update(typeof input === "string" ? Buffer.from(input, "utf8") : Buffer.from(input))
    .digest("hex");
}

export function shortId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

// A simulated on-chain tx hash derived from the content hash, so it is stable
// and verifiable-looking. Clearly labelled as simulated unless a real chain
// is wired in via env.
export function simulatedTxRef(contentHash: string): string {
  return "0x" + sha256("chain-anchor:" + contentHash).slice(0, 64);
}

export function chainConfigured(): boolean {
  return Boolean(process.env.CHAIN_RPC_URL && process.env.EVIDENCE_REGISTRY_ADDRESS);
}
