/**
 * Northern-hemisphere calendar seasons from a scheduled date/time.
 * Spring Mar–May, summer Jun–Aug, fall Sep–Nov, winter Dec–Feb.
 *
 * @param {string|Date|null|undefined} dateRef — ISO string or Date; null/undefined uses “today” for fallback
 * @returns {'spring'|'summer'|'fall'|'winter'}
 */
export function getSeasonFromDateRef(dateRef) {
  const d = dateRef ? new Date(dateRef) : new Date();
  if (Number.isNaN(d.getTime())) {
    return getSeasonFromDateRef(null);
  }
  const month = d.getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
}

/**
 * Season from service request schedule fields (start, then end, then date).
 * @param {{ scheduled_start_time?: string, scheduled_end_time?: string, scheduled_date?: string }} request
 * @returns {'spring'|'summer'|'fall'|'winter'}
 */
export function getSeasonFromServiceRequest(request) {
  const ref =
    request?.scheduled_start_time ||
    request?.scheduled_end_time ||
    request?.scheduled_date ||
    null;
  return getSeasonFromDateRef(ref);
}

/**
 * Service type column: calendar season only (not issue_category).
 * @param {'spring'|'summer'|'fall'|'winter'} season
 */
export function getServiceTypeLabelForSeason(season) {
  if (season === 'spring') return 'Spring Season';
  if (season === 'summer') return 'Summer Season';
  if (season === 'fall') return 'Fall Season';
  if (season === 'winter') return 'Winter Season';
  return '—';
}

/** Status badge: raw workflow status, title case (e.g. in_progress → In Progress). */
export function formatRequestStatusLabel(status) {
  if (!status || String(status).trim() === '') return '—';
  return String(status)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
