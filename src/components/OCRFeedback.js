/**
 * @file OCRFeedback.js
 * @description Component modern de feedback OCR amb vista prèvia en temps real i progrés (2025 UX)
 *
 * Característiques:
 * - Vista prèvia d'imatge en directe amb disseny elegant de targeta
 * - Missatges de progrés OCR en temps real amb auto-scroll
 * - Animacions suaus i micro-interaccions
 * - Accessibilitat prioritària (regions ARIA live, HTML semàntic)
 * - Disseny glass morphism amb colors suaus
 */

import React, { useState, useEffect, useRef } from "react";

/**
 * Component OCRFeedback
 * Mostra la imatge capturada + progrés OCR en temps real amb auto-scroll suau
 */
export function OCRFeedback({
  imageUrl = null,
  isProcessing = false,
  progress = 0,
  status = "idle",
  statusText = "Reconociendo texto",
  onClose = null,
}) {
  const containerRef = useRef(null);
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [dots, setDots] = useState("");

  // Suavitza els canvis de progrés per evitar salts sobtats
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(progress);
    }, 50);
    return () => clearTimeout(timer);
  }, [progress]);

  // Animació de punts suspensius mentre es processa
  useEffect(() => {
    if (status !== "processing") {
      setDots("");
      return;
    }
    setDots(".");
    const interval = setInterval(() => {
      setDots((prevDots) => {
        if (prevDots.length >= 3) return ".";
        return `${prevDots}.`;
      });
    }, 500);
    return () => clearInterval(interval);
  }, [status]);

  // El component NO es mostra mai en cas d'error o idle
  if (status === "error" || status === "idle") {
    return null;
  }

  // El component es renderitza si:
  // - Està processant (isProcessing = true)
  // - Té una imatge i està en estat "done" o "warning" (per mostrar el resultat)
  const shouldRender =
    (Boolean(imageUrl) && isProcessing) ||
    (Boolean(imageUrl) && (status === "done" || status === "warning"));
  if (!shouldRender) return null;

  const cleanedStatusText =
    statusText
      ?.replace(/\s+\d{1,3}%/, "")
      .replace(/\.{2,}$/, "")
      .trim() || "Reconociendo texto";
  const displayStatus =
    status === "processing" ? `${cleanedStatusText}${dots}` : statusText;

  return (
    <div
      className="ocr-feedback-overlay"
      role="dialog"
      aria-live="polite"
      aria-atomic="false"
      aria-label="OCR en progreso"
    >
      <div className="ocr-feedback-container" ref={containerRef}>
        {imageUrl && (
          <div className="ocr-image-preview fade-in">
            <img
              src={imageUrl}
              alt="Imagen capturada para OCR"
              className="ocr-captured-image"
              loading="eager"
            />
          </div>
        )}

        {(isProcessing ||
          status === "done" ||
          status === "error" ||
          status === "warning") && (
          <div className="ocr-progress-section fade-in">
            <div className="ocr-progress-bar-container">
              <div className="ocr-progress-bar-track">
                <div
                  className="ocr-progress-bar-fill"
                  style={{ width: `${animatedProgress}%` }}
                  role="progressbar"
                  aria-valuenow={animatedProgress}
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  <div className="ocr-progress-shine"></div>
                </div>
              </div>
              <span className="ocr-progress-percentage">
                {status === "error" ? "" : `${Math.round(animatedProgress)}%`}
              </span>
            </div>
            <div className={`ocr-status-line ${status}`}>
              {displayStatus
                ?.split("\n")
                .map((line, i) => <div key={i}>{line}</div>) || ""}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Hook per gestionar l'estat de l'OCR
 * @returns {Object} Estat de l'OCR i funcions de control
 */
export function useOCRFeedback() {
  const [imageUrl, setImageUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("idle");
  const [statusText, setStatusText] = useState("Reconociendo texto");

  const revokeBlobUrl = (url) => {
    if (url && url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  };

  const startOCR = (image) => {
    revokeBlobUrl(imageUrl);
    if (typeof image === "string") {
      setImageUrl(image);
    } else if (image instanceof Blob || image instanceof File) {
      const nextUrl = URL.createObjectURL(image);
      setImageUrl(nextUrl);
    }
    setIsProcessing(true);
    setProgress(0);
    setStatus("processing");
    setStatusText("Reconociendo texto");
  };

  const updateProgress = (value, message = null) => {
    setProgress(Math.min(100, Math.max(0, value)));
    if (message) {
      setStatusText(message);
    }
    setStatus((prev) => {
      if (prev === "error" || prev === "done") return prev;
      return "processing";
    });
  };

  const completeOCR = (successMessage = "✓ Texto reconocido correctamente") => {
    setProgress(100);
    setStatus("done");
    setStatusText(successMessage);
    setIsProcessing(false);
  };

  const errorOCR = (errorMessage = "Error al escanear") => {
    setStatus("error");
    setStatusText(errorMessage);
    setIsProcessing(false);
  };

  const reset = () => {
    revokeBlobUrl(imageUrl);
    setImageUrl(null);
    setIsProcessing(false);
    setProgress(0);
    setStatus("idle");
    setStatusText("Reconociendo texto");
  };

  useEffect(() => {
    return () => revokeBlobUrl(imageUrl);
  }, [imageUrl]);

  return {
    imageUrl,
    isProcessing,
    progress,
    status,
    statusText,
    startOCR,
    updateProgress,
    completeOCR,
    errorOCR,
    reset,
  };
}
