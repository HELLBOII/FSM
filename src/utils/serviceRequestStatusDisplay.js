/** Status pill / map pin styling — uses `status` field only (no `state` / overdue). */

export const CLOSED_STATUSES = ['completed', 'approved', 'closed'];
export const ACTIVE_STATUSES = ['scheduled', 'assigned', 'in_progress'];

export function toInitCapWords(value) {
  const text = String(value ?? '').trim();
  if (!text) return '—';
  return text
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export function getServiceRequestStatusLabel(record) {
  return toInitCapWords(record?.status);
}

function normalizeStatus(record) {
  return String(record?.status || '').trim().toLowerCase();
}

/** Pill classes by `status` only. */
export function getServiceRequestStatusToneClass(record) {
  const status = normalizeStatus(record);
  if (CLOSED_STATUSES.includes(status)) return 'bg-[#EAF3DE] text-[#3B6D11]';
  if (status === 'scheduled' || status === 'assigned') return 'bg-[#EEEDFE] text-[#534AB7]';
  if (status === 'in_progress') return 'bg-[#E6F1FB] text-[#185FA5]';
  return 'bg-[#FAEEDA] text-[#BA7517]';
}

/** Calendar event chip / card surface (bg + border + optional text). */
export function getServiceRequestStatusCardClass(record, { withText = false } = {}) {
  const status = normalizeStatus(record);
  if (CLOSED_STATUSES.includes(status)) {
    return withText
      ? 'bg-[#EAF3DE] border-[#C5D9B8] text-[#3B6D11]'
      : 'bg-[#EAF3DE] border-[#C5D9B8]';
  }
  if (status === 'scheduled' || status === 'assigned') {
    return withText
      ? 'bg-[#EEEDFE] border-[#D8D4FB] text-[#534AB7]'
      : 'bg-[#EEEDFE] border-[#D8D4FB]';
  }
  if (status === 'in_progress') {
    return withText
      ? 'bg-[#E6F1FB] border-[#B8D4EF] text-[#185FA5]'
      : 'bg-[#E6F1FB] border-[#B8D4EF]';
  }
  return withText
    ? 'bg-[#FAEEDA] border-[#EFD080] text-[#BA7517]'
    : 'bg-[#FAEEDA] border-[#EFD080]';
}

/** Dashboard map pin hex colors by `status` only. */
export function getServiceRequestPinColor(record) {
  const status = normalizeStatus(record);
  if (CLOSED_STATUSES.includes(status)) return '#1D9E75';
  if (status === 'scheduled' || status === 'assigned') return '#534AB7';
  if (status === 'in_progress') return '#378ADD';
  return '#EF9F27';
}
