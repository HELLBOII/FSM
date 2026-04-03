/**
 * Normalizes client.notes_history from DB (JSONB array or legacy shapes).
 * @returns {Array<{ id: string, text: string, created_at: string }>}
 */
export function normalizeNotesHistory(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.filter((e) => e && typeof e.text === 'string' && e.text.trim());
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? normalizeNotesHistory(parsed) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function newNoteEntry(text) {
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  return {
    id,
    text: text.trim(),
    created_at: new Date().toISOString()
  };
}
