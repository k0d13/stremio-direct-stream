/**
 * Single source of truth for the addon's brand mark.
 *
 * The mark: a rounded play triangle with a motion trail streaming off its
 * left edge — playback, arriving directly. Monochrome orange on warm ink so
 * it reads as one glyph, not a pile of shapes. Shared by the manifest
 * (`logo`) and the install landing page so they never drift apart.
 * Everything is inline SVG / data URI, so there are no external asset
 * requests on any host.
 *
 * `assets/logo.svg` is a static export of the badge for the README (GitHub
 * strips data URIs) — update it when changing anything here.
 */

/** Brand palette. */
export const INK = "#12100c"; // near-black, warm
export const PAPER = "#efe8d8"; // warm off-white
export const ACCENT = "#ff4d00"; // international orange

/**
 * The glyph, drawn in a 0 0 256 256 viewBox. The triangle gets its rounded
 * corners from a wide round-joined stroke of the same color; the trail is
 * three pills that fade with distance, longest in the middle where the
 * triangle is widest. Geometry is nudged so the whole composition sits on
 * the optical center of the box.
 */
const TRIANGLE = `<path d="M124 90 L194 128 L124 166 z" fill="${ACCENT}" stroke="${ACCENT}" stroke-width="26" stroke-linejoin="round"/>`;
const TRAIL =
  `<rect x="52" y="120" width="44" height="16" rx="8" fill="${ACCENT}"/>` +
  `<rect x="70" y="94" width="26" height="16" rx="8" fill="${ACCENT}" opacity="0.55"/>` +
  `<rect x="70" y="146" width="26" height="16" rx="8" fill="${ACCENT}" opacity="0.55"/>`;

/** Just the glyph, transparent background — for placing on an existing surface. */
export const LOGO_MARK_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" aria-hidden="true">` +
  TRAIL +
  TRIANGLE +
  `</svg>`;

/** The full badge: rounded ink square + glyph. 256x256, per Stremio's spec. */
export const LOGO_BADGE_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">` +
  `<rect width="256" height="256" rx="58" fill="${INK}"/>` +
  TRAIL +
  TRIANGLE +
  `</svg>`;

/** The badge as a data URI, usable anywhere a URL is expected (manifest, favicon). */
export const LOGO_DATA_URI =
  "data:image/svg+xml," + encodeURIComponent(LOGO_BADGE_SVG);
