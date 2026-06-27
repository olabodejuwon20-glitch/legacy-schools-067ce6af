import { useEffect, useMemo, useRef, useState } from "react";
import { Bus, MapPin, Pause, Play, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import BusMap, { BusMarker, StopMarker } from "@/components/transport/BusMap";
import { distanceMeters } from "@/lib/geo";

export default function DriverTrip() {
  const { school } = useSchool();
  const [me, setMe] = useState<string | null>(null);
  const [buses, setBuses] = useState<any[]>([]);
  const [stops, setStops] = useState<any[]>([]);
  const [busId, setBusId] = useState("");
  const [direction, setDirection] = useState<string>("pickup");
  const [trip, setTrip] = useState<any | null>(null);
  const [pos, setPos] = useState<GeolocationPosition | null>(null);
  const [trail, setTrail] = useState<{ lat: number; lng: number }[]>([]);
  const watchRef = useRef<number | null>(null);
  const visitedStops = useRef<Set<string>>(new Set());

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null)); }, []);

  useEffect(() => {
    if (!school || !me) return;
    supabase.from("transport_buses").select("*").eq("school_id", school.id).eq("driver_user_id", me)
      .then(({ data }) => { setBuses(data ?? []); if (data?.[0]) setBusId(data[0].id); });
  }, [school, me]);

  useEffect(() => {
    if (!school || !busId) { setStops([]); return; }
    const bus = buses.find(b => b.id === busId);
    if (!bus?.route_id) return setStops([]);
    supabase.from("transport_stops").select("*").eq("route_id", bus.route_id).order("sort_order")
      .then(({ data }) => setStops(data ?? []));
  }, [busId, buses, school]);

  // Resume an active trip
  useEffect(() => {
    if (!school || !busId) return;
    supabase.from("transport_trips").select("*").eq("school_id", school.id).eq("bus_id", busId).eq("status", "active")
      .order("started_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (data) { setTrip(data); setDirection(data.direction); } });
  }, [school, busId]);

  async function startTrip() {
    if (!school || !busId || !me) return;
    const { data, error } = await supabase.from("transport_trips").insert({
      school_id: school.id, bus_id: busId, driver_user_id: me, direction,
      status: "active", started_at: new Date().toISOString(),
    }).select().single();
    if (error) return toast.error(error.message);
    setTrip(data); setTrail([]); visitedStops.current.clear();
    await supabase.from("transport_trip_events").insert({ school_id: school.id, trip_id: data.id, bus_id: busId, kind: "trip_started" });
    toast.success("Trip started");
  }

  async function endTrip() {
    if (!trip) return;
    await supabase.from("transport_trips").update({ status: "completed", ended_at: new Date().toISOString() }).eq("id", trip.id);
    await supabase.from("transport_trip_events").insert({ school_id: trip.school_id, trip_id: trip.id, bus_id: trip.bus_id, kind: "trip_ended" });
    stopWatch(); setTrip(null); toast.success("Trip ended");
  }

  function startWatch() {
    if (!("geolocation" in navigator)) return toast.error("Location not supported on this device");
    if (watchRef.current != null) return;
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => { setPos(p); pushPosition(p); },
      (err) => toast.error(err.message || "Could not read GPS"),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
  }
  function stopWatch() {
    if (watchRef.current != null) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null; }
  }
  useEffect(() => () => stopWatch(), []);

  async function pushPosition(p: GeolocationPosition) {
    if (!trip) return;
    const { latitude, longitude, speed, heading, accuracy } = p.coords;
    const ll = { lat: latitude, lng: longitude };
    setTrail(t => [...t.slice(-200), ll]);
    await supabase.from("transport_trip_locations").insert({
      trip_id: trip.id, school_id: trip.school_id,
      lat: latitude, lng: longitude,
      speed: speed ?? null, heading: heading ?? null, accuracy: accuracy ?? null,
    } as any);
    await supabase.from("transport_trips").update({
      last_lat: latitude, last_lng: longitude, last_speed: speed, last_heading: heading, last_ping_at: new Date().toISOString(),
    } as any).eq("id", trip.id);
    // Geofence detection
    for (const s of stops) {
      if (visitedStops.current.has(s.id)) continue;
      const d = distanceMeters(ll, { lat: s.lat, lng: s.lng });
      if (d <= (s.geofence_radius_m || 120)) {
        visitedStops.current.add(s.id);
        await supabase.from("transport_trip_events").insert({
          school_id: trip.school_id, trip_id: trip.id, bus_id: trip.bus_id, stop_id: s.id,
          kind: "arrived_stop",
          note: `Arrived at ${s.name}`,
        });
      }
    }
  }

  const buseMarkers: BusMarker[] = pos ? [{
    id: "me", lat: pos.coords.latitude, lng: pos.coords.longitude, heading: pos.coords.heading,
    label: buses.find(b => b.id === busId)?.name ?? "Your bus",
    sublabel: pos.coords.speed ? `${Math.round(pos.coords.speed * 3.6)} km/h` : "stopped",
  }] : [];
  const stopMarkers: StopMarker[] = stops.map(s => ({
    id: s.id, lat: s.lat, lng: s.lng, name: s.name, radiusM: s.geofence_radius_m,
    highlight: visitedStops.current.has(s.id),
  }));

  const tracking = watchRef.current != null;

  if (!buses.length) {
    return <EmptyState icon={Bus} title="No bus assigned" desc="Ask your school admin to assign you to a bus." />;
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4">
      <SectionCard title="Live map" description="Your position is streamed to the school and parents in real time.">
        <BusMap buses={buseMarkers} stops={stopMarkers} trail={trail} height={520} />
      </SectionCard>
      <SectionCard title="Trip controls">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Bus</label>
            <Select value={busId} onValueChange={setBusId} disabled={!!trip}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{buses.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Direction</label>
            <Select value={direction} onValueChange={(v: any) => setDirection(v)} disabled={!!trip}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pickup">Morning pickup (to school)</SelectItem>
                <SelectItem value="dropoff">Afternoon dropoff (from school)</SelectItem>
                <SelectItem value="other">Other trip</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant={trip ? "default" : "outline"}>{trip ? "Trip active" : "Idle"}</Badge>
              <Badge variant={tracking ? "default" : "outline"} className={tracking ? "bg-green-600" : ""}>{tracking ? "GPS on" : "GPS off"}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {pos ? `Lat ${pos.coords.latitude.toFixed(5)}, Lng ${pos.coords.longitude.toFixed(5)} · ±${Math.round(pos.coords.accuracy)}m` : "Waiting for first GPS reading…"}
            </div>
            {trip ? (
              <div className="grid grid-cols-2 gap-2">
                {tracking
                  ? <Button variant="outline" onClick={stopWatch}><Pause className="size-4 mr-1.5" /> Pause GPS</Button>
                  : <Button onClick={startWatch}><Play className="size-4 mr-1.5" /> Resume GPS</Button>}
                <Button variant="destructive" onClick={endTrip}><Square className="size-4 mr-1.5" /> End trip</Button>
              </div>
            ) : (
              <Button className="w-full" onClick={async () => { await startTrip(); startWatch(); }}>
                <Play className="size-4 mr-1.5" /> Start trip
              </Button>
            )}
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Stops on route</div>
            <ul className="space-y-1 text-sm max-h-[200px] overflow-auto">
              {stops.map((s, i) => (
                <li key={s.id} className="flex items-center justify-between border-b border-border py-1">
                  <span className="flex items-center gap-1.5"><MapPin className="size-3 text-muted-foreground" />#{i + 1} {s.name}</span>
                  {visitedStops.current.has(s.id) ? <Badge className="bg-green-600">Visited</Badge> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}