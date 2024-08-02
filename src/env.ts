import "dotenv/config";
import pfs from "fs/promises";
import { generateSecretKey, getPublicKey, nip19 } from "nostr-tools";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";

import logger from "./logger.js";

function parseNsec(nsec: string) {
  if (nsec.match(/^[0-9a-f]{64}$/i)) {
    return hexToBytes(nsec);
  }
  const decode = nip19.decode(nsec);
  if (decode.type !== "nsec") throw new Error("Invalid nsec");
  return decode.data;
}

const NOSTR_RELAYS = process.env.NOSTR_RELAYS?.split(",").map((r) => new URL(r)) ?? [];
if (NOSTR_RELAYS.length === 0) throw new Error("Missing NOSTR_RELAYS");

const READ_RELAYS = process.env.READ_RELAYS?.split(",").map((r) => new URL(r)) ?? [];
if (READ_RELAYS.length === 0) throw new Error("Missing READ_RELAYS");

const BLOSSOM_SERVERS = process.env.BLOSSOM_SERVERS?.split(",").map((r) => new URL(r)) ?? [];

const DEFAULT_SIZE = process.env.DEFAULT_SIZE ? parseInt(process.env.DEFAULT_SIZE) : 6;

const DATA_DIR = process.env.DATA_DIR ?? "./data";

const NOSTR_NSEC = process.env.NOSTR_NSEC ? parseNsec(process.env.NOSTR_NSEC) : generateSecretKey();

if (!process.env.NOSTR_NSEC) {
  logger("Saving NOSTR_NSEC to .env");
  await pfs.appendFile(".env", `NOSTR_NSEC="${bytesToHex(NOSTR_NSEC)}"\n`);
}

const NOSTR_PUBKEY = getPublicKey(NOSTR_NSEC);

export { NOSTR_RELAYS, BLOSSOM_SERVERS, DEFAULT_SIZE, DATA_DIR, NOSTR_NSEC, NOSTR_PUBKEY, READ_RELAYS };
