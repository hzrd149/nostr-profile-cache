import NDK, { NDKEvent, NDKPrivateKeySigner, NDKRelaySet } from "@nostr-dev-kit/ndk";
import { bytesToHex } from "@noble/hashes/utils";
import { EventTemplate } from "nostr-tools";
import { SignedEvent } from "blossom-client-sdk";

import { NOSTR_NSEC, NOSTR_RELAYS, READ_RELAYS } from "./env.js";
import logger from "./logger.js";

const ndk = new NDK({
  explicitRelayUrls: NOSTR_RELAYS.map((url) => url.toString()).concat(READ_RELAYS.map((url) => url.toString())),
});

logger(`Connecting to ${NOSTR_RELAYS.length} relays`);
await ndk.connect();

ndk.signer = new NDKPrivateKeySigner(bytesToHex(NOSTR_NSEC));

export async function signEventTemplate(template: EventTemplate): Promise<SignedEvent> {
  const e = new NDKEvent(ndk);
  e.kind = template.kind;
  e.content = template.content;
  e.tags = template.tags;
  e.created_at = template.created_at;
  await e.sign();
  return e.rawEvent() as SignedEvent;
}

export default ndk;
