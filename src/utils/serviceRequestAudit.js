/**
 * Service request audit + assignment / reschedule history helpers.
 */

function normIso(value) {
  if (value == null || value === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function parseAssignmentHistory(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return [...raw];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * If technician or schedule fields change vs `beforeRow`, append one history row with previous values.
 * @param {object} beforeRow - Row before update (from DB)
 * @param {object} patch - Fields being written (partial or full)
 * @param {string|null} userId - Supabase auth user id
 * @returns {object|null} history entry or null if no relevant change
 */
export function buildAssignmentHistoryEntry(beforeRow, patch, userId) {
  if (!beforeRow || !userId) return null;
  const after = { ...beforeRow, ...patch };

  const techChanged =
    String(beforeRow.assigned_technician_id ?? '') !== String(after.assigned_technician_id ?? '');
  const startChanged = normIso(beforeRow.scheduled_start_time) !== normIso(after.scheduled_start_time);
  const endChanged = normIso(beforeRow.scheduled_end_time) !== normIso(after.scheduled_end_time);
  const dateChanged = String(beforeRow.scheduled_date ?? '') !== String(after.scheduled_date ?? '');

  if (!techChanged && !startChanged && !endChanged && !dateChanged) return null;

  const action =
    techChanged && (startChanged || endChanged || dateChanged)
      ? 'reassign_reschedule'
      : techChanged
        ? 'reassign'
        : 'reschedule';

  return {
    at: new Date().toISOString(),
    by: userId,
    action,
    previous: {
      assigned_technician_id: beforeRow.assigned_technician_id ?? null,
      assigned_technician_name: beforeRow.assigned_technician_name ?? null,
      scheduled_start_time: beforeRow.scheduled_start_time ?? null,
      scheduled_end_time: beforeRow.scheduled_end_time ?? null,
      scheduled_date: beforeRow.scheduled_date ?? null,
    },
  };
}

/**
 * Merge assignment_history + modified_* into an update payload.
 * @param {object} beforeRow
 * @param {object} patch
 * @param {string|null} userId
 * @param {{ alwaysSetModified?: boolean }} [opts] - set modified when any update (e.g. reschedule dialog)
 */
export function mergeServiceRequestUpdateAudit(beforeRow, patch, userId, opts = {}) {
  const { alwaysSetModified = false } = opts;
  const now = new Date().toISOString();
  const out = { ...patch };
  const entry = buildAssignmentHistoryEntry(beforeRow, patch, userId);
  if (entry) {
    const prev = parseAssignmentHistory(beforeRow.assignment_history);
    out.assignment_history = [...prev, entry];
  }
  if (entry || alwaysSetModified) {
    out.modified_by = userId ?? null;
    out.modified_on = now;
  }
  return out;
}

const DEFAULT_CLOSED_FOR_CANCEL = ['completed', 'approved', 'closed'];

/** Row marked cancelled in DB (T / true / etc.). */
export function isServiceRequestCancelledRow(r) {
  if (!r) return false;
  const v = r.is_cancelled;
  return v === true || v === 'T' || v === 't' || String(v).toLowerCase() === 'true';
}

/** Whether list/table actions may offer cancel (not closed, not already cancelled). */
export function canCancelServiceRequestRow(r, closedStatuses = DEFAULT_CLOSED_FOR_CANCEL) {
  if (!r) return false;
  if (isServiceRequestCancelledRow(r)) return false;
  if (closedStatuses.includes(r.status)) return false;
  return true;
}
