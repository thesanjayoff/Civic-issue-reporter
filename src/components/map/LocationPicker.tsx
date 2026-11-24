"use client";

import { useEffect, useRef } from "react";
import { Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/config/app";

const MAP_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://demotiles.maplibre.org/style.json";

interface Props {
  lon: number | null;
  lat: number | null;
  onChange: (lon: number, lat: number) => void;
}

/** Tap/click anywhere on the map to drop or move the pin — the location used for the report. */
export function LocationPicker({ lon, lat, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new MLMap({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: lon !== null && lat !== null ? [lon, lat] : DEFAULT_MAP_CENTER,
      zoom: lon !== null ? 16 : DEFAULT_MAP_ZOOM,
    });
    mapRef.current = map;

    if (lon !== null && lat !== null) {
      markerRef.current = new Marker({ draggable: true, color: "#b91c1c" }).setLngLat([lon, lat]).addTo(map);
      markerRef.current.on("dragend", () => {
        const pos = markerRef.current!.getLngLat();
        onChangeRef.current(pos.lng, pos.lat);
      });
    }

    map.on("click", (e) => {
      if (!markerRef.current) {
        markerRef.current = new Marker({ draggable: true, color: "#b91c1c" }).setLngLat(e.lngLat).addTo(map);
        markerRef.current.on("dragend", () => {
          const pos = markerRef.current!.getLngLat();
          onChangeRef.current(pos.lng, pos.lat);
        });
      } else {
        markerRef.current.setLngLat(e.lngLat);
      }
      onChangeRef.current(e.lngLat.lng, e.lngLat.lat);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || lon === null || lat === null) return;
    if (!markerRef.current) {
      markerRef.current = new Marker({ draggable: true, color: "#b91c1c" }).setLngLat([lon, lat]).addTo(map);
      markerRef.current.on("dragend", () => {
        const pos = markerRef.current!.getLngLat();
        onChangeRef.current(pos.lng, pos.lat);
      });
    } else {
      markerRef.current.setLngLat([lon, lat]);
    }
    map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 15) });
  }, [lon, lat]);

  return <div ref={containerRef} className="h-56 w-full overflow-hidden rounded-lg border border-neutral-300" />;
}
