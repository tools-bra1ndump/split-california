import React, { useState, useEffect, useRef } from "react";
import * as d3 from "d3";

const NORTH_SET = [
  "Del Norte", "Siskiyou", "Modoc", "Humboldt", "Trinity", "Shasta", "Lassen",
  "Tehama", "Plumas", "Mendocino", "Glenn", "Butte", "Sierra", "Lake", "Colusa",
  "Sutter", "Nevada", "Yuba", "Placer", "Yolo", "El Dorado", "Napa", "Sonoma",
  "Sacramento", "Solano", "Amador", "Alpine", "Marin", "Contra Costa",
  "San Francisco", "San Mateo", "Alameda", "Santa Clara", "Santa Cruz",
  "San Joaquin", "Stanislaus", "Calaveras", "Tuolumne", "Mariposa", "Merced",
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
          "Lake", "Colusa", "Sutter", "Nevada", "Yuba", "Placer", "Yolo",
          "El Dorado", "Napa", "Sonoma", "Sacramento", "Solano", "Amador", "Alpine",
        ],
      },
      east: {
        label: "East California",
        color: "#1B9AAA",
        capital: { name: "Sacramento", coords: [-121.494, 38.582] },
        counties: [
          "Marin", "Contra Costa", "San Francisco", "San Mateo", "Alameda",
          "Santa Clara", "Santa Cruz", "San Benito", "Monterey",
          "San Luis Obispo", "Santa Barbara", "Ventura", "Los Angeles",
        ],
      },
      west: {
        label: "West California",
        color: "#F28C28",
        capital: { name: "Monterey", coords: [-121.895, 36.600] },
        counties: [
          "Calaveras", "Tuolumne", "San Joaquin", "Stanislaus", "Mariposa",
          "Mono", "Merced", "Madera", "Fresno", "Inyo", "Kings", "Tulare",
          "Kern", "San Bernardino", "Orange", "Riverside", "San Diego", "Imperial",
        ],
      },
    },
  },
  two: {
    title: "Two Californias",
    regions: {
      north: {
        label: "North California",
        color: "#27AAB8",
        capital: { name: "Sacramento", coords: [-121.494, 38.582] },
        counties: NORTH_SET,
      },
      south: {
        label: "South California",
        color: "#E03131",
        capital: { name: "San Bernardino", coords: [-117.290, 34.108] },
        counties: [
          "Mono", "Inyo", "San Luis Obispo", "Kern", "Santa Barbara", "Ventura",
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
  const [error, setError] = useState(null);
  const [scenarioKey, setScenarioKey] = useState("three");
  const [hovered, setHovered] = useState(null);
  const [selectedCounty, setSelectedCounty] = useState(null);

  const scenario = SCENARIOS[scenarioKey];
  const { countyToRegion, stats } = React.useMemo(
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
        const counties = topoFeature(topology, topology.objects.counties).features;
        const ca = counties.filter((f) => String(f.id).startsWith("06"));
        if (!cancelled) setGeographies(ca);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { setSelectedCounty(null); }, [scenarioKey]);

  useEffect(() => {
    if (!geographies || !svgRef.current) return;
    const width = 620, height = 720;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const projection = d3.geoMercator().fitSize([width, height], {
      type: "FeatureCollection", features: geographies,
    });
    const path = d3.geoPath().projection(projection);

    const gFill = svg.append("g");
    svg.append("g").attr("class", "highlight-layer").attr("pointer-events", "none");
    const gLabel = svg.append("g").attr("pointer-events", "none");
    const gCapital = svg.append("g").attr("pointer-events", "none");

    gFill.selectAll("path")
      .data(geographies)
      .join("path")
      .attr("d", path)
      .attr("fill", (d) => {
        const region = countyToRegion[d.properties.name];
        return region ? scenario.regions[region].color : "#dcd8cc";
      })
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 0.6)
      .attr("cursor", "pointer")
      .attr("data-county", (d) => d.properties.name)
      .on("mouseenter", function (event, d) {
        setHovered(d.properties.name);
      })
      .on("mouseleave", function () {
        setHovered(null);
      })
      .on("click", function (event, d) {
        setSelectedCounty(d.properties.name);
      });

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
      .attr("r", 4)
      .attr("fill", "#1a1a1a")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.4);
    capGroup.append("text")
      .attr("y", -7)
      .attr("text-anchor", "middle")
      .attr("font-size", 8.5)
      .attr("font-weight", 700)
      .attr("font-family", "'IBM Plex Sans', sans-serif")
      .attr("fill", "#1a1a1a")
      .attr("paint-order", "stroke")
      .attr("stroke", "#fff")
      .attr("stroke-width", 3)
      .text((c) => "★ " + c.name);
  }, [geographies, scenarioKey]);

  useEffect(() => {
    if (!svgRef.current || !geographies) return;
    const width = 620, height = 720;
    const projection = d3.geoMercator().fitSize([width, height], {
      type: "FeatureCollection", features: geographies,
    });
    const path = d3.geoPath().projection(projection);
    const findCounty = (name) =>
      geographies.find((d) => d.properties.name === name);

    const outlines = [
      selectedCounty && { kind: "selected", feature: findCounty(selectedCounty) },
      hovered &&
        hovered !== selectedCounty && {
          kind: "hovered",
          feature: findCounty(hovered),
        },
    ].filter((outline) => outline && outline.feature);

    d3.select(svgRef.current)
      .select(".highlight-layer")
      .selectAll("path")
      .data(outlines, (d) => d.kind)
      .join(
        (enter) =>
          enter
            .append("path")
            .attr("fill", "none")
            .attr("pointer-events", "none")
            .attr("stroke-linejoin", "round")
            .attr("stroke-linecap", "round")
            .attr("vector-effect", "non-scaling-stroke"),
        (update) => update,
        (exit) => exit.remove()
      )
      .attr("d", (d) => path(d.feature))
      .attr("stroke", "#1a1a1a")
      .attr("stroke-width", (d) => (d.kind === "selected" ? 2.2 : 1.3))
      .attr("stroke-opacity", (d) => (d.kind === "selected" ? 1 : 0.75));
  }, [geographies, hovered, selectedCounty, scenarioKey]);

  function buildExportSVG() {
    const src = svgRef.current;
    if (!src) return null;
    const clone = src.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", "620");
    clone.setAttribute("height", "760");
    clone.setAttribute("viewBox", "0 0 620 760");
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("x", "0");
    bg.setAttribute("y", "0");
    bg.setAttribute("width", "620");
    bg.setAttribute("height", "760");
    bg.setAttribute("fill", "#ffffff");
    clone.insertBefore(bg, clone.firstChild);
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", "310");
    t.setAttribute("y", "745");
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
      canvas.width = 620 * scale;
      canvas.height = 760 * scale;
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
        <div style={{ position: "relative", flex: "0 1 620px" }}>
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
            viewBox="0 0 620 720"
            style={{
              width: "min(620px, 86vw)",
              height: "auto",
              display: geographies ? "block" : "none",
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

        <div style={{ minWidth: 230, flex: "0 1 260px" }}>
          {Object.entries(scenario.regions).map(([key, r]) => {
            const dim = hovered && countyToRegion[hovered] !== key;
            const active = selectedRegion === key;
            return (
              <div
                key={key}
                style={{
                  marginBottom: 22,
                  paddingLeft: 14,
                  borderLeft: `3px solid ${active ? r.color : "transparent"}`,
                  opacity: dim ? 0.4 : 1,
                  transition: "opacity 0.2s, border-color 0.2s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      background: r.color,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "'Fraunces', serif",
                      fontWeight: 600,
                      fontSize: 17,
                      color: ink,
                    }}
                  >
                    {r.label}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12.5,
                    color: muted,
                    lineHeight: 1.7,
                  }}
                >
                  <div>
                    Capital&nbsp;&nbsp;
                    <span style={{ color: ink, fontWeight: 600 }}>
                      ★ {r.capital.name}
                    </span>
                  </div>
                  <div>
                    Counties&nbsp;&nbsp;
                    <span style={{ color: ink, fontWeight: 600 }}>
                      {stats[key].count}
                    </span>
                  </div>
                  <div>
                    Population&nbsp;&nbsp;
                    <span style={{ color: ink, fontWeight: 600 }}>
                      {fmt(stats[key].pop)}
                    </span>
                  </div>
                  <div>
                    Largest&nbsp;&nbsp;
                    <span style={{ color: ink, fontWeight: 600 }}>
                      {stats[key].largest}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

        </div>
      </div>

      <div
        className="no-print"
        style={{
          marginTop: 28,
          width: "min(620px, 86vw)",
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
      </div>
    </div>
  );
}
