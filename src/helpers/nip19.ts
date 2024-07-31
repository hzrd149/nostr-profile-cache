import * as nip19 from "nostr-tools/nip19";

export function getProfilePointer(value: string) {
  const pointer = nip19.decode(value);

  switch (pointer.type) {
    case "npub":
      return { pubkey: pointer.data as string, relays: [] };
    case "nprofile":
      return pointer.data;
    default:
      throw new Error(`Unknown type ${pointer.type}`);
  }
}
