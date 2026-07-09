# NoiseMap Aklima

Acoustic noise calculator for HVAC outdoor units on a map. Uses
**ISO 9613-2** for outdoor sound propagation and OpenStreetMap for building
geometry (no Google Maps).

## What it does

1. Search an address (Photon API) or pan the map to a location.
2. Load nearby building footprints and heights from OSM (Overpass API).
3. Place noise sources (heat pumps, VRF, chillers, splits) from the equipment
   catalogue with mounting height and directivity (free / wall / corner).
4. Auto-generate façade receivers at 1.5 m and 4.5 m on protected buildings.
5. Compute Lp(A) per receiver via ISO 9613-2 in a Web Worker: Adiv, Aatm,
   Agr (§7.3.2 alternative), Abar (§7.4), DI, energy summation across sources.
6. Draw a noise grid and isolines (35 / 40 / 45 / 50 / 55 / 60 dBA).
7. Score every receiver against PL / UA night & day limits with a coloured
   status badge.
8. Export a PDF report (map screenshot + inputs + results + methodology +
   ±3 dB disclaimer).

## Tech stack

- **React 18** + **TypeScript** + **Vite**
- **MapLibre GL JS** with OpenFreeMap tiles (`tiles.openfreemap.org/styles/liberty`)
- **Zustand** for state
- **@turf/turf** for isolines and geometry helpers
- **Web Worker** for the ISO 9613-2 grid calculation
- **pdf-lib** + **html-to-image** for client-side PDF export
- **i18next** / **react-i18next** for PL / UA / EN
- Optional **Supabase** for saving projects (falls back to localStorage)

## Local development

Requires **Node 20+**.

```bash
npm install
npm run dev          # start Vite on http://localhost:5173
npm test             # run vitest engine tests
npm run type-check   # tsc --noEmit
npm run build        # production bundle to dist/
```

Optional environment for cloud project saving:

```bash
# .env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Without these variables, projects are saved to browser `localStorage`.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import into Vercel and select the repository.
3. Framework preset: **Vite**. Build command: `npm run build`. Output: `dist`.
4. (Optional) Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in
   Vercel → Settings → Environment Variables.

## Project structure

```
src/
├── engine/           ISO 9613-2 physics (pure functions + Web Worker)
│   ├── spectrum.ts   Octave-band helpers, A-weighting, DI
│   ├── geometry.ts   Ray casting, path difference δ, local ENU projection
│   ├── iso9613.ts    Adiv / Aatm / Agr / Abar / calcLpA
│   ├── receivers.ts  Auto-façade receivers around protected buildings
│   ├── noisegrid.ts  Grid sampling for isoline generation
│   ├── isolines.ts   turf.js isoline wrapper
│   ├── worker.ts     Web Worker entrypoint
│   └── types.ts      Domain types
├── components/       React UI (Map / Sidebar / Results / PDF)
├── services/         overpass.ts, photon.ts, supabase.ts
├── store/            Zustand state
├── i18n/             PL / UA / EN translations
├── data/             equipment.json, norms.json
└── types/            Shared TS types
tests/engine/         Vitest unit tests
.github/workflows/    CI (type-check + tests + build on every push)
```

## Calculation notes

For every source→receiver pair, per octave (63 – 8 000 Hz):

```
Lp(f) = Lw(f) + DI − Adiv − Aatm(f) − Agr − Abar(f)
```

- `Adiv = 20·log10(d) + 11` (§7.1, point source)
- `Aatm(f)` from ISO 9613-1 Annex D at **10 °C / 70 % RH**
- `Agr` from §7.3.2 alternative method, ground factor `G` configurable
  (0 = asphalt, 1 = grass)
- `Abar(f) = 10·log10(3 + (C₂/λ)·δ)`, capped at 20 dB per band (§7.4)
- `DI = 10·log10(Q)`, with Q = 2 / 4 / 8 for free / wall / corner
- Multiple identical units: `+10·log10(n)`
- Sources are energy-summed: `Lp,tot = 10·log10(Σ 10^(Lp,i/10))`

Expected accuracy of ISO 9613-2: **±3 dB** in the near range, degrading
with distance and complex meteorology (see standard, clause 9).

## Licence

Building geometry is © OpenStreetMap contributors under
[ODbL](https://opendatacommons.org/licenses/odbl/). Attribution is included
in the map by MapLibre GL JS. Do **not** substitute Google Maps for building
outlines — their licence forbids reuse.
