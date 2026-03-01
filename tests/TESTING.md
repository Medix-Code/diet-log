# Guía de pruebas

Este documento resume el alcance de la suite de tests del proyecto, cómo ejecutarla y qué tipo de cobertura ofrece actualmente.

## Estado actual

- Suite validada con `Vitest`
- Última ejecución verificada: `2026-03-01`
- Resultado observado: `15` archivos de test, `117` tests superados

## Objetivo de la suite

La batería de pruebas está orientada a cubrir los flujos con más impacto funcional del proyecto:

- validación de entradas y saneado básico
- guardado y recuperación de dietas
- migraciones de datos
- cifrado y descifrado
- integridad y tolerancia a errores
- OCR y gestión de cancelaciones
- papelera y restauración

## Cómo ejecutar las pruebas

Ejecución completa:

```bash
pnpm test -- --run
```

Modo interactivo durante desarrollo:

```bash
pnpm test
```

Ejecutar un archivo concreto:

```bash
pnpm vitest tests/encryption.e2e.test.js --run
```

## Áreas cubiertas

### Validación y formularios

- comprobación de entradas inválidas
- saneado de texto
- comportamiento base de servicios de formulario

Archivos relacionados:

- `tests/validation.test.js`
- `tests/formService.test.js`

### Dietas y persistencia

- creación y carga de dietas
- movimientos a papelera
- restauración y borrado definitivo

Archivos relacionados:

- `tests/dietService.test.js`
- `tests/trash.test.js`

### Migraciones

- detección de datos legacy
- validación de estructuras antes y después de migrar
- flujos de migración con reintentos y manejo de errores

Archivos relacionados:

- `tests/dataMigration.integration.test.js`
- `tests/security.migration.test.js`
- `tests/security.improvements.test.js`

### Cifrado e integridad

- cifrado y descifrado de dietas y dotaciones
- round-trip de datos
- detección de manipulación
- compatibilidad con Web Crypto API en entorno de test

Archivos relacionados:

- `tests/cryptoManager.unit.test.js`
- `tests/encryption.e2e.test.js`
- `tests/dotacion.encryption.test.js`
- `tests/dotacion.simple.test.js`
- `tests/security.failclosed.test.js`

### OCR y robustez operativa

- cancelación de procesos OCR
- gestión de errores de worker
- timeouts y limpieza de recursos

Archivos relacionados:

- `tests/cameraOcr/cancellation.test.js`
- `tests/cameraOcr/errorHandling.test.js`
- `tests/cameraOcr/workerTimeout.test.js`

## Notas de mantenimiento

- La suite mezcla pruebas unitarias, integradas y de comportamiento.
- Algunos tests registran mensajes en consola como parte esperada del flujo validado.
- El pretest ejecuta verificación de hashes antes de lanzar `Vitest`.
- Los totales de tests pueden variar con la evolución del proyecto; este documento debe actualizarse cuando cambie de forma relevante la cobertura.

## Criterio práctico

Antes de fusionar cambios con impacto funcional, conviene verificar como mínimo:

```bash
pnpm test -- --run
```

Si el cambio afecta a persistencia, migraciones, OCR o cifrado, es recomendable revisar también el archivo de test específico de esa área.
