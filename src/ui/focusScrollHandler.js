// src/ui/focusScrollHandler.js

const formElements = document.querySelectorAll(
  'input:not([type="checkbox"]), select, textarea'
);

function handleFocus(event) {
  const element = event.target;

  // Ignorem els elements dins de modals
  if (element.closest(".modal")) {
    return;
  }

  // Esperem un instant perquè el teclat comenci a aparèixer.
  // Aquest delay és crucial per a un funcionament correcte.
  setTimeout(() => {
    // 'scrollIntoView' és la manera estàndard i més fiable de fer això.
    // 'block: "center"' intenta posar l'element al mig de la part visible de la pantalla.
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, 250); // Un delay de 250ms sol ser un bon equilibri
}

formElements.forEach((el) => {
  el.addEventListener("focus", handleFocus);
});
