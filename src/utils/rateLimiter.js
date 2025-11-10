/**
 * RateLimiter - Sistema de control de límit de peticions
 * Prevé abusos de recursos i DoS efectiu en operacions costoses (OCR, PDF)
 *
 * NOTA: Aquest rate limiter és client-side i pot ser bypassat per usuaris tècnics.
 * Per aplicacions crítiques, implementar rate limiting al backend.
 *
 * @class RateLimiter
 * @version 1.1.0 (2025)
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

    // Identificador únic basat en timestamp de creació + random
    // Fa més difícil (però no impossible) bypassar el rate limiter
    this._instanceId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this._tokens = this._generateTokens();
  }

  /**
   * Genera tokens de validació interns
   * @private
   */
  _generateTokens() {
    const tokens = [];
    for (let i = 0; i < this.maxRequests; i++) {
      tokens.push({
        id: `${this._instanceId}_${i}`,
        used: false,
        timestamp: null,
      });
    }
    return tokens;
  }

  /**
   * Valida que la instància no ha estat manipulada
   * @private
   */
  _validateIntegrity() {
    // Comprovar que els tokens no han estat modificats externament
    if (!Array.isArray(this._tokens) || this._tokens.length !== this.maxRequests) {
      console.error(`[RateLimiter] MANIPULACIÓ DETECTADA per "${this.actionName}"`);
      // Regenerar tokens
      this._tokens = this._generateTokens();
      this.requests = [];
      return false;
    }
    return true;
  }

  /**
   * Comprova si es pot fer una nova petició
   * @returns {boolean} True si es pot fer la petició, false si s'ha arribat al límit
   */
  canMakeRequest() {
    // Validar integritat de la instància
    this._validateIntegrity();

    const now = Date.now();

    // Neteja peticions antigues fora de la finestra de temps
    this.requests = this.requests.filter((time) => now - time < this.windowMs);

    // Neteja tokens expirats
    this._tokens.forEach((token) => {
      if (token.used && token.timestamp && now - token.timestamp >= this.windowMs) {
        token.used = false;
        token.timestamp = null;
      }
    });

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

    // Buscar un token disponible i marcar-lo com a usat
    const availableToken = this._tokens.find((t) => !t.used);
    if (availableToken) {
      availableToken.used = true;
      availableToken.timestamp = now;
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
    if (process.env.NODE_ENV !== "production") {
      console.log(`[RateLimiter] Resetejat el límit per "${this.actionName}"`);
    }
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
