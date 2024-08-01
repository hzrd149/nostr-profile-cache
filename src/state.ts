import { getPublicKey } from "nostr-tools";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import dayjs from "dayjs";

import { RESIZE_IMAGE_KIND, Size } from "./const.js";
import ndk from "./ndk.js";
import logger from "./logger.js";
import { NOSTR_NSEC, NOSTR_PUBKEY } from "./env.js";
import { getTagValue } from "./helpers/nostr.js";
import { getSha256 } from "./helpers/crypto.js";

const cache = new Map<string, NDKEvent>();

export function getResizeUID(url: string, size: string, format: string) {
  return getSha256(JSON.stringify([url, size, format]));
}

export function handleEvent(event: NDKEvent) {
  const pubkey = getTagValue(event, "p");
  const uid = getTagValue(event, "u");
  if (!pubkey || !uid) return;

  const key = `${pubkey}|${uid}`;
  const current = cache.get(key);

  // only save the event if there isn't one or if its published by us
  if (!current || event.pubkey === NOSTR_PUBKEY) {
    cache.set(key, event);
  }
}

export async function saveResizeResult(pubkey: string, url: string, size: Size, format: string, sha256: string) {
  const event = new NDKEvent(ndk);
  event.kind = RESIZE_IMAGE_KIND;
  event.content = "";

  // indexable tags
  event.tags.push(["p", pubkey]);
  event.tags.push(["u", getResizeUID(url, size, format)]);

  // human readable tags
  event.tags.push(["url", url]);
  event.tags.push(["dim", size]);
  event.tags.push(["format", format]);

  // sha256 fo resized image
  event.tags.push(["x", sha256]);

  event.tags.push(["expiration", String(dayjs().add(1, "day").unix())]);

  handleEvent(event);

  const result = await event.publish();
  return { event, result };
}

export async function forgetResizeResult(pubkey: string, url: string, size: Size, format: string) {
  const uid = getResizeUID(url, size, format);
  cache.delete(`${pubkey}|${uid}`);
}

export async function getResizeResult(pubkey: string, url: string, size: Size, format: string) {
  const uid = getResizeUID(url, size, format);
  const cacheKey = `${pubkey}|${uid}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const events = await ndk.fetchEvents([{ kinds: [RESIZE_IMAGE_KIND], "#u": [uid], "#p": [pubkey] }]);

  for (const event of events) handleEvent(event);

  return cache.get(cacheKey);
}

export async function hydrate() {
  logger(`Fetching events from relays`);
  const events = await ndk.fetchEvents([{ kinds: [RESIZE_IMAGE_KIND], authors: [getPublicKey(NOSTR_NSEC)] }]);

  for (const event of events) {
    handleEvent(event);
  }
  logger(`Loaded ${events.size} events`);
}
