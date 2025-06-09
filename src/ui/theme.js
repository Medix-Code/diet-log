/**
 * @file theme.js
 * @description Gestiona el canvi de tema (clar/fosc), la persistència
 *              en localStorage i la sincronització amb les preferències del sistema.
 * @module themeSwitcher
 */

// --- Constants ---
const DOM_IDS = {
  TOGGLE_BTN: "theme-toggle-btn",
  THEME_ICON: "theme-icon",
};
const CSS_CLASSES = {
  DARK_THEME: "theme-dark", // Classe aplicada al body per al tema fosc
};
const LS_KEY = "themePreference"; // Clau per a localStorage
const THEMES = {
  LIGHT: "light",
  DARK: "dark",
};
const ICONS = {
  LIGHT: "assets/icons/moon.svg", // Icona a mostrar quan el tema és clar (per canviar a fosc)
  DARK: "assets/icons/sun.svg", // Icona a mostrar quan el tema és fosc (per canviar a clar)
};
// Colors per al meta tag (opcional, es podrien llegir des de CSS si fos necessari)
const META_COLORS = {
  LIGHT: "#004aad", // Color per al tema clar
  DARK: "#343a40", // Color per al tema fosc
};

// --- Variables / Cache ---
let themeToggleButton = null;
let themeIconElement = null;
let bodyElement = null;
let systemDarkMatcher = null; // Per guardar el matchMedia

// --- Funcions Privades ---

/** Actualitza (elimina i recrea) la meta etiqueta 'theme-color'. */
function _updateThemeColorMeta(color) {
  // Intenta reutilitzar si ja existeix
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = color;
}

/**
 * Aplica el tema visualment (classe al body), actualitza la icona del botó,
 * el meta tag, i opcionalment desa la preferència.
 * @param {string} theme - El tema a aplicar ('light' o 'dark').
 * @param {boolean} [savePreference=false] - Si és true, desa la preferència a localStorage.
 */
function _applyTheme(theme, savePreference = false) {
  if (!bodyElement || !themeIconElement) return;

  const isDark = theme === THEMES.DARK;

  bodyElement.classList.toggle(CSS_CLASSES.DARK_THEME, isDark);
  themeIconElement.src = isDark ? ICONS.DARK : ICONS.LIGHT;
  themeIconElement.alt = isDark ? "Canviar a tema clar" : "Canviar a tema fosc"; // Accessibilitat
  _updateThemeColorMeta(isDark ? META_COLORS.DARK : META_COLORS.LIGHT);

  if (savePreference) {
    try {
      localStorage.setItem(LS_KEY, theme);
      console.log(`Preferència de tema desada: ${theme}`);
    } catch (error) {
      console.error(
        "Error desant la preferència de tema a localStorage:",
        error
      );
    }
  }
  console.log(`Tema aplicat: ${theme}`);
}

/** Gestiona el clic al botó de canvi de tema. */
function _handleThemeToggle() {
  const currentTheme = bodyElement.classList.contains(CSS_CLASSES.DARK_THEME)
    ? THEMES.DARK
    : THEMES.LIGHT;
  const newTheme = currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
  // En fer clic, sempre desem la preferència manual
  _applyTheme(newTheme, true);
}

/** Gestiona els canvis en la preferència de tema del sistema operatiu. */
function _handleSystemThemeChange(event) {
  // Només aplica el canvi del sistema si NO hi ha preferència manual desada
  if (!localStorage.getItem(LS_KEY)) {
    const systemTheme = event.matches ? THEMES.DARK : THEMES.LIGHT;
    console.log(
      `Preferència del sistema canviada a: ${systemTheme}. Aplicant...`
    );
    _applyTheme(systemTheme, false); // No desem, és preferència del sistema
  } else {
    console.log(
      "Canvi de preferència del sistema ignorat (preferència manual existent)."
    );
  }
}

// --- Funcions Públiques ---

/**
 * Inicialitza el sistema de canvi de tema. S'ha de cridar quan el DOM estigui llest.
 * @export
 */
export function initThemeSwitcher() {
  themeToggleButton = document.getElementById(DOM_IDS.TOGGLE_BTN);
  themeIconElement = document.getElementById(DOM_IDS.THEME_ICON);
  bodyElement = document.body;

  if (!themeToggleButton || !themeIconElement || !bodyElement) {
    console.warn(
      "Theme Switcher: Falten elements DOM necessaris (botó, icona o body)."
    );
    return;
  }

  // Determina el tema inicial
  let initialTheme;
  const savedTheme = localStorage.getItem(LS_KEY);

  if (
    savedTheme &&
    (savedTheme === THEMES.LIGHT || savedTheme === THEMES.DARK)
  ) {
    initialTheme = savedTheme;
    console.log(`Tema inicial carregat des de localStorage: ${initialTheme}`);
  } else {
    systemDarkMatcher = window.matchMedia("(prefers-color-scheme: dark)");
    initialTheme = systemDarkMatcher.matches ? THEMES.DARK : THEMES.LIGHT;
    console.log(`Tema inicial detectat des del sistema: ${initialTheme}`);
    // Escolta canvis del sistema només si no hi ha preferència desada
    systemDarkMatcher.addEventListener("change", _handleSystemThemeChange);
  }

  // Aplica el tema inicial (sense desar-lo de nou si ja venia de localStorage)
  _applyTheme(initialTheme, false);

  // Configura el listener del botó
  themeToggleButton.addEventListener("click", _handleThemeToggle);

  console.log("Theme Switcher inicialitzat.");
}
