/**
 * Servei per gestionar suggeriments d'origen i destí
 * Guarda valors introduïts anteriorment i els ofereix com a suggeriments
 */

import {
  ALL_LOCATIONS,
  PUBLIC_HEALTH_CENTERS,
  MUNICIPALITIES,
} from "../data/locationOptions.js";
import { logger } from "../utils/logger.js";

const log = logger.withScope("LocationSuggestions");

// Constants per localStorage
const STORAGE_KEYS = {
  ORIGIN_SUGGESTIONS: "locationSuggestions.origin",
  DESTINATION_SUGGESTIONS: "locationSuggestions.destination",
};

// Límits de suggeriments
const MAX_SUGGESTIONS = 10;
const MAX_DATALIST_OPTIONS = 5; // Màxim 5 opcions al desplegable
const RECENT_SUGGESTIONS_LIMIT = 6;
const MIN_CHARS_FOR_SUGGESTIONS = 3; // Mínim caràcters abans de mostrar suggeriments

const normalizeText = (text) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const PRIORITY_LOCATIONS = [
  "Barcelona",
  "L'Hospitalet de Llobregat",
  "Badalona",
  "Terrassa",
  "Sabadell",
  "Lleida",
  "Girona",
  "Tarragona",
  "Reus",
  "Manresa",
  "Mataró",
  "Santa Coloma de Gramenet",
  "Cornellà de Llobregat",
  "Sant Boi de Llobregat",
  "Rubí",
  "Vilanova i la Geltrú",
  "Viladecans",
  "El Prat de Llobregat",
  "Granollers",
  "Cerdanyola del Vallès",
  "Mollet del Vallès",
  "Castelldefels",
  "Gavà",
  "Martorell",
  "Igualada",
  "Vic",
  "Figueres",
  "Olot",
  "Blanes",
  "Lloret de Mar",
  "Cambrils",
  "Salou",
  "Sitges",
  "Roses",
  "Palafrugell",
  "Sant Cugat del Vallès",
  "Esplugues de Llobregat",
  "Sant Adrià de Besòs",
  "Sant Feliu de Llobregat",
  "Sant Joan Despí",
  "Sant Just Desvern",
  "Parets del Vallès",
  "Pineda de Mar",
  "Calella",
  "Castellar del Vallès",
  "Molins de Rei",
  "Ripollet",
  "Berga",
  "La Seu d'Urgell",
  "Puigcerdà",
  "Amposta",
  "Balaguer",
  "Valls",
  "La Bisbal d'Empordà",
  "Palamós",
  "Platja d'Aro",
];

const POPULARITY_PRIORITY = new Map(
  PRIORITY_LOCATIONS.map((name, index) => [normalizeText(name), index])
);
const DEFAULT_POPULARITY_RANK = POPULARITY_PRIORITY.size + 100;

/**
 * Expandeix sinònims per fer cerques més intel·ligents
 * Ex: "hospital" també cerca "H."
 */
const expandSearchTerms = (text) => {
  let normalized = normalizeText(text);

  // Reemplaça paraules completes per les seves abreviatures
  // Ordre important: del més específic al més general
  normalized = normalized
    .replace(/hospital comarcal/g, "h. com.")
    .replace(/hospital universitari/g, "h. u.")
    .replace(/hospital general/g, "h. gen.")
    .replace(/hospital/g, "h.")
    .replace(/comarcal/g, "com.")
    .replace(/universitari/g, "u.")
    .replace(/general/g, "gen.")
    .replace(/sant /g, "st. ")
    .replace(/santa /g, "sta. ");

  return [normalized];
};

/**
 * Classe principal per gestionar suggeriments de localitzacions
 */
class LocationSuggestionsService {
  constructor() {
    this.originSuggestions = this.loadSuggestions(
      STORAGE_KEYS.ORIGIN_SUGGESTIONS
    );
    this.destinationSuggestions = this.loadSuggestions(
      STORAGE_KEYS.DESTINATION_SUGGESTIONS
    );
    this.destinationLookup = this.createDestinationLookup();
    this.destinationSuggestions = this.destinationSuggestions
      .map((value) => this.destinationLookup.get(normalizeText(value)) || null)
      .filter(Boolean);
    this.saveSuggestions(
      STORAGE_KEYS.DESTINATION_SUGGESTIONS,
      this.destinationSuggestions
    );

    // Variables per gestionar el desplegable personalitzat
    this.currentDropdown = null;
    this.currentInput = null;
    this.selectedIndex = -1;
    this.inputDebounceTimer = null; // Timer per debounce
    this.scrollAnimationFrame = null;
    this.visibilityTimeout = null;

    this.handleWindowScroll = () => {
      if (!this.currentDropdown || !this.currentInput) return;
      this.scheduleDropdownReposition();
    };

    this.handleWindowResize = () => {
      if (!this.currentDropdown || !this.currentInput) return;
      this.scheduleDropdownReposition();
      this.scheduleDropdownVisibilityCheck();
    };

    this.handleViewportShift = () => {
      if (!this.currentDropdown || !this.currentInput) return;
      this.scheduleDropdownReposition();
      this.scheduleDropdownVisibilityCheck();
    };
  }

  /**
   * Crea un mapa per validar i obtenir la forma canònica dels centres de destí
   */
  createDestinationLookup() {
    const lookup = new Map();
    PUBLIC_HEALTH_CENTERS.forEach((center) => {
      lookup.set(normalizeText(center), center);
    });
    return lookup;
  }

  /**
   * Carrega suggeriments des de localStorage
   */
  loadSuggestions(key) {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      log.warn(`Error carregant suggeriments per ${key}:`, error);
      return [];
    }
  }

  /**
   * Guarda suggeriments a localStorage
   */
  saveSuggestions(key, suggestions) {
    try {
      localStorage.setItem(key, JSON.stringify(suggestions));
    } catch (error) {
      log.warn(`Error guardant suggeriments per ${key}:`, error);
    }
  }

  /**
   * Afegeix un nou valor als suggeriments
   */
  addSuggestion(type, value) {
    if (!value || value.trim().length < 2) return;

    let trimmedValue = value.trim();
    let suggestions;

    if (type === "origin") {
      suggestions = this.originSuggestions;
    } else if (type === "destination") {
      suggestions = this.destinationSuggestions;
      const canonicalDestination = this.destinationLookup.get(
        normalizeText(trimmedValue)
      );
      if (!canonicalDestination) {
        log.warn(
          `Destí no reconegut. Només s'accepten centres sanitaris públics. Valor rebut: "${trimmedValue}"`
        );
        return;
      }
      trimmedValue = canonicalDestination;
    } else {
      return;
    }

    // Elimina si ja existeix (per moure'l al principi)
    const existingIndex = suggestions.indexOf(trimmedValue);
    if (existingIndex > -1) {
      suggestions.splice(existingIndex, 1);
    }

    // Afegeix al principi
    suggestions.unshift(trimmedValue);

    // Limita el nombre de suggeriments
    if (suggestions.length > MAX_SUGGESTIONS) {
      suggestions = suggestions.slice(0, MAX_SUGGESTIONS);
    }

    // Actualitza i guarda
    if (type === "origin") {
      this.originSuggestions = suggestions;
      this.saveSuggestions(STORAGE_KEYS.ORIGIN_SUGGESTIONS, suggestions);
    } else {
      this.destinationSuggestions = suggestions;
      this.saveSuggestions(STORAGE_KEYS.DESTINATION_SUGGESTIONS, suggestions);
    }

    // Actualitza els datalists
    this.updateDatalistForType(type);
  }

  /**
   * Obté suggeriments per un tipus
   */
  getSuggestions(type) {
    if (type === "origin") {
      return [...this.originSuggestions];
    } else if (type === "destination") {
      return [...this.destinationSuggestions];
    }
    return [];
  }

  /**
   * Actualitza els elements datalist amb els suggeriments actuals
   */
  updateDatalists() {
    this.updateDatalistForType("origin");
    this.updateDatalistForType("destination");
  }

  /**
   * Retorna la llista base segons el tipus
   * Per origen: prioritzar municipis (població)
   */
  getBaseLocations(type) {
    return type === "origin"
      ? MUNICIPALITIES // Només municipis per defecte a origen
      : PUBLIC_HEALTH_CENTERS;
  }

  calculateMatchScore(
    normalizedValue,
    locationWords,
    expandedSearchTerms,
    originalValue,
    searchMeta
  ) {
    const popularityRank =
      POPULARITY_PRIORITY.get(normalizedValue) ?? DEFAULT_POPULARITY_RANK;
    const articlePenalty = /,\s*(el|la|els|les|l')$/i.test(originalValue)
      ? 1
      : 0;
    const hyphenPenalty = originalValue.includes("-") ? 1 : 0;
    const multiWordPenalty = locationWords.length > 1 ? 0 : 1;

    if (!expandedSearchTerms.length) {
      return {
        category: 0,
        popularityRank,
        articlePenalty,
        hyphenPenalty,
        multiWordPenalty,
        prefixLengthPenalty: 0,
      };
    }

    const evaluateWord = (word) => {
      if (!word) {
        return 3;
      }

      if (normalizedValue.startsWith(word)) {
        return 0;
      }

      if (locationWords.some((locWord) => locWord.startsWith(word))) {
        return 1;
      }

      return 2;
    };

    const bestScore = expandedSearchTerms.reduce(
      (currentBest, variantWords) => {
        let variantCategory = -Infinity;

        variantWords.forEach((word) => {
          variantCategory = Math.max(variantCategory, evaluateWord(word));
        });

        const targetLength =
          variantWords[0]?.length ?? searchMeta.primaryLength ?? 0;
        const firstWord = locationWords[0] ?? "";
        const prefixLengthPenalty =
          targetLength > 0 && firstWord.startsWith(variantWords[0] ?? "")
            ? Math.abs(firstWord.length - targetLength)
            : firstWord.length;

        const candidate = {
          category: Number.isFinite(variantCategory) ? variantCategory : 3,
          popularityRank,
          articlePenalty,
          hyphenPenalty,
          multiWordPenalty,
          prefixLengthPenalty,
        };

        if (!currentBest) {
          return candidate;
        }

        return this.compareScores(candidate, currentBest) < 0
          ? candidate
          : currentBest;
      },
      null
    );

    return (
      bestScore || {
        category: 3,
        popularityRank,
        articlePenalty,
        hyphenPenalty,
        multiWordPenalty,
        prefixLengthPenalty: locationWords[0]?.length ?? 99,
      }
    );
  }

  compareScores(a, b) {
    if (a.category !== b.category) {
      return a.category - b.category;
    }

    if (a.popularityRank !== b.popularityRank) {
      return a.popularityRank - b.popularityRank;
    }

    if (a.articlePenalty !== b.articlePenalty) {
      return a.articlePenalty - b.articlePenalty;
    }

    if (a.hyphenPenalty !== b.hyphenPenalty) {
      return a.hyphenPenalty - b.hyphenPenalty;
    }

    if (a.multiWordPenalty !== b.multiWordPenalty) {
      return a.multiWordPenalty - b.multiWordPenalty;
    }

    if (a.prefixLengthPenalty !== b.prefixLengthPenalty) {
      return a.prefixLengthPenalty - b.prefixLengthPenalty;
    }

    return 0;
  }

  /**
   * Construeix les opcions que es mostraran al datalist
   * Requereix mínim 3 caràcters per mostrar suggeriments (excepte recents)
   */
  getSuggestionsForInput(type, searchTerm = "", options = {}) {
    // Si no hi ha mínim caràcters i no es demanen només recents, no mostrar res
    if (
      !options.onlyRecent &&
      searchTerm.trim().length < MIN_CHARS_FOR_SUGGESTIONS
    ) {
      return [];
    }

    // Expandeix els termes de cerca (ex: "hospital" → també cerca "h.")
    const expandedSearchTerms = expandSearchTerms(searchTerm)
      .map((term) =>
        term
          .split(/\s+/)
          .map((word) => word.trim())
          .filter(Boolean)
      )
      .filter((words) => words.length > 0);

    const normalizedSearch = normalizeText(searchTerm.trim());
    const normalizedSearchWords = normalizedSearch
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(Boolean);

    const searchMeta = {
      primaryLength:
        normalizedSearchWords[0]?.length ?? normalizedSearch.length ?? 0,
    };

    // ORIGEN: només municipis
    // DESTÍ: tots els llocs (municipis + centres mèdics)
    const baseLocations =
      type === "origin"
        ? MUNICIPALITIES // Només municipis a origen
        : this.getBaseLocations(type); // Tot a destí

    const optionsArray = [];
    const seen = new Set();

    const pushOption = (option, index) => {
      if (!option) return;
      const trimmed = option.trim();
      if (!trimmed) return;

      const normalizedValue = normalizeText(trimmed);

      // Comprova si TOTS els termes de cerca apareixen al valor (cerca per paraules)
      const locationWords = normalizedValue
        .split(/[\s,\/'.-]+/)
        .map((word) => word.trim())
        .filter(Boolean);

      const allVariantsMatch =
        expandedSearchTerms.length === 0 ||
        expandedSearchTerms.some((variantWords) =>
          variantWords.every((word) => normalizedValue.includes(word))
        );

      if (!allVariantsMatch) return;

      if (seen.has(normalizedValue)) return;

      seen.add(normalizedValue);
      const score = this.calculateMatchScore(
        normalizedValue,
        locationWords,
        expandedSearchTerms,
        trimmed,
        searchMeta
      );
      optionsArray.push({ value: trimmed, score, index });
    };

    // NOMÉS afegeix les opcions oficials de la base de dades
    // NO afegim storedSuggestions (valors que l'usuari ha escrit)
    baseLocations.forEach((location, index) => pushOption(location, index));

    return optionsArray
      .sort((a, b) => {
        const scoreComparison = this.compareScores(a.score, b.score);
        if (scoreComparison !== 0) {
          return scoreComparison;
        }
        return a.index - b.index;
      })
      .slice(0, MAX_DATALIST_OPTIONS)
      .map((entry) => entry.value);
  }

  /**
   * Retorna només els suggeriments recents guardats per un tipus
   */
  getRecentSuggestions(type, limit = RECENT_SUGGESTIONS_LIMIT) {
    const source =
      type === "origin" ? this.originSuggestions : this.destinationSuggestions;
    return source.slice(0, limit);
  }

  /**
   * Actualitza el datalist segons el tipus i el valor actual
   */
  updateDatalistForType(type, currentValue = "", options = {}) {
    const datalistId =
      type === "origin" ? "origin-datalist" : "destination-datalist";
    let suggestions;

    if (options.onlyRecent) {
      suggestions = this.getRecentSuggestions(type);
      if (!suggestions.length) {
        suggestions = this.getBaseLocations(type).slice(
          0,
          MAX_DATALIST_OPTIONS
        );
      }
    } else {
      suggestions = this.getSuggestionsForInput(type, currentValue);
    }

    this.updateDatalist(datalistId, suggestions);
  }

  /**
   * Actualitza un datalist específic
   */
  updateDatalist(datalistId, suggestions) {
    const datalist = document.getElementById(datalistId);
    if (!datalist) return;

    // Neteja opcions existents
    datalist.innerHTML = "";

    // Afegeix noves opcions
    suggestions.forEach((suggestion) => {
      const option = document.createElement("option");
      option.value = suggestion;
      datalist.appendChild(option);
    });
  }

  /**
   * Determina el z-index del desplegable perquè quedi sota la topbar i les pestanyes.
   */
  calculateDropdownZIndex() {
    // Retornar un z-index fix que estigui per sota de la topbar (1100) i els tabs (900)
    // Utilitzem 850 per assegurar-nos que sempre estigui per sota
    return 850;
  }

  getFixedHeadersOffset() {
    const selectors = [".top-bar", ".tabs-container"];
    let maxBottom = 0;

    selectors.forEach((selector) => {
      const element = document.querySelector(selector);
      if (!element) return;

      const rect = element.getBoundingClientRect();
      if (rect.bottom > maxBottom) {
        maxBottom = rect.bottom;
      }
    });

    return Math.max(maxBottom, 0);
  }

  /**
   * Crea un desplegable personalitzat visual
   */
  createCustomDropdown(input, suggestions) {
    if (!suggestions || suggestions.length === 0) {
      this.closeDropdown();
      return;
    }

    // Si ja existeix el desplegable pel mateix input, només actualitza les opcions
    if (this.currentDropdown && this.currentInput === input) {
      this.updateDropdownOptions(this.currentDropdown, suggestions, input);
      return;
    }

    // Elimina desplegable anterior si existeix
    this.closeDropdown();

    // Crea el contenidor del desplegable
    const dropdown = document.createElement("div");
    dropdown.className = "custom-location-dropdown";
    dropdown.id = "custom-location-dropdown";

    // Posiciona el desplegable ENGANXAT just a sota del input (sense espai)
    const inputRect = input.getBoundingClientRect();
    dropdown.style.position = "fixed";
    dropdown.style.top = `${inputRect.bottom}px`;
    dropdown.style.left = `${inputRect.left}px`;
    dropdown.style.width = `${inputRect.width}px`;
    dropdown.style.zIndex = String(this.calculateDropdownZIndex());

    // Afegeix classe al input per canviar el border-radius
    input.classList.add("has-dropdown-open");

    // Afegeix les opcions
    this.updateDropdownOptions(dropdown, suggestions, input);

    // Afegeix al document
    document.body.appendChild(dropdown);
    this.currentDropdown = dropdown;
    this.currentInput = input;
    this.selectedIndex = -1;

    this.ensureDropdownVisibility(dropdown, input);
    this.scheduleDropdownVisibilityCheck();

    // Tanca el desplegable si es clica fora
    setTimeout(() => {
      document.addEventListener("click", this.handleOutsideClick.bind(this));
    }, 0);
  }

  /**
   * Actualitza les opcions del desplegable sense recrear-lo (evita parpadeig)
   */
  updateDropdownOptions(dropdown, suggestions, input) {
    // Neteja opcions existents
    dropdown.innerHTML = "";

    // Afegeix les noves opcions
    suggestions.forEach((suggestion, index) => {
      const option = document.createElement("div");
      option.className = "custom-dropdown-option";
      option.textContent = suggestion;
      option.dataset.index = index;

      // Click en opció
      option.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        input.value = suggestion;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        this.closeDropdown();
      });

      // Hover en opció
      option.addEventListener("mouseenter", () => {
        this.selectedIndex = index;
        this.updateSelectedOption(dropdown);
      });

      dropdown.appendChild(option);
    });
  }

  scheduleDropdownReposition() {
    if (this.scrollAnimationFrame) return;

    this.scrollAnimationFrame = window.requestAnimationFrame(() => {
      this.scrollAnimationFrame = null;

      if (!this.currentDropdown || !this.currentInput) return;
      if (!document.body.contains(this.currentInput)) {
        this.closeDropdown();
        return;
      }

      this.repositionDropdown();
    });
  }

  scheduleDropdownVisibilityCheck() {
    if (this.visibilityTimeout) {
      clearTimeout(this.visibilityTimeout);
    }

    this.visibilityTimeout = setTimeout(() => {
      this.visibilityTimeout = null;
      if (!this.currentDropdown || !this.currentInput) return;
      this.ensureDropdownVisibility(this.currentDropdown, this.currentInput);
    }, 160);
  }

  repositionDropdown() {
    if (!this.currentDropdown || !this.currentInput) return;

    const inputRect = this.currentInput.getBoundingClientRect();
    this.currentDropdown.style.top = `${inputRect.bottom}px`;
    this.currentDropdown.style.left = `${inputRect.left}px`;
    this.currentDropdown.style.width = `${inputRect.width}px`;
  }

  ensureDropdownVisibility(dropdown, input) {
    const viewport = window.visualViewport;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const viewportTop = viewport?.offsetTop ?? 0;
    const headerOffset = this.getFixedHeadersOffset();

    const dropdownRect = dropdown.getBoundingClientRect();
    const dropdownTopViewport = dropdownRect.top + viewportTop;
    const dropdownBottomViewport = dropdownTopViewport + dropdownRect.height;

    const SAFE_TOP_MARGIN = 12;
    const SAFE_BOTTOM_MARGIN = 16;

    const scrollingElement =
      document.scrollingElement || document.documentElement || document.body;
    const currentScroll = window.scrollY;
    const maxScroll = Math.max(
      (scrollingElement?.scrollHeight ?? document.body.scrollHeight) -
        viewportHeight,
      0
    );

    const topOverlap = headerOffset + SAFE_TOP_MARGIN - dropdownTopViewport;
    if (topOverlap > 0) {
      const newScroll = Math.max(currentScroll - topOverlap, 0);
      if (newScroll !== currentScroll) {
        window.scrollTo({
          top: newScroll,
          behavior: "smooth",
        });
      }
      return;
    }

    const viewportBottom = viewportTop + viewportHeight;
    const bottomOverlap =
      dropdownBottomViewport - (viewportBottom - SAFE_BOTTOM_MARGIN);
    if (bottomOverlap > 0) {
      const newScroll = Math.min(currentScroll + bottomOverlap, maxScroll);
      if (newScroll !== currentScroll) {
        window.scrollTo({
          top: newScroll,
          behavior: "smooth",
        });
      }
      return;
    }

    const inputRect = input.getBoundingClientRect();
    const inputTopViewport = inputRect.top + viewportTop;
    const desiredInputTop = headerOffset + SAFE_TOP_MARGIN;

    if (inputTopViewport < desiredInputTop) {
      const diff = desiredInputTop - inputTopViewport;
      const newScroll = Math.max(currentScroll - diff, 0);
      if (newScroll !== currentScroll) {
        window.scrollTo({
          top: newScroll,
          behavior: "smooth",
        });
      }
    }
  }

  /**
   * Actualitza l'opció seleccionada visualment
   */
  updateSelectedOption(dropdown) {
    if (!dropdown) return;

    const options = dropdown.querySelectorAll(".custom-dropdown-option");
    options.forEach((option, index) => {
      if (index === this.selectedIndex) {
        option.classList.add("selected");
      } else {
        option.classList.remove("selected");
      }
    });
  }

  /**
   * Tanca el desplegable personalitzat
   */
  closeDropdown() {
    if (this.currentDropdown) {
      this.currentDropdown.remove();
      this.currentDropdown = null;

      if (this.scrollAnimationFrame) {
        cancelAnimationFrame(this.scrollAnimationFrame);
        this.scrollAnimationFrame = null;
      }

      if (this.visibilityTimeout) {
        clearTimeout(this.visibilityTimeout);
        this.visibilityTimeout = null;
      }

      // Elimina la classe del input per restaurar el border-radius normal
      if (this.currentInput) {
        this.currentInput.classList.remove("has-dropdown-open");
      }

      this.currentInput = null;
      this.selectedIndex = -1;
      document.removeEventListener("click", this.handleOutsideClick.bind(this));
    }
  }

  /**
   * Gestiona clics fora del desplegable
   */
  handleOutsideClick(event) {
    if (
      this.currentDropdown &&
      !this.currentDropdown.contains(event.target) &&
      event.target !== this.currentInput
    ) {
      this.closeDropdown();
    }
  }

  /**
   * Gestiona la navegació amb teclat
   */
  handleKeyboardNavigation(event, dropdown) {
    if (!dropdown) return;

    const options = dropdown.querySelectorAll(".custom-dropdown-option");

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        this.selectedIndex = Math.min(
          this.selectedIndex + 1,
          options.length - 1
        );
        this.updateSelectedOption(dropdown);
        options[this.selectedIndex]?.scrollIntoView({ block: "nearest" });
        break;

      case "ArrowUp":
        event.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
        this.updateSelectedOption(dropdown);
        if (this.selectedIndex >= 0) {
          options[this.selectedIndex]?.scrollIntoView({ block: "nearest" });
        }
        break;

      case "Enter":
        event.preventDefault();
        if (this.selectedIndex >= 0 && options[this.selectedIndex]) {
          const selectedValue = options[this.selectedIndex].textContent;
          this.currentInput.value = selectedValue;
          this.currentInput.dispatchEvent(
            new Event("change", { bubbles: true })
          );
          this.closeDropdown();
        }
        break;

      case "Escape":
        event.preventDefault();
        this.closeDropdown();
        break;
    }
  }

  /**
   * Inicialitza els datalists i listeners
   */
  init() {
    log.info("Inicialitzant servei de suggeriments de localitzacions");

    // Crea els datalists si no existeixen
    this.createDatalists();

    // Actualitza amb dades existents
    this.updateDatalists();

    // Afegeix listeners als inputs
    this.addInputListeners();
  }

  /**
   * Crea els elements datalist al DOM
   */
  createDatalists() {
    // JA NO UTILITZEM DATALIST NATIU - Sistema personalitzat
    // Els inputs només necessiten autocomplete="off"
    const originInputs = document.querySelectorAll(".origin");
    const destinationInputs = document.querySelectorAll(".destination");

    originInputs.forEach((input) => {
      input.setAttribute("autocomplete", "off");
      input.removeAttribute("list");
    });

    destinationInputs.forEach((input) => {
      input.setAttribute("autocomplete", "off");
      input.removeAttribute("list");
    });
  }

  /**
   * Mostra tots els suggeriments quan es fa focus
   * Per origen: mostra només municipis (població) fins que escrigui 3+ caràcters
   */
  addInputListeners() {
    // Mostra suggeriments recents quan es fa focus
    document.addEventListener(
      "focus",
      (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;

        if (
          target.classList.contains("origin") ||
          target.classList.contains("destination")
        ) {
          // NO mostrar res al focus inicial - només quan escrigui 3+ caràcters
          this.closeDropdown();
        }
      },
      true
    );

    // Actualitza suggeriments mentre s'escriu (amb debounce per evitar parpadeig)
    document.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;

      let type = null;
      if (target.classList.contains("origin")) {
        type = "origin";
      } else if (target.classList.contains("destination")) {
        type = "destination";
      }

      if (type) {
        const value = target.value.trim();

        // Esborra el timer anterior
        if (this.inputDebounceTimer) {
          clearTimeout(this.inputDebounceTimer);
        }

        // Només mostra desplegable si té 3+ caràcters
        if (value.length >= MIN_CHARS_FOR_SUGGESTIONS) {
          // Debounce de 300ms per evitar parpadeig
          this.inputDebounceTimer = setTimeout(() => {
            const suggestions = this.getSuggestionsForInput(type, value);
            this.createCustomDropdown(target, suggestions);
          }, 300);
        } else {
          this.closeDropdown();
        }
      }
    });

    // Navegació amb teclat
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;

      if (
        (target.classList.contains("origin") ||
          target.classList.contains("destination")) &&
        this.currentDropdown
      ) {
        this.handleKeyboardNavigation(event, this.currentDropdown);
      }
    });

    // NO guardem els valors que l'usuari escriu
    // Només mostrem la llista oficial de municipis i centres sanitaris

    // Manté el desplegable alineat mentre es fa scroll o canvia la mida
    window.addEventListener("scroll", this.handleWindowScroll, true);
    window.addEventListener("resize", this.handleWindowResize);

    if (window.visualViewport) {
      window.visualViewport.addEventListener(
        "resize",
        this.handleViewportShift
      );
      window.visualViewport.addEventListener(
        "scroll",
        this.handleViewportShift
      );
    }
  }
}

// Instància única
const locationSuggestionsService = new LocationSuggestionsService();

// Exporta mètodes públics
export const initLocationSuggestions = () => locationSuggestionsService.init();
export const addLocationSuggestion = (type, value) =>
  locationSuggestionsService.addSuggestion(type, value);
export const getLocationSuggestions = (type) =>
  locationSuggestionsService.getSuggestions(type);
