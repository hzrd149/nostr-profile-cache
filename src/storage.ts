import { LocalStorage } from "blossom-server-sdk";
import { BlossomClient } from "blossom-client-sdk";

import { BLOSSOM_SERVERS, DATA_DIR } from "./env.js";

const storage = new LocalStorage(DATA_DIR);
await storage.setup();

export async function getBlob(sha256: string) {
  if (await storage.hasBlob(sha256)) return storage.readBlob(sha256);

  for (const server of BLOSSOM_SERVERS) {
    if (await BlossomClient.hasBlob(server, sha256)) {
      const blob = await BlossomClient.getBlob(server, sha256);
      const buffer = Buffer.from(await blob.arrayBuffer());
      await storage.writeBlob(sha256, buffer);
      return buffer;
    }
  }
}

export default storage;
