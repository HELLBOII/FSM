import { supabase } from '@/lib/supabase';

const TABLE = 'app_settings';
const KEY_TECHNICIAN_EQUIPMENT_FIELDS = 'technician_equipment_fields';
const STORAGE_KEY = 'fms_technician_equipment_fields';

/**
 * App settings (key-value). Uses Supabase app_settings table if available;
 * falls back to localStorage. Table: app_settings (key text primary key, value jsonb, updated_at timestamptz).
 */
export const appSettingsService = {
  async get(key) {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('value')
        .eq('key', key)
        .maybeSingle();

      if (error) throw error;
      return data?.value ?? null;
    } catch {
      if (key === KEY_TECHNICIAN_EQUIPMENT_FIELDS) {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      }
      return null;
    }
  },

  async set(key, value) {
    try {
      const { error } = await supabase
        .from(TABLE)
        .upsert(
          { key, value, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );

      if (error) throw error;
    } catch {
      if (key === KEY_TECHNICIAN_EQUIPMENT_FIELDS) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      }
    }
  },

  async getTechnicianEquipmentFields() {
    return this.get(KEY_TECHNICIAN_EQUIPMENT_FIELDS);
  },

  async setTechnicianEquipmentFields(fieldKeys) {
    return this.set(KEY_TECHNICIAN_EQUIPMENT_FIELDS, fieldKeys);
  },
};
