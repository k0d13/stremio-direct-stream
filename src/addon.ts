import { AddonBuilder, type Manifest } from "@stremio-addon/sdk";
import { getScrapeMedia } from "./tmdb.js";
import { getStreams } from "./streams.js";
import { LOGO_DATA_URI } from "./logo.js";

const manifest: Manifest = {
  id: "community.directstream",
  version: "0.0.1",
  name: "Direct Stream",
  description: "Direct HTTP streams for movies and series.",
  logo: LOGO_DATA_URI,
  // Stream-only: meta, posters and catalogs come from Cinemeta.
  resources: ["stream"],
  types: ["movie", "series"],
  // Only invoked for IMDb ids (Cinemeta's default) and TMDB-prefixed ids.
  idPrefixes: ["tt", "tmdb:"],
  catalogs: [],
};

const builder = new AddonBuilder(manifest);

builder.defineStreamHandler(async ({ type, id }) => {
  const started = Date.now();
  console.log(`[stream] ${type} ${id} requested`);

  try {
    const media = await getScrapeMedia(type, id);
    const streams = await getStreams(media);
    const ms = Date.now() - started;
    console.log(`[stream] ${type} ${id} -> ${streams.length} streams (${ms}ms)`);
    return { maxAgeCache: 60, streams };
  } catch (err) {
    // Stremio expects a resolved promise — swallow and return nothing.
    console.error(`[stream] ${type} ${id} failed:`, err);
    return { streams: [] };
  }
});

/** Shared addon interface, consumed by both the Bun server and serverless entries. */
export const addonInterface = builder.getInterface();
