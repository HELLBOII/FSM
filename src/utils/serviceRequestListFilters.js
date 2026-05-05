/**
 * Shared list filters / sort keys for service request tables (issue_category + season).
 */

export const SERVICE_TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'All service types' },
  { value: 'Scheduled Maintenance', label: 'Scheduled Maintenance' },
  { value: 'Repair & Service', label: 'Repair & Service' },
  { value: 'Other', label: 'Other' },
];

export const SEASON_FILTER_OPTIONS = [
  { value: 'all', label: 'All seasons' },
  { value: 'spring', label: 'Spring' },
  { value: 'summer', label: 'Summer' },
  { value: 'fall', label: 'Fall' },
  { value: 'winter', label: 'Winter' },
];

/** True when row has an assigned technician id. */
export function isRequestAssignedTechnician(request) {
  const id = request?.assigned_technician_id;
  if (id == null) return false;
  const s = String(id).trim();
  return s !== '' && s !== 'null' && s !== 'undefined';
}

/**
 * True when `assigned_technician_id` is DB-null / absent (only these rows belong on the Unassigned page).
 */
export function isAssignedTechnicianIdNull(request) {
  return request?.assigned_technician_id == null;
}

/**
 * @param {{ issue_category?: string }|null|undefined} request
 * @param {string} filterVal — value from SERVICE_TYPE_FILTER_OPTIONS
 */
export function requestMatchesServiceTypeFilter(request, filterVal) {
  if (!filterVal || filterVal === 'all') return true;
  const raw = request?.issue_category;
  if (filterVal === 'Repair & Service') {
    const lower = String(raw || '').toLowerCase().replace(/\s+/g, ' ');
    return (
      ['leak_repair', 'pump_issue', 'pipe_repair', 'valve_replacement'].includes(lower) ||
      lower === 'repair & service' ||
      lower === 'repair and service' ||
      raw === 'Repair & Service'
    );
  }
  if (filterVal === 'Scheduled Maintenance') {
    const lower = String(raw || '').toLowerCase();
    return lower === 'scheduled_maintenance' || raw === 'Scheduled Maintenance';
  }
  if (filterVal === 'Other') {
    const lower = String(raw || '').toLowerCase();
    return lower === 'other' || raw === 'Other';
  }
  return String(raw || '') === filterVal;
}

/**
 * @param {{ season?: string }|null|undefined} request
 * @param {string} filterVal — lowercase season or 'all'
 */
export function requestMatchesSeasonFilter(request, filterVal) {
  if (!filterVal || filterVal === 'all') return true;
  const s = String(request?.season ?? '').trim().toLowerCase();
  return s === String(filterVal).trim().toLowerCase();
}

/**
 * Sort key: scheduled activity first, then created. Unscheduled sorts last (ascending lists).
 */
export function getRequestSortDateMs(request) {
  const ref =
    request?.scheduled_start_time ||
    request?.scheduled_end_time ||
    request?.scheduled_date ||
    request?.created_at;
  if (!ref) return Number.POSITIVE_INFINITY;
  const t = new Date(ref).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

export function sortRequestsByDateAsc(a, b) {
  return getRequestSortDateMs(a) - getRequestSortDateMs(b);
}
