import { MovieDb, ExternalId } from "moviedb-promise";
import type { ScrapeMedia } from "@p-stream/providers";
import type { ContentType } from "@stremio-addon/sdk";
import { config } from "./config.js";

const tmdb = new MovieDb(config.tmdbApiKey);

/**
 * Converts a Stremio id into the ScrapeMedia shape the provider library expects.
 *
 * Stremio ids come in two flavours:
 *   - IMDb:  `tt1234567`        (movie)   /  `tt1234567:1:5`  (series S1E5)
 *   - TMDB:  `tmdb:12345`       (movie)   /  `tmdb:12345:1:5` (series S1E5)
 */
export async function getScrapeMedia(
  type: ContentType,
  id: string,
): Promise<ScrapeMedia> {
  const parts = id.split(":");
  const isTmdb = parts[0] === "tmdb";
  const [ref, seasonStr, episodeStr] = isTmdb ? parts.slice(1) : parts;
  if (!ref) throw new Error(`Malformed Stremio id: ${id}`);

  if (type === "movie") {
    // Resolve to a numeric TMDB id, either directly or via IMDb lookup.
    const tmdbId = isTmdb
      ? Number(ref)
      : (await tmdb.find({ id: ref, external_source: ExternalId.ImdbId }))
          .movie_results?.[0]?.id;
    if (tmdbId === undefined) throw new Error(`No TMDB movie for ${id}`);

    const movie = await tmdb.movieInfo(tmdbId);
    return {
      type: "movie",
      title: movie.title ?? "",
      releaseYear: new Date(movie.release_date ?? "").getFullYear(),
      imdbId: isTmdb ? (movie.imdb_id ?? undefined) : ref,
      tmdbId: String(tmdbId),
    };
  }

  const seasonNumber = Number(seasonStr);
  const episodeNumber = Number(episodeStr);

  const showId = isTmdb
    ? Number(ref)
    : (await tmdb.find({ id: ref, external_source: ExternalId.ImdbId }))
        .tv_results?.[0]?.id;
  if (showId === undefined) throw new Error(`No TMDB show for ${id}`);

  const show = await tmdb.tvInfo(showId);
  const season = await tmdb.seasonInfo({
    id: showId,
    season_number: seasonNumber,
  });
  const episode = season.episodes //
    ?.find((e) => e.episode_number === episodeNumber);
  if (!episode)
    throw new Error(`No episode ${seasonNumber}x${episodeNumber} for ${id}`);

  // imdbId isn't on the show payload; only fetch it for the TMDB-id path
  // (the IMDb path already knows it from the id itself).
  const imdbId = isTmdb
    ? ((await tmdb.tvExternalIds(showId)).imdb_id ?? undefined)
    : ref;

  return {
    type: "show",
    title: show.name ?? "",
    releaseYear: new Date(show.first_air_date ?? "").getFullYear(),
    imdbId,
    tmdbId: String(showId),
    season: {
      number: season.season_number ?? seasonNumber,
      tmdbId: String(season.id),
      title: season.name ?? "",
      episodeCount: season.episodes?.length,
    },
    episode: {
      number: episode.episode_number ?? episodeNumber,
      tmdbId: String(episode.id),
    },
  };
}
