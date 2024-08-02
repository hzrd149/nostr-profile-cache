#!/bin/env node
import "./polyfill.js";
import Koa from "koa";
import serve from "koa-static";
import path, { extname } from "node:path";
import cors from "@koa/cors";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import HttpErrors from "http-errors";
import sharp from "sharp";
import mime from "mime";

import logger from "./logger.js";
import { getProfilePointer } from "./helpers/nip19.js";
import ndk, { signEventTemplate } from "./ndk.js";
import { isHttpError } from "./helpers/error.js";
import { getBufferFromURL } from "./helpers/http.js";
import { BLOSSOM_SERVERS, DEFAULT_SIZE } from "./env.js";
import { forgetResizeResult, getResizeResult, hydrate, saveResizeResult as publishResizeResult } from "./state.js";
import { getSha256 } from "./helpers/crypto.js";
import storage, { getBlob } from "./storage.js";
import { Size } from "./const.js";
import { getTagValue } from "./helpers/nostr.js";
import { BlossomClient } from "blossom-client-sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = new Koa();

// set CORS headers
app.use(
  cors({
    origin: "*",
    allowMethods: "*",
    allowHeaders: "*",
    exposeHeaders: "*",
  }),
);

// handle errors
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    if (isHttpError(err)) {
      const status = (ctx.status = err.status || 500);
      if (status >= 500) console.error(err.stack);
      ctx.body = status > 500 ? { message: "Something went wrong" } : { message: err.message };
    } else {
      console.log(err);
      ctx.status = 500;
      ctx.body = { message: "Something went wrong" };
    }
  }
});

// serve public dir
try {
  const www = path.resolve(process.cwd(), "public");
  fs.statSync(www);
  app.use(serve(www));
} catch (error) {
  const www = path.resolve(__dirname, "../public");
  app.use(serve(www));
}

// resize profile picture
app.use(async (ctx, next) => {
  const match = ctx.path.match(/^\/(npub1[a-z0-9]{58}|nprofile[a-z0-9]{40,})/i);
  if (!match) return next();

  const ext = extname(ctx.path).replace(/^\./, "");
  const [_, npub] = match;
  const pointer = getProfilePointer(npub);

  // fetch user
  const user = await ndk.getUser({ pubkey: pointer.pubkey, relayUrls: pointer.relays });
  if (!user.profile) await user.fetchProfile();
  if (!user.profile) throw new HttpErrors.InternalServerError("Failed to find user profile");

  const imageURL: string | undefined = user.profile!.image || String(user.profile.picture);
  if (!imageURL) throw new HttpErrors.InternalServerError("User does not have a picture");

  logger(imageURL, mime.getType(imageURL));

  const imageExt = extname(new URL(imageURL).pathname).replace(/^\./, "");

  // get size from query param
  let size = typeof ctx.query.size === "string" ? ctx.query.size : Size["128x128"];

  // if the size is not supported. override with 128x128
  if (!Object.keys(Size).includes(size)) {
    logger(`Unsupported size ${size}, defaulting to 128x128`);
    size = Size["128x128"];
  }

  // get format
  let format = ext || imageExt || "png";

  // look for cached results
  const cached = await getResizeResult(pointer.pubkey, imageURL, size as Size, format);

  // return cached result
  if (cached) {
    const sha256 = getTagValue(cached, "x");
    if (sha256) {
      const blob = await getBlob(sha256);
      if (blob) {
        const type = mime.getType(format);
        ctx.status = 200;
        if (type) ctx.set("Content-Type", type);
        ctx.body = blob;
        return;
      } else {
        // cant find blob, forget about the cache entry
        forgetResizeResult(pointer.pubkey, imageURL, size as Size, format);
      }
    }
  }

  logger("Fetching image", imageURL);
  let image = sharp(await getBufferFromURL(imageURL), { animated: true });

  const metadata = await image.metadata();
  // if no format is specified
  if (format === "") format = metadata.format ?? "png";

  // resize image
  const [width, height] = size.split("x").map((v) => parseInt(v));
  image = image.resize({ width, height, fit: "cover" });

  // convert
  if (format !== imageExt) logger(`Converting image to ${ext}`);
  switch (ext) {
    case "png":
      image = image.png();
      break;
    case "jpg":
    case "jpeg":
      image = image.jpeg();
      break;
    case "webp":
      image = image.webp();
      break;
    case "gif":
      image = image.gif();
      break;
  }

  // set content type header
  const type = format && mime.getType(format);
  if (type) ctx.set("Content-Type", type);

  const buffer = await image.toBuffer();

  ctx.status = 200;
  ctx.body = buffer;

  // save image
  const sha256 = getSha256(buffer);

  // saving blob
  if (!(await storage.hasBlob(sha256))) await storage.writeBlob(sha256, buffer, type || format);

  // save resize
  await publishResizeResult(pointer.pubkey, imageURL, size as Size, format, sha256);

  // upload blob
  const auth = await BlossomClient.createUploadAuth(
    sha256,
    signEventTemplate,
    `Upload profile image for ${pointer.pubkey}`,
  );
  for (const server of BLOSSOM_SERVERS) {
    // don't wait for the upload
    BlossomClient.uploadBlob(server, buffer, auth).catch((err) => {
      logger("Failed to upload blob", sha256, "to", server.toString(), err);
    });
  }
});

app.listen(process.env.PORT || 3000);
logger("Started app on port", process.env.PORT || 3000);

hydrate();

async function shutdown() {
  process.exit(0);
}

process.addListener("SIGTERM", shutdown);
process.addListener("SIGINT", shutdown);
