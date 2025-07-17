// utils/relativeTime.js
/**
 * @module relativeTime
 * @description Proporciona funcions per formatar temps relatiu en format llegible.
 */

const LANGUAGE = "es"; // Constant per facilitar canvis d'idioma
const rtf = new Intl.RelativeTimeFormat(LANGUAGE, { numeric: "auto" });

/**
 * Calcula i formata el temps transcorregut des d'una data donada.
 * @param {Date} date - La data des de la qual calcular el temps transcorregut.
 * @returns {string} Una cadena descriptiva del temps transcorregut.
 * @throws {Error} Si la data no és vàlida.
 * @export
 */
export function timeAgo(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error("La data proporcionada no és vàlida.");
  }

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return "en el futuro"; // Edge case: data futura

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
