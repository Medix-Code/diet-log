import { dotacionService } from "../../services/dotacion.js";
import { logger } from "../../utils/logger.js";

const log = logger.withScope("Modals:Dotacio");

function createDotacioListItem(dotacio, index) {
  const template = document.getElementById("dotacio-template");
  if (!template) {
    log.warn("No s'ha trobat el template per a dotacions.");
    return null;
  }

  const clone = template.content.cloneNode(true);
  const dotacioItem = clone.firstElementChild;

  const uniqueId =
    `${dotacio.numero}-${dotacio.conductor}-${dotacio.ajudant}`.replace(
      /\s/g,
      ""
    );
  dotacioItem.setAttribute("data-dotacio-id", uniqueId);

  const infoSpan = clone.querySelector(".dotacio-info");
  const loadBtn = clone.querySelector(".dotacio-load");

  if (infoSpan) {
    const persones = [dotacio.conductor, dotacio.ajudant]
      .filter(Boolean)
      .join(" / ");
    infoSpan.textContent = persones
      ? `${dotacio.numero} - ${persones}`
      : dotacio.numero;
  }
  if (loadBtn) {
    loadBtn.setAttribute("data-index", String(index));
  }

  return dotacioItem;
}

export function updateDotacioListVisibility() {
  const dotacioOptionsList = document.getElementById("dotacio-options");
  const noDotacioText = document.getElementById("no-dotacio-text");
  if (!dotacioOptionsList || !noDotacioText) return;

  const hasItems = dotacioOptionsList.children.length > 0;
  dotacioOptionsList.classList.toggle("hidden", !hasItems);
  noDotacioText.classList.toggle("hidden", hasItems);

  if (!hasItems) {
    noDotacioText.innerHTML = `No hay dotaciones, guarde abans: <img src="assets/icons/save_green.svg" alt="Guardar" class="save-icon" />`;
  }
}

export function initMouseSwipeToDeleteDotacio(dotacioItem, dotacioId) {
  let startX = 0;
  let currentX = 0;
  let isDragging = false;

  dotacioItem.addEventListener("mousedown", (event) => {
    if (event.target.closest("button") || event.target.closest(".button-container"))
      return;
    startX = event.clientX;
    currentX = startX;
    isDragging = false;
  });

  document.addEventListener("mousemove", (event) => {
    currentX = event.clientX;
    const diff = startX - currentX;
    if (diff > 10 && !isDragging) {
      isDragging = true;
      dotacioItem.classList.add("swiping");
    }
    if (isDragging && diff > 10) {
      dotacioItem.style.transform = `translateX(-${Math.min(diff, 80)}px)`;
      event.preventDefault();
    }
  });

  document.addEventListener("mouseup", async () => {
    if (!isDragging) return;
    isDragging = false;
    const diff = startX - currentX;

    dotacioItem.classList.remove("swiping");
    dotacioItem.style.transition = "transform 0.3s ease, opacity 0.3s ease";

    if (diff > 50) {
      dotacioItem.style.transform = "translateX(-100%)";
      dotacioItem.style.opacity = "0";

      setTimeout(async () => {
        await dotacionService.handleDeleteById(dotacioId);
        dotacioItem.remove();
        updateDotacioListVisibility();
      }, 300);
    } else {
      dotacioItem.style.transform = "translateX(0)";
      dotacioItem.style.opacity = "1";
    }

    setTimeout(() => {
      dotacioItem.style.transition = "";
      dotacioItem.style.opacity = "";
    }, 300);
  });
}

export function initSwipeToDeleteDotacio(dotacioItem, dotacioId) {
  let startX = 0;
  let currentX = 0;
  let isSwiping = false;

  dotacioItem.addEventListener(
    "touchstart",
    (event) => {
      if (event.target.closest("button")) return;
      startX = event.touches[0].clientX;
      currentX = startX;
      isSwiping = false;
      event.stopPropagation();
    },
    { passive: false }
  );

  dotacioItem.addEventListener(
    "touchmove",
    (event) => {
      currentX = event.touches[0].clientX;
      const diff = startX - currentX;
      if (diff > 10 && !isSwiping) {
        isSwiping = true;
        dotacioItem.classList.add("swiping");
      }
      if (isSwiping && diff > 10) {
        dotacioItem.style.transform = `translateX(-${Math.min(diff, 80)}px)`;
        event.preventDefault();
        event.stopPropagation();
      }
    },
    { passive: false }
  );

  dotacioItem.addEventListener("touchend", async (event) => {
    if (!isSwiping) return;
    isSwiping = false;
    const diff = startX - currentX;

    dotacioItem.classList.remove("swiping");
    dotacioItem.style.transition = "transform 0.3s ease, opacity 0.3s ease";

    if (diff > 50) {
      dotacioItem.style.transform = "translateX(-100%)";
      dotacioItem.style.opacity = "0";
      setTimeout(async () => {
        await dotacionService.handleDeleteById(dotacioId);
        dotacioItem.remove();
        updateDotacioListVisibility();
      }, 300);
    } else {
      dotacioItem.style.transform = "translateX(0)";
      dotacioItem.style.opacity = "1";
    }

    setTimeout(() => {
      dotacioItem.style.transition = "";
      dotacioItem.style.opacity = "";
    }, 300);

    event.stopPropagation();
  });
}

export function restoreDotacioItemToList(dotacio) {
  const dotacioOptionsList = document.getElementById("dotacio-options");
  if (!dotacioOptionsList) {
    dotacionService.displayDotacioOptions();
    return;
  }

  const originalIndex = dotacio.originalIndex;
  const restoredItem = createDotacioListItem(dotacio, originalIndex);
  if (!restoredItem) return;

  restoredItem.style.opacity = "0";
  restoredItem.style.transform = "translateX(-100%)";

  const sibling = dotacioOptionsList.children[originalIndex];
  if (sibling) {
    dotacioOptionsList.insertBefore(restoredItem, sibling);
  } else {
    dotacioOptionsList.appendChild(restoredItem);
  }

  requestAnimationFrame(() => {
    restoredItem.style.transition = "opacity 0.5s ease, transform 0.5s ease";
    restoredItem.style.opacity = "1";
    restoredItem.style.transform = "translateX(0)";

    const uniqueId =
      `${dotacio.numero}-${dotacio.conductor}-${dotacio.ajudant}`.replace(
        /\s/g,
        ""
      );

    initSwipeToDeleteDotacio(restoredItem, uniqueId);
    initMouseSwipeToDeleteDotacio(restoredItem, uniqueId);
  });

  updateDotacioListVisibility();
}
