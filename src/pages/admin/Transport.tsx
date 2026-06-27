import { useEffect, useMemo, useState } from "react";
import { Bus, MapPin, Plus, Radio, Route as RouteIcon, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import BusMap, { BusMarker, StopMarker } from "@/components/transport/BusMap";

export default function AdminTransport() {
  const { school } = useSchool();
  return (
    <Tabs defaultValue="live" className="space-y-4">
      <TabsList className="flex-wrap">
        <TabsTrigger value="live"><Radio className="size-4 mr-1.5" /> Live tracking</TabsTrigger>
        <TabsTrigger value="buses"><Bus className="size-4 mr-1.5" /> Buses</TabsTrigger>
        <TabsTrigger value="routes"><RouteIcon className="size-4 mr-1.5" /> Routes</TabsTrigger>
        <TabsTrigger value="stops"><MapPin className="size-4 mr-1.5" /> Stops</TabsTrigger>
        <TabsTrigger value="riders"><Users className="size-4 mr-1.5" /> Riders</TabsTrigger>
      </TabsList>
      <TabsContent value="live"><LiveTracking schoolId={school?.id} /></TabsContent>
      <TabsContent value="buses"><Buses schoolId={school?.id} /></TabsContent>
      <TabsContent value="routes"><Routes schoolId={school?.id} /></TabsContent>
      <TabsContent value="stops"><Stops schoolId={school?.id} /></TabsContent>
      <TabsContent value="riders"><Riders schoolId={school?.id} /></TabsContent>
    </Tabs>
  );
}

/* ============= LIVE TRACKING ============= */
function LiveTracking({ schoolId }: { schoolId?: string }) {
  const [trips, setTrips] = useState<any[]>([]);
  const [buses, setBuses] = useState<any[]>([]);
  const [stops, setStops] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  async function loadAll() {
    if (!schoolId) return;
    const [t, b, s, e] = await Promise.all([
      supabase.from("transport_trips").select("*").eq("school_id", schoolId).eq("status", "active"),
      supabase.from("transport_buses").select("id,name,plate_number,driver_name,route_id").eq("school_id", schoolId),
      supabase.from("transport_stops").select("*").eq("school_id", schoolId),
      supabase.from("transport_trip_events").select("*").eq("school_id", schoolId).order("occurred_at", { ascending: false }).limit(30),
    ]);
    setTrips(t.data ?? []); setBuses(b.data ?? []); setStops(s.data ?? []); setEvents(e.data ?? []);
  }
  useEffect(() => { loadAll(); }, [schoolId]);

  useEffect(() => {
    if (!schoolId) return;
    const ch = supabase.channel(`bus-live:${schoolId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transport_trips", filter: `school_id=eq.${schoolId}` }, loadAll)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transport_trip_events", filter: `school_id=eq.${schoolId}` }, (p: any) => {
        setEvents(prev => [p.new, ...prev].slice(0, 30));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [schoolId]);

  const busMarkers: BusMarker[] = useMemo(() => trips.filter(t => t.last_lat && t.last_lng).map(t => {
    const b = buses.find(x => x.id === t.bus_id);
    return {
      id: t.id,
      lat: t.last_lat, lng: t.last_lng,
      heading: t.last_heading,
      label: b?.name ?? "Bus",
      sublabel: `${b?.driver_name ?? "Driver"} · ${t.direction} · ${t.last_speed ? Math.round(t.last_speed * 3.6) + " km/h" : "stopped"}`,
    };
  }), [trips, buses]);

  const stopMarkers: StopMarker[] = stops.map(s => ({
    id: s.id, lat: s.lat, lng: s.lng, name: s.name, radiusM: s.geofence_radius_m,
  }));

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <SectionCard title={`Live fleet · ${trips.length} active`} description="Real-time bus locations updated as drivers ping their location.">
          <BusMap buses={busMarkers} stops={stopMarkers} height={520} />
        </SectionCard>
      </div>
      <SectionCard title="Recent events" description="Boarding, dropoff and geofence alerts.">
        {events.length === 0 ? <EmptyState icon={Radio} title="No events yet" desc="They will appear as trips run." /> : (
          <ul className="space-y-2 text-sm max-h-[480px] overflow-auto pr-1">
            {events.map(ev => (
              <li key={ev.id} className="border-b border-border pb-2 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="text-[10px]">{ev.kind.replace(/_/g, " ")}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(ev.occurred_at).toLocaleTimeString()}</span>
                </div>
                {ev.note ? <div className="text-xs mt-1 text-muted-foreground">{ev.note}</div> : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

/* ============= BUSES ============= */
function Buses({ schoolId }: { schoolId?: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", plate_number: "", capacity: 0, route_id: "", driver_user_id: "", driver_name: "", driver_phone: "" });

  async function load() {
    if (!schoolId) return;
    const [a, b, mem] = await Promise.all([
      supabase.from("transport_buses").select("*").eq("school_id", schoolId).order("name"),
      supabase.from("transport_routes").select("id,name").eq("school_id", schoolId),
      supabase.from("memberships").select("user_id").eq("school_id", schoolId).eq("status", "active").in("role", ["teacher", "admin"]),
    ]);
    setRows(a.data ?? []); setRoutes(b.data ?? []);
    const ids = (mem.data ?? []).map((m: any) => m.user_id);
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      setDrivers((ps ?? []).map((p: any) => ({ user_id: p.id, full_name: p.full_name })));
    } else setDrivers([]);
  }
  useEffect(() => { load(); }, [schoolId]);

  async function add(e: React.FormEvent) {
    e.preventDefault(); if (!schoolId || busy) return; setBusy(true);
    const payload: any = { ...form, school_id: schoolId, capacity: Number(form.capacity) || 0 };
    if (!payload.route_id) delete payload.route_id;
    if (!payload.driver_user_id) delete payload.driver_user_id;
    const { error } = await supabase.from("transport_buses").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Bus added"); setOpen(false);
    setForm({ name: "", plate_number: "", capacity: 0, route_id: "", driver_user_id: "", driver_name: "", driver_phone: "" });
    load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this bus?")) return;
    const { error } = await supabase.from("transport_buses").delete().eq("id", id);
    if (error) return toast.error(error.message); load();
  }

  return (
    <SectionCard title="Buses" description="Each bus is assigned to a route and a driver who streams GPS." action={
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-1" /> Add bus</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Add bus</DialogTitle></DialogHeader>
          <form onSubmit={add} className="space-y-3">
            <div><Label>Bus name / number</Label><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Plate number</Label><Input value={form.plate_number} onChange={e => setForm({ ...form, plate_number: e.target.value })} /></div>
              <div><Label>Capacity</Label><Input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: +e.target.value })} /></div>
            </div>
            <div><Label>Route</Label>
              <Select value={form.route_id} onValueChange={v => setForm({ ...form, route_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select route" /></SelectTrigger>
                <SelectContent>{routes.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Driver (staff account)</Label>
              <Select value={form.driver_user_id} onValueChange={v => setForm({ ...form, driver_user_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pick driver from staff" /></SelectTrigger>
              <SelectContent>{drivers.map((d: any) => <SelectItem key={d.user_id} value={d.user_id}>{d.full_name ?? "Staff member"}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Driver must sign in with their account to stream GPS.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Driver display name</Label><Input value={form.driver_name} onChange={e => setForm({ ...form, driver_name: e.target.value })} /></div>
              <div><Label>Driver phone</Label><Input value={form.driver_phone} onChange={e => setForm({ ...form, driver_phone: e.target.value })} /></div>
            </div>
            <Button type="submit" disabled={busy} className="w-full">{busy ? "Saving…" : "Save"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    }>
      {rows.length === 0 ? <EmptyState icon={Bus} title="No buses yet" desc="Add a bus to start tracking." /> : (
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground"><tr className="border-b border-border">
            <th className="text-left py-2">Bus</th><th className="text-left">Plate</th><th className="text-left">Driver</th>
            <th className="text-right">Capacity</th><th></th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.id} className="border-b border-border last:border-0">
              <td className="py-3 font-medium">{r.name}</td>
              <td className="text-muted-foreground">{r.plate_number || "—"}</td>
              <td className="text-muted-foreground">{r.driver_name || (r.driver_user_id ? "Assigned" : "—")}</td>
              <td className="text-right tabular-nums">{r.capacity}</td>
              <td className="text-right"><Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="size-4 text-destructive" /></Button></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </SectionCard>
  );
}

/* ============= ROUTES ============= */
function Routes({ schoolId }: { schoolId?: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", driver: "", vehicle_no: "", capacity: 0, fee: 0 });
  async function load() {
    if (!schoolId) return;
    const { data } = await supabase.from("transport_routes").select("*").eq("school_id", schoolId).order("name");
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, [schoolId]);
  async function add(e: React.FormEvent) {
    e.preventDefault(); if (!schoolId || busy) return; setBusy(true);
    const { error } = await supabase.from("transport_routes").insert({ ...form, school_id: schoolId });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Route added"); setOpen(false);
    setForm({ name: "", driver: "", vehicle_no: "", capacity: 0, fee: 0 }); load();
  }
  async function remove(id: string) {
    if (!confirm("Delete route?")) return;
    const { error } = await supabase.from("transport_routes").delete().eq("id", id);
    if (error) return toast.error(error.message); load();
  }
  return (
    <SectionCard title="Routes" description="Logical routes / fee tiers. Add stops in the Stops tab." action={
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-1" /> Add route</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Add route</DialogTitle></DialogHeader>
          <form onSubmit={add} className="space-y-3">
            <div><Label>Route name</Label><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Fee</Label><Input type="number" value={form.fee} onChange={e => setForm({ ...form, fee: +e.target.value })} /></div>
              <div><Label>Capacity</Label><Input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: +e.target.value })} /></div>
            </div>
            <Button type="submit" disabled={busy} className="w-full">{busy ? "Saving…" : "Save"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    }>
      {rows.length === 0 ? <EmptyState icon={RouteIcon} title="No routes yet" desc="Create a route, then add stops and assign a bus." /> : (
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground"><tr className="border-b border-border">
            <th className="text-left py-2">Route</th><th className="text-right">Capacity</th><th className="text-right">Fee</th><th></th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.id} className="border-b border-border last:border-0">
              <td className="py-3 font-medium">{r.name}</td>
              <td className="text-right tabular-nums">{r.capacity}</td>
              <td className="text-right tabular-nums">{Number(r.fee).toLocaleString()}</td>
              <td className="text-right"><Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="size-4 text-destructive" /></Button></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </SectionCard>
  );
}

/* ============= STOPS ============= */
function Stops({ schoolId }: { schoolId?: string }) {
  const [routes, setRoutes] = useState<any[]>([]);
  const [routeId, setRouteId] = useState("");
  const [stops, setStops] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [pendingLL, setPendingLL] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(120);
  const [busy, setBusy] = useState(false);

  async function loadRoutes() {
    if (!schoolId) return;
    const { data } = await supabase.from("transport_routes").select("id,name").eq("school_id", schoolId);
    setRoutes(data ?? []);
    if (!routeId && data?.[0]) setRouteId(data[0].id);
  }
  async function loadStops(rid: string) {
    if (!rid) return setStops([]);
    const { data } = await supabase.from("transport_stops").select("*").eq("route_id", rid).order("sort_order");
    setStops(data ?? []);
  }
  useEffect(() => { loadRoutes(); }, [schoolId]);
  useEffect(() => { loadStops(routeId); }, [routeId]);

  async function addStop() {
    if (!schoolId || !routeId || !pendingLL || !name.trim() || busy) return;
    setBusy(true);
    const next = (stops[stops.length - 1]?.sort_order ?? 0) + 1;
    const { error } = await supabase.from("transport_stops").insert({
      school_id: schoolId, route_id: routeId, name: name.trim(),
      lat: pendingLL.lat, lng: pendingLL.lng, sort_order: next, geofence_radius_m: radius,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Stop added"); setName(""); setPendingLL(null); loadStops(routeId);
  }
  async function removeStop(id: string) {
    if (!confirm("Delete stop?")) return;
    const { error } = await supabase.from("transport_stops").delete().eq("id", id);
    if (error) return toast.error(error.message); loadStops(routeId);
  }

  const stopMarkers: StopMarker[] = stops.map(s => ({ id: s.id, lat: s.lat, lng: s.lng, name: s.name, radiusM: s.geofence_radius_m }));
  const tempMarkers = pendingLL ? [{ id: "tmp", lat: pendingLL.lat, lng: pendingLL.lng, name: name || "New stop", radiusM: radius, highlight: true }] : [];

  return (
    <SectionCard title="Stops" description="Click on the map to drop a new stop. Each stop has a geofence used for boarding alerts.">
      <div className="grid md:grid-cols-[1fr_320px] gap-4">
        <BusMap stops={[...stopMarkers, ...tempMarkers]} height={520} onClickMap={setPendingLL} />
        <div className="space-y-3">
          <div>
            <Label>Route</Label>
            <Select value={routeId} onValueChange={setRouteId}>
              <SelectTrigger><SelectValue placeholder="Select route" /></SelectTrigger>
              <SelectContent>{routes.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">New stop</div>
            <Input placeholder="Stop name (e.g. Garki Junction)" value={name} onChange={e => setName(e.target.value)} />
            <div className="text-xs text-muted-foreground">
              {pendingLL ? `Lat ${pendingLL.lat.toFixed(5)}, Lng ${pendingLL.lng.toFixed(5)}` : "Click anywhere on the map to drop a pin."}
            </div>
            <div>
              <Label className="text-xs">Geofence radius (m)</Label>
              <Input type="number" min={30} max={1000} value={radius} onChange={e => setRadius(+e.target.value)} />
            </div>
            <Button onClick={addStop} disabled={busy || !pendingLL || !name.trim() || !routeId} className="w-full">Save stop</Button>
          </div>
          <div className="space-y-1.5 max-h-[260px] overflow-auto">
            {stops.length === 0 ? <p className="text-xs text-muted-foreground">No stops on this route yet.</p> :
              stops.map((s, i) => (
                <div key={s.id} className="flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-sm">
                  <div className="truncate"><span className="text-xs text-muted-foreground mr-2">#{i + 1}</span>{s.name}</div>
                  <Button size="icon" variant="ghost" onClick={() => removeStop(s.id)}><Trash2 className="size-4 text-destructive" /></Button>
                </div>
              ))}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

/* ============= RIDERS ============= */
function Riders({ schoolId }: { schoolId?: string }) {
  const [students, setStudents] = useState<any[]>([]);
  const [buses, setBuses] = useState<any[]>([]);
  const [stops, setStops] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [studentId, setStudentId] = useState("");
  const [busId, setBusId] = useState("");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!schoolId) return;
    const [mem, b, st, a] = await Promise.all([
      supabase.from("memberships").select("user_id").eq("school_id", schoolId).eq("role", "student").eq("status", "active"),
      supabase.from("transport_buses").select("id,name,route_id").eq("school_id", schoolId),
      supabase.from("transport_stops").select("id,name,route_id").eq("school_id", schoolId),
      supabase.from("transport_student_stops").select("*").eq("school_id", schoolId),
    ]);
    setBuses(b.data ?? []); setStops(st.data ?? []); setAssignments(a.data ?? []);
    const ids = (mem.data ?? []).map((m: any) => m.user_id);
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      setStudents((ps ?? []).map((p: any) => ({ user_id: p.id, full_name: p.full_name })));
    } else setStudents([]);
  }
  useEffect(() => { load(); }, [schoolId]);

  const stopsForBus = useMemo(() => {
    const route = buses.find(b => b.id === busId)?.route_id;
    return stops.filter(s => s.route_id === route);
  }, [busId, buses, stops]);

  async function assign() {
    if (!schoolId || !studentId || !busId || busy) return;
    setBusy(true);
    const { error } = await supabase.from("transport_student_stops").upsert({
      school_id: schoolId, student_id: studentId, bus_id: busId,
      pickup_stop_id: pickup || null, dropoff_stop_id: dropoff || null,
    }, { onConflict: "school_id,student_id,bus_id" });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Rider assigned"); setStudentId(""); setPickup(""); setDropoff(""); load();
  }
  async function remove(id: string) {
    if (!confirm("Remove rider?")) return;
    const { error } = await supabase.from("transport_student_stops").delete().eq("id", id);
    if (error) return toast.error(error.message); load();
  }

  return (
    <SectionCard title="Riders" description="Assign students to their bus and pickup/dropoff stops.">
      <div className="grid md:grid-cols-5 gap-2 mb-4">
        <div><Label className="text-xs">Student</Label>
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger><SelectValue placeholder="Student" /></SelectTrigger>
            <SelectContent>{students.map((s: any) => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name ?? "Student"}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Bus</Label>
          <Select value={busId} onValueChange={setBusId}>
            <SelectTrigger><SelectValue placeholder="Bus" /></SelectTrigger>
            <SelectContent>{buses.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Pickup stop</Label>
          <Select value={pickup} onValueChange={setPickup}>
            <SelectTrigger><SelectValue placeholder="Pickup" /></SelectTrigger>
            <SelectContent>{stopsForBus.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Dropoff stop</Label>
          <Select value={dropoff} onValueChange={setDropoff}>
            <SelectTrigger><SelectValue placeholder="Dropoff" /></SelectTrigger>
            <SelectContent>{stopsForBus.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-end"><Button onClick={assign} disabled={busy || !studentId || !busId} className="w-full">Assign</Button></div>
      </div>
      {assignments.length === 0 ? <EmptyState icon={Users} title="No riders yet" /> : (
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground"><tr className="border-b border-border">
            <th className="text-left py-2">Student</th><th className="text-left">Bus</th><th className="text-left">Pickup</th><th className="text-left">Dropoff</th><th></th></tr></thead>
          <tbody>{assignments.map(a => {
            const st = students.find((s: any) => s.user_id === a.student_id);
            const b = buses.find(x => x.id === a.bus_id);
            const p = stops.find(x => x.id === a.pickup_stop_id);
            const d = stops.find(x => x.id === a.dropoff_stop_id);
            return (
              <tr key={a.id} className="border-b border-border last:border-0">
                <td className="py-2">{st?.full_name ?? "Student"}</td>
                <td className="text-muted-foreground">{b?.name ?? "—"}</td>
                <td className="text-muted-foreground">{p?.name ?? "—"}</td>
                <td className="text-muted-foreground">{d?.name ?? "—"}</td>
                <td className="text-right"><Button size="icon" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="size-4 text-destructive" /></Button></td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
    </SectionCard>
  );
}
