// /src/ui/onboarding.js (VERSIÓ FINAL AMB LÒGICA DE 'MOSTRAR UNA VEGADA')

const ONBOARDING_COMPLETED_KEY = "onboardingCompleted"; // Clau per al localStorage

export function initOnboarding() {
  const container = document.getElementById("onboarding-container");
  if (!container) return;

  // --- PAS 1: COMPROVAR SI L'ONBOARDING JA S'HA COMPLETAT ---
  // Utilitzem JSON.parse per llegir el valor de forma segura.
  const isCompleted = JSON.parse(
    localStorage.getItem(ONBOARDING_COMPLETED_KEY) || "false"
  );

  if (isCompleted) {
    // Si ja s'ha completat, amaguem el contenidor i no fem res més.
    container.classList.add("hidden");
    return;
  }

  // --- Si no s'ha completat, continuem amb la lògica normal de l'onboarding ---

  // Lògica per a la transició d'entrada (fade-in)
  window.addEventListener("load", () => {
    container.classList.add("onboarding-loaded");
  });

  const slides = document.querySelectorAll(".onboarding-slide");
  const dots = document.querySelectorAll(".nav-dot");
  const finishBtn = document.getElementById("onboarding-finish-btn");
  const skipBtn = document.getElementById("onboarding-skip-btn");
  let currentSlide = 0;

  function showSlide(index) {
    slides.forEach((slide, i) => {
      slide.classList.toggle("active", i === index);
    });
    dots.forEach((dot, i) => {
      dot.classList.toggle("active", i === index);
    });
  }

  function nextSlide() {
    if (currentSlide < slides.length - 1) {
      currentSlide++;
      showSlide(currentSlide);
      if (navigator.vibrate) navigator.vibrate(10);
    }
  }

  // --- PAS 2: FUNCIÓ PER FINALITZAR I GUARDAR L'ESTAT ---
  function finishOnboarding() {
    container.classList.add("hidden");
    // Guardem la marca al localStorage. Utilitzem JSON.stringify per seguretat.
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, JSON.stringify(true));
    if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
  }

  // --- GESTIÓ D'INTERACCIONS DE L'USUARI ---

  // Clic per avançar (ignorant botons)
  container.addEventListener("click", (e) => {
    if (e.target.closest("button, a, .nav-dot")) {
      return;
    }
    nextSlide();
  });

  // Gestos tàctils (swipe)
  let touchStartX = 0;
  container.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.changedTouches[0].screenX;
    },
    { passive: true }
  );

  container.addEventListener("touchend", (e) => {
    const touchEndX = e.changedTouches[0].screenX;
    if (touchEndX < touchStartX - 50) {
      // Swipe a l'esquerra
      nextSlide();
    }
  });

  // --- PAS 3: ASSIGNAR LA FUNCIÓ DE FINALITZACIÓ ALS BOTONS ---
  finishBtn.addEventListener("click", finishOnboarding);
  skipBtn.addEventListener("click", finishOnboarding);
}
