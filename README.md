# Keycap Konfigurator (standalone)

A fully static, client-side keycap configurator extracted from the ControlPad
website. Pick a symbol, colors, scale/rotation/depth, preview it on a 3D keycap,
and **export a print-ready `.3mf`** — everything runs in the browser, nothing is
uploaded or stored on a server.

## How it works

- **3D preview** — `three` + `@react-three/fiber` render the keycap STL with the
  engraved symbol live.
- **`.3mf` export** — the symbol SVG is extruded, CSG-subtracted from the keycap
  body (`three-bvh-csg`), and zipped into a Bambu Studio-compatible `.3mf`
  (`jszip`) with two parts (body + inlay) for multi-material printing. This is a
  browser port of the original server-side Node script — `jsdom` and `fs` were
  the only server dependencies and are replaced by the browser's native
  `DOMParser` and `fetch`.
- **Icons** — Tabler icons (outline + filled) are copied from the `@tabler/icons`
  npm package into `public/icons/` by `scripts/sync-icons.mjs` (runs
  automatically before `dev`/`build`). You can also upload your own SVG.
- **Config** — colors, icon variants, and pricing are hardcoded in
  `src/config/keycap.ts` (extracted from the original backend seeder).

## Develop

```bash
npm install
npm run dev      # http://localhost:5173  (syncs icons first)
npm run build    # outputs static site to dist/
npm run preview  # serve the production build locally
```

The keycap model lives at `public/keycap.stl`. Replace it to change the base
keycap shape.

## Deploy to GitHub Pages

A workflow is included at `.github/workflows/deploy.yml`:

1. Push this repo to GitHub.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main` — the site builds and deploys automatically.

The build sets the Vite `base` path to `/<repo>/` for project pages. If you host
it on a user/org page (`<user>.github.io`), change `VITE_BASE` in the workflow to
`/`.

All asset URLs (STL, icons) respect `import.meta.env.BASE_URL`, so the site works
correctly under a subpath.
