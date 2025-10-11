/**
 * Components React Incrementals (2025) - Integració Segura
 *
 * Aquest mòdul conté components React que embolcallen funcionalitat
 * JavaScript existent sense alterar-la. És 100% additiu i reversible.
 */

import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";

/**
 * Component que mostra el resum dels serveis actius
 * Usa hooks React per estat reactiu, però llegeix de l'estat vanilla JS
 */
function ActiveServicesSummary() {
  // Estat local React - sincronitzat amb global window state
  const [activeService, setActiveService] = useState(0);
  const [serviceCount, setServiceCount] = useState(0);

  // Sincronitzar amb estat vanilla JS cada 500ms
  useEffect(() => {
    const syncWithVanillaState = () => {
      try {
        // Llegeix l'estat global sense modificar-lo
        const active = window.currentActiveService || 0;
        const count =
          document.querySelectorAll(".service:not(.hidden)").length || 0;

        setActiveService(active);
        setServiceCount(count);
      } catch (error) {
        console.log("React component sync skipped:", error.message);
      }
    };

    // Sincronització inicial
    syncWithVanillaState();

    // Monitorització periòdica (low overhead)
    const interval = setInterval(syncWithVanillaState, 1000); // Cada segon

    return () => clearInterval(interval);
  }, []);

  // No renderitza res si no hi ha serveis (fallback safe)
  if (serviceCount === 0) {
    return null;
  }

  return (
    <div
      className="react-service-summary"
      style={{
        position: "fixed",
        bottom: "100px",
        right: "20px",
        background: "rgba(0, 74, 173, 0.95)",
        color: "white",
        padding: "8px 12px",
        borderRadius: "8px",
        fontSize: "12px",
        zIndex: 1000,
        backdropFilter: "blur(10px)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <span style={{ fontSize: "16px" }}>📊</span>
      <span>
        Servei actiu: S{activeService + 1} / Total: {serviceCount}
      </span>
      <span
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: "#4CAF50",
          animation: "pulse 2s infinite",
        }}
      />
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

/**
 * Component de barra de progrés del formulari
 * Mostra visualment quants serveis tenen dades omplertes
 */
function FormProgressBar() {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const calculateProgress = () => {
      try {
        let totalFields = 0;
        let filledFields = 0;

        // Mesura camps bàsics (data, tipus, servei)
        const basicFields = ["date", "diet-type", "service-type"];
        basicFields.forEach((fieldId) => {
          const elem = document.getElementById(fieldId);
          if (elem) {
            totalFields++;
            if (elem.value) filledFields++;
          }
        });

        // Mesura camps de dotació
        const dotacioFields = ["vehicle-number", "person1", "person2"];
        dotacioFields.forEach((fieldId) => {
          const elem = document.getElementById(fieldId);
          if (elem) {
            totalFields++;
            if (elem.value && elem.value.trim()) filledFields++;
          }
        });

        // Mesura serveis actius
        const serviceElements = document.querySelectorAll(
          ".service:not(.hidden)"
        );
        serviceElements.forEach((service) => {
          const inputs = service.querySelectorAll(
            'input:not([type="button"]):not([type="time"]), select, textarea'
          );
          inputs.forEach((input) => {
            if (!input.disabled) {
              totalFields++;
              if (input.value && input.value.trim()) filledFields++;
            }
          });
        });

        const progressPercent =
          totalFields > 0 ? (filledFields / totalFields) * 100 : 0;
        setProgress(progressPercent);
      } catch (error) {
        console.log("Progress calculation skipped:", error.message);
        setProgress(0);
      }
    };

    calculateProgress();
    const interval = setInterval(calculateProgress, 2000); // Cada 2 segons (menys freqüent)
    return () => clearInterval(interval);
  }, []);

  if (progress === 0) return null; // No mostra si no hi ha progress

  return (
    <div
      style={{
        position: "fixed",
        top: "125px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(90vw, 400px)",
        background: "rgba(255, 255, 255, 0.9)",
        backdropFilter: "blur(10px)",
        borderRadius: "8px",
        padding: "12px 16px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        border: "1px solid rgba(0,74,173,0.2)",
        zIndex: 1000,
        fontSize: "12px",
        fontFamily: "Roboto Serif, serif",
        color: "#333",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span>📈</span>
        <span style={{ flex: 1 }}>Progrés del formulari</span>
        <span style={{ fontWeight: "bold", color: "#004aad" }}>
          {Math.round(progress)}%
        </span>
      </div>
      <div
        style={{
          width: "100%",
          height: "4px",
          background: "rgba(0,74,173,0.1)",
          borderRadius: "2px",
          margin: "8px 0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            background: "linear-gradient(90deg, #004aad, #0a96e7)",
            borderRadius: "2px",
            transition: "width 0.5s ease-out",
          }}
        />
      </div>
    </div>
  );
}

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

    // Inicialitza el primer component (summary)
    const summaryContainer = document.getElementById("react-summary-container");
    if (summaryContainer && !summaryContainer.hasChildNodes()) {
      const summaryRoot = ReactDOM.createRoot(summaryContainer);
      summaryRoot.render(<ActiveServicesSummary />);
    }

    // Inicialitza el segon component (progress bar)
    const progressContainer = document.getElementById(
      "react-progress-container"
    );
    if (progressContainer && !progressContainer.hasChildNodes()) {
      const progressRoot = ReactDOM.createRoot(progressContainer);
      progressRoot.render(<FormProgressBar />);
    }

    // Inicialitza el tercer component (connection indicator)
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
