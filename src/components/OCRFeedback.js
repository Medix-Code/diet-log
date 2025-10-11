/**
 * @file OCRFeedback.js
 * @description Modern OCR feedback component with live preview and progress (2025 UX)
 *
 * Features:
 * - Live image preview with elegant card design
 * - Real-time OCR progress messages with auto-scroll
 * - Smooth animations and micro-interactions
 * - Accessibility-first (ARIA live regions, semantic HTML)
 * - Glass morphism design with soft colors
 */

import React, { useState, useEffect, useRef } from "react";

/**
 * OCRFeedback Component
 * Shows captured image + live OCR progress with smooth auto-scroll
 */
export function OCRFeedback({
  imageUrl = null,
  isProcessing = false,
  messages = [],
  progress = 0,
  onClose = null,
}) {
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const [animatedProgress, setAnimatedProgress] = useState(0);

  // Smooth progress animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(progress);
    }, 50);
    return () => clearTimeout(timer);
  }, [progress]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [messages]);

  if (!imageUrl && !isProcessing) return null;

  return (
    <div
      className="ocr-feedback-overlay"
      role="dialog"
      aria-live="polite"
      aria-atomic="false"
      aria-label="OCR en progreso"
    >
      <div className="ocr-feedback-container" ref={containerRef}>
        {/* Image Preview Section */}
        {imageUrl && (
          <div className="ocr-image-preview fade-in">
            <div className="ocr-image-wrapper">
              <img
                src={imageUrl}
                alt="Imagen capturada para OCR"
                className="ocr-captured-image"
                loading="eager"
              />
              <div className="ocr-image-badge">
                <svg
                  className="ocr-camera-icon"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 15.2c1.77 0 3.2-1.43 3.2-3.2s-1.43-3.2-3.2-3.2-3.2 1.43-3.2 3.2 1.43 3.2 3.2 3.2zm0-5.4c1.21 0 2.2.99 2.2 2.2s-.99 2.2-2.2 2.2-2.2-.99-2.2-2.2.99-2.2 2.2-2.2z" />
                  <path d="M20 5h-3.2L15 3H9L7.2 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 14H4V7h3.6l1.8-2h5.2l1.8 2H20v12z" />
                </svg>
                Imagen capturada
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {isProcessing && (
          <div
            className="ocr-progress-bar-container fade-in"
            style={{ animationDelay: "0.1s" }}
          >
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
              {Math.round(animatedProgress)}%
            </span>
          </div>
        )}

        {/* Messages Section with Glass Morphism */}
        {messages.length > 0 && (
          <div
            className="ocr-messages-panel fade-in"
            style={{ animationDelay: "0.2s" }}
            role="log"
            aria-live="polite"
            aria-atomic="false"
          >
            <div className="ocr-messages-header">
              <div className="ocr-ai-badge">
                <div className="ocr-ai-pulse"></div>
                <span>AI trabajando</span>
              </div>
              {onClose && !isProcessing && (
                <button
                  className="ocr-close-btn"
                  onClick={onClose}
                  aria-label="Cerrar vista OCR"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="ocr-close-icon"
                  >
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </svg>
                </button>
              )}
            </div>

            <div className="ocr-messages-list">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`ocr-message slide-up ${msg.type || "info"}`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="ocr-message-icon">
                    {msg.type === "success"
                      ? "✓"
                      : msg.type === "error"
                      ? "✗"
                      : msg.type === "warning"
                      ? "⚠"
                      : "→"}
                  </div>
                  <span className="ocr-message-text">{msg.text}</span>
                  {msg.type === "success" && (
                    <div className="ocr-success-ripple"></div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Loading Dots Animation */}
            {isProcessing && (
              <div className="ocr-loading-dots">
                <span className="ocr-dot"></span>
                <span className="ocr-dot"></span>
                <span className="ocr-dot"></span>
              </div>
            )}
          </div>
        )}

        {/* Completion Checkmark */}
        {!isProcessing && messages.length > 0 && progress === 100 && (
          <div className="ocr-completion-badge pop-in">
            <svg
              className="ocr-check-icon"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
            <span>Completado</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Hook for managing OCR state
 * @returns {Object} OCR state and control functions
 */
export function useOCRFeedback() {
  const [imageUrl, setImageUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [progress, setProgress] = useState(0);

  const startOCR = (image) => {
    if (typeof image === "string") {
      setImageUrl(image);
    } else if (image instanceof Blob || image instanceof File) {
      setImageUrl(URL.createObjectURL(image));
    }
    setIsProcessing(true);
    setMessages([]);
    setProgress(0);
  };

  const addMessage = (text, type = "info") => {
    setMessages((prev) => [...prev, { text, type, timestamp: Date.now() }]);
  };

  const updateProgress = (value, message = null) => {
    setProgress(Math.min(100, Math.max(0, value)));
    if (message) {
      addMessage(message, value === 100 ? "success" : "info");
    }
  };

  const completeOCR = (successMessage = "Proceso completado") => {
    setProgress(100);
    addMessage(successMessage, "success");
    setIsProcessing(false);
  };

  const errorOCR = (errorMessage = "Error en el proceso") => {
    addMessage(errorMessage, "error");
    setIsProcessing(false);
  };

  const reset = () => {
    if (imageUrl && imageUrl.startsWith("blob:")) {
      URL.revokeObjectURL(imageUrl);
    }
    setImageUrl(null);
    setIsProcessing(false);
    setMessages([]);
    setProgress(0);
  };

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (imageUrl && imageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  return {
    imageUrl,
    isProcessing,
    messages,
    progress,
    startOCR,
    addMessage,
    updateProgress,
    completeOCR,
    errorOCR,
    reset,
  };
}
