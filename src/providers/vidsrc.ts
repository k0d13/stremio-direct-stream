import {
  flags,
  NotFoundError,
  type MovieScrapeContext,
  type ShowScrapeContext,
  type SourcererOutput,
} from "@p-stream/providers";

const VIDSRC = "https://vidsrcme.ru";

// The CDN hosts hang on requests without a browser-like UA.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * VidSrc doesn't need a browser — the click in a Playwright trace just fires
 * JS that walks this HTTP chain, which we reproduce directly with the fetcher:
 *
 *   1. embed page          -> iframe  //<rcpHost>/rcp/<hash>
 *   2. rcp/<hash>          -> src: '/prorcp/<id>'
 *   3. prorcp/<id>         -> `master_urls` string (has __TOKEN__ placeholders)
 *   4. https://<cdn>/generate.php -> JWT token, substituted into the url
 *
 * The token's JWT carries an `ip_cidr` (/24) claim, so the playlist only works
 * from the same /24 subnet that called generate.php — hence the IP_LOCKED flag.
 * That flag requires .enableConsistentIpForRequests() on the builder, else the
 * source is filtered out at build time.
 */
async function scrape(
  ctx: MovieScrapeContext | ShowScrapeContext,
  embedPath: string,
): Promise<SourcererOutput> {
  // 1. Embed page -> the rcp iframe URL.
  const embedHtml = await ctx.fetcher<string>(`${VIDSRC}${embedPath}`, {
    headers: { "user-agent": UA },
  });
  const rcpSrc = embedHtml.match(/src="(\/\/[^"]+\/rcp\/[^"]+)"/)?.[1];
  if (!rcpSrc) throw new NotFoundError("no rcp iframe on embed page");
  const rcpUrl = `https:${rcpSrc}`;
  const rcpHost = new URL(rcpUrl).origin;
  ctx.progress(30);

  // 2. rcp page -> the prorcp path.
  const rcpHtml = await ctx.fetcher<string>(rcpUrl, {
    headers: { referer: `${VIDSRC}/`, "user-agent": UA },
  });
  const proPath = rcpHtml.match(/src:\s*'(\/prorcp\/[^']+)'/)?.[1];
  if (!proPath) throw new NotFoundError("no prorcp path on rcp page");
  ctx.progress(55);

  // 3. prorcp page -> the master_urls string (may hold several " or "-joined
  //    candidates, each with its own token placeholder).
  const proHtml = await ctx.fetcher<string>(`${rcpHost}${proPath}`, {
    headers: { referer: `${rcpHost}/`, "user-agent": UA },
  });
  const masterUrls = proHtml.match(/master_urls\s*=\s*"([^"]+)"/)?.[1];
  if (!masterUrls) throw new NotFoundError("no master_urls on prorcp page");
  ctx.progress(75);

  // 4. Resolve the first candidate we can mint a token for.
  const playlist = await resolvePlaylist(ctx, masterUrls, rcpHost);
  if (!playlist) throw new NotFoundError("could not resolve a playlist token");
  ctx.progress(95);

  return {
    embeds: [],
    stream: [
      {
        id: "primary",
        type: "hls",
        playlist,
        flags: [flags.IP_LOCKED],
        // Replayed by the player so the CDN accepts segment requests.
        headers: { referer: `${rcpHost}/` },
        captions: [],
      },
    ],
  };
}

/**
 * Each candidate looks like `https://<cdn>/.../master.m3u8?token=__TOKEN__`
 * (or `__TOKENPG__`). We hit that cdn's generate.php for a token and splice
 * it in. Returns the first candidate that resolves.
 */
async function resolvePlaylist(
  ctx: MovieScrapeContext | ShowScrapeContext,
  masterUrls: string,
  referer: string,
): Promise<string | undefined> {
  for (const raw of masterUrls.split(" or ")) {
    const url = raw.trim();
    const placeholder = url.match(/__TOKEN[A-Z]*__/)?.[0];
    if (!placeholder) continue;
    try {
      const host = new URL(url).origin;
      const token = (
        await ctx.fetcher<string>(`${host}/generate.php`, {
          headers: { referer: referer + "/", "user-agent": UA },
        })
      ).trim();
      if (token) return url.replaceAll(placeholder, token);
    } catch {
      // try the next candidate
    }
  }
  return undefined;
}

export const vidsrcSource = {
  id: "vidsrc",
  name: "VidSrc 🔥",
  rank: 999,
  disabled: false,
  externalSource: false,
  flags: [flags.IP_LOCKED],
  type: "source" as const,
  mediaTypes: ["movie", "show"] as ("movie" | "show")[],

  scrapeMovie: (ctx: MovieScrapeContext) =>
    scrape(ctx, `/embed/movie?tmdb=${ctx.media.tmdbId}`),

  scrapeShow: (ctx: ShowScrapeContext) =>
    scrape(
      ctx,
      `/embed/tv?tmdb=${ctx.media.tmdbId}` +
        `&season=${ctx.media.season.number}&episode=${ctx.media.episode.number}`,
    ),
};
