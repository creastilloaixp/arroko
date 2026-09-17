# Arroko Control — backend handoff

Estado: implementado y verificado localmente; no aplicado en Supabase remoto.

## Qué quedó construido

- Dieciocho tablas `arroko_*` separadas del CRM general de Creastilo.
- Aislamiento por `org_id` y roles `viewer`, `sales`, `ops`, `admin`, `owner`.
- Datos de clientes sin teléfonos ni correos crudos: solo campos enmascarados y
  una referencia opaca a un almacén de PII por aprobar.
- Inventario, recetas, movimientos, pedidos, partidas, pagos e incidencias.
- Campañas, métricas diarias, atribución, propuestas y aprobación auditada.
- Vistas de venta diaria e inventario más reciente.
- RPC `arroko_dashboard_summary` para alimentar el resumen del frontend.
- RPC `arroko_decide_campaign` para aprobar o rechazar sin ejecutar pauta.
- RPC privada `arroko_ingest_event` para escrituras atómicas e idempotentes.
- Edge Function `arroko-sync-ingest` con HMAC, ventana antireplay y lotes de
  hasta 250 eventos normalizados.

## Garantías verificadas

- Las tres migraciones compilan desde cero sobre PostgreSQL 17 de Supabase.
- Un evento repetido no duplica información.
- Pedido, partidas y pagos se escriben dentro de una misma transacción SQL.
- Un miembro no puede leer datos de otra organización.
- El rol `viewer` no puede leer clientes ni eventos crudos del conector.
- Aprobar una propuesta crea un evento de auditoría.
- El contrato rechaza PII, credenciales y secretos en cualquier profundidad.
- El código de la Edge Function pasa `deno check`.

## Decisiones antes de desplegar

1. Crear o identificar la organización real de Arroko y sus usuarios.
2. Confirmar sucursales, versión y topología de Soft Restaurant.
3. Elegir NSDeveloper, ERP/PMS o puente local de solo lectura.
4. Definir dónde vive la PII y documentar consentimiento de marketing.
5. Crear `ARROKO_INGEST_SECRET` directamente como secreto de Supabase.
6. Revisar el payload real y escribir el adaptador Soft Restaurant → contrato
   normalizado.

## Orden de despliegue futuro

1. Revisar y aplicar las tres migraciones por timestamp.
2. Crear organización, membresías, sucursales y conector mediante onboarding
   administrativo; no mediante datos demo en migración.
3. Configurar el secreto HMAC sin imprimirlo ni almacenarlo en tablas.
4. Desplegar `arroko-sync-ingest`.
5. Ejecutar una conciliación de una jornada en paralelo.
6. Conectar el frontend solo cuando ventas y cierres cuadren con caja.

No desplegar con `supabase db push` o `supabase functions deploy` hasta recibir
la confirmación explícita del usuario y revisar el estado remoto.
