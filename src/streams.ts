import type { RunOutput, ScrapeMedia } from "@p-stream/providers";
import { Parser } from "m3u8-parser";
import type { Stream } from "@stremio-addon/sdk";
import { providers } from "./providers.js";

/** Stop once we have this many working sources. */
const MAX_SOURCES = 3;
/**
 * How long we'll wait to find *any* working source. If nothing has succeeded by
 * now we give up and return empty.
 */
const DISCOVERY_MS = 30_000;
/**
 * Once we have at least one source, how long we keep collecting more before
 * returning. The timer resets on each new source, so a steady trickle keeps
 * gathering (up to MAX_SOURCES) while a lone hit returns soon after — this is
 * what stops us idling on slow/hung sources once we already have something.
 */
const SETTLE_MS = 6_000;
/** How many sources to scrape at once. */
const CONCURRENCY = 6;

export async function getStreams(media: ScrapeMedia): Promise<Stream[]> {
  const results = await runMultiSource(media);
  if (results.length === 0) return [];

  const streams: Stream[] = [];
  for (const result of results) {
    // Only the top quality from each source — one entry per working source.
    const provider = providerName(result);
    const perSource =
      result.stream.type === "file"
        ? fileStreams(result, provider)
        : await hlsStreams(result, provider);
    if (perSource[0]) streams.push(perSource[0]);
  }
  return streams;
}

/** Resolve a result's source/embed id (e.g. "vidlink") to its name ("Vidlink"). */
function providerName(result: RunOutput): string {
  const id = result.embedId ?? result.sourceId;
  return providers.getMetadata(id)?.name ?? id;
}

/** `[streams]`-prefixed logger with a millisecond stopwatch for run summaries. */
function makeLog(media: ScrapeMedia) {
  const start = Date.now();
  const elapsed = () => `${((Date.now() - start) / 1000).toFixed(1)}s`;
  const title = `"${media.title}" (${media.type})`;
  return {
    elapsed,
    start: (n: number) =>
      console.log(`[streams] ${title}: scraping ${n} sources`),
    hit: (result: RunOutput, n: number) =>
      console.log(
        `[streams] ${title}: ${providerName(result)} ${result.stream.type} ` +
          `[${n}/${MAX_SOURCES}] (${elapsed()})`,
      ),
    done: (results: RunOutput[], reason: string) => {
      if (results.length === 0) {
        console.warn(
          `[streams] ${title}: no working source after ${elapsed()} (${reason})`,
        );
        return;
      }
      const names = results.map(providerName).join(", ");
      console.log(
        `[streams] ${title}: ${results.length} source(s) in ${elapsed()} ` +
          `(${reason}) — ${names}`,
      );
    },
  };
}

/**
 * Scrape sources concurrently and collect the first working ones. `runAll`
 * only ever returns a single source's streams, and the top-ranked source is
 * frequently dead — so instead we gather up to MAX_SOURCES working sources and
 * surface one quality from each, giving Stremio several fallbacks to try.
 */
async function runMultiSource(media: ScrapeMedia): Promise<RunOutput[]> {
  const log = makeLog(media);
  const sources = providers
    .listSources()
    .filter((s) => s.mediaTypes?.includes(media.type) ?? true)
    .sort((a, b) => b.rank - a.rank);
  log.start(sources.length);

  const results: RunOutput[] = [];

  return new Promise<RunOutput[]>((resolve) => {
    let done = false;
    let index = 0;
    let active = 0;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;

    // Why the run ended — surfaced in the summary log.
    const finish = (reason: string) => {
      if (done) return;
      done = true;
      clearTimeout(discoveryTimer);
      clearTimeout(settleTimer);
      const out = results.slice(0, MAX_SOURCES);
      log.done(out, reason);
      resolve(out);
    };

    const check = () => {
      if (results.length >= MAX_SOURCES) return finish("target reached");
      // Ran out of sources with nothing (more) to wait on.
      if (index >= sources.length && active === 0) return finish("exhausted");
    };

    const onResult = (out: RunOutput | null) => {
      if (!out) return;
      results.push(out);
      log.hit(out, results.length);
      // (Re)start the settle window: once we have something, we only wait a
      // little longer for stragglers rather than the full discovery timeout.
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => finish("settle window"), SETTLE_MS);
    };

    // Backstop: if nothing succeeds at all, give up after the discovery window.
    const discoveryTimer = setTimeout(() => finish("timed out"), DISCOVERY_MS);

    const launchNext = () => {
      if (done || index >= sources.length) {
        check();
        return;
      }
      const source = sources[index++]!;
      active++;
      resolveSource(media, source.id)
        .then(onResult)
        .finally(() => {
          active--;
          check();
          launchNext();
        });
    };

    if (sources.length === 0) return finish("no sources");
    for (let i = 0; i < Math.min(CONCURRENCY, sources.length); i++) {
      launchNext();
    }
  });
}

/**
 * Resolve a single source to one working stream, mirroring `runAll`'s per-source
 * logic: take a direct stream if the source produced one, otherwise walk its
 * embeds until one yields a playable stream. Returns null if the source is dead.
 */
async function resolveSource(
  media: ScrapeMedia,
  id: string,
): Promise<RunOutput | null> {
  try {
    const output = await providers.runSourceScraper({ media, id });
    if (output.stream?.[0]) {
      return { sourceId: id, stream: output.stream[0] };
    }
    for (const embed of output.embeds) {
      try {
        const embedOutput = await providers.runEmbedScraper({
          url: embed.url,
          id: embed.embedId,
        });
        if (embedOutput.stream[0]) {
          return {
            sourceId: id,
            embedId: embed.embedId,
            stream: embedOutput.stream[0],
          };
        }
      } catch {
        // Embed failed — try the next one.
      }
    }
  } catch {
    // Source failed entirely — treat as dead.
  }
  return null;
}

/** One Stremio entry per quality in a direct-file (mp4) stream. */
function fileStreams(result: RunOutput, provider: string): Stream[] {
  if (result.stream.type !== "file") return [];
  const { qualities } = result.stream;

  return Object.entries(qualities)
    .sort(([a], [b]) => qualityRank(b) - qualityRank(a))
    .map(([quality, file]) =>
      toStream(result, provider, {
        url: file.url,
        label: prettyQuality(quality),
      }),
    );
}

/**
 * HLS streams point at an m3u8. We fetch and parse it: a *master* playlist
 * lists variant streams (one per quality), each with its own media-playlist
 * URI relative to the master — so we resolve those and emit one entry each.
 * A bare *media* playlist has no variants, so it becomes a single entry.
 */
async function hlsStreams(
  result: RunOutput,
  provider: string,
): Promise<Stream[]> {
  if (result.stream.type !== "hls") return [];
  const playlistUrl = result.stream.playlist;

  const res = await fetch(playlistUrl, { headers: allHeaders(result.stream) });
  const parser = new Parser();
  parser.push(await res.text());
  parser.end();

  const variants = parser.manifest.playlists ?? [];
  if (variants.length === 0) {
    return [
      toStream(result, provider, {
        url: playlistUrl,
        label: "Auto",
        hls: true,
      }),
    ];
  }

  return variants
    .sort(
      (a, b) =>
        (b.attributes.RESOLUTION?.height ?? 0) -
        (a.attributes.RESOLUTION?.height ?? 0),
    )
    .map((variant) =>
      toStream(result, provider, {
        url: new URL(variant.uri, playlistUrl).toString(),
        label: variant.attributes.RESOLUTION
          ? prettyQuality(String(variant.attributes.RESOLUTION.height))
          : "Auto",
        hls: true,
      }),
    );
}

/** Build a single Stremio Stream, wiring in headers, subtitles and hints. */
function toStream(
  result: RunOutput,
  provider: string,
  opts: { url: string; label: string; hls?: boolean },
): Stream {
  const headers = allHeaders(result.stream);

  return {
    url: opts.url,
    description: `${provider} (${opts.label})`,
    subtitles: result.stream.captions.map((c) => ({
      id: c.id,
      url: c.url,
      lang: c.language,
    })),
    behaviorHints: {
      // hls (and any stream needing headers) can't be played as a plain mp4.
      notWebReady: opts.hls || Object.keys(headers).length > 0,
      bingeGroup: `${provider}-${opts.label}`,
      // proxyHeaders: headers Stremio replays on the playback request.
      ...(Object.keys(headers).length > 0 && {
        proxyHeaders: { request: headers },
      }),
    },
  };
}

const allHeaders = (stream: RunOutput["stream"]): Record<string, string> => ({
  ...stream.headers,
  ...stream.preferredHeaders,
});

const QUALITY_ORDER = ["unknown", "360", "480", "720", "1080", "1440", "4k"];
const qualityRank = (q: string) => QUALITY_ORDER.indexOf(normalizeQuality(q));

/** Map a raw quality key or pixel height to a standard quality bucket. */
function normalizeQuality(q: string): string {
  const n = Number(q);
  if (!Number.isNaN(n)) {
    if (n >= 2160) return "4k";
    if (n >= 1440) return "1440";
    if (n >= 1080) return "1080";
    if (n >= 720) return "720";
    if (n >= 480) return "480";
    if (n >= 360) return "360";
  }
  return q === "4k" ? "4k" : q;
}

const prettyQuality = (q: string): string => {
  const bucket = normalizeQuality(q);
  return bucket === "4k" ? "4K" : bucket === "unknown" ? "Auto" : `${bucket}p`;
};
