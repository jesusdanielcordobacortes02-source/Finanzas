# Finanzas Privadas

Aplicación web de finanzas personales desplegada en https://finanzas-personales-banco9.vercel.app/.

## Funciones activas
- Acceso por correo y contraseña (Supabase Auth).
- Ingresos y gastos, categorías, fecha, historial y exportación CSV.
- Activos, inversiones, dinero por cobrar y deudas; actualización de saldos.
- Flujo neto = ingresos - gastos.
- Patrimonio neto estimado = activos + inversiones + cuentas por cobrar - deudas. **No sumar el flujo neto automáticamente** o se puede duplicar el dinero.
- Sin metas de ahorro.

## Seguridad y arquitectura
- Las tablas `fin_personal_entries` y `fin_personal_positions` están en Supabase y tienen RLS: el acceso se condiciona al `auth.uid()` del usuario.
- Solo se usa una clave pública de Supabase en el cliente. Nunca publicar credenciales privadas.
- Proyecto de código separado de Afluva y Flubank. **La infraestructura Supabase se comparte con Flubank**, aunque las tablas y permisos de Finanzas están separados; falta una instancia completamente independiente.
- No se sincronizan ni se copian datos de Afluva o Flubank.
- La versión anterior usaba localStorage, y esos datos no se migran automáticamente.

## Antes de ingresar información importante
1. Confirmar en Supabase Auth la URL del sitio y la URL de redirección `https://finanzas-personales-banco9.vercel.app/**`.
2. Probar registro, confirmación de email, recuperación y entrada/salida con usuarios reales.
3. Ejecutar pruebas automáticas de RLS con dos cuentas distintas y probar acceso denegado.
4. Configurar copias de seguridad, recuperación y política de tratamiento de datos.
5. Conciliar ingresos, gastos, activos y deudas con registros ficticios y luego con tus propios totales.

## Código reutilizado de Afluva
Los utilitarios `src/lib/financeUtils.js`, `src/lib/financialDecisions.js`, `src/lib/financialImportDates.js`, `src/lib/financialFileParser.js` fueron copiados del repositorio Afluva para reutilización futura, pero no están integrados aún con la interfaz actual.
