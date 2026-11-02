# Finanzas personales (independiente de Afluva y Flubank)

Este repositorio es un proyecto separado. Contiene una primera aplicación funcional en `index.html` para registrar ingresos, gastos y calcular ganancias netas en pesos colombianos. Permite exportar CSV, crear copias JSON y restaurarlas.

## Código reutilizado de Afluva
Los archivos `src/lib/financeUtils.js`, `src/lib/financialDecisions.js`, `src/lib/financialImportDates.js` y `src/lib/financialFileParser.js` son copias del repositorio privado `finova` (Afluva). **No están integrados todavía con la aplicación HTML**; sirven como base para la siguiente etapa de integración.

## Ejecutar
Abre `index.html` en un navegador o publica el repositorio como sitio estático.

## Límites actuales
- Los movimientos se guardan localmente en cada navegador mediante localStorage, sin sincronización, inicio de sesión, cifrado propio ni respaldo automático.
- No hay conexión a la base de datos de Afluva, y no se han copiado registros financieros reales.
- No existe todavía registro de cuentas bancarias, activos, pasivos, patrimonio o inversión; el cálculo actual es ingresos menos gastos.
- Evita usar datos personales sensibles o confiar en este prototipo como registro financiero definitivo.
- Antes de publicar como producto, se necesita autenticación, base de datos aislada con políticas de acceso por usuario, respaldo y pruebas de extremo a extremo.

Afluva y Flubank no se modificaron para esta extracción.
