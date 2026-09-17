# Arroko Control — check-in, ticket y memoria de cliente

Estado: **demo funcional desplegado** el 14 de septiembre de 2026 en el proyecto Supabase compartido de Creastilo.

Acceso interno: la cuenta técnica de Creastilo indicada por el propietario quedó registrada como `owner` de `arroko-demo`. La validación bajo el rol `authenticated` confirmó acceso RLS a 1 cliente, 1 visita, 1 partida y 2 relaciones del grafo, sin ampliar acceso anónimo.

## Recorrido activo

1. Un NFC o QR abre `https://arroko.creastilo-ai-xperience.com/checkin?point=centro-nfc`.
2. El adulto registra nombre, teléfono, tamaño del grupo y consentimientos separados.
3. La Edge Function normaliza el teléfono, genera una referencia HMAC y descarta el valor crudo antes de escribir en SQL.
4. Supabase crea o actualiza cliente, hogar, visita, tres eventos de consentimiento y un hecho del grafo.
5. ArroKids conserva sólo alias y rango de edad del menor.
6. Al terminar `Construye tu rollo`, el score se convierte en puntos mediante una regla versionable e idempotente.
7. Cuando Soft Restaurant entregue el ticket, `arroko_visit_orders` lo vincula a la visita y `arroko_customer_360` recalcula ticket promedio y valor acumulado.

## Componentes desplegados

- 18 tablas originales de Arroko Control.
- 13 tablas de visita, hogar, ArroKids, recompensas, consentimiento y grafo.
- Vista interna `arroko_customer_360`.
- RPC privadas `arroko_public_checkin` y `arroko_public_game_complete`, ejecutables sólo por `service_role`.
- Edge Function `arroko-public-experience` con CORS restringido al subdominio Arroko y localhost de desarrollo.
- Organización, sucursal, punto NFC y tres juegos de demostración: `roll-builder`, `sushi-memory` y `ninja-sushi`.

## Verificación realizada

- Las seis migraciones Arroko compilaron en PostgreSQL 17 aislado.
- Las pruebas originales del conector y RLS siguen pasando.
- La prueba de recorrido confirmó ticket promedio de `$580`, 94 puntos y protección contra doble envío.
- Prueba real sintética en el subdominio: 1 visita, 1 hogar, 3 consentimientos, 1 partida, 19 puntos y 2 hechos con procedencia.
- `deno check` y el build de Vite pasaron.
- El asesor de seguridad mostró las RPC públicas Arroko cerradas a `anon` y `authenticated` después del hardening.
- El CRM local conserva fixtures cuando no hay sesión y cambia a Supabase sólo con autenticación y RLS.
- La vista Cliente 360 ya presenta visitas, ticket conciliado o pendiente, perfiles infantiles seudónimos, partidas, puntos, consentimientos y memoria verificable.

## Privacidad acordada por diseño

- No se almacena teléfono crudo en las tablas Arroko; sólo últimos cuatro dígitos y referencia HMAC.
- El menor no tiene teléfono, correo, domicilio ni fecha completa de nacimiento.
- Las campañas contactan exclusivamente al adulto responsable y sólo con consentimiento vigente.
- El grafo distingue `fact` de `inference` y exige procedencia, fecha, confianza y alcance de consentimiento.

## Pendientes para activar el CRM con una cuenta real

1. Iniciar sesión desde Arroko Control con la cuenta técnica ya autorizada y validar visualmente el expediente Cliente 360.
2. Incorporar como segundo `owner` a una cuenta individual del responsable de Arroko cuando el cliente la defina.
3. Definir la regla de conciliación Soft Restaurant: referencia de cliente, código de ticket o correlación mesa + ventana de tiempo.
4. Agregar catálogo y flujo aprobado de canjes: postres, premios de mesa y Dummy 13.
5. Sustituir la organización demo por infraestructura propiedad de Arroko cuando el cliente dé luz verde.

## Nota operativa

El historial remoto de migraciones Supabase no coincide con el repositorio. El despliegue se hizo con `db query --linked --file` sobre los seis archivos Arroko, no con `db push`, para evitar ejecutar decenas de migraciones ajenas. Antes de una siguiente migración global se debe reconciliar ese historial en una tarea separada y con respaldo.
