-- ============================================
-- Supabase Database Migration Script
-- Run this in your Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. CLIENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  farm_name TEXT NOT NULL,
  address TEXT,
  location JSONB,
  total_acreage NUMERIC,
  irrigation_systems TEXT[],
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for clients table
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);

-- Enable RLS on clients table
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated users to view all clients" ON clients;
DROP POLICY IF EXISTS "Allow authenticated users to insert clients" ON clients;
DROP POLICY IF EXISTS "Allow authenticated users to update clients" ON clients;
DROP POLICY IF EXISTS "Allow authenticated users to delete clients" ON clients;

-- Create RLS policies for clients table
-- Allow all authenticated users to view all clients
CREATE POLICY "Allow authenticated users to view all clients" ON clients
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow all authenticated users to insert clients
CREATE POLICY "Allow authenticated users to insert clients" ON clients
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow all authenticated users to update clients
CREATE POLICY "Allow authenticated users to update clients" ON clients
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow all authenticated users to delete clients
CREATE POLICY "Allow authenticated users to delete clients" ON clients
  FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- 2. TECHNICIANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  employee_id TEXT NOT NULL UNIQUE,
  specializations TEXT[],
  certifications TEXT[],
  current_location JSONB,
  availability_status TEXT DEFAULT 'offline' CHECK (availability_status IN ('available', 'on_job', 'break', 'offline')),
  current_job_id UUID,
  rating NUMERIC CHECK (rating >= 0 AND rating <= 5),
  jobs_completed INTEGER DEFAULT 0,
  avatar_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_technicians_user_id ON technicians(user_id);
CREATE INDEX IF NOT EXISTS idx_technicians_status ON technicians(status);
CREATE INDEX IF NOT EXISTS idx_technicians_availability ON technicians(availability_status);

ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to view all technicians" ON technicians;
DROP POLICY IF EXISTS "Allow authenticated users to insert technicians" ON technicians;
DROP POLICY IF EXISTS "Allow authenticated users to update technicians" ON technicians;
DROP POLICY IF EXISTS "Allow authenticated users to delete technicians" ON technicians;

CREATE POLICY "Allow authenticated users to view all technicians" ON technicians
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert technicians" ON technicians
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update technicians" ON technicians
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete technicians" ON technicians
  FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- 3. SERVICE REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT UNIQUE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  farm_name TEXT,
  contact_phone TEXT,
  location JSONB,
  irrigation_type TEXT CHECK (irrigation_type IN ('drip', 'sprinkler', 'center_pivot', 'flood', 'micro_sprinkler', 'subsurface')),
  issue_category TEXT CHECK (issue_category IN ('leak_repair', 'system_installation', 'maintenance', 'pump_issue', 'valve_replacement', 'filter_cleaning', 'pipe_repair', 'controller_issue', 'water_pressure', 'other')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  description TEXT NOT NULL,
  photos TEXT[],
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'scheduled', 'assigned', 'in_progress', 'completed', 'approved', 'closed', 'rework')),
  assigned_technician_id UUID REFERENCES technicians(id) ON DELETE SET NULL,
  assigned_technician_name TEXT,
  scheduled_date DATE,
  scheduled_time_slot TEXT,
  estimated_duration NUMERIC,
  actual_start_time TIMESTAMPTZ,
  actual_end_time TIMESTAMPTZ,
  sla_deadline TIMESTAMPTZ,
  is_sla_breached BOOLEAN DEFAULT false,
  acreage_affected NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_requests_client_id ON service_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_technician_id ON service_requests(assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_request_number ON service_requests(request_number);
CREATE INDEX IF NOT EXISTS idx_service_requests_scheduled_date ON service_requests(scheduled_date);

ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to view all service_requests" ON service_requests;
DROP POLICY IF EXISTS "Allow authenticated users to insert service_requests" ON service_requests;
DROP POLICY IF EXISTS "Allow authenticated users to update service_requests" ON service_requests;
DROP POLICY IF EXISTS "Allow authenticated users to delete service_requests" ON service_requests;

CREATE POLICY "Allow authenticated users to view all service_requests" ON service_requests
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert service_requests" ON service_requests
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update service_requests" ON service_requests
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete service_requests" ON service_requests
  FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- 4. WORK REPORTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS work_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID REFERENCES service_requests(id) ON DELETE CASCADE,
  request_number TEXT,
  technician_id UUID REFERENCES technicians(id) ON DELETE SET NULL,
  technician_name TEXT,
  client_name TEXT,
  farm_name TEXT,
  check_in_time TIMESTAMPTZ,
  check_in_location JSONB,
  check_out_time TIMESTAMPTZ,
  check_out_location JSONB,
  before_photos TEXT[],
  after_photos TEXT[],
  tasks_completed JSONB,
  equipment_used JSONB,
  water_flow_reading NUMERIC,
  pressure_reading NUMERIC,
  work_notes TEXT,
  voice_notes_url TEXT,
  farmer_signature_url TEXT,
  farmer_feedback TEXT,
  farmer_rating NUMERIC CHECK (farmer_rating >= 0 AND farmer_rating <= 5),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  rejection_reason TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_reports_service_request_id ON work_reports(service_request_id);
CREATE INDEX IF NOT EXISTS idx_work_reports_technician_id ON work_reports(technician_id);
CREATE INDEX IF NOT EXISTS idx_work_reports_status ON work_reports(status);

ALTER TABLE work_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to view all work_reports" ON work_reports;
DROP POLICY IF EXISTS "Allow authenticated users to insert work_reports" ON work_reports;
DROP POLICY IF EXISTS "Allow authenticated users to update work_reports" ON work_reports;
DROP POLICY IF EXISTS "Allow authenticated users to delete work_reports" ON work_reports;

CREATE POLICY "Allow authenticated users to view all work_reports" ON work_reports
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert work_reports" ON work_reports
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update work_reports" ON work_reports
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete work_reports" ON work_reports
  FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- 5. EQUIPMENT TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('pipes', 'valves', 'fittings', 'filters', 'pumps', 'controllers', 'sensors', 'tools', 'chemicals', 'other')),
  sku TEXT,
  unit TEXT NOT NULL,
  stock_quantity NUMERIC DEFAULT 0,
  min_stock_level NUMERIC,
  unit_cost NUMERIC,
  description TEXT,
  status TEXT DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'low_stock', 'out_of_stock')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category);
CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status);
CREATE INDEX IF NOT EXISTS idx_equipment_sku ON equipment(sku);

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to view all equipment" ON equipment;
DROP POLICY IF EXISTS "Allow authenticated users to insert equipment" ON equipment;
DROP POLICY IF EXISTS "Allow authenticated users to update equipment" ON equipment;
DROP POLICY IF EXISTS "Allow authenticated users to delete equipment" ON equipment;

CREATE POLICY "Allow authenticated users to view all equipment" ON equipment
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert equipment" ON equipment
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update equipment" ON equipment
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete equipment" ON equipment
  FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- 5b. TASKS TABLE (default job execution tasks template)
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_sort_order ON tasks(sort_order);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to view all tasks" ON tasks;
DROP POLICY IF EXISTS "Allow authenticated users to insert tasks" ON tasks;
DROP POLICY IF EXISTS "Allow authenticated users to update tasks" ON tasks;
DROP POLICY IF EXISTS "Allow authenticated users to delete tasks" ON tasks;

CREATE POLICY "Allow authenticated users to view all tasks" ON tasks
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert tasks" ON tasks
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update tasks" ON tasks
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete tasks" ON tasks
  FOR DELETE USING (auth.role() = 'authenticated');

-- Seed default tasks (only if table is empty)
INSERT INTO tasks (label, sort_order)
SELECT v.label, v.sort_order FROM (VALUES
  ('Inspect irrigation system', 1),
  ('Check water pressure', 2),
  ('Inspect pipes for leaks', 3),
  ('Clean filters', 4),
  ('Test valves', 5),
  ('Check controller settings', 6),
  ('Verify water flow', 7),
  ('Document findings', 8)
) AS v(label, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM tasks LIMIT 1);

-- ============================================
-- 6. CHAT MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL,
  service_request_id UUID REFERENCES service_requests(id) ON DELETE SET NULL,
  request_number TEXT,
  sender_user_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_role TEXT CHECK (sender_role IN ('admin', 'supervisor', 'technician', 'client')),
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'system')),
  attachments TEXT[],
  read_by TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_service_request_id ON chat_messages(service_request_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_user_id ON chat_messages(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to view all chat_messages" ON chat_messages;
DROP POLICY IF EXISTS "Allow authenticated users to insert chat_messages" ON chat_messages;
DROP POLICY IF EXISTS "Allow authenticated users to update chat_messages" ON chat_messages;
DROP POLICY IF EXISTS "Allow authenticated users to delete chat_messages" ON chat_messages;

CREATE POLICY "Allow authenticated users to view all chat_messages" ON chat_messages
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert chat_messages" ON chat_messages
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update chat_messages" ON chat_messages
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete chat_messages" ON chat_messages
  FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- 7. NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT CHECK (type IN ('job_assigned', 'job_updated', 'report_approved', 'report_rejected', 'system', 'info')),
  link TEXT,
  related_id UUID,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to view their notifications" ON notifications;
DROP POLICY IF EXISTS "Allow authenticated users to insert notifications" ON notifications;
DROP POLICY IF EXISTS "Allow authenticated users to update notifications" ON notifications;
DROP POLICY IF EXISTS "Allow authenticated users to delete notifications" ON notifications;

-- Users can only view their own notifications
CREATE POLICY "Allow authenticated users to view their notifications" ON notifications
  FOR SELECT USING (auth.role() = 'authenticated' AND (user_id = auth.uid()::text OR user_id = auth.jwt() ->> 'email'));

-- All authenticated users can insert notifications
CREATE POLICY "Allow authenticated users to insert notifications" ON notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Users can only update their own notifications
CREATE POLICY "Allow authenticated users to update notifications" ON notifications
  FOR UPDATE USING (auth.role() = 'authenticated' AND (user_id = auth.uid()::text OR user_id = auth.jwt() ->> 'email'));

-- Users can only delete their own notifications
CREATE POLICY "Allow authenticated users to delete notifications" ON notifications
  FOR DELETE USING (auth.role() = 'authenticated' AND (user_id = auth.uid()::text OR user_id = auth.jwt() ->> 'email'));

-- ============================================
-- 8. TECHNICIAN GOALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS technician_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID REFERENCES technicians(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('jobs_completed', 'customer_rating', 'response_time', 'completion_rate', 'custom')),
  title TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  current_value NUMERIC DEFAULT 0,
  period TEXT DEFAULT 'monthly' CHECK (period IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_technician_goals_technician_id ON technician_goals(technician_id);
CREATE INDEX IF NOT EXISTS idx_technician_goals_status ON technician_goals(status);

ALTER TABLE technician_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to view all technician_goals" ON technician_goals;
DROP POLICY IF EXISTS "Allow authenticated users to insert technician_goals" ON technician_goals;
DROP POLICY IF EXISTS "Allow authenticated users to update technician_goals" ON technician_goals;
DROP POLICY IF EXISTS "Allow authenticated users to delete technician_goals" ON technician_goals;

CREATE POLICY "Allow authenticated users to view all technician_goals" ON technician_goals
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert technician_goals" ON technician_goals
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update technician_goals" ON technician_goals
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete technician_goals" ON technician_goals
  FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- 9. NAVIGATION LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS navigation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  page_name TEXT NOT NULL,
  visited_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_navigation_logs_user_id ON navigation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_navigation_logs_page_name ON navigation_logs(page_name);
CREATE INDEX IF NOT EXISTS idx_navigation_logs_visited_at ON navigation_logs(visited_at);

ALTER TABLE navigation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to view their own navigation_logs" ON navigation_logs;
DROP POLICY IF EXISTS "Allow authenticated users to insert navigation_logs" ON navigation_logs;
DROP POLICY IF EXISTS "Allow authenticated users to update their own navigation_logs" ON navigation_logs;
DROP POLICY IF EXISTS "Allow authenticated users to delete their own navigation_logs" ON navigation_logs;

CREATE POLICY "Allow authenticated users to view their own navigation_logs" ON navigation_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to insert navigation_logs" ON navigation_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to update their own navigation_logs" ON navigation_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to delete their own navigation_logs" ON navigation_logs
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- STORAGE BUCKETS SETUP
-- ============================================

-- Create uploads bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to read files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete files" ON storage.objects;

-- Create storage policies for uploads bucket
-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'uploads');

-- Allow authenticated users to read files
CREATE POLICY "Allow authenticated users to read files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'uploads');

-- Allow authenticated users to update files
CREATE POLICY "Allow authenticated users to update files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'uploads')
WITH CHECK (bucket_id = 'uploads');

-- Allow authenticated users to delete files
CREATE POLICY "Allow authenticated users to delete files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'uploads');

-- ============================================
-- ADD MISSING COLUMNS (for existing tables)
-- ============================================

-- Add created_date column to service_requests if it doesn't exist
-- This is a computed column that extracts the date from created_at
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_requests') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'service_requests' AND column_name = 'created_date') THEN
      ALTER TABLE service_requests ADD COLUMN created_date DATE;
      UPDATE service_requests SET created_date = created_at::DATE WHERE created_date IS NULL;
      ALTER TABLE service_requests ALTER COLUMN created_date SET DEFAULT (CURRENT_DATE);
      CREATE INDEX IF NOT EXISTS idx_service_requests_created_date ON service_requests(created_date);
      
      -- Create a trigger to automatically update created_date when created_at changes
      CREATE OR REPLACE FUNCTION update_service_request_created_date()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.created_date = NEW.created_at::DATE;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      DROP TRIGGER IF EXISTS trigger_update_service_request_created_date ON service_requests;
      CREATE TRIGGER trigger_update_service_request_created_date
        BEFORE INSERT OR UPDATE OF created_at ON service_requests
        FOR EACH ROW
        EXECUTE FUNCTION update_service_request_created_date();
    END IF;
  END IF;
END $$;

-- ============================================
-- 8. IRRIGATION SYSTEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS irrigation_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  irrigation_systems TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for irrigation_systems table
CREATE INDEX IF NOT EXISTS idx_irrigation_systems_name ON irrigation_systems(irrigation_systems);

-- Enable RLS on irrigation_systems table
ALTER TABLE irrigation_systems ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to view all irrigation_systems" ON irrigation_systems;
DROP POLICY IF EXISTS "Allow authenticated users to insert irrigation_systems" ON irrigation_systems;
DROP POLICY IF EXISTS "Allow authenticated users to update irrigation_systems" ON irrigation_systems;
DROP POLICY IF EXISTS "Allow authenticated users to delete irrigation_systems" ON irrigation_systems;

-- Create RLS policies for irrigation_systems table
CREATE POLICY "Allow authenticated users to view all irrigation_systems" ON irrigation_systems
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert irrigation_systems" ON irrigation_systems
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update irrigation_systems" ON irrigation_systems
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete irrigation_systems" ON irrigation_systems
  FOR DELETE USING (auth.role() = 'authenticated');

-- Insert default irrigation systems
INSERT INTO irrigation_systems (irrigation_systems) VALUES
  ('Drip Irrigation'),
  ('Sprinkler System'),
  ('Center Pivot'),
  ('Flood Irrigation'),
  ('Micro Sprinkler'),
  ('Subsurface Drip')
ON CONFLICT (irrigation_systems) DO NOTHING;

-- ============================================
-- 9. SPECIALIZATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS specializations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specializations TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for specializations table
CREATE INDEX IF NOT EXISTS idx_specializations_name ON specializations(specializations);

-- Enable RLS on specializations table
ALTER TABLE specializations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to view all specializations" ON specializations;
DROP POLICY IF EXISTS "Allow authenticated users to insert specializations" ON specializations;
DROP POLICY IF EXISTS "Allow authenticated users to update specializations" ON specializations;
DROP POLICY IF EXISTS "Allow authenticated users to delete specializations" ON specializations;

-- Create RLS policies for specializations table
CREATE POLICY "Allow authenticated users to view all specializations" ON specializations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert specializations" ON specializations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update specializations" ON specializations
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete specializations" ON specializations
  FOR DELETE USING (auth.role() = 'authenticated');

-- Insert default specializations
INSERT INTO specializations (specializations) VALUES
  ('Drip Irrigation'),
  ('Sprinkler Systems'),
  ('Center Pivot'),
  ('Pump Repair'),
  ('Controller Programming'),
  ('Water Management')
ON CONFLICT (specializations) DO NOTHING;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully! All tables, RLS policies, and storage buckets have been created.';
END $$;

