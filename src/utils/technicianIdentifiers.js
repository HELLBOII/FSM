import { USER_EMAIL_DOMAIN } from '@/lib/userEmail';

/**
 * Slug from first initial + first three letters of last name (e.g. v + gop → vgop).
 */
export function buildTechnicianSlug(firstName, lastName) {
  const first = firstName?.trim().slice(0, 1);
  const last = lastName?.trim().slice(0, 3);
  if (!first || !last) return '';
  return `${first}${last}`.toLowerCase();
}

export function normalizeTechnicianUsername(username) {
  const trimmed = (username ?? '').trim().toLowerCase();
  if (!trimmed) return '';
  if (trimmed.includes('@')) return trimmed;
  return `${trimmed}${USER_EMAIL_DOMAIN.toLowerCase()}`;
}

function normalizeEmployeeId(employeeId) {
  return (employeeId ?? '').trim().toLowerCase();
}

/**
 * First free username for slug: vgop@…, then vgop01@…, vgop02@…, etc.
 */
export function nextTechnicianUsername(slug, usedUsernames = []) {
  if (!slug) return '';
  const used = new Set(
    usedUsernames.map(normalizeTechnicianUsername).filter(Boolean)
  );
  const domain = USER_EMAIL_DOMAIN.toLowerCase();

  const base = `${slug}${domain}`;
  if (!used.has(base)) return base;

  for (let n = 1; n <= 9999; n += 1) {
    const suffix = String(n).padStart(2, '0');
    const candidate = `${slug}${suffix}${domain}`;
    if (!used.has(candidate)) return candidate;
  }
  return '';
}

/** Trailing numeric suffix from ids like empvgop01, empaven02 (global sequence). */
function parseEmployeeIdSuffix(employeeId) {
  const normalized = normalizeEmployeeId(employeeId);
  const match = normalized.match(/^emp[a-z]+(\d+)$/);
  if (!match) return 0;
  return parseInt(match[1], 10);
}

/**
 * Next employee id: emp + slug + global suffix (empvgop01, empaven02, empjrob03, …).
 */
export function nextTechnicianEmployeeId(slug, usedEmployeeIds = []) {
  if (!slug) return '';
  let maxSuffix = 0;
  for (const id of usedEmployeeIds) {
    const n = parseEmployeeIdSuffix(id);
    if (n > maxSuffix) maxSuffix = n;
  }
  const next = maxSuffix + 1;
  if (next > 9999) return '';
  const suffix = String(next).padStart(2, '0');
  return `emp${slug}${suffix}`;
}

export function generateTechnicianIdentifiers({
  firstName,
  lastName,
  usedUsernames = [],
  usedEmployeeIds = []
}) {
  const slug = buildTechnicianSlug(firstName, lastName);
  if (!slug) return { username: '', employee_id: '' };
  return {
    username: nextTechnicianUsername(slug, usedUsernames),
    employee_id: nextTechnicianEmployeeId(slug, usedEmployeeIds)
  };
}

/** Keep existing IDs on edit when name is unchanged and both IDs are already set. */
export function shouldPreserveTechnicianIdentifiers(tech, firstName, lastName) {
  if (!tech) return false;
  const fn = firstName?.trim() ?? '';
  const ln = lastName?.trim() ?? '';
  const prevFn = tech.first_name?.trim() ?? '';
  const prevLn = tech.last_name?.trim() ?? '';
  const nameUnchanged = fn === prevFn && ln === prevLn;
  const hasUsername = Boolean(tech.username?.trim());
  const hasEmployeeId = Boolean(tech.employee_id?.trim());
  return nameUnchanged && hasUsername && hasEmployeeId;
}

/** Exclude the record being edited so its own IDs stay available for the same slug. */
export function filterUsedIdentifiersForEdit(usedUsernames, usedEmployeeIds, tech) {
  if (!tech) {
    return { usedUsernames, usedEmployeeIds };
  }
  const excludeUsername = normalizeTechnicianUsername(tech.username);
  const excludeEmployeeId = normalizeEmployeeId(tech.employee_id);
  return {
    usedUsernames: usedUsernames.filter(
      (u) => normalizeTechnicianUsername(u) !== excludeUsername
    ),
    usedEmployeeIds: usedEmployeeIds.filter(
      (id) => normalizeEmployeeId(id) !== excludeEmployeeId
    )
  };
}
