import type { RunOutput, ScrapeMedia } from "@p-stream/providers";
import { Parser } from "m3u8-parser";
import type { Stream } from "@stremio-addon/sdk";
import { providers } from "./providers.js";

export async function getStreams(media: ScrapeMedia): Promise<Stream[]> {
  const result = await providers.runAll({ media });
  if (!result) {
    console.warn(`[streams] no provider produced a stream for "${media.title}"`);
    return [];
  }

  // Resolve the source/embed id (e.g. "vidlink") to its pretty name ("Vidlink").
  const id = result.embedId ?? result.sourceId;
  const provider = providers.getMetadata(id)?.name ?? id;
  console.log(`[streams] "${media.title}" matched ${provider} (${result.stream.type})`);

  return result.stream.type === "file"
    ? fileStreams(result, provider)
    : await hlsStreams(result, provider);
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
