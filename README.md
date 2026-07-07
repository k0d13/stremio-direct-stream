## Direct Stream <a href='https://ko-fi.com/X8X554X28' target='_blank'>☕</a>

A Stremio addon that finds direct HTTP video streams for movies and series,
with separate entries per quality and subtitles when available.

It only supplies streams — titles, posters and catalogs come from Stremio's
built-in Cinemeta addon. Just add it, and streams show up on any movie or
series you open.

## Deploy your own

You'll need a free [TMDB](https://www.themoviedb.org/) API key (v3) — grab one
under TMDB → Settings → API. Set it as `TMDB_API_KEY` when prompted.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/k0d13/stremio-direct-stream&env=TMDB_API_KEY&envDescription=TMDB%20v3%20API%20key)
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/k0d13/stremio-direct-stream)

> Cloudflare support is experimental — some sources may not work there, and
> Vercel/Cloudflare both run from datacenter IPs that a few hosts block, so a
> hosted addon can return fewer streams than running it yourself.

After deploying, open `https://<your-deployment>/` to install it.

## Run with Docker

A prebuilt image is published to the GitHub Container Registry. Using the
included `docker-compose.yml`:

```sh
cp .env.example .env   # add your TMDB_API_KEY
docker compose up -d
```

**Portainer:** deploy the image `ghcr.io/k0d13/stremio-direct-stream`,
add `TMDB_API_KEY` under environment variables, and publish port `7000`.

The addon is then available at `http://<your-host>:7000/` to install.

> Devices other than the one running it can't reach `127.0.0.1`. To use a local
> addon elsewhere, expose it over HTTPS and install that URL.

## Notes

- Stream links are often time-signed and expire quickly, so responses aren't
  cached.
- This addon only points to streams — it hosts and torrents nothing itself.
