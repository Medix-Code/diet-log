// /src/services/cookieConsentService.js

import { loadExternalScript } from "../utils/secureScriptLoader.js";

const GA_MEASUREMENT_ID = "G-23SXKMLR75";
const GA_SCRIPT_URL = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
const GA_SCRIPT_INTEGRITY =
  "sha384-npdF2r0gS4VTDBOUWQ32Igb6Tr6PDv4p0eoQI5oJUSutnNpdFb8JFJ7Y8dbvECv7";

// Inicialitza dataLayer i gtag de forma segura sense codi inline.
window.dataLayer = window.dataLayer || [];
window.gtag =
  window.gtag ||
  function gtag() {
    window.dataLayer.push(arguments);
  };

// Funció per obtenir una cookie (del teu exemple)
const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift();
};

// Funció per establir una cookie (del teu exemple)
const setCookie = (name, value, days) => {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = `expires=${date.toUTCString()}`;
  // Afegit Secure per a més seguretat si la teva web va per HTTPS
  document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax;Secure`;
};

// Elements del DOM
let banner, acceptBtn, declineBtn;
let gaInitialized = false;

// Funció per carregar GA dinàmicament sols en acceptar
async function loadGoogleAnalytics() {
  if (gaInitialized) return;
  let scriptLoaded = false;
  try {
    await loadExternalScript({
      src: GA_SCRIPT_URL,
      integrity: GA_SCRIPT_INTEGRITY,
      referrerPolicy: "strict-origin-when-cross-origin",
    });
    scriptLoaded = true;
  } catch (error) {
    console.warn(
      "Fallo de SRI carregant Google Analytics. Reintentant sense integritat:",
      error
    );
    await loadExternalScript({
      src: GA_SCRIPT_URL,
      referrerPolicy: "strict-origin-when-cross-origin",
    });
    scriptLoaded = true;
  }

  if (!scriptLoaded) return;

  window.gtag("consent", "update", {
    analytics_storage: "granted",
  });
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, {
    anonymize_ip: true,
  });
  gaInitialized = true;
}

function handleAccept() {
  // Carreguem i configurem GA amb consentiment grant
  loadGoogleAnalytics().catch((error) => {
    console.error("Error carregant Google Analytics:", error);
  });
  window.gtag("consent", "update", {
    analytics_storage: "granted",
  });
  setCookie("cookie_consent", "granted", 365);
  hideBanner();
}

function handleDecline() {
  if (typeof window.gtag === "function") {
    window.gtag("consent", "update", {
      analytics_storage: "denied",
    });
  }
  setCookie("cookie_consent", "denied", 365);
  hideBanner();
}

function showBanner() {
  if (banner) {
    banner.classList.remove("hidden");
  }
}

function hideBanner() {
  if (banner) {
    banner.classList.add("hidden");
  }
}

export function initCookieConsentService() {
  banner = document.getElementById("cookie-consent-banner");
  acceptBtn = document.getElementById("accept-cookies");
  declineBtn = document.getElementById("decline-cookies");

  if (!banner || !acceptBtn || !declineBtn) {
    console.warn("Elements del bàner de cookies no trobats.");
    return;
  }

  const consent = getCookie("cookie_consent");
  window.gtag("consent", "default", {
    analytics_storage: "denied",
  });

  if (consent === "granted") {
    window.gtag("consent", "update", {
      analytics_storage: "granted",
    });
    loadGoogleAnalytics().catch((error) => {
      console.error("Error carregant GA després del consentiment guardat:", error);
    });
    hideBanner();
    return;
  }

  if (consent === "denied") {
    hideBanner();
    return;
  }

  if (!consent) {
    showBanner();
    acceptBtn.addEventListener("click", handleAccept);
    declineBtn.addEventListener("click", handleDecline);
  }
}
