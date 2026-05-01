-- =============================================================================
-- FMS Web — RLS + JWT hardening (Supabase)
-- Run this in the Supabase SQL Editor AFTER supabase_migration.sql
--
-- How it works:
-- - The anon key sends requests as role "anon"; RLS must not grant anon access.
-- - Logged-in users get a JWT; PostgREST sets role "authenticated" and auth.uid().
-- - Policies below use TO authenticated so only valid sessions hit the database.
-- - Custom app role (admin / technician / client) lives in JWT user_metadata and
--   is available as: (auth.jwt() -> 'user_metadata' ->> 'user_role')
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers (STABLE, read JWT claims — no SECURITY DEFINER)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_auth_uid()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.app_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT NULLIF(TRIM(auth.jwt() -> 'user_metadata' ->> 'user_role'), '');
$$;

COMMENT ON FUNCTION public.app_auth_uid() IS 'Current Supabase user id from JWT (sub).';
COMMENT ON FUNCTION public.app_user_role() IS 'App role from JWT user_metadata.user_role (admin|supervisor|technician|client).';

-- -----------------------------------------------------------------------------
-- CLIENTS — authenticated staff only (JWT required)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated users to view all clients" ON clients;
DROP POLICY IF EXISTS "Allow authenticated users to insert clients" ON clients;
DROP POLICY IF EXISTS "Allow authenticated users to update clients" ON clients;
DROP POLICY IF EXISTS "Allow authenticated users to delete clients" ON clients;

CREATE POLICY "clients_select_authenticated" ON clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "clients_insert_authenticated" ON clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "clients_update_authenticated" ON clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "clients_delete_authenticated" ON clients FOR DELETE TO authenticated USING (true);

-- -----------------------------------------------------------------------------
-- TECHNICIANS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated users to view all technicians" ON technicians;
DROP POLICY IF EXISTS "Allow authenticated users to insert technicians" ON technicians;
DROP POLICY IF EXISTS "Allow authenticated users to update technicians" ON technicians;
DROP POLICY IF EXISTS "Allow authenticated users to delete technicians" ON technicians;

CREATE POLICY "technicians_select_authenticated" ON technicians FOR SELECT TO authenticated USING (true);
CREATE POLICY "technicians_insert_authenticated" ON technicians FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "technicians_update_authenticated" ON technicians FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "technicians_delete_authenticated" ON technicians FOR DELETE TO authenticated USING (true);

-- -----------------------------------------------------------------------------
-- SERVICE REQUESTS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated users to view all service_requests" ON service_requests;
DROP POLICY IF EXISTS "Allow authenticated users to insert service_requests" ON service_requests;
DROP POLICY IF EXISTS "Allow authenticated users to update service_requests" ON service_requests;
DROP POLICY IF EXISTS "Allow authenticated users to delete service_requests" ON service_requests;

CREATE POLICY "service_requests_select_authenticated" ON service_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_requests_insert_authenticated" ON service_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "service_requests_update_authenticated" ON service_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service_requests_delete_authenticated" ON service_requests FOR DELETE TO authenticated USING (true);

-- -----------------------------------------------------------------------------
-- WORK REPORTS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated users to view all work_reports" ON work_reports;
DROP POLICY IF EXISTS "Allow authenticated users to insert work_reports" ON work_reports;
DROP POLICY IF EXISTS "Allow authenticated users to update work_reports" ON work_reports;
DROP POLICY IF EXISTS "Allow authenticated users to delete work_reports" ON work_reports;

CREATE POLICY "work_reports_select_authenticated" ON work_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "work_reports_insert_authenticated" ON work_reports FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "work_reports_update_authenticated" ON work_reports FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "work_reports_delete_authenticated" ON work_reports FOR DELETE TO authenticated USING (true);

-- -----------------------------------------------------------------------------
-- EQUIPMENT
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated users to view all equipment" ON equipment;
DROP POLICY IF EXISTS "Allow authenticated users to insert equipment" ON equipment;
DROP POLICY IF EXISTS "Allow authenticated users to update equipment" ON equipment;
DROP POLICY IF EXISTS "Allow authenticated users to delete equipment" ON equipment;

CREATE POLICY "equipment_select_authenticated" ON equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "equipment_insert_authenticated" ON equipment FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "equipment_update_authenticated" ON equipment FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "equipment_delete_authenticated" ON equipment FOR DELETE TO authenticated USING (true);

-- -----------------------------------------------------------------------------
-- TASKS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated users to view all tasks" ON tasks;
DROP POLICY IF EXISTS "Allow authenticated users to insert tasks" ON tasks;
DROP POLICY IF EXISTS "Allow authenticated users to update tasks" ON tasks;
DROP POLICY IF EXISTS "Allow authenticated users to delete tasks" ON tasks;

CREATE POLICY "tasks_select_authenticated" ON tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "tasks_insert_authenticated" ON tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tasks_update_authenticated" ON tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tasks_delete_authenticated" ON tasks FOR DELETE TO authenticated USING (true);

-- -----------------------------------------------------------------------------
-- CHAT MESSAGES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated users to view all chat_messages" ON chat_messages;
DROP POLICY IF EXISTS "Allow authenticated users to insert chat_messages" ON chat_messages;
DROP POLICY IF EXISTS "Allow authenticated users to update chat_messages" ON chat_messages;
DROP POLICY IF EXISTS "Allow authenticated users to delete chat_messages" ON chat_messages;

CREATE POLICY "chat_messages_select_authenticated" ON chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "chat_messages_insert_authenticated" ON chat_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "chat_messages_update_authenticated" ON chat_messages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "chat_messages_delete_authenticated" ON chat_messages FOR DELETE TO authenticated USING (true);

-- -----------------------------------------------------------------------------
-- NOTIFICATIONS — JWT user must match row (uid or email in user_id)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated users to view their notifications" ON notifications;
DROP POLICY IF EXISTS "Allow authenticated users to insert notifications" ON notifications;
DROP POLICY IF EXISTS "Allow authenticated users to update notifications" ON notifications;
DROP POLICY IF EXISTS "Allow authenticated users to delete notifications" ON notifications;

CREATE POLICY "notifications_select_own" ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text OR user_id = (auth.jwt() ->> 'email'));

CREATE POLICY "notifications_insert_authenticated" ON notifications FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text OR user_id = (auth.jwt() ->> 'email'))
  WITH CHECK (user_id = auth.uid()::text OR user_id = (auth.jwt() ->> 'email'));

CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid()::text OR user_id = (auth.jwt() ->> 'email'));

-- -----------------------------------------------------------------------------
-- TECHNICIAN GOALS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated users to view all technician_goals" ON technician_goals;
DROP POLICY IF EXISTS "Allow authenticated users to insert technician_goals" ON technician_goals;
DROP POLICY IF EXISTS "Allow authenticated users to update technician_goals" ON technician_goals;
DROP POLICY IF EXISTS "Allow authenticated users to delete technician_goals" ON technician_goals;

CREATE POLICY "technician_goals_select_authenticated" ON technician_goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "technician_goals_insert_authenticated" ON technician_goals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "technician_goals_update_authenticated" ON technician_goals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "technician_goals_delete_authenticated" ON technician_goals FOR DELETE TO authenticated USING (true);

-- -----------------------------------------------------------------------------
-- NAVIGATION LOGS — JWT sub must match user_id
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated users to view their own navigation_logs" ON navigation_logs;
DROP POLICY IF EXISTS "Allow authenticated users to insert navigation_logs" ON navigation_logs;
DROP POLICY IF EXISTS "Allow authenticated users to update their own navigation_logs" ON navigation_logs;
DROP POLICY IF EXISTS "Allow authenticated users to delete their own navigation_logs" ON navigation_logs;

CREATE POLICY "navigation_logs_select_own" ON navigation_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "navigation_logs_insert_own" ON navigation_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "navigation_logs_update_own" ON navigation_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "navigation_logs_delete_own" ON navigation_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- IRRIGATION SYSTEMS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated users to view all irrigation_systems" ON irrigation_systems;
DROP POLICY IF EXISTS "Allow authenticated users to insert irrigation_systems" ON irrigation_systems;
DROP POLICY IF EXISTS "Allow authenticated users to update irrigation_systems" ON irrigation_systems;
DROP POLICY IF EXISTS "Allow authenticated users to delete irrigation_systems" ON irrigation_systems;

CREATE POLICY "irrigation_systems_select_authenticated" ON irrigation_systems FOR SELECT TO authenticated USING (true);
CREATE POLICY "irrigation_systems_insert_authenticated" ON irrigation_systems FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "irrigation_systems_update_authenticated" ON irrigation_systems FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "irrigation_systems_delete_authenticated" ON irrigation_systems FOR DELETE TO authenticated USING (true);

-- -----------------------------------------------------------------------------
-- SPECIALIZATIONS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated users to view all specializations" ON specializations;
DROP POLICY IF EXISTS "Allow authenticated users to insert specializations" ON specializations;
DROP POLICY IF EXISTS "Allow authenticated users to update specializations" ON specializations;
DROP POLICY IF EXISTS "Allow authenticated users to delete specializations" ON specializations;

CREATE POLICY "specializations_select_authenticated" ON specializations FOR SELECT TO authenticated USING (true);
CREATE POLICY "specializations_insert_authenticated" ON specializations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "specializations_update_authenticated" ON specializations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "specializations_delete_authenticated" ON specializations FOR DELETE TO authenticated USING (true);

-- =============================================================================
-- Done. Anonymous (anon) role has no policies above → no data access without JWT.
-- Never expose the service_role key in the browser; use anon + RLS only.
-- =============================================================================
