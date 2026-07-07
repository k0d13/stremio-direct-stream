import type { Manifest } from "@stremio-addon/sdk";
import { LOGO_DATA_URI, LOGO_MARK_SVG } from "./logo.js";

const TYPE_LABELS: Record<string, string> = {
  movie: "Movies",
  series: "Series",
  tv: "Live TV",
  channel: "Channels",
};

/**
 * The install page served at `/`. Cinematic and warm: near-black room, a
 * faint projector glow, a big serif headline, soft rounded shapes and one
 * orange accent. Fully self-contained (system fonts, inline SVG only) so it
 * renders identically on Bun, Vercel and Cloudflare.
 * Title/version/description/tags come from the manifest.
 */
export function landingPage(manifest: Manifest): string {
  const tags = (manifest.types ?? [])
    .map((t) => TYPE_LABELS[t] ?? t)
    .map((label) => `<li>${label}</li>`)
    .join("");

  // Set the last word of the name in italic — "Direct Stream" reads as
  // "Direct <i>Stream</i>". Falls back gracefully for one-word names.
  const words = manifest.name.split(" ");
  const last = words.pop();
  const title = words.length
    ? `${words.join(" ")} <i>${last}</i>`
    : `<i>${last}</i>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="description" content="${manifest.description}" />
<meta name="color-scheme" content="dark" />
<link rel="icon" href="${LOGO_DATA_URI}" />
<title>${manifest.name} · Stremio Addon</title>
<style>
  :root {
    --ink: #12100c;
    --ink-2: #1b1812;
    --paper: #efe8d8;
    --muted: #9a927f;
    --faint: #6b6455;
    --accent: #ff4d00;
    --hairline: rgba(239, 232, 216, 0.12);
    --serif: ui-serif, "Iowan Old Style", Georgia, "Times New Roman", serif;
    --sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  ::selection { background: var(--accent); color: var(--ink); }
  body {
    margin: 0;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background:
      radial-gradient(90% 55% at 50% -10%, rgba(255, 77, 0, 0.13), transparent 70%),
      var(--ink);
    color: var(--paper);
    font-family: var(--sans);
    line-height: 1.6;
    text-align: center;
  }
  .frame {
    width: 100%;
    max-width: 620px;
    margin: auto;
    padding: clamp(32px, 7vh, 72px) clamp(20px, 5vw, 40px);
  }
  .badge {
    width: clamp(56px, 14vw, 72px);
    height: clamp(56px, 14vw, 72px);
    margin: 0 auto clamp(20px, 4vh, 32px);
    border-radius: 24%;
    overflow: hidden;
    background: var(--ink-2);
    border: 1px solid var(--hairline);
    box-shadow: 0 18px 50px -18px rgba(255, 77, 0, 0.35);
  }
  .badge svg { display: block; width: 100%; height: 100%; }
  .eyebrow {
    margin: 0 0 14px;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--faint);
  }
  h1 {
    margin: 0;
    font-family: var(--serif);
    font-weight: 500;
    font-size: clamp(2.6rem, 10vw, 4.2rem);
    line-height: 1.05;
    letter-spacing: -0.015em;
    text-wrap: balance;
  }
  h1 i { font-style: italic; color: var(--accent); }
  .desc {
    margin: clamp(16px, 3vh, 24px) auto 0;
    max-width: 42ch;
    color: var(--muted);
    font-size: clamp(0.95rem, 3.4vw, 1.05rem);
  }
  ul.tags {
    list-style: none;
    display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;
    padding: 0;
    margin: clamp(18px, 3.5vh, 28px) 0 0;
  }
  ul.tags li {
    font-size: 0.78rem;
    letter-spacing: 0.04em;
    color: var(--muted);
    padding: 6px 16px;
    border: 1px solid var(--hairline);
    border-radius: 999px;
  }
  .actions { margin-top: clamp(32px, 6vh, 52px); }
  .install {
    display: inline-flex; align-items: center; justify-content: center; gap: 10px;
    min-width: min(100%, 320px);
    padding: 16px 34px;
    border-radius: 999px;
    background: var(--accent);
    color: #16100b;
    font-size: 1.02rem;
    font-weight: 650;
    letter-spacing: 0.01em;
    text-decoration: none;
    box-shadow: 0 14px 40px -12px rgba(255, 77, 0, 0.55);
    transition: transform 150ms ease, box-shadow 150ms ease;
  }
  /* Optically align the glyph with the text: lowercase-heavy text sits low
     in its line box, so a geometrically centered icon reads as too high.
     Em-based so the correction survives zoom and DPI changes. */
  .install svg { width: 1em; height: 1em; flex-shrink: 0; margin-top: 0.24em; }
  .install:hover {
    transform: translateY(-2px);
    box-shadow: 0 20px 50px -12px rgba(255, 77, 0, 0.7);
  }
  .install:active { transform: translateY(0); }
  .install:focus-visible,
  .web:focus-visible,
  .manifest button:focus-visible { outline: 2px solid var(--paper); outline-offset: 3px; }
  .web {
    display: block;
    margin-top: 18px;
    color: var(--muted);
    font-size: 0.88rem;
    text-decoration: underline;
    text-underline-offset: 4px;
    text-decoration-color: var(--hairline);
  }
  .web:hover { color: var(--paper); text-decoration-color: var(--accent); }

  .manifest-block { margin-top: clamp(40px, 7vh, 64px); }
  .manifest-label {
    display: flex; align-items: center; gap: 14px;
    margin: 0 0 14px;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: var(--faint);
  }
  .manifest-label::before,
  .manifest-label::after {
    content: ""; flex: 1; height: 1px; background: var(--hairline);
  }
  .manifest {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 6px 6px 18px;
    background: var(--ink-2);
    border: 1px solid var(--hairline);
    border-radius: 999px;
  }
  .manifest code {
    flex: 1; min-width: 0;
    font-family: var(--sans);
    font-size: 0.82rem;
    color: var(--muted);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    text-align: left;
  }
  .manifest button {
    flex-shrink: 0;
    min-width: 5em;
    border: 0;
    border-radius: 999px;
    padding: 9px 18px;
    background: rgba(239, 232, 216, 0.1);
    color: var(--paper);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 150ms ease, color 150ms ease;
  }
  .manifest button:hover { background: var(--paper); color: var(--ink); }
  .hint { margin: 14px 0 0; font-size: 0.78rem; color: var(--faint); }

  footer {
    margin-top: clamp(40px, 7vh, 64px);
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    color: var(--faint);
  }
  footer .dot { color: var(--accent); margin: 0 6px; }
  @media (prefers-reduced-motion: reduce) {
    .install, .manifest button { transition: none; }
    .install:hover { transform: none; }
  }
</style>
</head>
<body>
  <div class="frame">
    <div class="badge" aria-hidden="true">${LOGO_MARK_SVG}</div>

    <main>
      <p class="eyebrow">Stremio Addon</p>
      <h1>${title}</h1>
      <p class="desc">${manifest.description}</p>
      <ul class="tags">${tags}</ul>

      <div class="actions">
        <a class="install" id="install">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5a1 1 0 0 1 1.52-.85l10 6.5a1 1 0 0 1 0 1.7l-10 6.5A1 1 0 0 1 8 18.5v-13z"/></svg>
          Install in Stremio
        </a>
        <a class="web" id="installWeb" target="_blank" rel="noopener">or open in Stremio Web &nearr;</a>
      </div>

      <div class="manifest-block">
        <p class="manifest-label">Manifest URL</p>
        <div class="manifest">
          <code id="manifestUrl"></code>
          <button id="copy" type="button">Copy</button>
        </div>
        <p class="hint">Button not working? Paste the URL into Stremio &rarr; Addons.</p>
      </div>
    </main>

    <footer>v${manifest.version}<span class="dot">&middot;</span>${manifest.id}</footer>
  </div>

  <script>
    // Install links, built from the current location so they work on any host.
    var manifestUrl = location.origin + "/manifest.json";
    document.getElementById("manifestUrl").textContent = manifestUrl;
    document.getElementById("install").href = "stremio://" + manifestUrl.split("://")[1];
    document.getElementById("installWeb").href =
      "https://web.stremio.com/#/addons?addon=" + encodeURIComponent(manifestUrl);

    var copyBtn = document.getElementById("copy");
    copyBtn.addEventListener("click", function () {
      navigator.clipboard.writeText(manifestUrl).then(
        function () { copyBtn.textContent = "Copied"; },
        function () { copyBtn.textContent = "Failed"; }
      );
      setTimeout(function () { copyBtn.textContent = "Copy"; }, 1500);
    });
  </script>
</body>
</html>`;
}
