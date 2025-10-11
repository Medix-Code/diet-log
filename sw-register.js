// sw-register.js

if ("serviceWorker" in navigator) {
  // Funció per registrar i gestionar actualitzacions
  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        "./service-worker.js",
        { updateViaCache: "none" }
      );

      console.log("Service Worker registrat amb èxit.");

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker) {
          installingWorker.onstatechange = () => {
            if (
              installingWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              console.log(
                "Nou Service Worker instal·lat. Recarregant pàgina..."
              );
              window.location.reload();
            }
          };
        }
      };
    } catch (error) {
      console.error("Error en registrar el Service Worker:", error);
    }
  };

  window.addEventListener("load", registerServiceWorker);

  // COMPROVACIÓ PERIÒDICA ===
  // Comprova si hi ha una nova versió del SW cada hora.
  setInterval(async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        console.log("Comprovant actualitzacions del Service Worker...");
        await registration.update();
      }
    } catch (error) {
      console.error(
        "Error durant la comprovació d'actualització periòdica:",
        error
      );
    }
  }, 1000 * 60 * 60);
}
