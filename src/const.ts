import { NDKKind } from "@nostr-dev-kit/ndk";

export enum Size {
  "32x32" = "32x32",
  "64x64" = "64x64",
  "96x96" = "96x96",
  "128x128" = "128x128",
  "512x512" = "512x512",
}

export const RESIZE_IMAGE_KIND = 1078 as NDKKind;
