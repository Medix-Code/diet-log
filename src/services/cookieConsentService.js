// /src/services/cookieConsentService.js

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

function handleAccept() {
  // Comprovem si gtag existeix abans de cridar-lo
  if (typeof window.gtag === "function") {
    window.gtag("consent", "update", {
      analytics_storage: "granted",
    });
  }
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
  if (!consent) {
    showBanner();
    acceptBtn.addEventListener("click", handleAccept);
    declineBtn.addEventListener("click", handleDecline);
  }
}
