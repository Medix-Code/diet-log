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
    // Seguretat XSS: usar createElement en lloc de innerHTML
    noDotacioText.textContent = "No hay dotaciones, guarde abans: ";
    const saveIcon = document.createElement("img");
    saveIcon.src = "assets/icons/save_green.svg";
    saveIcon.alt = "Guardar";
    saveIcon.className = "save-icon";
    noDotacioText.appendChild(saveIcon);
  }
}

export function initMouseSwipeToDeleteDotacio(dotacioItem, dotacioId) {
  if (!dotacioItem) return;

  const deleteReveal = dotacioItem.querySelector(".delete-reveal");

  const handleDelete = async () => {
    await dotacionService.handleDeleteById(dotacioId);
    dotacioItem.remove();
    updateDotacioListVisibility();
  };

  if (typeof window === "undefined" || !("PointerEvent" in window)) {
    deleteReveal?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleDelete().catch((error) => {
        log.error("Error eliminant dotació des de fallback:", error);
      });
    });
    return;
  }

  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let isDragging = false;

  const cleanupPointerState = (withTransition = true) => {
    if (
      pointerId !== null &&
      typeof dotacioItem.releasePointerCapture === "function"
    ) {
      const hasCapture =
        typeof dotacioItem.hasPointerCapture === "function" &&
        dotacioItem.hasPointerCapture(pointerId);
      if (hasCapture) {
        try {
          dotacioItem.releasePointerCapture(pointerId);
        } catch (error) {
          log.debug("Error alliberant pointer capture:", error);
        }
      }
    }
    pointerId = null;
    dotacioItem.classList.remove("swiping");
    dotacioItem.style.transition = withTransition
      ? "transform 0.3s ease, opacity 0.3s ease"
      : "";
  };

  const resetVisualState = () => {
    dotacioItem.style.transform = "translateX(0)";
    dotacioItem.style.opacity = "1";
    setTimeout(() => {
      dotacioItem.style.transition = "";
    }, 300);
  };

  const onPointerDown = (event) => {
    if (event.pointerType === "touch") return; // Gestos tàctils gestionats a initSwipeToDeleteDotacio
    if (event.button !== 0) return;
    if (
      event.target.closest("button") ||
      event.target.closest(".button-container")
    ) {
      return;
    }

    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    isDragging = false;
    dotacioItem.style.transition = "";
    if (typeof dotacioItem.setPointerCapture === "function") {
      try {
        dotacioItem.setPointerCapture(pointerId);
      } catch (error) {
        log.debug("No s'ha pogut establir pointer capture:", error);
      }
    }
  };

  const onPointerMove = (event) => {
    if (pointerId === null || event.pointerId !== pointerId) return;

    const diffX = event.clientX - startX;
    const diffY = event.clientY - startY;

    if (!isDragging) {
      if (
        Math.abs(diffX) < 12 ||
        Math.abs(diffX) <= Math.abs(diffY) ||
        diffX >= 0
      ) {
        return;
      }
      isDragging = true;
      dotacioItem.classList.add("swiping");
    }

    if (isDragging) {
      const limitedDiff = Math.max(Math.min(diffX, 0), -120);
      dotacioItem.style.transform = `translateX(${limitedDiff}px)`;
      event.preventDefault();
    }
  };

  const onPointerUp = (event) => {
    if (pointerId === null || event.pointerId !== pointerId) return;

    const diffX = event.clientX - startX;
    const shouldDelete = isDragging && diffX <= -60;

    cleanupPointerState();

    if (shouldDelete) {
      dotacioItem.style.transform = "translateX(-100%)";
      dotacioItem.style.opacity = "0";

      setTimeout(() => {
        handleDelete().catch((error) => {
          log.error("Error eliminant dotació després del gest:", error);
          resetVisualState();
        });
      }, 250);
    } else {
      resetVisualState();
    }

    isDragging = false;
  };

  const onPointerCancel = () => {
    cleanupPointerState();
    resetVisualState();
    isDragging = false;
  };

  dotacioItem.addEventListener("pointerdown", onPointerDown);
  dotacioItem.addEventListener("pointermove", onPointerMove);
  dotacioItem.addEventListener("pointerup", onPointerUp);
  dotacioItem.addEventListener("pointercancel", onPointerCancel);
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
        dotacioItem.style.transform = `translateX(-${Math.min(diff, 120)}px)`;
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
