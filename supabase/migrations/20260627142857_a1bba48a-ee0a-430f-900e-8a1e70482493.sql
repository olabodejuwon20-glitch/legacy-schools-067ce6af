CREATE TABLE IF NOT EXISTS public.transport_buses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  plate_number text,
  capacity int DEFAULT 0,
  route_id uuid REFERENCES public.transport_routes(id) ON DELETE SET NULL,
  driver_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  driver_name text,
  driver_phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_buses TO authenticated;
GRANT ALL ON public.transport_buses TO service_role;
ALTER TABLE public.transport_buses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage buses" ON public.transport_buses FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));
CREATE POLICY "Members read buses" ON public.transport_buses FOR SELECT TO authenticated
  USING (public.is_member(school_id, auth.uid()) OR driver_user_id = auth.uid());
CREATE TRIGGER tg_transport_buses_updated BEFORE UPDATE ON public.transport_buses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.transport_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  geofence_radius_m int NOT NULL DEFAULT 120,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_stops TO authenticated;
GRANT ALL ON public.transport_stops TO service_role;
ALTER TABLE public.transport_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage stops" ON public.transport_stops FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));
CREATE POLICY "Members read stops" ON public.transport_stops FOR SELECT TO authenticated
  USING (public.is_member(school_id, auth.uid()));
CREATE TRIGGER tg_transport_stops_updated BEFORE UPDATE ON public.transport_stops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_transport_stops_route ON public.transport_stops(route_id, sort_order);

CREATE TABLE IF NOT EXISTS public.transport_student_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bus_id uuid NOT NULL REFERENCES public.transport_buses(id) ON DELETE CASCADE,
  pickup_stop_id uuid REFERENCES public.transport_stops(id) ON DELETE SET NULL,
  dropoff_stop_id uuid REFERENCES public.transport_stops(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, student_id, bus_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_student_stops TO authenticated;
GRANT ALL ON public.transport_student_stops TO service_role;
ALTER TABLE public.transport_student_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage stuassign" ON public.transport_student_stops FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));
CREATE POLICY "Student reads own stop" ON public.transport_student_stops FOR SELECT TO authenticated
  USING (student_id = auth.uid());
CREATE POLICY "Parent reads child stop" ON public.transport_student_stops FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.parent_links pl
    WHERE pl.parent_user_id = auth.uid() AND pl.student_user_id = transport_student_stops.student_id));
CREATE POLICY "Driver reads bus assignments" ON public.transport_student_stops FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transport_buses b
    WHERE b.id = transport_student_stops.bus_id AND b.driver_user_id = auth.uid()));
CREATE TRIGGER tg_transport_student_stops_updated BEFORE UPDATE ON public.transport_student_stops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.transport_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  bus_id uuid NOT NULL REFERENCES public.transport_buses(id) ON DELETE CASCADE,
  route_id uuid REFERENCES public.transport_routes(id) ON DELETE SET NULL,
  driver_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'pickup' CHECK (direction IN ('pickup','dropoff','other')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  last_lat double precision,
  last_lng double precision,
  last_speed double precision,
  last_heading double precision,
  last_ping_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_trips TO authenticated;
GRANT ALL ON public.transport_trips TO service_role;
ALTER TABLE public.transport_trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage trips" ON public.transport_trips FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));
CREATE POLICY "Driver manages own trips" ON public.transport_trips FOR ALL TO authenticated
  USING (driver_user_id = auth.uid()) WITH CHECK (driver_user_id = auth.uid());
CREATE POLICY "Parent reads child trips" ON public.transport_trips FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transport_student_stops tss
    JOIN public.parent_links pl ON pl.student_user_id = tss.student_id
    WHERE tss.bus_id = transport_trips.bus_id AND pl.parent_user_id = auth.uid()));
CREATE POLICY "Student reads own bus trips" ON public.transport_trips FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transport_student_stops tss
    WHERE tss.bus_id = transport_trips.bus_id AND tss.student_id = auth.uid()));
CREATE TRIGGER tg_transport_trips_updated BEFORE UPDATE ON public.transport_trips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_transport_trips_active ON public.transport_trips(school_id, status, started_at DESC);

CREATE TABLE IF NOT EXISTS public.transport_trip_locations (
  id bigserial PRIMARY KEY,
  trip_id uuid NOT NULL REFERENCES public.transport_trips(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  speed double precision,
  heading double precision,
  accuracy double precision,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.transport_trip_locations TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.transport_trip_locations_id_seq TO authenticated;
GRANT ALL ON public.transport_trip_locations TO service_role;
GRANT ALL ON SEQUENCE public.transport_trip_locations_id_seq TO service_role;
ALTER TABLE public.transport_trip_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Driver inserts pings" ON public.transport_trip_locations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.transport_trips t
    WHERE t.id = transport_trip_locations.trip_id AND t.driver_user_id = auth.uid() AND t.status = 'active'));
CREATE POLICY "Admins read pings" ON public.transport_trip_locations FOR SELECT TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()));
CREATE POLICY "Driver reads own pings" ON public.transport_trip_locations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transport_trips t
    WHERE t.id = transport_trip_locations.trip_id AND t.driver_user_id = auth.uid()));
CREATE POLICY "Parent reads child pings" ON public.transport_trip_locations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transport_trips t
    JOIN public.transport_student_stops tss ON tss.bus_id = t.bus_id
    JOIN public.parent_links pl ON pl.student_user_id = tss.student_id
    WHERE t.id = transport_trip_locations.trip_id AND pl.parent_user_id = auth.uid()));
CREATE POLICY "Student reads bus pings" ON public.transport_trip_locations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transport_trips t
    JOIN public.transport_student_stops tss ON tss.bus_id = t.bus_id
    WHERE t.id = transport_trip_locations.trip_id AND tss.student_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_trip_locations_trip ON public.transport_trip_locations(trip_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS public.transport_trip_events (
  id bigserial PRIMARY KEY,
  trip_id uuid NOT NULL REFERENCES public.transport_trips(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  bus_id uuid NOT NULL REFERENCES public.transport_buses(id) ON DELETE CASCADE,
  student_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stop_id uuid REFERENCES public.transport_stops(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('trip_started','trip_ended','near_stop','arrived_stop','student_boarded','student_dropped','geofence_alert','speed_alert')),
  note text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.transport_trip_events TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.transport_trip_events_id_seq TO authenticated;
GRANT ALL ON public.transport_trip_events TO service_role;
GRANT ALL ON SEQUENCE public.transport_trip_events_id_seq TO service_role;
ALTER TABLE public.transport_trip_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Driver inserts events" ON public.transport_trip_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.transport_trips t
    WHERE t.id = transport_trip_events.trip_id AND t.driver_user_id = auth.uid()));
CREATE POLICY "Admin inserts events" ON public.transport_trip_events FOR INSERT TO authenticated
  WITH CHECK (public.is_school_admin(school_id, auth.uid()));
CREATE POLICY "Admins read events" ON public.transport_trip_events FOR SELECT TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()));
CREATE POLICY "Driver reads own events" ON public.transport_trip_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transport_trips t
    WHERE t.id = transport_trip_events.trip_id AND t.driver_user_id = auth.uid()));
CREATE POLICY "Parent reads child events" ON public.transport_trip_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transport_student_stops tss
    JOIN public.parent_links pl ON pl.student_user_id = tss.student_id
    WHERE tss.bus_id = transport_trip_events.bus_id AND pl.parent_user_id = auth.uid()));
CREATE POLICY "Student reads bus events" ON public.transport_trip_events FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR EXISTS (SELECT 1 FROM public.transport_student_stops tss
    WHERE tss.bus_id = transport_trip_events.bus_id AND tss.student_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_trip_events_trip ON public.transport_trip_events(trip_id, occurred_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.transport_trips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transport_trip_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transport_trip_events;
ALTER TABLE public.transport_trips REPLICA IDENTITY FULL;
ALTER TABLE public.transport_trip_locations REPLICA IDENTITY FULL;
ALTER TABLE public.transport_trip_events REPLICA IDENTITY FULL;