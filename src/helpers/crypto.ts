import crypto from "node:crypto";

export function getSha256(value: crypto.BinaryLike) {
  const hash = crypto.createHash("sha256");
  hash.update(value);
  return hash.digest().toString("hex");
}
