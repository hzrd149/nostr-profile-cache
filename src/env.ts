import "dotenv/config";

const NOSTR_RELAYS = process.env.NOSTR_RELAYS?.split(",").map((r) => new URL(r)) ?? [];
if (NOSTR_RELAYS.length === 0) throw new Error("Missing NOSTR_RELAYS");

const BLOSSOM_SERVERS = process.env.NOSTR_RELAYS?.split(",").map((r) => new URL(r)) ?? [];
if (BLOSSOM_SERVERS.length === 0) throw new Error("Missing BLOSSOM_SERVERS");

const DEFAULT_SIZE = process.env.DEFAULT_SIZE ? parseInt(process.env.DEFAULT_SIZE) : 6;

export { NOSTR_RELAYS, BLOSSOM_SERVERS, DEFAULT_SIZE };
