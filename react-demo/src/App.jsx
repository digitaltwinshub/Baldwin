import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

import homeHeroBackground from "../Data/Images/HomePage background.png";
import landUsePatternsImg from "../Data/Images/Land Use Patterns and Urban Fabric.jpeg";
import imperviousSurfaceImg from "../Data/Images/Intensive Urbanization and Impervious Surface Dominance.jpeg";
import transportationModalImg from "../Data/Images/Transportation Infrastructure and Modal Networks.jpeg";
import supportingMapFigureImg from "../Data/Images/page17_img2.jpeg";
import demographicCompositionImg from "../Data/Images/Demographic Composition and Community Structure.jpeg";

export default function App() {
  const [activePage, setActivePage] = useState("home");
  const [activeMetricId, setActiveMetricId] = useState("tree_canopy");
  const [activeMapLayerId, setActiveMapLayerId] = useState("base");
  const [activeBaseLayerId, setActiveBaseLayerId] = useState("base");
  const [activeOverlayLayerId, setActiveOverlayLayerId] = useState("heat");
  const [overlayOpacity, setOverlayOpacity] = useState(0.6);
  const [mapZoom, setMapZoom] = useState(1);
  const [navSearch, setNavSearch] = useState("");
  const [navSearchResults, setNavSearchResults] = useState([]);
  const [navSearchMeta, setNavSearchMeta] = useState({ query: "", totalMatches: 0 });
  const [csvOverlayStatus, setCsvOverlayStatus] = useState({
    loading: false,
    loaded: false,
    featureCount: 0,
    error: "",
  });

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const mapLoadedRef = useRef(false);

  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
  const hasValidMapboxToken = Boolean(mapboxToken && mapboxToken.trim() && mapboxToken !== "YOUR_TOKEN");

  const csvOverlayUrl = import.meta.env.VITE_POINTS_CSV_URL || "/data/points.csv";

  function csvToGeojson(text) {
    const rawLines = text.split(/\r?\n/);
    const lines = rawLines.map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return { type: "FeatureCollection", features: [] };

    const headers = lines[0]
      .split(",")
      .map((h) => h.trim().replace(/^\uFEFF/, ""));

    const idxLat = headers.findIndex((h) => /^(lat|latitude)$/i.test(h));
    const idxLon = headers.findIndex((h) => /^(lon|lng|long|longitude)$/i.test(h));
    const idxWeight = headers.findIndex((h) => /^(weight|value|intensity|count|pm25)$/i.test(h));

    if (idxLat === -1 || idxLon === -1) {
      throw new Error('CSV must have headers for latitude and longitude (e.g. "lat" and "lon").');
    }

    const features = [];
    for (let i = 1; i < lines.length; i += 1) {
      const cols = lines[i].split(",").map((c) => c.trim());
      const lat = Number.parseFloat(cols[idxLat]);
      const lon = Number.parseFloat(cols[idxLon]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

      const weight = idxWeight >= 0 ? Number.parseFloat(cols[idxWeight]) : 1;
      const props = {};
      headers.forEach((h, j) => {
        props[h] = cols[j];
      });
      props.weight = Number.isFinite(weight) ? weight : 1;

      features.push({
        type: "Feature",
        properties: props,
        geometry: { type: "Point", coordinates: [lon, lat] },
      });
    }

    return { type: "FeatureCollection", features };
  }

  const pages = useMemo(
    () => [
      { key: "home", label: "Home" },
      { key: "overview", label: "Overview" },
      { key: "challenges", label: "Challenges" },
      { key: "solutions", label: "Solutions" },
      { key: "community", label: "Community" },
      { key: "map", label: "Map" },
      { key: "sources", label: "Sources" },
      { key: "contact", label: "Contact" },
    ],
    []
  );

  function makeMapSvg({ title, subtitle, accent }) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0a0a"/>
      <stop offset="100%" stop-color="#2d2d2d"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#f4d03f" stop-opacity="0.85"/>
    </linearGradient>
  </defs>
  <rect width="1400" height="800" fill="url(#bg)"/>
  <rect x="70" y="70" width="1260" height="660" fill="#101010" stroke="#444"/>
  <path d="M120 540 C 280 420, 520 460, 700 360 C 860 270, 1080 300, 1250 190" fill="none" stroke="#3a3a3a" stroke-width="12"/>
  <path d="M180 620 C 360 520, 520 600, 760 520 C 980 450, 1100 520, 1230 420" fill="none" stroke="#333" stroke-width="10"/>
  <path d="M220 220 C 420 280, 560 210, 740 260 C 920 310, 1020 240, 1210 320" fill="none" stroke="#2f2f2f" stroke-width="8"/>
  <path d="M240 540 C 420 440, 520 520, 720 430 C 920 350, 1040 420, 1180 300" fill="none" stroke="url(#accent)" stroke-width="10"/>
  <circle cx="700" cy="360" r="12" fill="${accent}"/>
  <circle cx="760" cy="520" r="10" fill="#f4d03f"/>
  <circle cx="520" cy="460" r="9" fill="#d4af37"/>
  <rect x="70" y="70" width="1260" height="48" fill="rgba(0,0,0,0.35)"/>
  <text x="96" y="102" font-family="Segoe UI, Arial" font-size="20" fill="#d4af37" letter-spacing="2">${title}</text>
  <text x="1280" y="102" text-anchor="end" font-family="Segoe UI, Arial" font-size="14" fill="#bbb" letter-spacing="1">${subtitle}</text>
  <text x="96" y="712" font-family="Segoe UI, Arial" font-size="12" fill="#888" letter-spacing="1">Placeholder map (swap with real GIS images later)</text>
</svg>`;

    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  const mapLayers = useMemo(
    () => [
      {
        id: "base",
        label: "Base",
        src: makeMapSvg({
          title: "Baldwin Hills Corridor",
          subtitle: "Base Context",
          accent: "#d4af37",
        }),
        caption: "Base context (placeholder) — replace with your corridor boundary / basemap export.",
      },
      {
        id: "heat",
        label: "Heat",
        src: makeMapSvg({
          title: "Heat Exposure",
          subtitle: "Hotspot Overlay",
          accent: "#ff6b6b",
        }),
        caption: "Heat exposure overlay (placeholder).",
      },
      {
        id: "canopy",
        label: "Tree Canopy",
        src: makeMapSvg({
          title: "Tree Canopy",
          subtitle: "Coverage Indicator",
          accent: "#4ade80",
        }),
        caption: "Tree canopy coverage layer (placeholder).",
      },
      {
        id: "impervious",
        label: "Impervious",
        src: makeMapSvg({
          title: "Impervious Surface",
          subtitle: "Runoff Driver",
          accent: "#60a5fa",
        }),
        caption: "Impervious surface layer (placeholder).",
      },
    ],
    []
  );

  const activeMapLayer = useMemo(
    () => mapLayers.find((l) => l.id === activeMapLayerId) || mapLayers[0],
    [activeMapLayerId, mapLayers]
  );

  const activeBaseLayer = useMemo(
    () => mapLayers.find((l) => l.id === activeBaseLayerId) || mapLayers[0],
    [activeBaseLayerId, mapLayers]
  );

  const activeOverlayLayer = useMemo(
    () => mapLayers.find((l) => l.id === activeOverlayLayerId) || mapLayers[1],
    [activeOverlayLayerId, mapLayers]
  );

  const mapboxStyles = useMemo(
    () => ({
      base: "mapbox://styles/mapbox/dark-v11",
      heat: "mapbox://styles/mapbox/dark-v11",
      canopy: "mapbox://styles/mapbox/dark-v11",
      impervious: "mapbox://styles/mapbox/dark-v11",
    }),
    []
  );

  const overlayLayerIds = useMemo(
    () => ({
      heat: "overlay-heat",
      canopy: "overlay-canopy",
      impervious: "overlay-impervious",
      csv: "csv-heatmap",
    }),
    []
  );

  function addDemoMapLayers(map) {
    if (map.getSource("corridor")) return;

    const corridorLine = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [-118.46, 33.93],
          [-118.43, 33.95],
          [-118.4, 33.96],
          [-118.37, 33.98],
          [-118.34, 34.0],
          [-118.31, 34.02],
          [-118.28, 34.03],
          [-118.25, 34.05],
        ],
      },
    };

    map.addSource("corridor", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [corridorLine] },
    });

    map.addLayer({
      id: "corridor-line",
      type: "line",
      source: "corridor",
      paint: {
        "line-color": "#d4af37",
        "line-width": 4,
        "line-opacity": 0.9,
      },
    });

    const overlays = [
      {
        id: "overlay-heat",
        color: "#ff6b6b",
        coords: [
          [-118.45, 33.96],
          [-118.31, 33.96],
          [-118.31, 34.03],
          [-118.45, 34.03],
          [-118.45, 33.96],
        ],
      },
      {
        id: "overlay-canopy",
        color: "#4ade80",
        coords: [
          [-118.41, 33.93],
          [-118.3, 33.93],
          [-118.3, 33.98],
          [-118.41, 33.98],
          [-118.41, 33.93],
        ],
      },
      {
        id: "overlay-impervious",
        color: "#60a5fa",
        coords: [
          [-118.39, 33.985],
          [-118.26, 33.985],
          [-118.26, 34.045],
          [-118.39, 34.045],
          [-118.39, 33.985],
        ],
      },
    ];

    overlays.forEach((ov) => {
      if (map.getSource(ov.id)) return;
      map.addSource(ov.id, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "Polygon", coordinates: [ov.coords] },
            },
          ],
        },
      });

      map.addLayer({
        id: ov.id,
        type: "fill",
        source: ov.id,
        paint: {
          "fill-color": ov.color,
          "fill-opacity": 0,
        },
      });
    });

    if (!map.getSource("csv-points")) {
      map.addSource("csv-points", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }

    if (!map.getLayer("csv-heatmap")) {
      map.addLayer({
        id: "csv-heatmap",
        type: "heatmap",
        source: "csv-points",
        maxzoom: 15,
        paint: {
          "heatmap-weight": ["coalesce", ["to-number", ["get", "weight"]], 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 1, 14, 2.2],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 18, 14, 40],
          "heatmap-opacity": 0,
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(0,0,0,0)",
            0.2,
            "rgba(96,165,250,0.55)",
            0.4,
            "rgba(74,222,128,0.65)",
            0.65,
            "rgba(244,208,63,0.75)",
            0.85,
            "rgba(255,107,107,0.85)",
            1,
            "rgba(255,107,107,1)",
          ],
        },
      });
    }

    if (!map.getLayer("csv-points")) {
      map.addLayer({
        id: "csv-points",
        type: "circle",
        source: "csv-points",
        minzoom: 12,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 2, 16, 6],
          "circle-color": "#f4d03f",
          "circle-stroke-color": "#0a0a0a",
          "circle-stroke-width": 1,
          "circle-opacity": 0,
        },
      });
    }
  }

  useEffect(() => {
    if (activePage !== "map") return;
    if (!hasValidMapboxToken) return;
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: mapboxStyles.base,
      center: [-118.35, 33.98],
      zoom: 11.4,
      attributionControl: true,
    });

    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

    map.on("load", () => {
      mapLoadedRef.current = true;
      addDemoMapLayers(map);
    });

    map.on("style.load", () => {
      mapLoadedRef.current = true;
      addDemoMapLayers(map);
    });

    return () => {
      mapLoadedRef.current = false;
      mapRef.current = null;
      map.remove();
    };
  }, [activePage, mapboxToken, mapboxStyles.base]);

  useEffect(() => {
    if (activePage !== "map") return;
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;

    const nextStyle = mapboxStyles[activeBaseLayerId] || mapboxStyles.base;
    map.setStyle(nextStyle);
  }, [activeBaseLayerId, activePage, mapboxStyles]);

  useEffect(() => {
    if (activePage !== "map") return;
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;

    const visibleId = overlayLayerIds[activeOverlayLayerId];
    Object.values(overlayLayerIds).forEach((layerId) => {
      if (!map.getLayer(layerId)) return;
      const targetOpacity = layerId === visibleId ? overlayOpacity : 0;

      if (layerId === "csv-heatmap") {
        map.setPaintProperty(layerId, "heatmap-opacity", targetOpacity);
        return;
      }

      map.setPaintProperty(layerId, "fill-opacity", targetOpacity);
    });

    if (map.getLayer("csv-points")) {
      const pointsOpacity = activeOverlayLayerId === "csv" ? Math.min(1, overlayOpacity + 0.15) : 0;
      map.setPaintProperty("csv-points", "circle-opacity", pointsOpacity);
    }
  }, [activeOverlayLayerId, overlayOpacity, overlayLayerIds, activePage]);

  useEffect(() => {
    if (activePage !== "map") return;
    if (!hasValidMapboxToken) return;
    if (activeOverlayLayerId !== "csv") return;
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    const source = map.getSource("csv-points");
    if (!source) return;
    if (csvOverlayStatus.loading || csvOverlayStatus.loaded) return;

    setCsvOverlayStatus({ loading: true, loaded: false, featureCount: 0, error: "" });
    fetch(csvOverlayUrl, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load CSV (${res.status}): ${csvOverlayUrl}`);
        }
        return res.text();
      })
      .then((text) => {
        const data = csvToGeojson(text);
        source.setData(data);
        setCsvOverlayStatus({
          loading: false,
          loaded: true,
          featureCount: data.features.length,
          error: "",
        });
        if (data.features.length) {
          const bounds = new mapboxgl.LngLatBounds();
          data.features.forEach((f) => {
            const c = f?.geometry?.coordinates;
            if (Array.isArray(c) && c.length === 2) bounds.extend(c);
          });
          if (!bounds.isEmpty()) {
            map.fitBounds(bounds, { padding: 60, duration: 800, maxZoom: 14 });
          }
        }
      })
      .catch((err) => {
        setCsvOverlayStatus({
          loading: false,
          loaded: false,
          featureCount: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }, [
    activeOverlayLayerId,
    activePage,
    csvOverlayStatus.loading,
    csvOverlayStatus.loaded,
    csvOverlayUrl,
    hasValidMapboxToken,
  ]);

  useEffect(() => {
    if (activePage !== "map") return;
    const map = mapRef.current;
    if (!map) return;
    const baseZoom = 11.4;
    map.easeTo({ zoom: baseZoom + (mapZoom - 1) * 2, duration: 700 });
  }, [mapZoom, activePage]);

  const keyMetrics = useMemo(
    () => [
      {
        id: "corridor",
        value: "6",
        label: "Mile Corridor",
        description:
          "A corridor-scale focus area used for land context and infrastructure analysis.",
        source: "Project definition (Baldwin Hills 6‑Mile Corridor boundary)",
        sourceTags: ["Project boundary", "GIS"],
        meaning:
          "Defines the spatial frame for interpreting heat, air quality, stormwater, and equity conditions.",
        spark: [3, 5, 6, 6, 6],
      },
      {
        id: "tree_canopy",
        value: "<2%",
        label: "Tree Canopy",
        description:
          "Tree canopy coverage is extremely limited across much of the corridor.",
        source: "Local canopy assessment (summary statistic used in report)",
        sourceTags: ["Tree canopy", "Urban forestry"],
        meaning:
          "Low canopy increases heat exposure and reduces air filtration and shade in public space.",
        spark: [1, 1, 2, 1, 2],
      },
      {
        id: "impervious",
        value: "70%+",
        label: "Impervious Surface",
        description:
          "A high share of land is covered by roofs, pavement, and other hard surfaces.",
        source: "Land cover / imperviousness summary (report statistic)",
        sourceTags: ["Land cover", "Imperviousness"],
        meaning:
          "Higher imperviousness amplifies heat and runoff, increasing flood risk and reducing infiltration.",
        spark: [62, 65, 70, 72, 74],
      },
      {
        id: "heat",
        value: "111°F",
        label: "Peak Temperature",
        description:
          "Peak summer temperatures can reach extreme values in the corridor.",
        source: "Heat exposure summary (report statistic)",
        sourceTags: ["Heat", "Climate"],
        meaning:
          "Heat risk is compounded for sensitive populations and where cooling infrastructure is limited.",
        spark: [96, 101, 106, 110, 111],
      },
      {
        id: "pm25",
        value: "11.6+",
        label: "PM2.5 (μg/m³)",
        description:
          "Fine particulate matter (PM2.5) levels exceed health-based reference thresholds.",
        source: "Air quality summary (report statistic)",
        sourceTags: ["Air quality", "PM2.5"],
        meaning:
          "Elevated PM2.5 increases respiratory and cardiovascular risk, especially near high-traffic corridors.",
        spark: [9.8, 10.6, 11.2, 11.6, 12.0],
      },
    ],
    []
  );

  const activeMetric = useMemo(
    () => keyMetrics.find((m) => m.id === activeMetricId) || keyMetrics[0],
    [activeMetricId, keyMetrics]
  );

  function onNavClick(e, key) {
    e.preventDefault();
    setActivePage(key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goToPage(key) {
    setActivePage(key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function normalizeSearch(s) {
    return (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function handleNavSearchSubmit() {
    const q = normalizeSearch(navSearch);
    if (!q) return;

    const results = [];
    let totalMatches = 0;

    pages.forEach((p) => {
      const el = document.getElementById(p.key);
      if (!el) return;
      const text = normalizeSearch(el.innerText);
      if (!text) return;

      const idx = text.indexOf(q);
      if (idx === -1) return;

      let count = 0;
      let fromIndex = 0;
      while (true) {
        const next = text.indexOf(q, fromIndex);
        if (next === -1) break;
        count += 1;
        fromIndex = next + q.length;
      }

      totalMatches += count;

      const start = Math.max(0, idx - 42);
      const end = Math.min(text.length, idx + q.length + 62);
      const snippet = text.slice(start, end);

      results.push({
        key: p.key,
        label: p.label,
        matchCount: count,
        snippet: `${start > 0 ? "…" : ""}${snippet}${end < text.length ? "…" : ""}`,
      });
    });

    results.sort((a, b) => b.matchCount - a.matchCount);

    setNavSearchMeta({ query: navSearch, totalMatches });
    setNavSearchResults(results.slice(0, 8));
  }

  function clearNavSearchResults() {
    setNavSearchResults([]);
    setNavSearchMeta({ query: "", totalMatches: 0 });
  }

  function goToSources() {
    setActivePage("sources");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const inputStyle = {
    width: "100%",
    padding: "18px",
    marginBottom: "25px",
    background: "transparent",
    border: "1px solid #444",
    color: "#fff",
    fontSize: "16px",
    transition: "all 0.3s",
  };

  const formStyle = {
    background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
    padding: "50px",
    border: "1px solid #444",
  };

  function Sparkline({ points }) {
    const w = 72;
    const h = 26;
    const pad = 2;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const d = points
      .map((v, i) => {
        const x = pad + (i * (w - pad * 2)) / (points.length - 1);
        const y = h - pad - ((v - min) / range) * (h - pad * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

    return (
      <svg
        className="spark"
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        aria-hidden="true"
      >
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="nav-container">
          <div className="logo">BALDWIN HILLS</div>
          <div className="nav-search">
            <input
              className="nav-search__input"
              type="search"
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleNavSearchSubmit();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  clearNavSearchResults();
                }
              }}
              placeholder="Search site…"
              aria-label="Search site"
            />
            {navSearchResults.length > 0 && (
              <div className="nav-search__results" role="region" aria-label="Search results">
                <div className="nav-search__meta">
                  <span>
                    Results for <strong>{navSearchMeta.query}</strong>
                  </span>
                  <button type="button" className="nav-search__clear" onClick={clearNavSearchResults}>
                    Clear
                  </button>
                </div>
                <ul className="nav-search__list">
                  {navSearchResults.map((r) => (
                    <li key={r.key} className="nav-search__item">
                      <button
                        type="button"
                        className="nav-search__button"
                        onClick={() => {
                          goToPage(r.key);
                          clearNavSearchResults();
                        }}
                      >
                        <div className="nav-search__title">
                          <span>{r.label}</span>
                          <span className="nav-search__count">{r.matchCount}</span>
                        </div>
                        <div className="nav-search__snippet">{r.snippet}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <ul className="nav-links">
            {pages.map((p) => (
              <li key={p.key}>
                <a
                  href="#"
                  className={activePage === p.key ? "nav-link active" : "nav-link"}
                  data-page={p.key}
                  onClick={(e) => onNavClick(e, p.key)}
                >
                  {p.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="content">
        <div id="home" className={activePage === "home" ? "page active" : "page"}>
          <div className="hero hero-home" style={{ "--home-hero-bg": `url(${homeHeroBackground})` }}>
            <p className="hero-corner">Land Context and Infrastructure Report</p>
          </div>

          <div className="container">
            <h2 className="section-title">Executive Summary</h2>
            <p className="section-subtitle">
              A Comprehensive Analysis of Urban Resilience and Community Development
            </p>

          <div className="info-box">
            <h4>Project Scope</h4>
            <p>
              The Baldwin Hills 6-Mile Corridor, stretching north of the 105
              Freeway between the 405 and 110 Freeways in Los Angeles County, is
              a highly urbanized landscape marked by significant social,
              ecological, and infrastructural vulnerabilities.
            </p>
          </div>

          <div className="stats-bar">
            {keyMetrics.map((m) => (
              <div
                key={m.id}
                className={
                  `${m.id === "corridor" ? "stat-item stat-item--primary" : "stat-item"}${
                    activeMetricId === m.id ? " stat-item--active" : ""
                  }`
                }
              >
                <button
                  type="button"
                  className="stat-button"
                  onClick={() => setActiveMetricId(m.id)}
                >
                  <span className="number">{m.value}</span>
                  <span className="label">{m.label}</span>
                  <Sparkline points={m.spark} />
                </button>
              </div>
            ))}
          </div>

          <div className="metric-panel" role="region" aria-label="Key Metric Detail">
            <div className="metric-panel__header">
              <h3 className="metric-panel__title">{activeMetric.label}</h3>
              <div className="metric-panel__value">{activeMetric.value}</div>
            </div>
            <p className="metric-panel__text">{activeMetric.description}</p>
            <p className="metric-panel__text">
              <strong>Source:</strong> {activeMetric.source}
            </p>
            <div className="source-tags" aria-label="Source tags">
              {(activeMetric.sourceTags || []).map((tag) => (
                <button key={tag} type="button" className="source-tag" onClick={goToSources}>
                  {tag}
                </button>
              ))}
              <button type="button" className="source-tag source-tag--cta" onClick={goToSources}>
                Sources & Methods
              </button>
            </div>
            <p className="metric-panel__text">
              <strong>What it means:</strong> {activeMetric.meaning}
            </p>
          </div>

          <div className="cards-grid">
            <div className="card">
              <h3>Geographic Context</h3>
              <p>
                Bounded by major LA freeways, the corridor encompasses densely
                populated census tracts with unique land use patterns and
                environmental conditions.
              </p>
              <ul>
                <li>West: I-405 Freeway</li>
                <li>East: I-110 Freeway</li>
                <li>South: I-105 Freeway</li>
                <li>Length: Approximately 6 miles</li>
              </ul>
            </div>

            <div className="card">
              <h3>Key Challenges</h3>
              <p>
                The corridor faces multiple interconnected environmental and
                social stressors that impact community health and resilience.
              </p>
              <ul>
                <li>Extreme urban heat island effects</li>
                <li>Poor air quality (PM2.5 above 11.6 μg/m³)</li>
                <li>Limited green spaces and cooling infrastructure</li>
                <li>Aging housing stock (65-90% pre-1970)</li>
              </ul>
            </div>

            <div className="card">
              <h3>Strategic Vision</h3>
              <p>
                An integrated approach to urban greening, infrastructure
                modernization, and community empowerment for sustainable
                resilience.
              </p>
              <ul>
                <li>Green infrastructure integration</li>
                <li>Housing rehabilitation programs</li>
                <li>Enhanced cooling centers</li>
                <li>Multimodal transportation improvements</li>
              </ul>
            </div>
          </div>
          </div>
        </div>

        <div
          id="overview"
          className={activePage === "overview" ? "page active" : "page"}
        >
          <div className="hero">
            <h1>Corridor Overview</h1>
            <p>Understanding the Land Use, Demographics, and Environment</p>
          </div>

          <div className="container">
            <h2 className="section-title">Study Area Analysis</h2>
            <p className="section-subtitle">
              Comprehensive assessment of the corridor's characteristics
            </p>

          <div className="cards-grid">
            <figure className="media">
              <img
                src={landUsePatternsImg}
                alt="Land Use Patterns and Urban Fabric"
                loading="lazy"
              />
              <figcaption>Land Use Patterns and Urban Fabric</figcaption>
            </figure>

            <figure className="media">
              <img
                src={imperviousSurfaceImg}
                alt="Intensive Urbanization and Impervious Surface Dominance"
                loading="lazy"
              />
              <figcaption>Intensive Urbanization and Impervious Surface Dominance</figcaption>
            </figure>
          </div>

          <div className="two-column">
            <div className="column">
              <h3>Land Use Patterns</h3>
              <p>
                The corridor's land use is predominantly residential, composed
                primarily of aging, dense urban neighborhoods. Single-family and
                multi-family housing dominate, interspersed with commercial
                parcels concentrated near major arterials and transit nodes.
              </p>
              <p>
                Impervious surface coverage is extremely high, generally
                exceeding 70%, limiting open space and natural infiltration
                capacity. Protected open spaces constitute less than 12%, with
                the majority of land designated for restoration efforts.
              </p>
            </div>

            <div className="column">
              <h3>Urban Form</h3>
              <p>
                The corridor is characterized by a dense, grid-like street
                network with road intersection densities ranging from 20 to 65
                intersections per square kilometer.
              </p>
              <p>
                While this grid facilitates physical connectivity and multimodal
                access, it contributes to extensive impervious surface cover,
                limiting stormwater infiltration and intensifying urban heat
                island effects.
              </p>
            </div>
          </div>

          <div className="cards-grid">
            <div className="card">
              <h3>Housing Characteristics</h3>
              <span className="stat">65-90%</span>
              <p>
                Housing stock constructed prior to 1970, creating significant
                challenges related to energy inefficiency and climate resilience.
              </p>
              <p>
                Homeownership rates are generally low, often under 40%, with
                renter occupancy prevailing above 60%.
              </p>
            </div>

            <div className="card">
              <h3>Ecological Features</h3>
              <span className="stat">&lt;2%</span>
              <p>Tree canopy coverage throughout the corridor, with riparian habitats virtually absent.</p>
              <p>
                The majority of corridor land is designated for ecological
                restoration, reflecting the region's potential for urban
                greening.
              </p>
            </div>

            <div className="card">
              <h3>Infrastructure</h3>
              <span className="stat">24-108&quot;</span>
              <p>
                Diameter range of reinforced concrete stormwater pipes
                maintained by Caltrans and LA County Flood Control District.
              </p>
              <p>
                Critical for managing runoff but requiring modernization for
                climate resilience.
              </p>
            </div>
          </div>

          <div className="info-box">
            <h4>Key GIS Layers Used in Analysis</h4>
            <p>
              6-Mile Corridor boundary • Baldwin Hills Zone • Major watersheds •
              Stormwater infrastructure • Land use and housing • Tree planting
              initiatives • Air filtration indices • Transit stops
            </p>
          </div>
        </div>
      </div>

        <div
          id="challenges"
          className={activePage === "challenges" ? "page active" : "page"}
        >
          <div className="hero">
            <h1>Critical Challenges</h1>
            <p>Social, Environmental, and Infrastructure Vulnerabilities</p>
          </div>

          <div className="container">
            <h2 className="section-title">Environmental Stressors</h2>
            <p className="section-subtitle">Compounded ecological and climate challenges</p>

          <div className="cards-grid">
            <figure className="media">
              <img
                src={transportationModalImg}
                alt="Transportation Infrastructure and Modal Networks"
                loading="lazy"
              />
              <figcaption>Transportation Infrastructure and Modal Networks</figcaption>
            </figure>

            <figure className="media">
              <img
                src={supportingMapFigureImg}
                alt="Supporting map figure"
                loading="lazy"
              />
              <figcaption>Supporting map figure</figcaption>
            </figure>
          </div>

          <div className="cards-grid">
            <div className="card">
              <h3>Urban Heat Island</h3>
              <span className="stat">108-111°F</span>
              <p>
                Persistent high summer land surface temperatures due to sparse
                tree canopy and extensive impervious surfaces.
              </p>
              <p>
                The heat intensification poses acute climate stress risks,
                particularly for elderly, youth, and socioeconomically
                disadvantaged residents.
              </p>
            </div>

            <div className="card">
              <h3>Air Quality Crisis</h3>
              <span className="stat">11.6+ μg/m³</span>
              <p>
                Annual PM2.5 concentrations exceeding regional and WHO standards,
                largely from traffic emissions along the 105 Freeway.
              </p>
              <p>
                Asthma prevalence rates near or above 8%, disproportionately
                impacting vulnerable populations.
              </p>
            </div>

            <div className="card">
              <h3>Flood Vulnerability</h3>
              <span className="stat">35-45%</span>
              <p>
                Of properties in some tracts situated within the 100-year
                floodplain due to high imperviousness.
              </p>
              <p>
                Aging stormwater infrastructure challenged by increased runoff
                from climate change and urban density.
              </p>
            </div>
          </div>

          <h2 className="section-title" style={{ marginTop: "80px" }}>
            Social Vulnerabilities
          </h2>
          <p className="section-subtitle">Demographic and socioeconomic challenges</p>

          <div className="two-column">
            <div className="column">
              <h3>Demographic Profile</h3>
              <p>
                The corridor is home to communities with some of the highest
                concentrations of minority populations in LA County, with
                Non-Hispanic White residents comprising less than 5% in most
                census tracts.
              </p>
              <p>
                Significant proportions of both youth and elderly residents
                place unique demands on social services, healthcare, and
                educational infrastructure.
              </p>
            </div>

            <div className="column">
              <h3>Economic Hardship</h3>
              <p>
                Poverty rates consistently above county averages, with some
                tracts reporting rates as high as 24%. Educational attainment is
                also challenging, with 30-50% of adults lacking a high school
                diploma.
              </p>
              <p>
                Median household incomes well below regional benchmarks,
                compounding economic precarity.
              </p>
            </div>
          </div>

            <div className="info-box">
              <h4>Access Barriers</h4>
              <p>
                <strong>Transportation:</strong> Up to 14% of households lack a
                vehicle, increasing reliance on public transit and creating
                barriers to employment and healthcare access.
              </p>
              <p>
                <strong>Digital Divide:</strong> 7-18% of households lacking
                internet access, impacting educational and economic opportunities.
              </p>
              <p>
                <strong>Cooling Infrastructure:</strong> Limited access to cooling
                centers and climate resilience amenities, critical for mitigating
                extreme heat impacts.
              </p>
            </div>
          </div>
        </div>

        <div
          id="solutions"
          className={activePage === "solutions" ? "page active" : "page"}
        >
          <div className="hero">
            <h1>Strategic Solutions</h1>
            <p>Integrated Interventions for Community Resilience</p>
          </div>

          <div className="container">
            <h2 className="section-title">Recommendations</h2>
            <p className="section-subtitle">Multi-sector approach to building resilience</p>

          <div className="cards-grid">
            <div className="card">
              <h3>Urban Greening</h3>
              <p>
                Comprehensive strategy prioritizing large-scale planting of
                drought-tolerant, native tree species along major streets and
                public rights-of-way.
              </p>
              <ul>
                <li>Expand tree canopy to mitigate heat</li>
                <li>Improve air quality through filtration</li>
                <li>Create shaded recreational spaces</li>
                <li>Integrate with Park to Playa Trail</li>
              </ul>
            </div>

            <div className="card">
              <h3>Green Infrastructure</h3>
              <p>
                Integrate green stormwater solutions with legacy drainage
                systems to enhance flood resilience and water quality.
              </p>
              <ul>
                <li>Install bioswales and rain gardens</li>
                <li>Deploy permeable pavements</li>
                <li>Retrofit existing conduits</li>
                <li>Reduce pollutant loads</li>
              </ul>
            </div>

            <div className="card">
              <h3>Housing Rehabilitation</h3>
              <p>
                Targeted programs to upgrade aging pre-1970 housing stock for
                energy efficiency and climate resilience.
              </p>
              <ul>
                <li>Energy-efficient retrofits</li>
                <li>Heat-resilient design elements</li>
                <li>Improved ventilation systems</li>
                <li>Indoor air quality controls</li>
              </ul>
            </div>

            <div className="card">
              <h3>Cooling Infrastructure</h3>
              <p>
                Expand availability and equitable distribution of cooling centers
                and heat mitigation resources.
              </p>
              <ul>
                <li>Establish cooling centers in vulnerable areas</li>
                <li>Install shade structures at transit stops</li>
                <li>Enhance public heat emergency education</li>
                <li>Improve digital connectivity for alerts</li>
              </ul>
            </div>

            <div className="card">
              <h3>Transportation Improvements</h3>
              <p>
                Accelerate pedestrian and bicycle infrastructure to improve
                mobility and reduce emissions.
              </p>
              <ul>
                <li>Protected bike lanes</li>
                <li>Improved sidewalks</li>
                <li>Enhanced transit connectivity</li>
                <li>Safe Routes to School programs</li>
              </ul>
            </div>

            <div className="card">
              <h3>Community Engagement</h3>
              <p>
                Ensure sustainable success through culturally relevant,
                community-driven planning processes.
              </p>
              <ul>
                <li>Participatory planning frameworks</li>
                <li>Partnership with local organizations</li>
                <li>Transparency and ongoing feedback</li>
                <li>Capacity building for residents</li>
              </ul>
            </div>
          </div>

            <div className="info-box">
              <h4>Policy Recommendations</h4>
              <p>
                Municipal and regional agencies should adopt supportive zoning and
                development policies including mandates for minimum urban tree
                canopy cover, impervious surface reduction targets, and
                requirements for cool or green roofs in new developments. Funding
                mechanisms must prioritize high-vulnerability census tracts
                identified by GIS analyses.
              </p>
            </div>
          </div>
        </div>

        <div
          id="community"
          className={activePage === "community" ? "page active" : "page"}
        >
          <div className="hero">
            <h1>Community Impact</h1>
            <p>Building Resilience Through Partnership and Equity</p>
          </div>

          <div className="container">
            <h2 className="section-title">Regional Initiatives</h2>
            <p className="section-subtitle">Ongoing projects supporting corridor transformation</p>

          <div className="cards-grid">
            <figure className="media">
              <img
                src={demographicCompositionImg}
                alt="Demographic Composition and Community Structure"
                loading="lazy"
              />
              <figcaption>Demographic Composition and Community Structure</figcaption>
            </figure>
          </div>

          <div className="cards-grid">
            <div className="card">
              <h3>Park to Playa Trail</h3>
              <p>
                A 13-mile regional multi-use trail connecting the Baldwin Hills
                Parklands to the Pacific Ocean, intersecting the corridor at
                several points.
              </p>
              <p>
                Provides green, active transportation links and enhances
                ecological connectivity throughout the region.
              </p>
            </div>

            <div className="card">
              <h3>Slauson Corridor Plan</h3>
              <p>
                Transit Neighborhood Plan focused on improving walkability,
                bikeability, and bus rapid transit along the Slauson Avenue
                corridor.
              </p>
              <p>
                Supports northern neighborhoods of the Baldwin Hills corridor
                with enhanced multimodal connectivity.
              </p>
            </div>

            <div className="card">
              <h3>Baldwin Hills Conservancy</h3>
              <p>
                Prioritizes acquisition and restoration of underdeveloped lands
                for ecological and community benefit within the BHC Zone.
              </p>
              <p>
                Provides strategic framework for ecological restoration and
                green space expansion.
              </p>
            </div>
          </div>

          <h2 className="section-title" style={{ marginTop: "80px" }}>
            Community Assets
          </h2>
          <p className="section-subtitle">Strengths and resilience factors</p>

          <div className="two-column">
            <div className="column">
              <h3>Social Resilience</h3>
              <p>
                Despite significant challenges, the corridor's communities
                exhibit strong social cohesion and cultural resilience, shaped
                by long-standing traditions and community organizations.
              </p>
              <p>
                Deep cultural roots and established community networks provide a
                foundation for collaborative resilience-building efforts.
              </p>
            </div>

            <div className="column">
              <h3>Strategic Location</h3>
              <p>
                The corridor's position at the intersection of multiple regional
                planning initiatives provides opportunities for coordinated,
                multi-benefit improvements.
              </p>
              <p>
                Proximity to major transit infrastructure and active planning
                efforts creates leverage for transformative investments.
              </p>
            </div>
          </div>

            <div className="info-box">
              <h4>Next Steps for Community Engagement</h4>
              <p>
                Future efforts should prioritize deep community engagement to
                ensure interventions address locally articulated needs and
                historical legacies of marginalization. GIS-integrated planning
                will enable precise targeting of restoration and infrastructure
                upgrades, optimizing co-benefits across flood mitigation, heat
                reduction, and social equity.
              </p>
            </div>
          </div>
        </div>

        <div id="map" className={activePage === "map" ? "page active" : "page"}>
          <div className="hero">
            <h1>Map</h1>
            <p>Compare layers with overlay + opacity + zoom (lightweight, image-based)</p>
          </div>

          <div className="container">
            <h2 className="section-title">Map Viewer</h2>
            <p className="section-subtitle">
              Choose a <strong>Base</strong> map and an <strong>Overlay</strong> layer, then use the
              opacity slider to compare. Replace placeholders with your own GIS exports in
              <strong> Data/Images</strong> when ready.
            </p>

            <div className="map-viewer">
              <div className="map-controls">
                <div className="map-control-group">
                  <div className="map-control-title">Base</div>
                  <div className="map-toolbar" role="tablist" aria-label="Base layers">
                    {mapLayers.map((layer) => (
                      <button
                        key={layer.id}
                        type="button"
                        className={
                          activeBaseLayerId === layer.id
                            ? "map-toggle map-toggle--active"
                            : "map-toggle"
                        }
                        onClick={() => setActiveBaseLayerId(layer.id)}
                        role="tab"
                        aria-selected={activeBaseLayerId === layer.id}
                      >
                        {layer.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="map-control-group">
                  <div className="map-control-title">Overlay</div>
                  <div className="map-toolbar" role="tablist" aria-label="Overlay layers">
                    <button
                      type="button"
                      className={activeOverlayLayerId === "none" ? "map-toggle map-toggle--active" : "map-toggle"}
                      onClick={() => setActiveOverlayLayerId("none")}
                      role="tab"
                      aria-selected={activeOverlayLayerId === "none"}
                    >
                      None
                    </button>
                    <button
                      type="button"
                      className={activeOverlayLayerId === "csv" ? "map-toggle map-toggle--active" : "map-toggle"}
                      onClick={() => setActiveOverlayLayerId("csv")}
                      role="tab"
                      aria-selected={activeOverlayLayerId === "csv"}
                    >
                      CSV
                    </button>
                    {mapLayers
                      .filter((l) => l.id !== "base")
                      .map((layer) => (
                        <button
                          key={layer.id}
                          type="button"
                          className={
                            activeOverlayLayerId === layer.id
                              ? "map-toggle map-toggle--active"
                              : "map-toggle"
                          }
                          onClick={() => setActiveOverlayLayerId(layer.id)}
                          role="tab"
                          aria-selected={activeOverlayLayerId === layer.id}
                        >
                          {layer.label}
                        </button>
                      ))}
                  </div>
                  {activeOverlayLayerId === "csv" && (
                    <p style={{ marginTop: "12px", color: "#bbb", letterSpacing: "1px", lineHeight: 1.6 }}>
                      <strong>CSV:</strong> {csvOverlayUrl}
                      {csvOverlayStatus.loading && <span> (loading…)</span>}
                      {csvOverlayStatus.loaded && (
                        <span>{` (${csvOverlayStatus.featureCount.toLocaleString()} points)`}</span>
                      )}
                      {csvOverlayStatus.error && (
                        <span style={{ display: "block", marginTop: "8px", color: "#ff6b6b" }}>
                          {csvOverlayStatus.error}
                        </span>
                      )}
                    </p>
                  )}
                </div>

                <div className="map-control-group">
                  <div className="map-control-title">Opacity</div>
                  <div className="map-slider-row">
                    <input
                      className="map-slider"
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={overlayOpacity}
                      onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                      disabled={activeOverlayLayerId === "none"}
                      aria-label="Overlay opacity"
                    />
                    <div className="map-slider-value">{Math.round(overlayOpacity * 100)}%</div>
                  </div>
                </div>

                <div className="map-control-group">
                  <div className="map-control-title">Zoom</div>
                  <div className="map-zoom-row">
                    <button
                      type="button"
                      className="map-toggle"
                      onClick={() => setMapZoom((z) => Math.max(1, Number((z - 0.1).toFixed(2))))}
                    >
                      –
                    </button>
                    <div className="map-zoom-value">{Math.round(mapZoom * 100)}%</div>
                    <button
                      type="button"
                      className="map-toggle"
                      onClick={() => setMapZoom((z) => Math.min(2.2, Number((z + 0.1).toFixed(2))))}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="map-toggle"
                      onClick={() => {
                        setMapZoom(1);
                        setOverlayOpacity(0.6);
                        setActiveBaseLayerId("base");
                        setActiveOverlayLayerId("heat");
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              <figure className="map-frame">
                {hasValidMapboxToken ? (
                  <div className="mapbox-outer" aria-label="Interactive Mapbox map">
                    <div
                      className="mapbox-inner"
                      style={{ transform: `scale(${mapZoom})` }}
                    >
                      <div ref={mapContainerRef} className="mapbox-container" />
                    </div>
                  </div>
                ) : (
                  <div className="error-section">
                    <h3>Mapbox token not configured</h3>
                    <p>
                      Create a <strong>.env</strong> file inside <strong>react-demo</strong> and add:
                      <br />
                      <strong>VITE_MAPBOX_TOKEN=YOUR_TOKEN</strong>
                      <br />
                      Then restart <strong>npm run dev</strong>.
                    </p>
                  </div>
                )}

                <figcaption className="map-caption">
                  <strong>Base:</strong> {activeBaseLayer.label}
                  {activeOverlayLayerId !== "none" && (
                    <>
                      {" "}
                      <strong>• Overlay:</strong> {activeOverlayLayer.label} ({Math.round(overlayOpacity * 100)}%)
                    </>
                  )}
                </figcaption>
              </figure>
            </div>
          </div>
        </div>

        <div
          id="sources"
          className={activePage === "sources" ? "page active" : "page"}
        >
          <div className="hero">
            <h1>Sources & Methods</h1>
            <p>Data sources, GIS layers, and how key indicators are summarized</p>
          </div>

          <div className="container">
            <h2 className="section-title">Data Sources</h2>
            <p className="section-subtitle">
              A high-level inventory of datasets and agencies referenced throughout the report.
            </p>

            <div className="cards-grid">
              <div className="card">
                <h3>Transportation & Emissions</h3>
                <ul>
                  <li>Caltrans roadway / corridor context</li>
                  <li>Regional traffic and freight corridors (proxy for exposure)</li>
                  <li>Transit stops and mobility network references</li>
                </ul>
              </div>

              <div className="card">
                <h3>Stormwater & Flood</h3>
                <ul>
                  <li>LA County Flood Control District assets and drainage context</li>
                  <li>Caltrans stormwater infrastructure references</li>
                  <li>Floodplain and watershed context layers</li>
                </ul>
              </div>

              <div className="card">
                <h3>Demographics & Housing</h3>
                <ul>
                  <li>US Census / ACS demographics</li>
                  <li>Housing age and tenure (owner/renter) summaries</li>
                  <li>Equity and vulnerability indicators</li>
                </ul>
              </div>

              <div className="card">
                <h3>Environment</h3>
                <ul>
                  <li>Air quality indicators (PM2.5 summary statistics)</li>
                  <li>Urban heat / land surface temperature summaries</li>
                  <li>Tree canopy / urban forestry coverage</li>
                </ul>
              </div>
            </div>

            <h2 className="section-title" style={{ marginTop: "80px" }}>
              Methods Summary
            </h2>
            <p className="section-subtitle">
              How the indicators in the Key Metrics panel are interpreted.
            </p>

            <div className="two-column">
              <div className="column">
                <h3>How metrics are computed</h3>
                <p>
                  Metrics are summarized at the corridor scale using GIS overlays. Values shown in
                  the dashboard are report-level summary statistics intended to communicate
                  magnitude and relative risk.
                </p>
                <p>
                  Where exact computations vary by dataset (e.g., canopy vs. PM2.5), the same
                  principle is used: align layers to the corridor boundary, summarize coverage or
                  exposure, and interpret the result in the context of community vulnerability.
                </p>
              </div>

              <div className="column">
                <h3>How to read them</h3>
                <p>
                  Each metric connects to a planning implication:
                  heat + canopy relate to cooling and shade strategies; PM2.5 relates to respiratory
                  health; imperviousness relates to flood risk and stormwater capacity.
                </p>
                <p>
                  Use the Map page to visualize layer concepts. Replace placeholders with
                  authoritative GIS exports when available.
                </p>
              </div>
            </div>

            <div className="info-box">
              <h4>Key GIS Layers Used (examples)</h4>
              <p>
                Corridor boundary • Baldwin Hills Zone • Major watersheds • Stormwater
                infrastructure • Land use and housing • Tree planting initiatives • Air filtration
                indices • Transit stops
              </p>
            </div>
          </div>
        </div>

        <div
          id="contact"
          className={activePage === "contact" ? "page active" : "page"}
        >
          <div className="hero">
            <h1>Get Involved</h1>
            <p>Join Us in Building a Resilient Community</p>
          </div>

          <div className="container">
            <h2 className="section-title">Contact Information</h2>
            <p className="section-subtitle">Reach out to learn more or participate in planning</p>

          <div className="two-column">
            <div className="column">
              <h3>Project Information</h3>
              <p>
                <strong>Report Generated:</strong> November 09, 2025
              </p>
              <p>
                <strong>Prepared By:</strong> AURA AI Analyst
              </p>
              <p>
                <strong>Coverage Area:</strong> Baldwin Hills 6-Mile Corridor,
                Los Angeles County
              </p>
              <p>
                <strong>Report Pages:</strong> 28 pages of comprehensive analysis
              </p>
            </div>

            <div className="column">
              <h3>Stay Connected</h3>
              <p>
                For inquiries about the Baldwin Hills 6-Mile Corridor initiative,
                community engagement opportunities, or to provide feedback on
                proposed interventions, please use the form below.
              </p>
              <p>
                Your input is essential to ensuring our planning efforts reflect
                community needs and priorities.
              </p>
            </div>
          </div>

            <div style={{ maxWidth: "700px", margin: "60px auto" }}>
              <form
                id="contactForm"
                style={formStyle}
                onSubmit={(e) => {
                  e.preventDefault();
                }}
              >
              <h3
                style={{
                  color: "#d4af37",
                  marginBottom: "30px",
                  fontWeight: 300,
                  letterSpacing: "2px",
                }}
              >
                Send Us a Message
              </h3>

              <input type="text" id="name" placeholder="FULL NAME" style={inputStyle} />
              <input type="email" id="email" placeholder="EMAIL ADDRESS" style={inputStyle} />
              <input type="text" id="subject" placeholder="SUBJECT" style={inputStyle} />
              <textarea
                id="message"
                placeholder="YOUR MESSAGE"
                rows={6}
                style={{ ...inputStyle, resize: "vertical" }}
              />

                <button type="submit" className="btn">
                  Submit
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
