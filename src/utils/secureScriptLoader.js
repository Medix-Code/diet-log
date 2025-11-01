import { applyCspNonce } from "./utils.js";

const loadedScripts = new Map();

/**
 * Carrega un script extern amb SRI i controls de seguretat bàsics.
 * Guarda l'script perquè només es carregui una vegada.
 *
 * @param {Object} options
 * @param {string} options.src - URL completa de l'script.
 * @param {string} [options.integrity] - Cadena SRI (sha384-...).
 * @param {string} [options.crossOrigin="anonymous"] - Mode crossOrigin.
 * @param {string} [options.referrerPolicy="no-referrer"] - Política de referer.
 * @param {number} [options.timeoutMs=15000] - Temps màxim (ms) abans d'abortar.
 * @returns {Promise<void>}
 */
export function loadExternalScript({
  src,
  integrity,
  crossOrigin = "anonymous",
  referrerPolicy = "no-referrer",
  timeoutMs = 15000,
} = {}) {
  if (!src || typeof src !== "string") {
    return Promise.reject(new Error("loadExternalScript: src invàlid."));
  }

  if (loadedScripts.has(src)) {
    return loadedScripts.get(src);
  }

  const existingScript = document.querySelector(`script[src="${src}"]`);
  if (existingScript?.dataset?.secureLoaded === "true") {
    const resolved = Promise.resolve();
    loadedScripts.set(src, resolved);
    return resolved;
  }

  const scriptEl = existingScript ?? document.createElement("script");
  applyCspNonce(scriptEl);
  scriptEl.src = src;
  scriptEl.async = true;
  scriptEl.crossOrigin = crossOrigin;
  scriptEl.referrerPolicy = referrerPolicy;
  if (integrity) {
    scriptEl.integrity = integrity;
  }

  const loadPromise = new Promise((resolve, reject) => {
    let timeoutId = null;

    const cleanup = () => {
      scriptEl.removeEventListener("load", onLoad);
      scriptEl.removeEventListener("error", onError);
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const onLoad = () => {
      cleanup();
      scriptEl.dataset.secureLoaded = "true";
      resolve();
    };

    const onError = () => {
      cleanup();
      if (!existingScript && scriptEl.parentNode) {
        scriptEl.parentNode.removeChild(scriptEl);
      }
      loadedScripts.delete(src);
      reject(new Error(`Error carregant script: ${src}`));
    };

    scriptEl.addEventListener("load", onLoad);
    scriptEl.addEventListener("error", onError);

    timeoutId = window.setTimeout(() => {
      cleanup();
      loadedScripts.delete(src);
      if (!existingScript && scriptEl.parentNode) {
        scriptEl.parentNode.removeChild(scriptEl);
      }
      reject(new Error(`Timeout carregant script: ${src}`));
    }, timeoutMs);
  });

  loadedScripts.set(src, loadPromise);

  if (!existingScript) {
    document.head.appendChild(scriptEl);
  }

  return loadPromise;
}
