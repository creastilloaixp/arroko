# SoftRestaurantAdapter

Capa de mapeo pura: filas reales de Soft Restaurant (SQL Server) → los eventos
normalizados que `arroko-sync-ingest` ya acepta (`../contract.mjs`). No hace
red, no toca Deno ni Node, no habla con ninguna base de datos — es el contrato
que `softrestaurant-integration-research-2026-09-10.md` autorizó construir
"desde ahora" para que el CRM no dependa de qué transporte (NSDeveloper,
WRestaurantAPI o un bridge SQL de solo lectura) termine leyendo Soft
Restaurant. El worker que sí lea Soft Restaurant en vivo importa este módulo,
le pasa filas con esta misma forma y manda los eventos resultantes a
`arroko-sync-ingest`.

Las columnas y tipos vienen de
`docs/clients/arroko/soft-restaurant-tablas-factorbi.md` (volcado de
`INFORMATION_SCHEMA` vía Factor BI, un tercero — no un contrato confirmado con
la instalación real de Arroko).

## Mapeos

| Evento | Tablas SR | Notas |
|---|---|---|
| `product.upsert` | `productos` + `listadepreciosdetalle` | El precio no vive en `productos`; se resuelve por `idlistaprecio`. Sin lista resuelta, `price` es `null`, nunca `0`. |
| `ingredient.upsert` | `insumos` + `insumosdetalle` | `reorder_point` queda sin mapear a propósito — SR no tiene esa columna (pregunta 9 del research doc). |
| `client.upsert` | `clientes` | Ver "PII" abajo. |
| `inventory.snapshot` | `acumuladoinsumos` | La fila no trae timestamp; lo pone quien extrae (`capturedAt`). |
| `order.upsert` | `cheques` + `cheqdet` + `chequespagos` | `channel` queda `'unknown'` a propósito — SR no expone un catálogo de canal confirmado en `cheques`. |

`operation.event` y `campaign.*` no tienen mapeo aquí: el primero depende de
qué incidencias decida exponer Arroko (cancelaciones, alertas), el segundo
viene de Meta/Google Ads, no de Soft Restaurant.

## PII — la regla no vive en el contrato, vive aquí

`arroko-sync-ingest` rechaza payloads con llaves literales como `phone` o
`email` en cualquier profundidad, pero eso es una red de seguridad por nombre
de llave, no por contenido: nada impide que un adapter descuidado mande el
mismo teléfono bajo la llave `telefono1`. Por eso `mapClient`:

- nunca reenvía `telefono*`, `email`, `rfc`, `curp` ni `direccion` crudos;
- calcula `phone_last4` y `email_masked` con helpers exportados
  (`last4Digits`, `maskEmail`);
- deja `contact_ref` en `null` salvo que se le pase un `resolveContactRef` —
  la referencia opaca a un almacén de PII aprobado todavía no existe
  (`backend-handoff-2026-09-10.md`, decisión 4 pendiente);
- deja `display_name` en `null` salvo `allowDisplayName: true` explícito —
  usar el nombre real es una decisión de producto/consentimiento, no un
  default de este adapter;
- fuerza `marketing_consent: false` — SR no tiene columna de consentimiento
  (pregunta 12 del research doc); si existe consentimiento real, tiene que
  venir de otra fuente que el worker le pase al adapter, nunca inventarse.

## Pruebas

```bash
node --test supabase/functions/arroko-sync-ingest/adapters/softRestaurantAdapter.test.mjs
```

Cada mapeo de `client.upsert` y `order.upsert` se prueba dos veces: contra el
mapeo esperado, y contra `parseEnvelope` del contrato real — si el contrato
cambia de forma incompatible, estas pruebas truenan antes que producción.

## Qué falta antes de usar esto contra datos reales

Todo lo del "Gate inmediato" de `softrestaurant-integration-research-2026-09-10.md`:
versión y topología exactas de Arroko, qué ruta de transporte (1-2-3-4),
consentimiento de marketing, y el almacén de PII para `contact_ref`. Este
adapter no depende de esas decisiones — trabaja igual con datos de prueba —
pero el worker que lo alimente con filas reales sí las necesita.
