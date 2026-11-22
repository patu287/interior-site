# Maison Arc — Interior Architecture

A scroll-driven interior design studio website. The hero scrubs a 192-frame
video sequence (empty plaster room → candle-lit furnished room) as you scroll.

## Run it

No build step. Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

(A local server is recommended — opening the file directly with `file://`
works in most browsers but some block local font/canvas requests.)

## Structure

```
index.html          markup
styles.css          all styling (design tokens in :root)
app.js              frame scrub, reveals, rail, object tilt, cursor, menu, audio
frames/             192 WebP frames (f000 → f191) used by the hero canvas
assets/
  rooms/            project + journal photography (rounded frames)
  cut/              14 transparent furniture/plant cutouts (WebP w/ alpha)
  fonts/            self-hosted Cormorant Garamond + Inter (woff2, subset)
audio/ambient.wav   procedural ambient pad for the Sound toggle
```

## Sections

1. **Hero** — scroll-scrubbed 192-frame sequence, three caption beats.
2. **Manifesto** — split-word reveal, studio photo in a rounded frame, counters.
3. **Selected Work** — horizontal snap rail with drag, wheel and arrow controls.
4. **Object Library** — 14 cutout pieces on dark glass tiles; hover tilts them in
   3D, lights them from the pointer and reveals a caption.
5. **Approach** — arched image, accordion services.
6. **Process** — sticky heading, progress bar, dimmed-inactive steps.
7. **Journal** — three notes with rounded/arched thumbnails.
8. **Enquire** — CTA, floating cutout strip, footer grid.

## Objects

Cutouts live in `assets/cut/*.webp` (transparent). To swap one, replace the
file with another transparent PNG/WebP of the same name — no CSS changes
needed. Tiles are sized by grid spans: add `obj--wide` or `obj--tall` to a
`figure.obj` to change its footprint.

## Deploying

Any static host works — Vercel, Netlify, Cloudflare Pages, GitHub Pages,
S3/R2. Upload the folder as-is; there is no build command and no
dependencies.

One note: `frames/` is ~17 MB. On a fast CDN that is fine, but if you want
a snappier first paint, lazy-load frames after the first 20 in `app.js`
(`preload()`), or convert the sequence to a real MP4 and scrub a `<video>`
element's `currentTime` instead.

## Tweaking the hero

- **Scroll length** — `styles.css`, `.hero { height: 1300vh }`
  (mobile override: `@media (max-width: 760px) { .hero { height: 1100vh } }`).
  Larger = slower reveal.
- **Frame count** — `app.js`, `const FRAMES = 192;` (keep in sync with the
  files in `frames/` and the `/ 192` counter in `index.html`).
- **Caption timing** — `app.js`, the `windows` array in `updateHero()`.
  Values are 0–1 progress across the hero.
- **Copy / sections** — edit `index.html` directly. The studio name,
  projects and contact details are placeholders.
- **Rail speed / card width** — `.card { flex: 0 0 clamp(280px,38vw,520px) }`
  in `styles.css`.
- **Rounded corners** — `--r-sm / --r / --r-lg / --r-xl` in `:root`, plus
  `.shot--arch` for the arch-top frames.
- **Shadows** — `--shadow-soft / --shadow-lift / --shadow-deep /
  --shadow-object` in `:root`.

## Accessibility / performance notes

- `prefers-reduced-motion` is respected: animations collapse and the hero
  renders a single still frame.
- The custom cursor is disabled on touch devices.
- Audio is muted by default and only starts on user click.
