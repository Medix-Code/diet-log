/**
 * Components React Incrementals (2025) - Integració Segura
 *
 * Aquest mòdul conté components React que embolcallen funcionalitat
 * JavaScript existent sense alterar-la. És 100% additiu i reversible.
 */

import React from "react";
import ReactDOM from "react-dom/client";

/**
 * Component d'indicador d'estat de connectivitat PWA
 * Mostra online/offline status en temps real
 */
function ConnectionIndicator() {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const [show, setShow] = React.useState(true);

  React.useEffect(() => {
    const updateStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);

      // Oculta automàticament després de 3 segons quan torna online
      if (online) {
        setTimeout(() => setShow(false), 3000);
      } else {
        setShow(true); // Mostra sempre quan offline
      }
    };

    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  if (!show) return null;

  const statusStyle = {
    position: "fixed",
    top: "50px",
    right: "20px",
    padding: isOnline ? "4px 8px" : "8px 12px",
    borderRadius: "20px",
    fontSize: isOnline ? "10px" : "12px",
    fontWeight: "bold",
    backdropFilter: "blur(10px)",
    boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
    zIndex: 1000,
    transition: "all 0.3s ease",
    cursor: isOnline ? "none" : "pointer",
  };

  if (isOnline) {
    return (
      <div
        style={{
          ...statusStyle,
          background: "rgba(76,175,80,0.95)",
          color: "white",
        }}
      >
        🟢 Online
      </div>
    );
  }

  return (
    <div
      style={{
        ...statusStyle,
        background: "rgba(255,87,34,0.95)",
        color: "white",
      }}
      onClick={() => {
        // Opcional: Show helpful tips when clicked
        if (
          confirm(
            "En modo offline algunas funciones pueden estar limitadas. ¿Quieres recargar la app?"
          )
        ) {
          window.location.reload();
        }
      }}
      title="Haz clic para recargar (algunas funciones requieren conexión)"
    >
      ⚠️ Offline - Funciones limitadas
    </div>
  );
}

/**
 * Inicialitza components React de manera segura (fallback-safe)
 * Només s'executa si React està disponible i hi ha elements target
 */
export function initReactComponents() {
  try {
    // Verifica que React està carregat (defensive programming)
    if (typeof React === "undefined" || typeof ReactDOM === "undefined") {
      console.log("React no disponible - components skip");
      return;
    }

    // Inicialitza el component (connection indicator)
    const connectionContainer = document.getElementById(
      "react-connection-container"
    );
    if (connectionContainer && !connectionContainer.hasChildNodes()) {
      const connectionRoot = ReactDOM.createRoot(connectionContainer);
      connectionRoot.render(<ConnectionIndicator />);
    }

    console.log("✅ React components inicialitzats (incremental - reversible)");
  } catch (error) {
    console.log("⚠️ React component skip:", error.message);
    // NO falla - l'app vanilla JS funciona igual
  }
}
