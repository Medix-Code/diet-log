if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./service-worker.js", { updateViaCache: "none" })
    .then((registration) => {
      console.log("Service Worker registrat.");
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker) {
          installingWorker.onstatechange = () => {
            if (
              installingWorker.state === "installed" &&
              navigator.serviceWorker.controller
            )
              window.location.reload();
          };
        }
      };
    })
    .catch((error) => console.error("Error Service Worker:", error));
}
