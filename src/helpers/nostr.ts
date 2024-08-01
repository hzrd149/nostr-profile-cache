import { NDKEvent } from "@nostr-dev-kit/ndk";

export function getTagValue(event: NDKEvent, name: string) {
  return event.tags.find((t) => t[0] === name && t[1])?.[1];
}
