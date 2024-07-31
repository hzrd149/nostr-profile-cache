import debug from "debug";

if (!process.env.DEBUG) debug.enable("nostr-profile-cache, nostr-profile-cache:*");

const logger = debug("nostr-profile-cache");

export default logger;
