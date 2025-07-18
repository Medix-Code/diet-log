/* ────────────────────────── pseudoId.js ────────────────────────── */

/**
 * Retorna el *salt* permanent (unic per dispositiu).  Si no existeix, el crea.
 * S'al·loca a localStorage perquè segueixi disponible entre sessions.
 */
export function getOrCreateSalt() {
  const KEY = "dietSalt";

  // ─── Fallback per a contexts sense crypto.getRandomValues ───
  const getRandomHex = (len = 16) =>
    Array.from({ length: len }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, "0")
    ).join("");

  let salt = localStorage.getItem(KEY);
  if (!salt) {
    if (window.crypto?.getRandomValues) {
      const random = crypto.getRandomValues(new Uint8Array(16));
      salt = Array.from(random)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } else {
      console.warn(
        "[pseudoId] crypto.getRandomValues no disponible; usant Math.random() (menys segur, només mode desenvolupament)."
      );
      salt = getRandomHex(16);
    }
    localStorage.setItem(KEY, salt);
  }
  return salt;
}

/**
 * Converteix l’ID numèric (9 dígits) en hash SHA‑256 amb salt local.
 * - En context segur → hash real.
 * - En context no segur → retorna l’ID tal qual + avís a consola,
 *   així l’aplicació no es trenca durant proves locals.
 *
 * @param {string} id  Exemple: "123456789"
 * @returns {Promise<string>} Hash (64 caràcters hex) o l’ID original si no hi ha WebCrypto.
 */
export async function pseudoId(id) {
  // WebCrypto disponible?
  if (!window.crypto?.subtle) {
    console.warn(
      "[pseudoId] WebCrypto no disponible (context no segur). S’usarà l’ID en clar només en aquesta sessió."
    );
    return id; // devolució “sense hash” – segueix funcionant l’app
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(getOrCreateSalt() + id);
  const buf = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
