#!/bin/env node
import "./polyfill.js";
import Koa from "koa";
import serve from "koa-static";
import path from "node:path";
import cors from "@koa/cors";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import HttpErrors from "http-errors";
import mime from "mime";

import logger from "./logger.js";
import { getProfilePointer } from "./helpers/nip19.js";
import ndk from "./ndk.js";
import { isHttpError } from "./helpers/error.js";
import sharp from "sharp";
import { getBufferFromURL } from "./helpers/http.js";
import { DEFAULT_SIZE } from "./env.js";

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
  const match = ctx.path.match(/^\/(npub1[a-z0-9]{58}|nprofile[a-z0-9]{40,})(\.(\w+))?/i);
  if (!match) return next();

  const [_, npub, _dot, ext] = match;
  const pointer = getProfilePointer(npub);

  const user = await ndk.getUser({ pubkey: pointer.pubkey, relayUrls: pointer.relays });
  if (!user.profile) {
    logger("Looking for user profile", pointer.pubkey);
    await user.fetchProfile();
  }
  if (!user.profile) throw new HttpErrors.InternalServerError("Failed to find user profile");

  const imageURL = user.profile!.image;
  if (!imageURL) throw new HttpErrors.InternalServerError("User does not have a picture");

  logger("Fetching image", imageURL);
  let image = sharp(await getBufferFromURL(imageURL), { animated: true });
  const metadata = await image.metadata();

  // resize
  const size = typeof ctx.query.size === "string" ? Math.max(Math.min(parseInt(ctx.query.size), 10), 6) : DEFAULT_SIZE;
  image = image.resize({ width: Math.pow(2, size), height: Math.pow(2, size), fit: "outside" });

  // convert
  let format = metadata.format;
  if (ext) logger(`Converting image to ${ext}`);
  switch (ext) {
    case "png":
      if (ext !== format) {
        image = image.png();
        format = ext;
      }
      break;
    case "jpg":
    case "jpeg":
      if (ext !== format) {
        image = image.jpeg();
        format = ext;
      }
      break;
    case "webp":
      if (ext !== format) {
        image = image.webp();
        format = ext;
      }
      break;
    case "gif":
      if (ext !== format) {
        image = image.gif();
        format = ext;
      }
      break;
  }

  // set content type header
  const type = format && mime.getType(format);
  if (type) ctx.set("Content-Type", type);

  ctx.status = 200;
  ctx.body = await image.toBuffer();
});

app.listen(process.env.PORT || 3000);
logger("Started app on port", process.env.PORT || 3000);

async function shutdown() {
  logger("Saving database...");
  process.exit(0);
}

process.addListener("SIGTERM", shutdown);
process.addListener("SIGINT", shutdown);
