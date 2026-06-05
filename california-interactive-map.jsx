import React, { useState, useEffect, useRef } from "react";
import * as d3 from "d3";

const NORTH_SET = [
  "Del Norte", "Siskiyou", "Modoc", "Humboldt", "Trinity", "Shasta", "Lassen",
  "Tehama", "Plumas", "Mendocino", "Glenn", "Butte", "Sierra", "Lake", "Colusa",
  "Sutter", "Nevada", "Yuba", "Placer", "Yolo", "El Dorado", "Napa", "Sonoma",
  "Sacramento", "Solano", "Amador", "Alpine", "Marin", "Contra Costa",
  "San Francisco", "San Mateo", "Alameda", "Santa Clara", "Santa Cruz",
  "San Joaquin", "Stanislaus", "Calaveras", "Tuolumne", "Mariposa", "Mono", "Merced",
  "Madera", "Fresno", "San Benito", "Monterey", "Kings", "Tulare",
];

const SCENARIOS = {
  three: {
    title: "Divide California",
    regions: {
      jefferson: {
        label: "State of Jefferson",
        color: "#F2C200",
        capital: { name: "Yreka", coords: [-122.634, 41.726] },
        counties: [
          "Del Norte", "Siskiyou", "Modoc", "Humboldt", "Trinity", "Shasta",
          "Lassen", "Tehama", "Plumas", "Mendocino", "Glenn", "Butte", "Sierra",
          "Lake", "Colusa", "Sutter", "Nevada", "Yuba", "Placer", "El Dorado",
        ],
      },
      east: {
        label: "East California",
        color: "#1B9AAA",
        capital: { name: "Monterey", coords: [-121.895, 36.600] },
        counties: [
          "Marin", "Contra Costa", "San Francisco", "San Mateo", "Alameda",
          "Santa Clara", "Santa Cruz", "San Benito", "Monterey",
          "San Luis Obispo", "Santa Barbara", "Ventura", "Los Angeles",
        ],
      },
      west: {
        label: "West California",
        color: "#F28C28",
        capital: { name: "Sacramento", coords: [-121.494, 38.582] },
        counties: [
          "Sonoma", "Napa", "Yolo", "Solano", "Sacramento", "Amador", "Alpine",
          "San Joaquin", "Calaveras", "Tuolumne", "Stanislaus", "Mariposa", "Mono",
          "Merced", "Madera", "Fresno", "Inyo", "Kings", "Tulare", "Kern",
          "San Bernardino", "Orange", "Riverside", "San Diego", "Imperial",
        ],
      },
    },
  },
  two: {
    title: "Two Californias",
    regions: {
      north: {
        label: "Northern California",
        color: "#27AAB8",
        capital: { name: "Sacramento", coords: [-121.494, 38.582] },
        counties: NORTH_SET,
      },
      south: {
        label: "Southern California",
        color: "#E03131",
        capital: { name: "San Bernardino", coords: [-117.290, 34.108] },
        counties: [
          "Inyo", "San Luis Obispo", "Kern", "Santa Barbara", "Ventura",
          "Los Angeles", "San Bernardino", "Orange", "Riverside", "San Diego",
          "Imperial",
        ],
      },
    },
  },
};

const COUNTY_POP = {
  "Los Angeles": 9757179, "San Diego": 3298799, "Orange": 3170435,
  "Riverside": 2473906, "San Bernardino": 2197104, "Santa Clara": 1870945,
  "Alameda": 1622188, "Sacramento": 1611231, "Contra Costa": 1156555,
  "Fresno": 1024125, "Kern": 916421, "San Francisco": 827526,
  "Ventura": 829590, "San Mateo": 730390, "San Joaquin": 816108,
  "Stanislaus": 552878, "Sonoma": 482650, "Tulare": 480105,
  "Solano": 455101, "Monterey": 436251, "Placer": 433822,
  "San Luis Obispo": 281843, "Santa Barbara": 444500, "Merced": 296774,
  "Marin": 256400, "Butte": 207303, "Yolo": 224121, "El Dorado": 192823,
  "Imperial": 181724, "Shasta": 181121, "Madera": 165432, "Kings": 153443,
  "Napa": 132727, "Humboldt": 134623, "Nevada": 102195, "Sutter": 99633,
  "Mendocino": 89175, "Santa Cruz": 262406, "San Benito": 67016,
  "Tehama": 65498, "Tuolumne": 53893, "Calaveras": 45905, "Siskiyou": 42498,
  "Lake": 67407, "Amador": 41259, "Glenn": 28304, "Del Norte": 27009,
  "Colusa": 21917, "Lassen": 28340, "Plumas": 19790, "Inyo": 18485,
  "Mariposa": 17131, "Mono": 12991, "Trinity": 15642, "Modoc": 8491,
  "Sierra": 3113, "Alpine": 1099,
};

const fmt = (n) => n.toLocaleString("en-US");

function buildScenario(scenario) {
  const countyToRegion = {};
  Object.entries(scenario.regions).forEach(([key, r]) =>
    r.counties.forEach((c) => (countyToRegion[c] = key))
  );
  const stats = {};
  Object.entries(scenario.regions).forEach(([key, r]) => {
    const pop = r.counties.reduce((s, c) => s + (COUNTY_POP[c] || 0), 0);
    const largest = r.counties
      .slice()
      .sort((a, b) => (COUNTY_POP[b] || 0) - (COUNTY_POP[a] || 0))[0];
    stats[key] = { pop, count: r.counties.length, largest };
  });
  return { countyToRegion, stats };
}

const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json";
const MAP_WIDTH = 620;
const SVG_WIDTH = 720;
const MAP_HEIGHT = 720;
const EXPORT_TOP_OFFSET = 44;
const EXPORT_HEIGHT = 780;
const LEGEND_X = 480;
const LEGEND_Y = 26;

function collectArcIndexes(geom, indexes) {
  if (geom.type === "Polygon") {
    geom.arcs.flat().forEach((i) => indexes.add(i < 0 ? ~i : i));
    return;
  }
  if (geom.type === "MultiPolygon") {
    geom.arcs.flat(2).forEach((i) => indexes.add(i < 0 ? ~i : i));
  }
}

function arcMeshFeature(topology, geometries) {
  const indexes = new Set();
  geometries.forEach((geom) => collectArcIndexes(geom, indexes));
  return {
    type: "Feature",
    geometry: {
      type: "MultiLineString",
      coordinates: [...indexes].map((i) =>
        topology._decodedArcs[i].map((point) => point.slice())
      ),
    },
  };
}

function topoFeature(topology, o) {
  if (o.type === "GeometryCollection") {
    return {
      type: "FeatureCollection",
      features: o.geometries.map((g) => feature(topology, g)),
    };
  }
  return feature(topology, o);
}

function feature(topo, geom) {
  const id = geom.id;
  const props = geom.properties == null ? {} : geom.properties;
  const geometry = object(topo, geom);
  return id == null
    ? { type: "Feature", properties: props, geometry }
    : { type: "Feature", id, properties: props, geometry };
}

function decodeArcs(topology) {
  const { transform, arcs } = topology;
  if (!transform) return arcs;
  const [kx, ky] = transform.scale;
  const [dx, dy] = transform.translate;
  return arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([ax, ay]) => {
      x += ax; y += ay;
      return [x * kx + dx, y * ky + dy];
    });
  });
}

function object(topology, o) {
  const arcs = topology._decodedArcs;
  function arc(i, points) {
    if (points.length) points.pop();
    const a = arcs[i < 0 ? ~i : i];
    for (let k = 0; k < a.length; ++k) points.push(a[k].slice());
    if (i < 0) reverse(points, a.length);
  }
  function reverse(array, n) {
    for (let j = array.length - n, k = array.length - 1; j < k; ++j, --k) {
      const t = array[j]; array[j] = array[k]; array[k] = t;
    }
  }
  function line(al) {
    const points = [];
    for (let i = 0; i < al.length; ++i) arc(al[i], points);
    if (points.length < 2) points.push(points[0].slice());
    return points;
  }
  function ring(al) {
    const points = line(al);
    while (points.length < 4) points.push(points[0].slice());
    return points;
  }
  function polygon(rings) { return rings.map(ring); }
  const t = o.type;
  if (t === "Polygon") return { type: "Polygon", coordinates: polygon(o.arcs) };
  if (t === "MultiPolygon") return { type: "MultiPolygon", coordinates: o.arcs.map(polygon) };
  if (t === "LineString") return { type: "LineString", coordinates: line(o.arcs) };
  if (t === "MultiLineString") return { type: "MultiLineString", coordinates: o.arcs.map(line) };
  if (t === "Point") return { type: "Point", coordinates: o.coordinates };
  return null;
}

export default function DivideCalifornia() {
  const svgRef = useRef(null);
  const [geographies, setGeographies] = useState(null);
  const [boundaryGeography, setBoundaryGeography] = useState(null);
  const [error, setError] = useState(null);
  const [scenarioKey, setScenarioKey] = useState("three");
  const [selectedCounty, setSelectedCounty] = useState(null);

  const scenario = SCENARIOS[scenarioKey];
  const { countyToRegion } = React.useMemo(
    () => buildScenario(scenario),
    [scenarioKey]
  );
  const selectedRegion = selectedCounty ? countyToRegion[selectedCounty] : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const topology = await d3.json(GEO_URL);
        topology._decodedArcs = decodeArcs(topology);
        const caGeometries = topology.objects.counties.geometries.filter((g) =>
          String(g.id).startsWith("06")
        );
        const counties = topoFeature(topology, topology.objects.counties).features;
        const ca = counties.filter((f) => String(f.id).startsWith("06"));
        if (!cancelled) {
          setGeographies(ca);
          setBoundaryGeography(arcMeshFeature(topology, caGeometries));
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { setSelectedCounty(null); }, [scenarioKey]);

  useEffect(() => {
    if (!geographies || !boundaryGeography || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const projection = d3.geoMercator().fitSize([MAP_WIDTH, MAP_HEIGHT], {
      type: "FeatureCollection", features: geographies,
    });
    const path = d3.geoPath().projection(projection);

    const gFill = svg.append("g");
    const gBoundary = svg.append("g").attr("pointer-events", "none");
    const gLabel = svg.append("g").attr("pointer-events", "none");
    const gCapital = svg
      .append("g")
      .attr("class", "capital-layer")
      .attr("pointer-events", "none");

    gFill.selectAll("path")
      .data(geographies)
      .join("path")
      .attr("d", path)
      .attr("fill", (d) => {
        const region = countyToRegion[d.properties.name];
        return region ? scenario.regions[region].color : "#dcd8cc";
      })
      .attr("stroke", "none")
      .attr("cursor", "pointer")
      .attr("data-county", (d) => d.properties.name)
      .on("click", function (event, d) {
        setSelectedCounty(d.properties.name);
      });

    gBoundary
      .append("path")
      .datum(boundaryGeography)
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 0.7)
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
      .attr("vector-effect", "non-scaling-stroke");

    gLabel.selectAll("text")
      .data(geographies)
      .join("text")
      .attr("x", (d) => path.centroid(d)[0])
      .attr("y", (d) => path.centroid(d)[1])
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", 6.2)
      .attr("font-family", "'IBM Plex Sans', sans-serif")
      .attr("fill", "#23201a")
      .text((d) => d.properties.name.toUpperCase());

    const capData = Object.values(scenario.regions)
      .map((r) => r.capital)
      .filter(Boolean);
    const capGroup = gCapital.selectAll("g")
      .data(capData)
      .join("g")
      .attr("transform", (c) => {
        const [x, y] = projection(c.coords);
        return `translate(${x},${y})`;
      });
    capGroup.append("circle")
      .attr("class", "capital-dot")
      .attr("r", 4)
      .attr("fill", "#1a1a1a")
      .attr("stroke", "none");

    capGroup.append("text")
      .attr("class", "capital-name")
      .attr("x", 7)
      .attr("y", -5)
      .attr("font-size", 7.8)
      .attr("font-weight", 700)
      .attr("font-family", "'IBM Plex Sans', Arial, sans-serif")
      .attr("fill", "#1a1a1a")
      .attr("stroke", "none")
      .text((c) => c.name);

    const legend = svg
      .append("g")
      .attr("class", "svg-map-legend")
      .attr("pointer-events", "none")
      .attr("transform", `translate(${LEGEND_X},${LEGEND_Y})`);

    const legendItems = legend
      .selectAll("g")
      .data(Object.values(scenario.regions))
      .join("g")
      .attr("transform", (d, i) => `translate(0,${i * 62})`);

    legendItems
      .append("rect")
      .attr("width", 18)
      .attr("height", 18)
      .attr("fill", (d) => d.color);

    legendItems
      .append("text")
      .attr("x", 28)
      .attr("y", 13)
      .attr("font-family", "'Fraunces', Georgia, serif")
      .attr("font-size", 15)
      .attr("font-weight", 600)
      .attr("fill", "#1a1a1a")
      .text((d) => d.label);

    legendItems
      .append("text")
      .attr("x", 28)
      .attr("y", 32)
      .attr("font-family", "'IBM Plex Sans', Arial, sans-serif")
      .attr("font-size", 10.5)
      .attr("font-weight", 600)
      .attr("fill", "#6f6a5b")
      .text((d) => `Capital  ${d.capital.name}`);
  }, [boundaryGeography, geographies, scenarioKey]);

  function buildExportSVG() {
    const src = svgRef.current;
    if (!src) return null;
    const clone = src.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(SVG_WIDTH));
    clone.setAttribute("height", String(EXPORT_HEIGHT));
    clone.setAttribute("viewBox", `0 0 ${SVG_WIDTH} ${EXPORT_HEIGHT}`);

    const content = document.createElementNS("http://www.w3.org/2000/svg", "g");
    content.setAttribute("transform", `translate(0,${EXPORT_TOP_OFFSET})`);
    while (clone.firstChild) content.appendChild(clone.firstChild);

    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("x", "0");
    bg.setAttribute("y", "0");
    bg.setAttribute("width", String(SVG_WIDTH));
    bg.setAttribute("height", String(EXPORT_HEIGHT));
    bg.setAttribute("fill", "#ffffff");
    clone.appendChild(bg);
    clone.appendChild(content);

    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", String(SVG_WIDTH / 2));
    t.setAttribute("y", "29");
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("font-size", "20");
    t.setAttribute("font-weight", "900");
    t.setAttribute("font-family", "Georgia, 'Times New Roman', serif");
    t.setAttribute("fill", "#1a1a1a");
    t.textContent = scenario.title;
    clone.appendChild(t);
    return new XMLSerializer().serializeToString(clone);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportSVG() {
    const svgStr = buildExportSVG();
    if (!svgStr) return;
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    downloadBlob(blob, `${scenarioKey}-california.svg`);
  }

  function exportPNG() {
    const svgStr = buildExportSVG();
    if (!svgStr) return;
      const scale = 3;
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = SVG_WIDTH * scale;
      canvas.height = EXPORT_HEIGHT * scale;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => downloadBlob(b, `${scenarioKey}-california.png`), "image/png");
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }

  const ink = "#1a1a1a";
  const muted = "#8a8472";

  return (
    <div
      className="print-root"
      style={{
        fontFamily: "'IBM Plex Sans', sans-serif",
        background: "#f4f1e8",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "28px 16px 48px",
        boxSizing: "border-box",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,900&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <style>{`
        * { box-sizing: border-box; }
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-root { background: #fff !important; padding: 0 !important; min-height: auto !important; }
        }
      `}</style>

      <div
        className="no-print"
        style={{
          display: "inline-flex",
          border: `1px solid ${ink}`,
          marginBottom: 22,
        }}
      >
        {Object.entries(SCENARIOS).map(([key, s]) => (
          <button
            key={key}
            onClick={() => setScenarioKey(key)}
            style={{
              padding: "9px 20px",
              border: "none",
              background: scenarioKey === key ? ink : "transparent",
              color: scenarioKey === key ? "#fff" : ink,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "'IBM Plex Sans', sans-serif",
              cursor: "pointer",
            }}
          >
            {s.title}
          </button>
        ))}
      </div>

      <h1
        style={{
          fontFamily: "'Fraunces', serif",
          fontWeight: 900,
          fontSize: "clamp(26px, 5vw, 40px)",
          margin: "0 0 22px",
          color: ink,
          letterSpacing: 0,
        }}
      >
        {scenario.title}
      </h1>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 40,
          alignItems: "flex-start",
          justifyContent: "center",
          maxWidth: 980,
          width: "100%",
        }}
      >
        <div style={{ position: "relative", flex: "0 1 720px" }}>
          {error && (
            <div style={{ padding: 30, color: "#b00", maxWidth: 360 }}>
              Couldn't load map data: {error}. The artifact needs network access
              to the jsDelivr CDN.
            </div>
          )}
          {!geographies && !error && (
            <div style={{ padding: 60, color: muted }}>Loading map...</div>
          )}
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_WIDTH} ${MAP_HEIGHT}`}
            tabIndex={-1}
            style={{
              width: "min(720px, 94vw)",
              height: "auto",
              display: geographies ? "block" : "none",
              outline: "none",
              WebkitTapHighlightColor: "transparent",
              userSelect: "none",
            }}
          />
          <div
            style={{
              marginTop: 4,
              paddingTop: 14,
              borderTop: `1px solid #d8d2c2`,
              fontSize: 13,
              color: muted,
              minHeight: 44,
            }}
          >
            {selectedCounty ? (
              <span>
                <span style={{ color: ink, fontWeight: 700, fontSize: 16 }}>
                  {selectedCounty}
                </span>
                <span style={{ margin: "0 8px", opacity: 0.5 }}>·</span>
                {scenario.regions[selectedRegion].label}
                <span style={{ margin: "0 8px", opacity: 0.5 }}>·</span>
                {fmt(COUNTY_POP[selectedCounty] || 0)} people
              </span>
            ) : (
              <span className="no-print">Click a county on the map.</span>
            )}
          </div>
        </div>

      </div>

      <div
        className="no-print"
        style={{
          marginTop: 28,
          width: "min(720px, 94vw)",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={exportSVG}
            style={{
              flex: 1,
              padding: "10px 14px",
              background: ink,
              color: "#fff",
              border: "none",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "'IBM Plex Sans', sans-serif",
              cursor: "pointer",
            }}
          >
            Download SVG
          </button>
          <button
            onClick={exportPNG}
            style={{
              flex: 1,
              padding: "10px 14px",
              background: "transparent",
              color: ink,
              border: `1px solid ${ink}`,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "'IBM Plex Sans', sans-serif",
              cursor: "pointer",
            }}
          >
            Download PNG
          </button>
        </div>
        <div
          style={{
            fontSize: 11,
            color: muted,
            lineHeight: 1.5,
            textAlign: "center",
          }}
        >
          SVG is vector (best for print: open the SVG, print, then Save as PDF).
          PNG is high-res 3x.
        </div>
        <div
          style={{
            borderTop: "1px solid #d8d2c2",
            color: muted,
            fontSize: 11,
            lineHeight: 1.6,
            marginTop: 10,
            paddingTop: 10,
            textAlign: "left",
          }}
        >
          <div style={{ color: ink, fontWeight: 700, marginBottom: 2 }}>
            Data sources
          </div>
          <div>
            Boundaries and county names:{" "}
            <a
              href="https://github.com/topojson/us-atlas"
              rel="noreferrer"
              target="_blank"
              style={{ color: ink }}
            >
              topojson/us-atlas counties-10m
            </a>
            , derived from U.S. Census Bureau cartographic county boundary
            files. Current Census boundary files:{" "}
            <a
              href="https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html"
              rel="noreferrer"
              target="_blank"
              style={{ color: ink }}
            >
              census.gov cartographic boundary files
            </a>
            .
          </div>
          <div>
            Population estimates:{" "}
            <a
              href="https://dof.ca.gov/forecasting/demographics/estimates-e1/"
              rel="noreferrer"
              target="_blank"
              style={{ color: ink }}
            >
              California Department of Finance E-1 city/county/state
              population estimates
            </a>
            ; values shown are rounded county estimates.
          </div>
        </div>
      </div>
    </div>
  );
}
