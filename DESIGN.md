---
name: Arrokó Recompensas
description: Una experiencia de lealtad servida por Roko, el anfitrión onigiri de Arrokó.
colors:
  arroko-coral: "#F15B43"
  arroko-coral-deep: "#C83F30"
  nori-teal: "#0B4F56"
  nori-teal-deep: "#07383D"
  rice-warm: "#F4EBDD"
  rice-white: "#FFFDF8"
  ink: "#173B3D"
  muted-teal: "#6E8C8B"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(3rem, 10vw, 6rem)"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Nunito Sans, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.55
  label:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
rounded:
  control: "12px"
  surface: "16px"
  character: "28px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "20px"
  lg: "32px"
  xl: "56px"
components:
  button-primary:
    backgroundColor: "{colors.arroko-coral}"
    textColor: "{colors.rice-white}"
    rounded: "{rounded.control}"
    padding: "14px 22px"
  card:
    backgroundColor: "{colors.rice-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "20px"
---

# Design System: Arrokó Recompensas

<!--
THESIS: La caja de Arrokó cobra vida; rechazamos el casino negro-neón típico de una ruleta promocional.
OWN-WORLD: Grandes planos coral y teal, arroz cálido, tipografía condensada de empaque, recortes de nori y Roko como anfitrión funcional.
STORY: El visitante descubre su antojo, gira, entiende el premio y deja sus datos sabiendo cómo se usarán.
FIRST VIEWPORT: Roko ocupa el lado visual dominante; la ruleta/acción vive al alcance del pulgar con la promesa y condiciones visibles.
FORM: Experiencia móvil de empaque desplegable; dirección fijada por los activos y packaging reales de Arrokó, sin semilla aleatoria.
-->

## Overview

**Creative North Star: "La Caja que Cobra Vida"**

La experiencia toma su gramática del empaque de Arrokó: bloques grandes, mensajes directos, contraste de coral con nori teal y una superficie cálida que recuerda arroz y papel. Roko no es decoración flotante; presenta el reto, señala la acción, explica el resultado y acompaña el siguiente paso.

El sistema es energético sin parecer casino, infantil o aplicación genérica de restaurante. La interfaz pública puede ser expresiva; dashboards y canje reducen la expresividad para privilegiar operación y lectura.

**Key Characteristics:**

- Planos de color sólidos y composición asimétrica.
- Roko aparece sólo cuando guía una acción o estado.
- Copy breve, cálido y explícito sobre premios y consentimiento.
- Fotografía gastronómica únicamente cuando sea autorizada y verificable.

## Colors

Coral lleva la energía promocional; teal representa nori, operación y confianza; los tonos arroz conservan legibilidad y apetito.

### Primary

- **Coral de la Caja** (`#F15B43`): acciones primarias, premios y momentos de celebración.
- **Nori Teal** (`#0B4F56`): navegación, texto fuerte y superficies operativas.

### Secondary

- **Arroz Cálido** (`#F4EBDD`): fondo público y contraste amable.
- **Teal Profundo** (`#07383D`): fondos de dashboard y estados de foco sobre coral.

### Neutral

- **Blanco Arroz** (`#FFFDF8`): campos y tarjetas de lectura.
- **Tinta Oriental** (`#173B3D`): texto principal.
- **Teal Apagado** (`#6E8C8B`): texto secundario sólo sobre superficies claras.

**The Ingredient Rule.** Cada color tiene función: coral invita, teal orienta y arroz deja respirar. No se agregan acentos arbitrarios por categoría.

## Typography

**Display Font:** Barlow Condensed, con Arial Narrow como respaldo.
**Body Font:** Nunito Sans, con Segoe UI como respaldo.

**Character:** titulares compactos y contundentes como la rotulación del empaque; cuerpo redondeado y conversacional para interacción móvil.

### Hierarchy

- **Display** (800, `clamp(3rem, 10vw, 6rem)`, 0.92): una sola promesa por vista.
- **Headline** (800, `clamp(2rem, 6vw, 3.5rem)`, 1): resultados y nombres de premio.
- **Title** (700, `1.25rem`, 1.15): pasos y bloques operativos.
- **Body** (500, `1rem`, 1.55): instrucciones y explicación; máximo 68 caracteres por línea.
- **Label** (700, `0.8rem`, `0.08em`): estados breves, nunca párrafos en mayúsculas.

## Layout

El flujo público es móvil primero. En 390–767 px usa una sola columna, CTA entre 48 y 56 px de alto y contenido esencial dentro del primer recorrido de pulgar. Desde 768 px, Roko y la acción forman una composición 5/7 asimétrica. Dashboards usan rail lateral o navegación superior compacta y densidad informativa moderada.

La escala espacial es 6, 12, 20, 32 y 56 px. Se reserva más espacio antes de un cambio de etapa que dentro de los controles de la misma etapa.

## Elevation & Depth

La profundidad proviene de planos superpuestos del empaque, recortes y sombras oscuras con desplazamiento. No hay halos neón ni cristal desenfocado como decoración.

### Shadow Vocabulary

- **Plano elevado** (`0 14px 32px rgba(7, 56, 61, 0.18)`): panel principal sobre fondo arroz.
- **Acción presionable** (`0 8px 0 #9F3328`): botones coral; el estado activo reduce el desplazamiento.

## Shapes

Tarjetas y campos usan radios de 12–16 px; el avatar y la ruleta permiten curvas mayores porque son objetos, no contenedores genéricos. Las bandas verticales y recortes rectos evocan el nori centrado de Roko. No se usan píldoras para botones largos.

## Components

### Buttons

- **Shape:** rectángulo compacto de 12 px, no píldora.
- **Primary:** coral, texto blanco, altura mínima 48 px y sombra con desplazamiento.
- **Hover / Focus:** teal profundo para foco visible; hover eleva 2 px y activo regresa al plano.
- **Secondary:** fondo arroz y borde teal de 1 px.

### Cards / Containers

- **Corner Style:** 16 px.
- **Background:** blanco arroz o teal profundo según modo.
- **Shadow Strategy:** un solo plano elevado, sin borde adicional bajo la misma sombra.
- **Internal Padding:** 20 px móvil y 32 px escritorio.

### Inputs / Fields

- **Style:** blanco arroz, texto tinta, borde teal apagado, radio de 12 px y altura mínima de 48 px.
- **Focus:** anillo teal de 3 px con separación de 2 px.
- **Error / Disabled:** texto explica problema y recuperación; nunca sólo color.

### Navigation

Identidad Arrokó a la izquierda y menú móvil con superficie sólida. La navegación pública sólo contiene experiencia, canje y extensiones para comensales. Resultados y conversaciones viven en una cabecera operativa independiente bajo `/internal`, detrás de autenticación y con `noindex`.

### Charola de recompensas

La ruleta se interpreta como una charola física de Arrokó: laca teal, aro coral, marcas de arroz, puntero formado por palillos y Roko en el mecanismo central. El resultado se decide antes del movimiento y la animación aterriza en el centro exacto del segmento. La desaceleración dura 4.8 segundos; con `prefers-reduced-motion` se reduce a una transición breve de 350 ms. El estado también se anuncia en texto vivo, nunca sólo mediante movimiento.

### Roko

El avatar aparece en bienvenida, recomendación, resultado, estados vacíos y recuperación de error. La banda de nori siempre está centrada; jamás se recorta de forma que parezca una pieza pegada a un costado.

### ArroKids

ArroKids es una ruta pública propia, no un modal. Extiende el empaque Arrokó hacia un campamento de misiones: teal nocturno como escenario, coral para avanzar, arroz para elegir y personajes 3D a escala protagonista. Samurai Kid guía la acción; Nori reacciona y da pistas. La experiencia ofrece juego o exploración de antojo, evita el chat abierto y termina en una zona para adultos antes de cualquier pedido, dato o recompensa.

## Do's and Don'ts

### Do:

- **Do** hacer que premio, vigencia y siguiente paso sean visibles juntos.
- **Do** usar Roko para señalar acciones y explicar estados.
- **Do** separar consentimiento operativo de consentimiento comercial.
- **Do** respetar `prefers-reduced-motion` en ruleta, confeti y avatar.

### Don't:

- **Don't** conservar nombres, contactos, premios o referencias visuales de IKU.
- **Don't** usar negro, rojo y brillos de casino como mundo dominante.
- **Don't** ocultar el registro después de prometer que no existe.
- **Don't** mostrar recomendaciones generadas si el catálogo no respondió.
