# Arrokó — resumen de continuidad

Actualizado: 15 de septiembre de 2026.

## Estado verificado

- `https://arroko.creastilo-ai-xperience.com/crm` responde en producción.
- El CRM carga primero fixtures visuales y después cambia a Supabase cuando existe una sesión autorizada.
- La sesión actual confirmó acceso RLS a 8 clientes de la organización Arrokó.
- Cliente 360 carga visitas, consentimientos, perfiles ArroKids, partidas, puntos y relaciones de memoria con procedencia.
- El check-in público, las recompensas seguras y la bóveda cifrada de contactos ya están desplegados.
- Las tablas operativas conservan referencia HMAC y últimos cuatro dígitos; el contacto recuperable vive únicamente en la bóveda cifrada y cada acceso debe auditarse.
- Los registros anteriores a la bóveda se completarán en un check-in posterior; no se debe inferir ni reconstruir su contacto.
- Soft Restaurant, Meta y Google todavía no alimentan datos reales al CRM.
- Los tickets de las visitas actuales siguen pendientes de conciliación; por eso ticket promedio y consumo total aparecen en `$0`.
- La base contiene registros QA de la bóveda que deben separarse o eliminarse mediante un procedimiento explícito y auditable antes de entregar el entorno al cliente.

## Decisiones conocidas

1. Supabase permanece como backend de la demo funcional: Auth, Postgres, RLS, Edge Functions y trazabilidad.
2. Arrokó y ArroKids son superficies distintas; Samurai Kid pertenece sólo a ArroKids y Roko es la identidad principal de Arrokó.
3. La información de menores se limita a alias y rango de edad; campañas y contacto se realizan exclusivamente con el adulto responsable.
4. Los hechos del grafo deben distinguirse de inferencias y conservar origen, fecha, confianza y alcance de consentimiento.
5. Los canjes deben ser idempotentes y gobernados por catálogo: postres, premios de mesa y coleccionables Dummy 13.
6. El conector de Soft Restaurant debe ser de solo lectura respecto al POS y escribir únicamente mediante el contrato de ingesta de Arrokó.

## Riesgos activos

- No existe todavía una regla acordada para unir una visita NFC/QR con un ticket de Soft Restaurant.
- La versión, topología, acceso SQL y disponibilidad de identificadores del POS real siguen pendientes de confirmación con Arrokó o su proveedor.
- El historial remoto de migraciones Supabase no está reconciliado con el repositorio; no se debe usar `db push` global.
- Parte del CRM continúa mostrando fixtures en módulos sin fuente real, por lo que cada pantalla debe etiquetar claramente su procedencia.
- Hay registros sintéticos de QA mezclados en el tenant demo y no deben confundirse con clientes reales.

## Siguiente paso recomendado

Cerrar un **piloto de conciliación de tickets** antes de ampliar campañas o reportes:

1. Obtener un respaldo o exportación anonimizada de 20 a 50 tickets de una versión real de Soft Restaurant.
2. Confirmar qué dato puede capturarse en ambos lados: teléfono/referencia de cliente, folio, mesa, mesero, sucursal y hora.
3. Probar, en este orden, coincidencia determinista por referencia; folio informado en check-in; y mesa más ventana temporal como fallback revisable.
4. Registrar cada vínculo con método, confianza, evidencia y estado `proposed`, `confirmed` o `rejected`.
5. Mostrar en Cliente 360 el ticket conciliado y recalcular frecuencia, ticket promedio, consumo acumulado y segmentos.
6. Separar los registros QA antes de cualquier demostración con datos del cliente.

Hasta contar con la muestra real del POS, el desarrollo puede preparar importación CSV y revisión manual, pero no debe asumir nombres de tablas o claves definitivas para las versiones 8, 9, 10 y 11.
