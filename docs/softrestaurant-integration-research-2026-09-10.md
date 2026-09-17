# Arroko CRM — investigación de integración con Soft Restaurant

Fecha: 2026-09-10

## Decisión recomendada

Construir el CRM como una capa de inteligencia separada. Soft Restaurant continúa siendo el sistema de registro de ventas, cuentas, productos e inventario; el CRM de Arroko recibe copias normalizadas para clientes, insumos, operación, reportería y decisiones de pauta.

No escribir directamente en la base SQL de Soft Restaurant. Para lectura y sincronización, elegir la ruta en este orden:

1. **Integración oficial National Soft / NSDeveloper**.
2. **WRestaurantAPI como puente de terceros**, solo después de validar contrato, seguridad y cobertura de endpoints.
3. **Bridge SQL de solo lectura**, como contingencia cuando las APIs no entreguen un dato indispensable. Factor BI (proveedor externo de BI para Soft Restaurant) publica una herramienta open source con este mismo enfoque para copiar tablas a MySQL en AWS — https://factorbi.github.io/ — candidata a revisar como referencia de implementación antes de construir el bridge propio, no como dependencia.
4. **Herramienta de sincronización de Factor BI**, si validamos que su alcance cubre lo que necesitamos y aceptamos depender de un tercero adicional — ver `soft-restaurant-tablas-factorbi.md`.

La primera versión debe ser `read-first`: sincronizar datos y generar decisiones. El envío de pedidos o modificaciones al POS se habilita después, por una API soportada y con aprobación humana.

## Lo que está confirmado

### Ruta oficial de National Soft

- Existe un servicio REST/JSON para información de menú.
- Requiere una llave de aplicación enviada en el header `AuthorizedApp`.
- Las llaves se solicitan a National Soft; la documentación pública remite al DevPortal.
- El Help Center muestra un flujo NSDeveloper con alta de aplicación, permisos de servicios operativos, llaves, empresas vinculadas, catálogo de productos y alta de orden de servicio rápido.
- Delivery Hub permite que aplicaciones integradoras sincronicen menú y descarguen pedidos hacia Soft Restaurant.
- La guía ERP/PMS describe que Soft Restaurant puede enviar ventas en JSON a un servicio receptor del integrador.
- Soft Restaurant Analytics ofrece reportes web, pero su sitio público no confirma una API de extracción para construir un CRM externo.

Fuentes oficiales:

- https://api.softrestaurant.com.mx/
- https://help.softrestaurant.com/
- https://softrestaurant.com/integraciones/
- https://softrestaurant.com/manuales?download=200%3Aope-ana-sr11-guia-para-el-modulo-de-conexion-de-erp-y-pms
- https://softrestaurant.com/recursos/manuales?download=190%3Ades-mnl-sr11-delivery-hub-v-1-1-20082023

### Topología local

Las versiones de escritorio concentran la información en un servidor de la sucursal y usan Microsoft SQL Server. Esto hace viable un conector local, pero el esquema interno no debe convertirse en contrato de integración porque puede cambiar con actualizaciones.

Fuente oficial: https://softrestaurant.com/manuales?download=193%3Ades-mnl-sr11-manual-de-usuario-soft-restaurant-11-v1-0

### Ruta de terceros: WRestaurantAPI

WRestaurantAPI declara una capa REST instalada en el servidor Windows donde corre Soft Restaurant. El worker consulta el SQL Server local y expone productos, clientes, ventas, pedidos, cuentas y otros datos normalizados. Publica SDK y planes desde MXN 699 mensuales para un punto de venta.

Puede acelerar el piloto, pero antes de seleccionarlo hay que validar:

- relación contractual o autorización con National Soft;
- endpoints exactos para la versión de Arroko;
- cifrado y método del túnel remoto;
- rotación de API keys;
- acceso del proveedor a información de clientes y ventas;
- retención de logs y ubicación de datos;
- SLA, respaldo y procedimiento de desinstalación;
- tratamiento de actualizaciones de Soft Restaurant.

Fuentes del proveedor:

- https://wrestaurantapi.com/
- https://docs.wrestaurantapi.com/bienvenido
- https://docs.wrestaurantapi.com/limites

## Información que debemos pedir a Arroko

1. Versión exacta: Soft Restaurant 10, 11, 12 o Cloud.
2. Tipo de licencia y número de control, sin copiarlo a documentos ni chats.
3. ¿Servidor local Windows o Soft Restaurant Cloud?
4. ¿Cuántas cajas, estaciones y sucursales comparten la base?
5. ¿Tienen activos Delivery Hub, Analytics, e-Delivery o enlace ERP/PMS?
6. ¿Quién es su distribuidor o ejecutivo de National Soft?
7. ¿Qué datos necesitan en tiempo real y cuáles aceptan con corte diario?
8. ¿Registran clientes identificados o la mayoría de las ventas son anónimas?
9. ¿Inventario y recetas están capturados y actualizados en Soft Restaurant?
10. ¿Las compras, proveedores y mermas se registran ahí o en hojas externas?
11. ¿Qué plataformas usan para pauta: Meta Ads, Google Ads, TikTok u otras?
12. ¿Existe consentimiento para usar teléfono/correo del cliente con fines comerciales?

Si utilizan Soft Restaurant 10, primero hay que confirmar actualización: National Soft anunció su descontinuación desde el 1 de enero de 2026.

Fuente: https://softrestaurant.com/blog-restaurantero/soft-restaurant-10-fin-actualizacion

## Arquitectura propuesta

```text
Soft Restaurant POS / Cloud
        │
        ├── A. NSDeveloper / Delivery Hub / ERP-PMS JSON
        ├── B. WRestaurantAPI worker
        └── C. SQL read-only bridge (contingencia)
        │
        ▼
Arroko Integration Gateway
  - credenciales server-side
  - idempotencia
  - cursor incremental
  - bitácora y reintentos
  - raw payload cifrado con retención limitada
        │
        ▼
Supabase / Arroko CRM
  - modelo normalizado
  - RLS por organización y sucursal
  - vistas de métricas
  - auditoría
        │
        ├── Clientes
        ├── Insumos
        ├── Operación
        ├── Reportería
        └── Campañas y decisiones
```

## Los cinco módulos

### 1. Clientes

- ficha unificada y consentimiento;
- visitas, pedidos, recencia, frecuencia y ticket promedio;
- preferencias observadas, sin inferir datos sensibles;
- segmentos y seguimiento.

### 2. Insumos

- ingredientes, unidades, costos y proveedores;
- recetas y consumo teórico;
- existencias, compras, mermas y variaciones;
- alertas de faltantes y costo fuera de rango.

### 3. Operación

- ventas, órdenes, canales, horarios y productos;
- tiempos de servicio si el origen los proporciona;
- incidencias, tareas, responsables y aprobaciones;
- disponibilidad de menú y anomalías.

### 4. Reportería

- venta neta, ticket, mezcla de producto y margen estimado;
- comparativos por día, horario, canal y sucursal;
- costo teórico contra consumo real;
- tableros ejecutivos y explicaciones de variaciones.

### 5. Campañas y pauta

- campañas, conjuntos, anuncios, gasto y métricas de plataforma;
- relación entre promociones, periodos y ventas del POS;
- ROAS, CAC y costo por pedido cuando exista atribución válida;
- recomendaciones de presupuesto como propuestas aprobables;
- nunca mover presupuesto automáticamente en la primera fase.

Meta Ads y Google Ads se conectan directamente a sus APIs; Soft Restaurant aporta el resultado comercial, no el gasto publicitario.

## Roadmap técnico

### Fase 0 — Descubrimiento, 3–5 días

- inventario de versión, licencias y módulos;
- llamada con distribuidor/National Soft;
- catálogo de campos disponibles — cubierto en `soft-restaurant-tablas-factorbi.md` (273 tablas de un proveedor externo de BI, 69 marcadas como relevantes, con columnas de `INFORMATION_SCHEMA.COLUMNS` para cada una; no sustituye confirmar la versión/topología reales de Arroko);
- matriz dato → fuente → frecuencia → propietario.

### Fase 1 — Prueba de integración, 1–2 semanas

- obtener acceso sandbox o instalar worker en ambiente controlado;
- extraer productos, una jornada de ventas y existencias;
- demostrar sincronización incremental e idempotente;
- reconciliar totales contra un corte real.

### Fase 2 — CRM base, 2–3 semanas

- Clientes, Operación y Reportería;
- autenticación, roles y sucursal;
- dashboard con ventas, ticket y producto.

### Fase 3 — Insumos, 2–3 semanas

- recetas, costos, movimientos y mermas;
- alertas y variaciones.

### Fase 4 — Campañas, 2–3 semanas

- Meta/Google Ads;
- atribución y decisiones de pauta;
- flujo propuesta → aprobación → ejecución → resultado.

## Prueba de aceptación del conector

- Totales diarios coinciden con Soft Restaurant.
- Ningún pedido se duplica al reintentar.
- Una corrección/cancelación se refleja sin crear otra venta.
- Productos e ingredientes conservan unidades y sucursal.
- La sincronización se recupera después de perder internet.
- Las credenciales nunca llegan al navegador.
- Toda recomendación de pauta conserva evidencia, autor y aprobación.

## Gate inmediato

No construir el conector definitivo hasta conocer la versión exacta y recibir respuesta de National Soft sobre NSDeveloper, permisos y costos. Sí se puede construir desde ahora la webapp contra un contrato `SoftRestaurantAdapter` y datos de prueba, para que la UI no dependa del proveedor elegido.
