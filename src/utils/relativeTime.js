// utils/relativeTime.js
const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

export function timeAgo(date) {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 45) return "hace unos segundos";
  if (diffSec < 90) return "hace un minuto";

  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return rtf.format(-diffMin, "minute");

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return rtf.format(-diffHr, "hour");

  const diffDay = Math.round(diffHr / 24);
  return rtf.format(-diffDay, "day");
}
