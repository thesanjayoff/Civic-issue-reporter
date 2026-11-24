"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Map as MLMap, Popup, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/config/app";
import type { CategoryDef } from "@/lib/catalog/categories";

const MAP_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://demotiles.maplibre.org/style.json";

interface MapReport {
  id: string;
  publicCode: string;
  categoryId: string;
  status: string;
  wardId: string | null;
  createdAt: string;
  slaDeadline: string | null;
  supporterCount: number;
  lon: number;
  lat: number;
}

const STATUS_COLOR: Record<string, string> = {
  open: "#b45309",
  filed: "#1d4ed8",
  acknowledged: "#2563eb",
  in_progress: "#7c3aed",
  resolved_by_authority: "#16a34a",
  verified_fixed: "#15803d",
  disputed: "#b91c1c",
  reopened: "#dc2626",
  escalated: "#ea580c",
  closed: "#4b5563",
};

function toGeoJson(reports: MapReport[]) {
  return {
    type: "FeatureCollection" as const,
    features: reports.map((r) => ({
      type: "Feature" as const,
      properties: {
        publicCode: r.publicCode,
        status: r.status,
        color: STATUS_COLOR[r.status] ?? "#525252",
        overdue: r.slaDeadline ? new Date(r.slaDeadline).getTime() < Date.now() : false,
        supporterCount: r.supporterCount,
      },
      geometry: { type: "Point" as const, coordinates: [r.lon, r.lat] },
    })),
  };
}

export interface MapFilters {
  categoryIds: string[];
  statuses: string[];
  overdueOnly: boolean;
}

interface Props {
  categories: CategoryDef[];
  categoryIdBySlug: Record<string, string>;
  statusLabels: Record<string, string>;
  categoryLabel: string;
  statusLabelText: string;
  overdueOnlyLabel: string;
  heatmapLabel: string;
  allLabel: string;
  locale: string;
}

export function ReportsMap({ categories, categoryIdBySlug, statusLabels, categoryLabel, statusLabelText, overdueOnlyLabel, heatmapLabel, allLabel, locale }: Props) {
  const statusLabel = useCallback((status: string) => statusLabels[status] ?? status, [statusLabels]);
  const trackHref = useCallback((code: string) => `/${locale}/track/${code}`, [locale]);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [categorySlug, setCategorySlug] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [heatmap, setHeatmap] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  const fetchReports = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    const params = new URLSearchParams({
      minLon: String(bounds.getWest()),
      minLat: String(bounds.getSouth()),
      maxLon: String(bounds.getEast()),
      maxLat: String(bounds.getNorth()),
    });
    if (categorySlug && categoryIdBySlug[categorySlug]) params.set("categoryIds", categoryIdBySlug[categorySlug]);
    if (status) params.set("status", status);

    const res = await fetch(`/api/reports?${params.toString()}`);
    if (!res.ok) return;
    const data: { reports: MapReport[] } = await res.json();
    const filtered = overdueOnly ? data.reports.filter((r) => r.slaDeadline && new Date(r.slaDeadline).getTime() < Date.now()) : data.reports;
    setCount(filtered.length);

    const source = map.getSource("reports") as GeoJSONSource | undefined;
    source?.setData(toGeoJson(filtered));
  }, [categorySlug, status, overdueOnly, categoryIdBySlug]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new MLMap({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
    });
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("reports", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 15,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "reports",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#0f5132",
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 50, 30],
          "circle-opacity": 0.85,
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "reports",
        filter: ["has", "point_count"],
        layout: { "text-field": "{point_count_abbreviated}", "text-size": 13 },
        paint: { "text-color": "#ffffff" },
      });
      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "reports",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": 8,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addLayer({
        id: "reports-heat",
        type: "heatmap",
        source: "reports",
        layout: { visibility: "none" },
        paint: {
          "heatmap-weight": 1,
          "heatmap-intensity": 1,
          "heatmap-radius": 25,
          "heatmap-opacity": 0.75,
        },
      });

      map.on("click", "unclustered-point", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const code = feature.properties?.publicCode as string;
        const status = feature.properties?.status as string;
        const supporterCount = feature.properties?.supporterCount as number;
        const coords = (feature.geometry as { type: "Point"; coordinates: [number, number] }).coordinates;
        new Popup()
          .setLngLat(coords)
          .setHTML(
            `<div style="font-family:sans-serif;font-size:13px;min-width:160px">
              <strong>${code}</strong><br/>${statusLabel(status)}<br/>
              <a href="${trackHref(code)}" style="color:#0f5132;font-weight:600">View report →</a>
              <div style="color:#555;margin-top:4px">${supporterCount} supporting</div>
            </div>`
          )
          .addTo(map);
      });
      map.on("mouseenter", "unclustered-point", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "unclustered-point", () => (map.getCanvas().style.cursor = ""));

      fetchReports();
    });

    map.on("moveend", fetchReports);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("reports-heat")) return;
    map.setLayoutProperty("reports-heat", "visibility", heatmap ? "visible" : "none");
    map.setLayoutProperty("clusters", "visibility", heatmap ? "none" : "visible");
    map.setLayoutProperty("cluster-count", "visibility", heatmap ? "none" : "visible");
    map.setLayoutProperty("unclustered-point", "visibility", heatmap ? "none" : "visible");
  }, [heatmap]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-200 bg-white px-3 py-2 text-sm">
        <label className="flex items-center gap-1">
          <span className="sr-only">{categoryLabel}</span>
          <select value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)} className="rounded border border-neutral-300 px-2 py-1">
            <option value="">{allLabel} ({categoryLabel})</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nameEn}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="sr-only">{statusLabelText}</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-neutral-300 px-2 py-1">
            <option value="">{allLabel} ({statusLabelText})</option>
            {["open", "filed", "acknowledged", "in_progress", "resolved_by_authority", "verified_fixed", "disputed", "reopened", "escalated"].map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
          {overdueOnlyLabel}
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={heatmap} onChange={(e) => setHeatmap(e.target.checked)} />
          {heatmapLabel}
        </label>
        {count !== null && <span className="ml-auto text-neutral-500">{count}</span>}
      </div>
      <div ref={containerRef} className="min-h-0 flex-1" />
    </div>
  );
}
