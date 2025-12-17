# Baldwin Hills 6‑Mile Corridor Initiative (Web)

This repository contains a React + Vite web experience for the **Baldwin Hills 6‑Mile Corridor Initiative**.

The site is a single-page experience with multiple sections (Overview, Challenges, Solutions, Community, Map, Sources, Contact). It includes an interactive **Mapbox** map and a **CSV overlay** option to visualize point data (lat/lon) as a heatmap.

## Project structure

- `react-demo/` — Vite + React app
  - `src/App.jsx` — main UI + Mapbox map + CSV overlay logic
  - `public/data/points.csv` — sample CSV used by the CSV overlay

## Local development

### Prerequisites

- Node.js 18+ recommended

### Install

From the `react-demo` folder:

```bash
npm install
```

### Run

From the `react-demo` folder:

```bash
npm run dev
```

Then open:

- http://localhost:5173/

## Mapbox token setup

Create a file:

- `react-demo/.env`

Add:

```env
VITE_MAPBOX_TOKEN=pk.YOUR_MAPBOX_PUBLIC_TOKEN
```

Notes:

- Use a **public** Mapbox token that starts with `pk.`.
- The `.env` file is ignored by git (token will not be committed).
- After changing `.env`, **restart** `npm run dev`.

## CSV (lat/lon) overlay

The Map page includes an **Overlay → CSV** option.

### Where to put your CSV

Replace:

- `react-demo/public/data/points.csv`

### Supported CSV headers

Required:

- `lat` or `latitude`
- `lon` / `lng` / `long` / `longitude`

Optional intensity column:

- `pm25` (supported)
- or `weight` / `value` / `intensity` / `count`

Example:

```csv
latitude,longitude,pm25,date
33.9801,-118.3502,12.3,2025-01-01
33.9710,-118.3610,8.4,2025-01-01
```

## Build (production)

From the `react-demo` folder:

```bash
npm run build
npm run preview
```

## Deployment

This is a standard Vite app and can be deployed to Netlify/Vercel/GitHub Pages.

If deploying, set the environment variable in your host:

- `VITE_MAPBOX_TOKEN`

## License

Add a license if needed.
