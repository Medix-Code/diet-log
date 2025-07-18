/**
 * Retorna el *salt* permanent (unic per dispositiu).  Si no existeix, el crea.
 * S'al·loca a localStorage perquè segueixi disponible entre sessions.
 */
export function getOrCreateSalt() {
  const KEY = "dietSalt";
  let salt = localStorage.getItem(KEY);
  if (!salt) {
    const random = crypto.getRandomValues(new Uint8Array(16));
    salt = Array.from(random)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    localStorage.setItem(KEY, salt);
  }
  return salt;
}

/**
 * Converteix un identificador numèric (string de 9 dígits) en un hash SHA‑256
 * hexadecimal, emprant el *salt* local.  El resultat és determinista però
 * impracticable de revertir sense aquest salt.
 *
 * @param {string} id  Ex: "123456789"
 * @returns {Promise<string>} Hash en minúscules (64 caràcters hex)
 */
export async function pseudoId(id) {
  const encoder = new TextEncoder();
  const data = encoder.encode(getOrCreateSalt() + id);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
