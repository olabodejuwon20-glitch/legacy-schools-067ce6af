import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

// Fix Leaflet default-marker assets under Vite
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

export type LatLng = { lat: number; lng: number };
export type BusMarker = LatLng & { id: string; label: string; sublabel?: string; heading?: number | null };
export type StopMarker = LatLng & { id: string; name: string; radiusM?: number; highlight?: boolean };

function busIcon(heading?: number | null) {
  const rot = heading == null ? 0 : Math.round(heading);
  return L.divIcon({
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `<div style="width:36px;height:36px;border-radius:50%;background:hsl(220 90% 56%);color:white;display:grid;place-items:center;box-shadow:0 4px 14px rgba(0,0,0,.25);border:3px solid white;transform:rotate(${rot}deg);">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M16 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><circle cx="15" cy="18" r="2"/></svg>
    </div>`,
  });
}

const stopIcon = L.divIcon({
  className: "",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  html: `<div style="width:18px;height:18px;border-radius:50%;background:hsl(140 60% 45%);border:3px solid white;box-shadow:0 1px 6px rgba(0,0,0,.3)"></div>`,
});

const highlightStopIcon = L.divIcon({
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<div style="width:22px;height:22px;border-radius:50%;background:hsl(0 80% 60%);border:3px solid white;box-shadow:0 1px 8px rgba(0,0,0,.35);animation:pulse 1.6s infinite;"></div>`,
});

function Recenter({ center, zoom }: { center?: LatLng; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView([center.lat, center.lng], zoom ?? map.getZoom(), { animate: true });
  }, [center?.lat, center?.lng]);
  return null;
}

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const b = L.latLngBounds(points.map(p => [p.lat, p.lng] as [number, number]));
    map.fitBounds(b, { padding: [40, 40], maxZoom: 16 });
  }, [JSON.stringify(points)]);
  return null;
}

interface BusMapProps {
  buses?: BusMarker[];
  stops?: StopMarker[];
  trail?: LatLng[];
  center?: LatLng;
  zoom?: number;
  height?: number | string;
  fitToAll?: boolean;
  onClickMap?: (ll: LatLng) => void;
  className?: string;
}

function ClickHandler({ onClickMap }: { onClickMap?: (ll: LatLng) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!onClickMap) return;
    const h = (e: L.LeafletMouseEvent) => onClickMap({ lat: e.latlng.lat, lng: e.latlng.lng });
    map.on("click", h);
    return () => { map.off("click", h); };
  }, [onClickMap]);
  return null;
}

const FALLBACK: LatLng = { lat: 9.082, lng: 8.6753 }; // Nigeria center

export default function BusMap({
  buses = [], stops = [], trail = [], center, zoom = 13, height = 420, fitToAll = true, onClickMap, className,
}: BusMapProps) {
  const initial = center ?? buses[0] ?? stops[0] ?? FALLBACK;
  const fitPoints = useMemo(() => fitToAll ? [...buses, ...stops] : [], [fitToAll, buses, stops]);

  return (
    <div className={className} style={{ height, width: "100%", borderRadius: 12, overflow: "hidden", border: "1px solid hsl(var(--border))" }}>
      <MapContainer center={[initial.lat, initial.lng]} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {trail.length > 1 && (
          <Polyline positions={trail.map(p => [p.lat, p.lng]) as any} pathOptions={{ color: "hsl(220 90% 56%)", weight: 4, opacity: 0.65 }} />
        )}
        {stops.map(s => (
          <Marker key={s.id} position={[s.lat, s.lng]} icon={s.highlight ? highlightStopIcon : stopIcon}>
            <Popup>
              <strong>{s.name}</strong>
              {s.radiusM ? <div className="text-xs">Geofence: {s.radiusM} m</div> : null}
            </Popup>
            {s.radiusM ? <Circle center={[s.lat, s.lng]} radius={s.radiusM} pathOptions={{ color: "hsl(140 60% 45%)", weight: 1, opacity: 0.4, fillOpacity: 0.08 }} /> : null}
          </Marker>
        ))}
        {buses.map(b => (
          <Marker key={b.id} position={[b.lat, b.lng]} icon={busIcon(b.heading)}>
            <Popup>
              <strong>{b.label}</strong>
              {b.sublabel ? <div className="text-xs text-muted-foreground">{b.sublabel}</div> : null}
            </Popup>
          </Marker>
        ))}
        {fitPoints.length > 1 ? <FitBounds points={fitPoints} /> : <Recenter center={initial} zoom={zoom} />}
        <ClickHandler onClickMap={onClickMap} />
      </MapContainer>
    </div>
  );
}