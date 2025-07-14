// toast.js – Sistema de notificacions Toast amb cua, accessibilitat, animacions
// i botó «Desfés» opcional (versió neta, sense duplicats)
// -----------------------------------------------------------------------------
//  API
//    showToast(message, type = "info", duration = 3000, options = {})
//       options.undoCallback  →  Funció cridada si l'usuari prem «Desfés».
//       options.onExpire      →  Funció cridada si el toast expira sense undo (nova).
//       options.queueable     →  true (defecte). Si false, substitueix el toast viu.
//    cancelAllToasts()        →  Tanca i buida la cua.
// -----------------------------------------------------------------------------

// ───────────────────────── Configuració ─────────────────────────────────────
const CONFIG = {
  CONTAINER_ID: "toast-container",
  TOAST_CLASS: "toast",
  DEFAULT_DURATION: 3000,
  DEFAULT_TYPE: "info",
  ALLOWED_TYPES: ["info", "success", "error", "warning"],
  MAX_QUEUE_SIZE: 10,
  ANIMATION: { ENTER: "toast-enter", EXIT: "toast-exit" },
  UNDO_BTN_CLASS: "toast-undo-btn",
  DEFAULT_PRIORITY: 1,
};

// ───────────────────────── Estat Intern ─────────────────────────────────────
const state = {
  queue: [], // [{ message, type, duration, options }]
  isVisible: false,
  container: null,
  currentTimeout: null,
};

// ───────────────────────── Helpers ──────────────────────────────────────────
const sanitize = (s) =>
  s && typeof s === "string" ? s.replace(/[<>&]/g, "") : "";

function validateParams(message, type, duration) {
  if (!message || typeof message !== "string" || !message.trim()) {
    throw new Error(
      "El missatge del toast és obligatori i ha de ser una cadena no buida."
    );
  }
  if (!CONFIG.ALLOWED_TYPES.includes(type)) {
    throw new Error(
      `Tipus de toast invàlid: ${type}. Ha de ser un de: ${CONFIG.ALLOWED_TYPES.join(
        ", "
      )}`
    );
  }
  if (!Number.isInteger(duration) || duration < 0 || duration > 60000) {
    throw new Error("La durada ha d'estar entre 0 i 60000 ms.");
  }
}

function getContainer() {
  if (!state.container) {
    state.container = document.getElementById(CONFIG.CONTAINER_ID);
    if (!state.container) {
      console.error(`[Toast] Contenidor '#${CONFIG.CONTAINER_ID}' no trobat.`); // CORRECCIÓ: Log per depurar si no es veu el toast
      return null;
    }
  }
  return state.container;
}

function clearCurrentToast(el) {
  if (state.currentTimeout) {
    clearTimeout(state.currentTimeout);
    state.currentTimeout = null;
  }
  if (el) {
    el.classList.add(CONFIG.ANIMATION.EXIT);
    el.addEventListener("transitionend", () => el.remove(), { once: true });
  }
  state.isVisible = false;
  processQueue();
}

function displayToast({ message, type, duration, options }) {
  const container = getContainer();
  if (!container) return;

  const toastEl = document.createElement("div");
  toastEl.className = `${CONFIG.TOAST_CLASS} ${type}`; // Sense enter inicial
  toastEl.setAttribute("role", "alert");
  toastEl.setAttribute("aria-live", "polite");
  toastEl.setAttribute("aria-atomic", "true");
  toastEl.textContent = sanitize(message);

  let expiredWithoutUndo = true; // Flag per rastrejar si s'ha premut undo

  // Botó Desfés
  if (options?.undoCallback instanceof Function) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = CONFIG.UNDO_BTN_CLASS;
    btn.textContent = "Desfés";
    btn.setAttribute("aria-label", "Desfer l'acció");
    btn.addEventListener("click", () => {
      expiredWithoutUndo = false; // Marca que s'ha premut undo
      try {
        options.undoCallback();
      } finally {
        clearCurrentToast(toastEl);
      }
    });
    toastEl.appendChild(btn);
  }

  container.appendChild(toastEl);

  // Animació d'entrada
  requestAnimationFrame(() => {
    toastEl.classList.add(CONFIG.ANIMATION.ENTER);
  });

  state.currentTimeout = setTimeout(() => {
    if (expiredWithoutUndo && options?.onExpire instanceof Function) {
      options.onExpire(); // Executa la callback si no s'ha premut undo
    }
    clearCurrentToast(toastEl);
  }, duration);
}

function processQueue() {
  if (state.isVisible || state.queue.length === 0) return;
  state.isVisible = true;

  state.queue.sort((a, b) => b.priority - a.priority);

  displayToast(state.queue.shift());
}

// ───────────────────────── API Pública ──────────────────────────────────────
export function showToast(
  message,
  type = CONFIG.DEFAULT_TYPE,
  duration = CONFIG.DEFAULT_DURATION,
  options = {}
) {
  validateParams(message, type, duration);

  const priority = options.priority ?? CONFIG.DEFAULT_PRIORITY; // Assigna prioritat
  const toastData = { message, type, duration, priority, options };

  // «queueable» controla si entrem a la cua o substituïm el toast actual.
  const queueable = options.queueable !== false;
  if (!queueable && state.isVisible) {
    if (state.container) {
      const current = state.container.querySelector(
        `.${CONFIG.TOAST_CLASS}:not(.${CONFIG.ANIMATION.EXIT})`
      );
      if (current) current.remove();
    }
    clearCurrentToast();
  }

  // === CANVI PRINCIPAL: Com inserim a la cua ===
  if (state.queue.length >= CONFIG.MAX_QUEUE_SIZE) {
    // Si la cua és plena, eliminem el de menys prioritat, no el primer.
    state.queue.sort((a, b) => a.priority - b.priority).shift();
  }

  // Trobem on inserir el nou toast per mantenir la cua ordenada per prioritat.
  const insertIndex = state.queue.findIndex((t) => t.priority < priority);

  if (insertIndex === -1) {
    // Si tots tenen prioritat més alta o igual, l'afegim al final.
    state.queue.push(toastData);
  } else {
    // Si trobem un amb menys prioritat, l'inserim just abans.
    state.queue.splice(insertIndex, 0, toastData);
  }

  injectUndoStyles();
  processQueue(); // Aquesta funció ja agafarà el primer de la cua, que ara serà el de més prioritat.
}

export function cancelAllToasts() {
  state.queue = [];
  if (state.container) {
    const current = state.container.querySelector(`.${CONFIG.TOAST_CLASS}`);
    if (current) current.remove();
  }
  if (state.currentTimeout) clearTimeout(state.currentTimeout);
  state.currentTimeout = null;
  state.isVisible = false;
}

function injectUndoStyles() {
  const id = "toast-undo-style";
  if (document.getElementById(id)) return;

  const nonce = document.body.getAttribute("data-csp-nonce");

  const style = document.createElement("style");
  style.id = id;

  if (nonce) {
    style.setAttribute("nonce", nonce);
  }

  style.textContent = `
    .${CONFIG.UNDO_BTN_CLASS} {
      margin-left: 12px;
      background: none;
      border: none;
      padding: 0 4px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: underline;
      color: inherit;
      font-size: 0.9em;
    }
    .${CONFIG.UNDO_BTN_CLASS}:hover {
      opacity: 0.8;
    }
  `;

  document.head.appendChild(style);
}
