/**
 * @file theme.js
 * @description Gestiona el canvi de tema clar/fosc amb persistència.
 * @module themeSwitcher
 */

// --- Constants ---
const DOM_IDS = {
  TOGGLE_BTN: "theme-toggle-btn",
  THEME_ICON: "theme-icon",
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
  LIGHT: "assets/icons/moon.svg",
  DARK: "assets/icons/sun.svg",
};
const META_COLORS = {
  LIGHT: "#004aad",
  DARK: "#343a40",
};

// --- Classe Principal ---
class ThemeSwitcher {
  constructor() {
    this.themeToggleButton = null;
    this.themeIconElement = null;
    this.bodyElement = null;
    this.systemDarkMatcher = null;
  }

  /**
   * Inicialitza el switcher.
   * @export
   */
  init() {
    this.themeToggleButton = document.getElementById(DOM_IDS.TOGGLE_BTN);
    this.themeIconElement = document.getElementById(DOM_IDS.THEME_ICON);
    this.bodyElement = document.body;

    if (
      !this.themeToggleButton ||
      !this.themeIconElement ||
      !this.bodyElement
    ) {
      return;
    }

    let initialTheme;
    const savedTheme = localStorage.getItem(LS_KEY);

    if (
      savedTheme &&
      (savedTheme === THEMES.LIGHT || savedTheme === THEMES.DARK)
    ) {
      initialTheme = savedTheme;
    } else {
      this.systemDarkMatcher = window.matchMedia(
        "(prefers-color-scheme: dark)"
      );
      initialTheme = this.systemDarkMatcher.matches
        ? THEMES.DARK
        : THEMES.LIGHT;
      this.systemDarkMatcher.addEventListener(
        "change",
        this._handleSystemThemeChange.bind(this)
      );
    }

    this._applyTheme(initialTheme, false);

    this.themeToggleButton.addEventListener(
      "click",
      this._handleThemeToggle.bind(this)
    );
  }

  _updateThemeColorMeta(color) {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = color;
  }

  _applyTheme(theme, savePreference = false) {
    const isDark = theme === THEMES.DARK;
    this.bodyElement.classList.toggle(CSS_CLASSES.DARK_THEME, isDark);
    this.themeIconElement.src = isDark ? ICONS.DARK : ICONS.LIGHT;
    this.themeIconElement.alt = isDark
      ? "Canviar a tema clar"
      : "Canviar a tema fosc";
    this._updateThemeColorMeta(isDark ? META_COLORS.DARK : META_COLORS.LIGHT);

    if (savePreference) {
      try {
        localStorage.setItem(LS_KEY, theme);
      } catch (error) {
        // Maneig silenciós
      }
    }
  }

  _handleThemeToggle() {
    const currentTheme = this.bodyElement.classList.contains(
      CSS_CLASSES.DARK_THEME
    )
      ? THEMES.DARK
      : THEMES.LIGHT;
    const newTheme = currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    this._applyTheme(newTheme, true);
  }

  _handleSystemThemeChange(event) {
    if (!localStorage.getItem(LS_KEY)) {
      const systemTheme = event.matches ? THEMES.DARK : THEMES.LIGHT;
      this._applyTheme(systemTheme, false);
    }
  }
}

const themeSwitcher = new ThemeSwitcher();
export const initThemeSwitcher = () => themeSwitcher.init();
