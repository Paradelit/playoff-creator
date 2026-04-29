# Product

## Register

product

## Users

Pick&Coach está diseñado para entrenadores de baloncesto que cubren tres arquetipos, y el producto debe sostenerse para los tres sin privilegiar a ninguno:

- **Entrenador formativo de club** (minibasket, infantil, cadete). A menudo voluntario o con dedicación parcial. Trabaja por las tardes-noches después de su empleo principal. Planifica desde el móvil. Le importa la pedagogía: pilares, normas, asistencia, notas, informes a familias. Es la base de usuarios más numerosa.
- **Coordinador de cantera multi-equipo**. Lleva varios grupos en un club o academia. Necesita ver calendarios cruzados, compartir materiales entre equipos, mantener un cuaderno estructurado por grupo. Trabaja a escala "team of teams".
- **Entrenador senior orientado al rendimiento**. Senior o junior competitivo. Más peso en scouting, análisis y playbooks tácticos. Menos demanda de herramientas formativas (sextos, pilares).

Contextos reales de uso: el banquillo, el coche antes de entrar al pabellón, el sofá a las 23:00 preparando la sesión del día siguiente, el chat con un padre, la reunión con dirección deportiva. La app vive en momentos cortos y de alta presión, no en sesiones largas de escritorio.

## Product Purpose

Pick&Coach es un workspace de baloncesto con un copiloto IA llamado **Pick** que actúa como **entrenador asistente 24/7**. No es un panel con un chatbot pegado: es un compañero presente que conoce la cuenta del entrenador (equipos, jugadores, cuaderno, calendario, scouting) y puede ejecutar las mismas tareas que el usuario haría a mano en la UI.

El testimonio que define éxito: *"Pick es mi entrenador asistente."* Implica que:

- Pick recuerda contexto entre conversaciones y entre pantallas. No empieza de cero cada vez.
- Pick puede actuar, no solo sugerir. Genera entrenamientos, completa cuadros de playoffs, redacta informes, marca asistencia, propone alineaciones, y lo hace dentro de la UI rica del producto, no como JSON pelado.
- La IA conversacional tiene paridad funcional con la UI: cualquier acción accesible por menús lo es también por chat.
- El conocimiento público (centro de ayuda) es la única fuente de verdad de Pick. Si Pick lo afirma, está publicado.

El producto compite contra la sensación de soledad del entrenador con su libreta y sus PDFs. Gana cuando el entrenador deja de pensar "tengo que hacer X yo" y empieza a pensar "le pido a Pick que haga X".

## Brand Personality

**Tres palabras**: *court-side, kinetic, companion* (banquillo, no escritorio; movimiento, no estatismo; compañero, no asistente).

**Voz y tono**:

- Directa, sin paja. *"Tú entrenas. Pick trabaja."* Frases cortas, verbos activos.
- Tutea siempre. Pick habla al entrenador como un colega que sabe lo suyo, no como un servicio corporativo.
- Optimismo competente. Pick reconoce la dificultad del trabajo del entrenador y celebra que se haya resuelto, sin caer en cheerleader-talk.
- Vocabulario nativo del baloncesto. *Bloqueo directo, cuadro, sextos, pilares, scouting, transición, calentamiento, rotación.* Nunca terminología genérica de productividad cuando existe la del deporte.

**Energía visual / emocional** (sports-broadcast):

- *Cancha en los píxeles*. La cultura del baloncesto vive en la estructura, el ritmo y el movimiento, no en stickers de balones sobre un shell genérico.
- Calidez energética del naranja del club, lucidez eléctrica del cyan/azul. Brillo controlado, no neón gratuito.
- Movimiento siempre con propósito narrativo. La animación cuenta una jugada (typing → thinking → response, scrolltelling de PDF a cuadro, scan de scouting), no decora.
- Confianza sin solemnidad. El producto se toma en serio el trabajo del entrenador sin tomarse a sí mismo demasiado en serio.

## Anti-references

Pick&Coach NO debe parecerse a:

- **Plantillas SaaS genéricas**. Hero-metric con número grande sobre label pequeño, grids de tarjetas idénticas con icono + título + texto, gradient text decorativo, glassmorphism por defecto, side-stripes coloreadas como acento. Si un observador puede decir *"esto es una plantilla SaaS"* en dos segundos, está fallando.
- **Software de entrenadores de los 2010**. FastModel, MyFastBreak, herramientas oficiales de federaciones. Formularios densos, tipografías de 2008, tablas beige, UI orientada a PDF. El género entero asume que el entrenador es un funcionario tolerando la herramienta. Pick&Coach asume lo contrario.
- **Apps de fitness / social de consumidor**. Strava, Nike Training Club, Whoop. Streaks gamificados, leaderboards, feeds sociales, gráficos neón. El entrenador no es un usuario auto-cuantificado: es un profesional gestionando a otros. La UI no debe pedirle dopamina, debe darle apalancamiento.
- **Shells de chat IA pelados**. ChatGPT.com, Claude.ai en su forma más mínima. Un prompt en blanco no es la propuesta: Pick vive dentro de un workspace estructurado de baloncesto. La conversación es una capa sobre el producto, no el producto.

## Design Principles

1. **Pick es un compañero, no una pestaña.** El copiloto debe sentirse presente en cada superficie, no escondido tras un botón. Pantallas que ignoran a Pick son pantallas a las que les falta una pierna. Cuando una acción es posible vía menú, considerar siempre su ruta equivalente vía Pick.

2. **Lenguaje del baloncesto antes que el de software.** Brackets como brackets, no como árboles binarios. Cuaderno como cuaderno, no como CMS. Asistencia como pasar lista, no como log de eventos. Cuando exista una metáfora deportiva nativa, gana sobre la metáfora genérica de productividad.

3. **La ayuda pública es el cerebro de Pick.** Cualquier afirmación del agente IA debe ser trazable a un artículo público del centro de ayuda. No hay dos fuentes de conocimiento. Diseñar nuevas funciones implica diseñar también su entrada en ayuda, y por tanto en la base de conocimiento del agente.

4. **Aguanta los tres arquetipos sin elegir uno.** Cada pantalla debe ser legible para el voluntario de minibasket, el coordinador de cantera y el entrenador senior. Cuando una decisión privilegia a un arquetipo, hacerlo de forma consciente y declarada, nunca por accidente.

5. **Movimiento que cuenta una jugada.** La animación es lenguaje, no decoración. Cada animación del producto debe poder contarse como una frase: *"Pick está pensando", "el PDF se convierte en cuadro", "el bloque se ha encajado en el calendario"*. Si la animación no narra nada, sobra.

## Accessibility & Inclusion

Compromiso operativo: **a11y funcional sin auditoría WCAG formal**.

- **Funcional**: navegación por teclado completa en flujos críticos (login, calendario, bracket, cuaderno). Lectores de pantalla pueden recorrer la app: landmarks semánticos, `aria-label` en botones-icono, `aria-hidden` en decoración. Ya hay base, preservarla.
- **Movimiento**: `prefers-reduced-motion: reduce` apaga animaciones de landing y micro-escenas (ya implementado en `src/index.css`). Cualquier animación nueva debe respetar el media query desde el primer commit.
- **Contraste**: AA de Tailwind como referencia (no auditado). El sistema de color ya tiene escalas con tinte que cumplen AA en sus pares principales. Evitar texto sobre gradientes de bajo contraste y combinaciones naranja-claro / blanco que rompen AA.
- **Idioma**: español como idioma principal (`<html lang="es">`). Producto y ayuda redactados en español. La i18n no es requisito por ahora.
- **Dependencias**: `axe-core` está en devDependencies. Usarlo como prueba de humo en pantallas nuevas, no como gate de release.
