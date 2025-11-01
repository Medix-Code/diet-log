/**
 * Input Sanitizer - Validacions i sanitització d'inputs per seguretat
 * Prevé injecció de dades malicioses, XSS i altres vectors d'atac
 * 
 * @module inputSanitizer
 * @version 1.0.0 (2025)
 */

import { logger } from "./logger.js";

const log = logger.withScope("InputSanitizer");

// Patrons de validació semàntica
const VALIDATION_PATTERNS = {
  // Format d'hora HH:mm (00:00 - 23:59)
  TIME: /^(?:2[0-3]|[01]?[0-9]):[0-5][0-9]$/,
  
  // Número de servei (9 dígits)
  SERVICE_NUMBER: /^\d{9}$/,
  
  // Número de vehicle (alfanumèric, 3-6 caràcters)
  VEHICLE_NUMBER: /^[A-Z0-9]{3,6}$/i,
  
  // Data ISO (YYYY-MM-DD)
  DATE_ISO: /^\d{4}-\d{2}-\d{2}$/,
  
  // Nom de persona (lletres, espais, guions i accents)
  PERSON_NAME: /^[a-zA-ZÀ-ÿ\s\-']{1,28}$/,
  
  // Text general (alfanumèric amb puntuació bàsica)
  GENERAL_TEXT: /^[a-zA-Z0-9À-ÿ\s\-.,;:()'\/]{0,150}$/,
};

// Patrons sospitosos que indiquen possibles atacs
const SUSPICIOUS_PATTERNS = [
  // Scripts i tags HTML
  /<script[^>]*>.*?<\/script>/gi,
  /<iframe[^>]*>.*?<\/iframe>/gi,
  /<object[^>]*>.*?<\/object>/gi,
  /<embed[^>]*>/gi,
  /<[^>]*>/g, // Qualsevol tag HTML
  
  // JavaScript events i protocols
  /javascript:/gi,
  /on\w+\s*=/gi, // onclick=, onload=, etc.
  /data:text\/html/gi,
  
  // SQL Injection patterns
  /('|(--)|;|\/\*|\*\/|xp_|sp_|exec|execute|select|insert|update|delete|drop|create|alter)/gi,
  
  // Command Injection
  /(\||&|;|\$\(|\`|>|<)/g,
];

/**
 * Detecta patrons sospitosos en un text
 * @param {string} text - Text a analitzar
 * @returns {boolean} True si detecta patrons sospitosos
 */
export function hasSuspiciousPatterns(text) {
  if (typeof text !== 'string') return false;
  
  return SUSPICIOUS_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Sanititza text eliminant caràcters potencialment perillosos
 * @param {string} text - Text a sanititzar
 * @returns {string} Text sanititzat
 */
export function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  
  // Elimina tags HTML
  let sanitized = text.replace(/<[^>]*>/g, '');
  
  // Elimina caràcters de control excepte tabs i line breaks
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  // Elimina múltiples espais seguits
  sanitized = sanitized.replace(/\s+/g, ' ');
  
  // Trim
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * Valida format d'hora HH:mm
 * @param {string} time - Hora a validar
 * @returns {boolean} True si és vàlida
 */
export function validateTime(time) {
  if (!time || typeof time !== 'string') return false;
  
  if (hasSuspiciousPatterns(time)) {
    log.warn('Patró sospitós detectat en validació de hora:', time);
    return false;
  }
  
  return VALIDATION_PATTERNS.TIME.test(time);
}

/**
 * Valida número de servei (9 dígits)
 * @param {string} serviceNumber - Número de servei
 * @returns {boolean} True si és vàlid
 */
export function validateServiceNumber(serviceNumber) {
  if (!serviceNumber || typeof serviceNumber !== 'string') return false;
  
  if (hasSuspiciousPatterns(serviceNumber)) {
    log.warn('Patró sospitós detectat en número de servei:', serviceNumber);
    return false;
  }
  
  // Permet números de 1-9 dígits
  return /^\d{1,9}$/.test(serviceNumber);
}

/**
 * Valida número de vehicle
 * @param {string} vehicleNumber - Número de vehicle
 * @returns {boolean} True si és vàlid
 */
export function validateVehicleNumber(vehicleNumber) {
  if (!vehicleNumber || typeof vehicleNumber !== 'string') return false;
  
  if (hasSuspiciousPatterns(vehicleNumber)) {
    log.warn('Patró sospitós detectat en número de vehicle:', vehicleNumber);
    return false;
  }
  
  return VALIDATION_PATTERNS.VEHICLE_NUMBER.test(vehicleNumber);
}

/**
 * Valida nom de persona
 * @param {string} name - Nom a validar
 * @returns {boolean} True si és vàlid
 */
export function validatePersonName(name) {
  if (!name || typeof name !== 'string') return true; // Opcional
  
  if (hasSuspiciousPatterns(name)) {
    log.warn('Patró sospitós detectat en nom de persona:', name);
    return false;
  }
  
  return VALIDATION_PATTERNS.PERSON_NAME.test(name);
}

/**
 * Valida text general (ubicacions, notes, etc.)
 * @param {string} text - Text a validar
 * @returns {boolean} True si és vàlid
 */
export function validateGeneralText(text) {
  if (!text || typeof text !== 'string') return true; // Opcional
  
  if (hasSuspiciousPatterns(text)) {
    log.warn('Patró sospitós detectat en text general:', text.substring(0, 50));
    return false;
  }
  
  return VALIDATION_PATTERNS.GENERAL_TEXT.test(text);
}

/**
 * Valida data en format ISO (YYYY-MM-DD)
 * @param {string} date - Data a validar
 * @returns {boolean} True si és vàlida
 */
export function validateDate(date) {
  if (!date || typeof date !== 'string') return false;
  
  if (hasSuspiciousPatterns(date)) {
    log.warn('Patró sospitós detectat en data:', date);
    return false;
  }
  
  if (!VALIDATION_PATTERNS.DATE_ISO.test(date)) return false;
  
  // Valida que sigui una data real
  const dateObj = new Date(date);
  return dateObj instanceof Date && !isNaN(dateObj);
}

/**
 * Valida resultat d'OCR abans de processar-lo
 * @param {string} ocrText - Text obtingut de l'OCR
 * @returns {Object} { valid: boolean, reason?: string }
 */
export function validateOCRResult(ocrText) {
  if (!ocrText || typeof ocrText !== 'string') {
    return { valid: false, reason: 'Text buit o invàlid' };
  }
  
  // Detecta patrons sospitosos
  if (hasSuspiciousPatterns(ocrText)) {
    log.warn('Patrons sospitosos detectats en resultat OCR');
    return { valid: false, reason: 'Text amb patrons sospitosos detectats' };
  }
  
  // Comprova longitud raonable (màx 2000 caràcters)
  if (ocrText.length > 2000) {
    return { valid: false, reason: 'Text massa llarg' };
  }
  
  // Comprova que contingui almenys alguns números (hores)
  if (!/\d/.test(ocrText)) {
    return { valid: false, reason: 'No conté dígits (hores esperades)' };
  }
  
  return { valid: true };
}

/**
 * Sanititza i valida input abans de guardar
 * @param {string} value - Valor a sanititzar
 * @param {string} type - Tipus de validació ('time', 'serviceNumber', 'vehicleNumber', 'personName', 'text')
 * @returns {Object} { valid: boolean, sanitized: string, reason?: string }
 */
export function sanitizeAndValidate(value, type = 'text') {
  const sanitized = sanitizeText(value);
  
  let valid = false;
  let reason = '';
  
  switch (type) {
    case 'time':
      valid = validateTime(sanitized);
      reason = valid ? '' : 'Format d\'hora invàlid (esperat: HH:mm)';
      break;
      
    case 'serviceNumber':
      valid = validateServiceNumber(sanitized);
      reason = valid ? '' : 'Número de servei invàlid (esperat: 1-9 dígits)';
      break;
      
    case 'vehicleNumber':
      valid = validateVehicleNumber(sanitized);
      reason = valid ? '' : 'Número de vehicle invàlid (esperat: 3-6 caràcters alfanumèrics)';
      break;
      
    case 'personName':
      valid = validatePersonName(sanitized);
      reason = valid ? '' : 'Nom invàlid (només lletres, espais i guions)';
      break;
      
    case 'text':
    default:
      valid = validateGeneralText(sanitized);
      reason = valid ? '' : 'Text invàlid (conté caràcters no permesos)';
      break;
  }
  
  return { valid, sanitized, reason };
}

export default {
  hasSuspiciousPatterns,
  sanitizeText,
  validateTime,
  validateServiceNumber,
  validateVehicleNumber,
  validatePersonName,
  validateGeneralText,
  validateDate,
  validateOCRResult,
  sanitizeAndValidate,
};
