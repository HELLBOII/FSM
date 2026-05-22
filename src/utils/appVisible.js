/** Records with app_visible === false are hidden from app selection dropdowns. */
export function isAppVisible(record) {
  return record?.app_visible !== false;
}

export function filterAppVisible(records) {
  return (records || []).filter(isAppVisible);
}
