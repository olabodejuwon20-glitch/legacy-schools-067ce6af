import { useEffect, useMemo, useState } from "react";
import { Bus, MapPin, Phone, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BusMap, { BusMarker, StopMarker } from "@/components/transport/BusMap";
import { distanceMeters, etaMinutes } from "@/lib/geo";

export default function ParentBusTracking({ role = "parent" }: { role?: "parent" | "self" }) {
  const { school } = useSchool();
  const [me, setMe] = useState<string | null>(null);
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [studentId, setStudentId] = useState("");
  const [assignment, setAssignment] = useState<any | null>(null);
  const [bus, setBus] = useState<any | null>(null);
  const [stops, setStops] = useState<any[]>([]);
  const [trip, setTrip] = useState<any | null>(null);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null)); }, []);

  useEffect(() => {
    if (!me || !school) return;
    (async () => {
      if (role === "self") {
        const { data } = await supabase.from("profiles").select("id,full_name").eq("id", me).maybeSingle();
        if (data) { setStudents([{ id: data.id, name: data.full_name }]); setStudentId(data.id); }
        return;
      }
      const { data: links } = await supabase.from("parent_links").select("student_user_id").eq("parent_user_id", me);
      const ids = (links ?? []).map((l: any) => l.student_user_id);
      if (!ids.length) { setStudents([]); return; }
      const { data: ps } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      setStudents((ps ?? []).map((p: any) => ({ id: p.id, name: p.full_name })));
      if (ids[0]) setStudentId(ids[0]);
    })();
  }, [me, school, role]);

  useEffect(() => {
    if (!studentId || !school) return;
    (async () => {
      const { data: a } = await supabase.from("transport_student_stops").select("*").eq("school_id", school.id).eq("student_id", studentId).maybeSingle();
      setAssignment(a);
      if (!a) { setBus(null); setStops([]); return; }
      const { data: b } = await supabase.from("transport_buses").select("*").eq("id", a.bus_id).maybeSingle();
      setBus(b);
      if (b?.route_id) {
        const { data: st } = await supabase.from("transport_stops").select("*").eq("route_id", b.route_id).order("sort_order");
        setStops(st ?? []);
      } else setStops([]);
    })();
  }, [studentId, school]);

  useEffect(() => {
    if (!bus || !school) return;
    let mounted = true;
    async function loadTrip() {
      const { data } = await supabase.from("transport_trips").select("*").eq("bus_id", bus.id).eq("status", "active")
        .order("started_at", { ascending: false }).limit(1).maybeSingle();
      if (mounted) setTrip(data);
    }
    async function loadEvents() {
      const { data } = await supabase.from("transport_trip_events").select("*").eq("bus_id", bus.id)
        .order("occurred_at", { ascending: false }).limit(20);
      if (mounted) setEvents(data ?? []);
    }
    loadTrip(); loadEvents();
    const ch = supabase.channel(`bus-parent:${bus.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transport_trips", filter: `bus_id=eq.${bus.id}` }, loadTrip)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transport_trip_events", filter: `bus_id=eq.${bus.id}` }, loadEvents)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [bus?.id, school]);

  const pickupStop = useMemo(() => stops.find(s => s.id === assignment?.pickup_stop_id), [stops, assignment]);
  const dropoffStop = useMemo(() => stops.find(s => s.id === assignment?.dropoff_stop_id), [stops, assignment]);

  const eta = useMemo(() => {
    if (!trip?.last_lat || !pickupStop) return null;
    const d = distanceMeters({ lat: trip.last_lat, lng: trip.last_lng }, { lat: pickupStop.lat, lng: pickupStop.lng });
    return { meters: Math.round(d), mins: etaMinutes(d, trip.last_speed) };
  }, [trip, pickupStop]);

  if (!students.length) {
    return <EmptyState icon={Bus} title="No bus rider linked" desc={role === "parent" ? "Your children aren't assigned to a school bus yet." : "You aren't assigned to a school bus yet."} />;
  }

  const busMarkers: BusMarker[] = trip?.last_lat ? [{
    id: trip.id, lat: trip.last_lat, lng: trip.last_lng, heading: trip.last_heading,
    label: bus?.name ?? "Bus",
    sublabel: trip.last_speed ? `${Math.round(trip.last_speed * 3.6)} km/h` : "stopped",
  }] : [];
  const stopMarkers: StopMarker[] = stops.map(s => ({
    id: s.id, lat: s.lat, lng: s.lng, name: s.name, radiusM: s.geofence_radius_m,
    highlight: s.id === pickupStop?.id || s.id === dropoffStop?.id,
  }));

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4">
      <SectionCard title="Live bus map" description={trip ? "Bus is on the move." : "Bus is offline. The view updates the moment the driver starts the trip."}>
        <BusMap buses={busMarkers} stops={stopMarkers} height={520} />
      </SectionCard>
      <SectionCard title="Trip details">
        <div className="space-y-3">
          {role === "parent" && students.length > 1 && (
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {bus ? (
            <div className="rounded-lg border border-border p-3 space-y-1.5">
              <div className="flex items-center gap-2"><Bus className="size-4 text-primary" /><strong>{bus.name}</strong></div>
              {bus.plate_number ? <div className="text-xs text-muted-foreground">Plate {bus.plate_number}</div> : null}
              {bus.driver_name ? <div className="text-xs">Driver: <strong>{bus.driver_name}</strong></div> : null}
              {bus.driver_phone ? (
                <Button asChild size="sm" variant="outline" className="mt-1">
                  <a href={`tel:${bus.driver_phone}`}><Phone className="size-3.5 mr-1" /> Call driver</a>
                </Button>
              ) : null}
            </div>
          ) : <div className="text-sm text-muted-foreground">No bus assigned.</div>}

          <div className="rounded-lg border border-border p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <Badge variant={trip ? "default" : "outline"} className={trip ? "bg-green-600" : ""}>{trip ? "Live" : "Offline"}</Badge>
              {trip?.last_ping_at ? <span className="text-xs text-muted-foreground">Updated {timeAgo(trip.last_ping_at)}</span> : null}
            </div>
            {eta ? (
              <div className="flex items-center gap-2 text-sm"><Timer className="size-4 text-primary" />ETA to pickup: <strong>{eta.mins} min</strong> <span className="text-xs text-muted-foreground">({(eta.meters / 1000).toFixed(2)} km)</span></div>
            ) : null}
            {pickupStop && <div className="text-xs"><MapPin className="size-3 inline mr-1 text-muted-foreground" />Pickup: <strong>{pickupStop.name}</strong></div>}
            {dropoffStop && <div className="text-xs"><MapPin className="size-3 inline mr-1 text-muted-foreground" />Dropoff: <strong>{dropoffStop.name}</strong></div>}
          </div>

          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Recent activity</div>
            {events.length === 0 ? <p className="text-xs text-muted-foreground">No events yet.</p> : (
              <ul className="space-y-1.5 text-sm max-h-[260px] overflow-auto pr-1">
                {events.map(ev => (
                  <li key={ev.id} className="border-b border-border pb-1.5 last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[10px]">{ev.kind.replace(/_/g, " ")}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(ev.occurred_at).toLocaleTimeString()}</span>
                    </div>
                    {ev.note ? <div className="text-xs mt-0.5 text-muted-foreground">{ev.note}</div> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return `${Math.round(s)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}