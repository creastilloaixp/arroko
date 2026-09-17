# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Comensales de Arrokó en Culiacán que quieren descubrir qué pedir, obtener una recompensa y volver a visitar el restaurante.
- Personal de sucursal que valida premios sin tener que interpretar campañas o revisar hojas manuales.
- Dirección y marketing de Arrokó, que necesitan relacionar campañas, registros, canjes, visitas y consumo real.

## Product Purpose

Convertir la ruleta promocional de IKU en una experiencia propia de Arrokó: Roko entiende el antojo, ayuda a elegir platillo y maridaje, entrega una recompensa trazable y conecta el canje con el CRM. El éxito no es un giro; es una visita medible, un canje válido y una próxima acción comercial con consentimiento.

## Positioning

La experiencia une juego, sommelier gastronómico y CRM en un solo circuito: campaña → recomendación → premio → registro → QR → visita → consumo → recompra. La ruleta es el inicio visible; la atribución del ticket y el aprendizaje de preferencias son el mecanismo diferenciador.

## Operating Context

- Uso principalmente móvil desde QR de mesa, redes sociales, WhatsApp y campañas.
- Canje presencial por personal autorizado y consulta posterior desde dashboards administrativos.
- La experiencia del comensal y la operación interna son superficies distintas: lo público vive en `/`; resultados y conversaciones sólo en `/internal` con autenticación y sin enlaces públicos.
- Supabase aloja autenticación y datos de la experiencia; Soft Restaurant seguirá siendo la fuente de ventas y tickets mediante Arroko Bridge.
- El menú y la disponibilidad deben provenir de una fuente aprobada por Arrokó.

## Capabilities and Constraints

- Conservar ruleta ponderada, registro, QR de canje, dashboard, WhatsApp, sommelier por texto/voz y experiencia infantil.
- El frontend nunca contiene llaves privadas de Gemini, Evolution, n8n, Stripe o Supabase service-role.
- El asistente sólo recomienda productos registrados y debe advertir que ingredientes y preparación se confirman con el restaurante ante alergias.
- Los mocktails actuales son conceptos de demostración hasta recibir aprobación de la barra.
- Pagos live, automatización de pauta y escritura en Soft Restaurant permanecen desactivados hasta aprobación explícita.
- La integración Soft Restaurant 8–11 sigue pendiente de validación contra la instalación real de Arrokó.

## Brand Commitments

- Marca: **Arrokó Cocina Oriental y Sushi**.
- Anfitrión: **Roko**, avatar onigiri con banda de nori vertical centrada que envuelve frente, base y espalda; nunca piezas laterales.
- Experiencia infantil: **ArroKids**, guiada por Samurai Kid y Nori, una mascota koi-dragón. Ningún flujo infantil solicita datos personales ni permite ordenar sin intervención de un adulto.
- Voz: español mexicano cálido, directo y con energía culichi ligera, sin forzar modismos.
- Promesa: **“Tu antojo, bien acompañado.”**
- Paleta confirmada: coral `#F15B43`, teal oscuro `#0B4F56` y blanco cálido `#F4EBDD`.

## Evidence on Hand

- Avatar aprobado como base: `public/brand/roko-avatar-source.png`.
- Configuración de persona y catálogo de demostración: `data/arroko-config-preview.json`.
- Código local que alimenta el despliegue IKU: ruleta, canje, dashboards, WhatsApp, voz y sommelier.
- Esquema y adaptador preliminar de Soft Restaurant documentados en el repositorio Creastilo.
- Faltan autorización formal de marca/fotografías, menú oficial estructurado, carta real de bebidas, reglas finales de premio y política de consentimiento aprobada por Arrokó.

## Product Principles

1. La experiencia debe producir una visita o decisión útil, no sólo entretenimiento.
2. Una recomendación significa un platillo y un maridaje explicados con precisión.
3. Toda recompensa debe ser verificable, de un solo uso y atribuible.
4. La identidad de Arrokó debe sentirse desde el primer segundo, no como una capa de colores sobre IKU.
5. Privacidad, consentimiento y aprobación humana forman parte del producto.
6. Un cliente nunca debe encontrar controles, lenguaje ni navegación del personal interno.
7. ArroKids convierte la espera en exploración; el juego termina en conversación familiar, no en captura de datos del menor.

## Accessibility & Inclusion

El flujo debe funcionar con teclado, lector de pantalla y `prefers-reduced-motion`, mantener contraste WCAG 2.2 AA y no depender exclusivamente de color, sonido o animación para comunicar resultados.
