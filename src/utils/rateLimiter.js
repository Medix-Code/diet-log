/**
 * RateLimiter - Sistema de control de límit de peticions
 * Prevé abusos de recursos i DoS efectiu en operacions costoses (OCR, PDF)
 *
 * @class RateLimiter
 * @version 1.0.0 (2025)
 */
class RateLimiter {
  /**
   * Crea una nova instància de RateLimiter
   * @param {number} maxRequests - Nombre màxim de peticions permeses
   * @param {number} windowMs - Finestra de temps en mil·lisegons
   * @param {string} actionName - Nom de l'acció (per logging)
   */
  constructor(maxRequests = 10, windowMs = 60000, actionName = "acció") {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.actionName = actionName;
    this.requests = [];
  }

  /**
   * Comprova si es pot fer una nova petició
   * @returns {boolean} True si es pot fer la petició, false si s'ha arribat al límit
   */
  canMakeRequest() {
    const now = Date.now();

    // Neteja peticions antigues fora de la finestra de temps
    this.requests = this.requests.filter((time) => now - time < this.windowMs);

    // Comprova si s'ha arribat al límit
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      const timeUntilReset = Math.ceil(
        (oldestRequest + this.windowMs - now) / 1000
      );

      console.warn(
        `[RateLimiter] Límit assolit per "${this.actionName}". ` +
          `Espera ${timeUntilReset}s abans de tornar-ho a intentar.`
      );

      return false;
    }

    // Registra la nova petició
    this.requests.push(now);
    return true;
  }

  /**
   * Obté el nombre de peticions restants
   * @returns {number} Peticions disponibles
   */
  getRemainingRequests() {
    const now = Date.now();
    this.requests = this.requests.filter((time) => now - time < this.windowMs);
    return Math.max(0, this.maxRequests - this.requests.length);
  }

  /**
   * Reseteja el comptador de peticions
   */
  reset() {
    this.requests = [];
    console.log(`[RateLimiter] Resetejat el límit per "${this.actionName}"`);
  }

  /**
   * Obté informació de l'estat actual
   * @returns {Object} Estat del rate limiter
   */
  getStatus() {
    const now = Date.now();
    this.requests = this.requests.filter((time) => now - time < this.windowMs);

    return {
      actionName: this.actionName,
      requestsMade: this.requests.length,
      maxRequests: this.maxRequests,
      remaining: this.maxRequests - this.requests.length,
      windowSeconds: this.windowMs / 1000,
    };
  }
}

export default RateLimiter;
