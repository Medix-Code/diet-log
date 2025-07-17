<!-- .github/pull_request_template.md -->

## Descripción de la Actualización

_(Esta sección será rellenada automáticamente por Dependabot con los detalles de la actualización)._

---

## 🚨 Checklist de Seguridad para Dependencias

**Antes de aprobar y fusionar (hacer "Merge") esta Pull Request, es obligatorio verificar los siguientes puntos:**

- [ ] **He actualizado el hash de integridad (SRI) en `index.html`?**

  - **Motivo:** Si esta PR actualiza una librería cargada desde un CDN (`tesseract.js`, `pdf-lib`), el hash `integrity` actual dejará de ser válido y el navegador bloqueará el script.
  - **Acción:**
    1. Descargar el nuevo fichero `.js` de la librería actualizada.
    2. Calcular el nuevo hash sha384 con el comando:
       ```bash
       openssl dgst -sha384 -binary <nombre_del_fichero.js> | openssl base64 -A
       ```
    3. Copiar el hash resultante y pegarlo en el atributo `integrity="sha384-..."` correspondiente en el `index.html`.

- [ ] **He verificado que la aplicación sigue funcionando correctamente?**

  - **Acción:** Probar la aplicación en un entorno local o de desarrollo para confirmar que la nueva versión de la librería no ha introducido errores. Revisar las funcionalidades clave (generación de PDF, OCR, firmas, etc.).

- [ ] **He revisado las notas de la nueva versión (Release Notes)?**
  - **Acción:** Buscar el `CHANGELOG` de la librería para identificar posibles "breaking changes" (cambios que rompen la compatibilidad con versiones anteriores).

---

> _Esta Pull Request ha sido creada automáticamente por Dependabot para mantener las dependencias seguras y actualizadas._
