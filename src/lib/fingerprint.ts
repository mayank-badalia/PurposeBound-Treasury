// Duplicate / near-duplicate receipt detection.
//
// Two signals, both pure-JS (no native image libs, so it always installs):
//   contentHash       — SHA-256 of raw bytes -> catches exact re-uploads
//   visualFingerprint — coarse 64-bucket byte histogram -> catches near-dupes
//                        (re-saved / lightly re-compressed versions of the same
//                        file). This is a deliberate approximation of a true
//                        perceptual hash, honest about its limits.

import { sha256 } from "./hash";

export function contentHash(bytes: Uint8Array): string {
  return sha256(bytes);
}

// 64-bucket normalised byte histogram, serialised as a fixed-length string.
export function visualFingerprint(bytes: Uint8Array): string {
  const buckets = new Array<number>(64).fill(0);
  for (let i = 0; i < bytes.length; i++) buckets[bytes[i] >> 2]++;
  const total = bytes.length || 1;
  // Quantise each bucket to 0-15 (hex) so similar files produce similar strings.
  return buckets
    .map((c) => Math.min(15, Math.round((c / total) * 64 * 15)).toString(16))
    .join("");
}

// Hamming-like distance between two fingerprints (0 = identical).
export function fingerprintDistance(a: string, b: string): number {
  if (a.length !== b.length) return Math.max(a.length, b.length);
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    d += Math.abs(parseInt(a[i], 16) - parseInt(b[i], 16));
  }
  return d;
}

export const NEAR_DUPLICATE_THRESHOLD = 6; // tuned for the demo fixtures
