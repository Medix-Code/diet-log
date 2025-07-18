// theme.js

/**
 * @file theme.js
 * @description Gestiona el cambio de tema (claro/oscuro) y lo guarda en localStorage.
 */

// --- Constantes ---
const DOM_IDS = {
  TOGGLE_BTN: "theme-toggle-btn",
  THEME_ICON: "theme-icon",
  THEME_TEXT: "theme-btn-text", // ID del texto del botón
};

const CSS_CLASSES = {
  DARK_THEME: "theme-dark",
};

const LS_KEY = "themePreference";

const THEMES = {
  LIGHT: "light",
  DARK: "dark",
};

const ICONS = {
  LIGHT: "assets/icons/moon.svg", // Icono para activar tema oscuro
  DARK: "assets/icons/sun.svg", // Icono para activar tema claro
};

const META_COLORS = {
  LIGHT: "#004aad", // Color de la barra de estado en tema claro
  DARK: "#343a40", // Color de la barra de estado en tema oscuro
};

// --- Clase Principal ---
class ThemeSwitcher {
  constructor() {
    this.themeToggleButton = null;
    this.themeIconElement = null;
    this.themeTextElement = null; // Elemento que contiene el texto del botón
    this.bodyElement = null;
    this.systemDarkMatcher = null;
  }

  /**
   * Inicializa todos los componentes del gestor de temas.
   */
  init() {
    this.themeToggleButton = document.getElementById(DOM_IDS.TOGGLE_BTN);
    this.themeIconElement = document.getElementById(DOM_IDS.THEME_ICON);
    this.themeTextElement = document.getElementById(DOM_IDS.THEME_TEXT);
    this.bodyElement = document.body;

    // Si algún elemento esencial no existe, no continuamos.
    if (
      !this.themeToggleButton ||
      !this.themeIconElement ||
      !this.themeTextElement ||
      !this.bodyElement
    ) {
      console.warn("Faltan elementos del DOM para el gestor de temas.");
      return;
    }

    let initialTheme;
    const savedTheme = localStorage.getItem(LS_KEY);

    // Prioridad 1: Usar el tema guardado por el usuario.
    if (
      savedTheme &&
      (savedTheme === THEMES.LIGHT || savedTheme === THEMES.DARK)
    ) {
      initialTheme = savedTheme;
    } else {
      // Prioridad 2: Detectar la preferencia del sistema operativo.
      this.systemDarkMatcher = window.matchMedia(
        "(prefers-color-scheme: dark)"
      );
      initialTheme = this.systemDarkMatcher.matches
        ? THEMES.DARK
        : THEMES.LIGHT;

      // Escuchamos cambios en la preferencia del sistema para actualizar el tema si el usuario no ha elegido uno.
      this.systemDarkMatcher.addEventListener(
        "change",
        this._handleSystemThemeChange.bind(this)
      );
    }

    this._applyTheme(initialTheme, false); // Aplicamos el tema inicial sin guardarlo (ya está guardado o es del sistema)

    // Asignamos el evento de clic al botón.
    this.themeToggleButton.addEventListener(
      "click",
      this._handleThemeToggle.bind(this)
    );
  }

  /**
   * Cambia el color de la barra de estado del navegador (móvil).
   * @param {string} color - El color en formato hexadecimal.
   */
  _updateThemeColorMeta(color) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.content = color;
    }
  }

  /**
   * Aplica un tema a la aplicación, actualizando la clase del body, el icono, el texto y el color meta.
   * @param {string} theme - 'light' o 'dark'.
   * @param {boolean} savePreference - Si es true, guarda la elección en localStorage.
   */
  _applyTheme(theme, savePreference = false) {
    const isDark = theme === THEMES.DARK;

    // Actualiza la clase del body
    this.bodyElement.classList.toggle(CSS_CLASSES.DARK_THEME, isDark);

    // Actualiza el icono y el texto del botón
    this.themeIconElement.src = isDark ? ICONS.DARK : ICONS.LIGHT;
    this.themeTextElement.textContent = isDark ? "Claro" : "Oscuro"; // <-- LÓGICA DEL TEXTO

    // Actualiza la descripción para accesibilidad
    this.themeIconElement.alt = isDark
      ? "Cambiar a tema claro"
      : "Cambiar a tema oscuro";

    // Actualiza el color de la barra del navegador
    this._updateThemeColorMeta(isDark ? META_COLORS.DARK : META_COLORS.LIGHT);

    if (savePreference) {
      localStorage.setItem(LS_KEY, theme);
    }
  }

  /**
   * Gestiona el clic en el botón para cambiar de tema.
   */
  _handleThemeToggle() {
    const currentTheme = this.bodyElement.classList.contains(
      CSS_CLASSES.DARK_THEME
    )
      ? THEMES.DARK
      : THEMES.LIGHT;
    const newTheme = currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;

    // Aplica el nuevo tema y lo guarda como preferencia del usuario.
    this._applyTheme(newTheme, true);
  }

  /**
   * Se ejecuta cuando el sistema operativo cambia de tema (ej: del modo día al noche).
   * Solo actualiza el tema de la app si el usuario no ha elegido uno manualmente.
   */
  _handleSystemThemeChange(event) {
    if (!localStorage.getItem(LS_KEY)) {
      const systemTheme = event.matches ? THEMES.DARK : THEMES.LIGHT;
      this._applyTheme(systemTheme, false);
    }
  }
}

// Creamos una única instancia del gestor de temas.
const themeSwitcher = new ThemeSwitcher();

// Exportamos la función de inicialización para ser llamada desde app.js.
export const initThemeSwitcher = () => themeSwitcher.init();
