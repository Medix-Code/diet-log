# Regles de Treball per diet-log (MisDietas)

## ⚙️ Incorpora les Regles Globals

Aquestes regles són addicionals a les globals (`language-and-security.md`), però especifiques per al projecte **diet-log**. Prioritza sempre la seguretat i privacitat.

## 🗣️ Llenguatge i Estil (Català per comunicacions, anglès per codi)

- Escriu explicacions i missatges en **català** per a feedback i documentació.
- Mantén **especificacions complexes** en **anglès** per codi, variables i comentaris.
- Sigues **concís i tècnic**: explica breument després de mostrar codi.

## 🔒 Seguretat i Dades Sensibles

- **No obris, edits o referenciïs** fitxers que contenen:
  - Claus API (Google Analytics, etc.).
  - Dades personals d'usuaris (noms, matrícules reals).
  - Fitxers d'emmagatzemament: `service-worker.js` o IndexedDB relacionats amb dades reals.
- Quan inicis proves, fes servir **dades fictícies** només (ex. noms genèrics com " Conduc1" per conductor).
- Abans d'executar `npm install`, confirma per evitar sobreescriptures accidentals en `node_modules`.
- Quan facis canvis a codi, evita qualsevol execució d'scripts que no siguin de develop (ex. no executis `inject-version.js` en proves).
- **No executis usant `rm` o comandes destructives** sense confirmar explícita.

## 📁 Estructura i Bones Pràctiques

- Mantén l'estructura MVC: `src/models/`, `src/services/`, `src/ui/`, `src/utils/`, `src/db/`.
- Renomena funcions/clases amb noms anglès-consistent (ex. evita `dieta` com class; fes servir `Diet`).
- Quan editis CSS/SCSS (`main.scss`), comprova que el tema dark/light no es trenqui.
- Per `index.html`: No canviïs estructures d'id/modal sense provar PWA (service worker).
- Quan actualitzis dependències:
  - Alinea versions: Actualitza `tesseract.js` a v6 i `pdf-lib` a última (1.23+).
  - Afegeix SRI als scripts CDN a `index.html`.
- Afegix tests: Crea `tests/` amb Jest/Vitest per validacions i serveis clau (ex. `validation.js`, `dietService.js`).
- Sempre que toquis `validation.js`, prova casos extrems (inputs buits, caràcters especials, longituds màximes).

## 🔍 Validacions i Errors Comuns a Evitar

- **Règles de validació** (de `validation.js`): 9 dígits per número de servei, 28/35 per noms/origens, etc. No canviïs sense actualitzar dependencies dependents.
- Quan facis OCR: Prova escaneigs en diverses condicions (lừa baixa), però no processis fitxers reals d'usuaris.
- En `diagnostService.js`: Evita modificacions a `needsAnotherSave` sense locks (race conditions).
- Per signatures i PDFs: Comprova que `pdf-lib` generi PDFs vàlids; evita crashes en formats d'hora HH:mm.
- **Errors freqüents**:
  - Versions desfasades (tesseract v5 vs. package.json v6) – alinea abans de commit.
  - Alt-texts buits: Quan afegis imatges, usa alt descriptiu per accessibilitat.
  - Sine FP: Cookie-consent sempre defensiu (denied per defecte).
  - No injectis HTML directament sense sanititzar (XSS risk).

## ⚡ Rendiment i Manteniment

- Optimiza càrregues: Carrega Tesseract.js lazy quan s'usi OCR.
- Minifica CSS/JS: Confirma `main.min.css` s'actualitzi automàticament.
- En IndexedDB: Prova recovery d'errors (quota, corrupció).
- Per PWA: Testa offline, actualitzacions de cache.

## 📊 Proves i Depuració

- Abans de qualsevol canvi, executa `validateForPdf()` manualment per assegurar validacions.
- Sis if tests fallen, fixa primer abans de prosseguir.
- Usa `console.log` en mode debug, però elimina abans de commit.
- Quan facis commits, els missatges siguin en anglès (ex. "Fix validation for service numbers").

## 🚫 Prohibit Sense Permís

- No canviïs GA ID o configuracions de consentiment.
- No edits `privacy-policy.html` sense aprovació legal.
- No publiques canvis que afectin producció sense QA.

_(Creat segons anàlisi del projecte. Actualitza segons evolucions)_
