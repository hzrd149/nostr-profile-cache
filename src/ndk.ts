import NDK from "@nostr-dev-kit/ndk";
import { NOSTR_RELAYS } from "./env.js";
import logger from "./logger.js";

const ndk = new NDK({
  explicitRelayUrls: NOSTR_RELAYS.map((url) => url.toString()),
});

logger(`Connecting to ${NOSTR_RELAYS.length} relays`);
await ndk.connect();

export default ndk;
