/**
 * utils/priority.js
 * Computes the dynamic urgency badge for a request based on its
 * requested_due_date, per the DASHBOARD SORTING & VISUAL ALERT RULES spec.
 *
 *   RED    (URGENT / OVERDUE) -> due within 24h or already past due
 *   ORANGE (HIGH PRIORITY)    -> due within 2 to 3 days
 *   GREEN  (NORMAL)           -> due 3+ days away
 */
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function computeBadge(requestedDueDate, now = new Date()) {
  const due = new Date(requestedDueDate);
  const diffMs = due.getTime() - now.getTime();

  if (diffMs <= DAY_MS) {
    return { level: 'URGENT', color: 'RED', label: 'URGENT / OVERDUE' };
  }
  if (diffMs <= 3 * DAY_MS) {
    return { level: 'HIGH', color: 'ORANGE', label: 'HIGH PRIORITY' };
  }
  return { level: 'NORMAL', color: 'GREEN', label: 'NORMAL' };
}

/** Attaches a computed `badge` field to a request row (or array of rows). */
function withBadge(requestRow) {
  if (Array.isArray(requestRow)) {
    return requestRow.map((r) => ({ ...r, badge: computeBadge(r.requested_due_date) }));
  }
  return { ...requestRow, badge: computeBadge(requestRow.requested_due_date) };
}

module.exports = { computeBadge, withBadge };
