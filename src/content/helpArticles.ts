/**
 * Single source of truth for editorial content.
 *
 * Consumed by:
 * - The public web (/ayuda index and /ayuda/:slug detail pages).
 * - The AI agent's knowledge base indexer (functions/scripts/indexKnowledge.ts),
 *   which embeds each article and writes it to Firestore `knowledgeBase/{id}`
 *   for use by the `search_knowledge_base` tool.
 *
 * Principle: anything in this file is BOTH publicly publishable AND consumed
 * by the agent. There is no separate "agent-only" or "draft" content.
 */

export type HelpCategory = 'app-usage' | 'competition-rules' | 'bracket-engine' | 'basketball-concepts';

export interface HelpArticle {
  /** Stable internal id (e.g. "app-create-team"). Used as Firestore doc id. */
  id: string;
  /** URL-facing slug (SEO-friendly Spanish, e.g. "como-crear-equipo"). Mounted at /ayuda/:slug. */
  slug: string;
  category: HelpCategory;
  /** Used in lists and as <title>. */
  title: string;
  /** 1-2 sentences (120-160 chars). Used in <meta description>, index cards, agent preview. */
  summary: string;
  /** Markdown. Rendered on detail page; embedded for semantic search. */
  body: string;
  /** Optional — boost in client-side search scoring. */
  tags?: string[];
  /** Optional — order within category (lower = earlier). */
  order?: number;
  /** ISO date — shown as "Última actualización: 25 abr 2026". */
  updatedAt: string;
}

export const HELP_CATEGORIES: Record<
  HelpCategory,
  {
    label: string;
    description: string;
    order: number;
  }
> = {
  'app-usage': {
    label: 'Guías de uso',
    description: 'Cómo usar Pick&Coach paso a paso',
    order: 1,
  },
  'competition-rules': {
    label: 'Reglas y formatos',
    description: 'Formatos de competición y series',
    order: 2,
  },
  'bracket-engine': {
    label: 'Motor de cuadros',
    description: 'Cómo funcionan los cuadros de playoffs',
    order: 3,
  },
  'basketball-concepts': {
    label: 'Conceptos de baloncesto',
    description: 'Fundamentos, posiciones y sistemas',
    order: 4,
  },
};

export const HELP_ARTICLES: HelpArticle[] = [
  // ─── APP USAGE ────────────────────────────────────────────────────────────

  {
    id: 'app-create-team',
    slug: 'como-crear-un-equipo',
    category: 'app-usage',
    title: 'Cómo crear un equipo',
    summary:
      'Crea tu equipo en Pick&Coach desde la sección Equipos y configura categoría, género y división. Una vez creado, añade jugadores desde la pestaña Plantilla.',
    body: `Para crear un equipo en Pick&Coach ve a la sección \`Equipos\` (icono de personas en la barra lateral) y pulsa el botón "Nuevo equipo".

Rellena los campos: nombre del club, categoría (minibasket, alevín, infantil, cadete, júnior, sénior), año de nacimiento, letra (A/B/C), género y división.

Una vez creado podrás añadir jugadores desde la pestaña \`Plantilla\` del equipo.

Cada equipo tiene su propio cuaderno, calendario de sesiones y biblioteca de entrenamientos.`,
    tags: ['equipos', 'crear', 'plantilla', 'configuracion'],
    updatedAt: '2026-04-25',
  },

  {
    id: 'app-add-players',
    slug: 'como-anadir-jugadores',
    category: 'app-usage',
    title: 'Cómo añadir jugadores a un equipo',
    summary:
      'Añade jugadores y staff técnico a tu equipo desde la pestaña Plantilla. Los jugadores aparecen en estadísticas y planilla; el staff solo en la plantilla.',
    body: `Para añadir jugadores a un equipo, entra en el detalle del equipo y ve a la pestaña \`Plantilla\` o \`Jugadores\`.

Pulsa "Añadir jugador" o "Añadir miembro".

Puedes añadir jugadores (con dorsal, posición, datos personales) y staff técnico (entrenador, asistente, delegado).

El tipo "jugador" aparece en las estadísticas de asistencia y en la planilla. El tipo "staff" aparece solo en la plantilla.`,
    tags: ['jugadores', 'plantilla', 'staff', 'equipo'],
    updatedAt: '2026-04-25',
  },

  {
    id: 'app-generate-training',
    slug: 'generar-entrenamiento-con-ia',
    category: 'app-usage',
    title: 'Cómo generar un entrenamiento con IA',
    summary:
      'Pick te genera entrenamientos personalizados por duración, categoría y objetivos tácticos. Previsualiza, ajusta con lenguaje natural y confirma para guardarlo.',
    body: `Para generar un entrenamiento con IA, abre el chat de \`Pick\` (icono de chat) y escribe algo como:

"Genera un entrenamiento de 75 minutos para mis infantiles centrado en el tiro y la defensa en zona".

El asistente te mostrará una previsualización del entrenamiento con calentamiento, bloques principales y vuelta a la calma.

Puedes pedirle ajustes: "hazlo más corto", "añade un bloque de juego 3x3", "adapta para 8 jugadores".

Cuando estés conforme, pulsa "Confirmar" para guardarlo en el equipo.

También puedes crear entrenamientos manualmente desde la sección de entrenamientos del equipo.`,
    tags: ['entrenamiento', 'ia', 'pick', 'generar'],
    updatedAt: '2026-04-25',
  },

  {
    id: 'app-calendar-import',
    slug: 'importar-calendario-excel',
    category: 'app-usage',
    title: 'Cómo importar el calendario desde Excel',
    summary:
      'Sube tu cuadrante Excel al Calendario y la IA detectará automáticamente entrenamientos y partidos. Revisa el resumen y confirma para crear todas las sesiones.',
    body: `Para importar el cuadrante de entrenamientos desde un archivo Excel, ve a la sección \`Calendario\` y pulsa el botón de importar.

Sube tu archivo Excel con el cuadrante. El asistente IA lo analizará y detectará automáticamente los horarios de entrenamientos y partidos de tus equipos.

Revisarás un resumen de lo que se va a crear y confirmarás la importación.

Los entrenamientos regulares se crean como sesiones recurrentes (por ejemplo, "todos los martes a las 18:00").

Los partidos con fecha concreta se crean como sesiones específicas con rival y lugar.`,
    tags: ['calendario', 'excel', 'importar', 'sesiones'],
    updatedAt: '2026-04-25',
  },

  {
    id: 'app-create-bracket',
    slug: 'como-crear-cuadro-de-playoffs',
    category: 'app-usage',
    title: 'Cómo crear un cuadro de playoffs',
    summary:
      'Sube las bases de competición y la clasificación en PDF y la IA genera automáticamente los emparejamientos. Edita los cruces, introduce resultados y comparte el cuadro.',
    body: `Para crear un cuadro de playoffs, ve a la sección \`Playoffs\` en la barra de navegación.

Pulsa "Nuevo playoff" y sube los documentos: las bases de competición (PDF) y la clasificación final (PDF o texto).

La IA analizará los documentos y generará automáticamente los emparejamientos según las bases.

Podrás revisar y editar los cruces antes de confirmar.

Una vez creado, puedes introducir resultados partido a partido y el cuadro avanzará automáticamente.

También puedes compartir el cuadro con un enlace público para que otros puedan verlo.`,
    tags: ['playoffs', 'cuadro', 'crear', 'ia'],
    updatedAt: '2026-04-25',
  },

  {
    id: 'app-cuaderno',
    slug: 'cuaderno-del-entrenador',
    category: 'app-usage',
    title: 'Qué es el cuaderno del entrenador',
    summary:
      'El cuaderno es tu espacio privado por equipo para notas, test de tiro, pilares de juego, normas y valoraciones de jugadores. Solo visible para el entrenador autenticado.',
    body: `El cuaderno es una sección privada por equipo donde el entrenador puede guardar información cualitativa:

- Jugadores destacados: notas sobre jugadores de otros equipos que te interesan para el futuro.
- Test de tiro: resultados del test de tiro libre (series de 10 tiros por jugador).
- Notas: anotaciones libres sobre el equipo, la temporada o cualquier aspecto.
- Pilares: los valores o principios de juego del equipo (máximo 5).
- Normas: las reglas de convivencia del equipo.
- Informe de jugadores: valoraciones y estado de forma de cada jugador de la plantilla.

Toda esta información es privada y solo visible para el entrenador autenticado.`,
    tags: ['cuaderno', 'notas', 'privado', 'jugadores'],
    updatedAt: '2026-04-25',
  },

  {
    id: 'app-exercise-library',
    slug: 'biblioteca-de-ejercicios',
    category: 'app-usage',
    title: 'Biblioteca de ejercicios',
    summary:
      'Crea y guarda ejercicios con nombre, descripción, categorías y dibujo de pista. Márcalos como favoritos y pídele a Pick que los use al generar entrenamientos.',
    body: `La biblioteca de ejercicios es una colección personal de ejercicios que puedes crear, guardar y reutilizar.

Cada ejercicio tiene: nombre, descripción, categorías (ataque, defensa, tiro, físico, etc.), tags libres, y opcionalmente un dibujo de pista.

Puedes marcar ejercicios como favoritos para encontrarlos más rápido.

Al generar entrenamientos con IA, puedes pedirle que use ejercicios de tu biblioteca: "genera un entrenamiento usando mis ejercicios favoritos de tiro".

Los ejercicios se pueden compartir con otros entrenadores mediante un enlace.`,
    tags: ['ejercicios', 'biblioteca', 'favoritos', 'entrenamiento'],
    updatedAt: '2026-04-25',
  },

  {
    id: 'app-scouting-analysis',
    slug: 'scouting-y-analisis-de-partidos',
    category: 'app-usage',
    title: 'Scouting y análisis de partidos',
    summary:
      'Crea informes de scouting del rival y análisis post-partido para cada sesión. Sube el acta en PDF y la IA extrae los marcadores y los registra en el cuadro de playoffs.',
    body: `Para cada partido del calendario puedes crear un informe de scouting del rival y un análisis post-partido.

El scouting pre-partido recoge observaciones sobre el equipo rival: sistemas ofensivos, defensivos, jugadores clave.

El análisis post-partido recoge reflexiones sobre el rendimiento de tu equipo.

Puedes subir el acta del partido (PDF) y la IA extraerá automáticamente los marcadores y los registrará en el cuadro de playoffs si hay uno activo.

Estos informes quedan vinculados a la sesión del calendario para consultarlos en el futuro.`,
    tags: ['scouting', 'analisis', 'partido', 'acta'],
    updatedAt: '2026-04-25',
  },

  {
    id: 'app-sharing-bracket',
    slug: 'compartir-cuadro-de-playoffs',
    category: 'app-usage',
    title: 'Compartir un cuadro de playoffs',
    summary:
      'Genera un enlace público para compartir tu cuadro en modo solo lectura o edición colaborativa. Puedes revocar el acceso en cualquier momento.',
    body: `Puedes compartir cualquier cuadro de playoffs con un enlace público.

Desde el cuadro de playoffs, pulsa el icono de compartir. Se genera un código y un enlace.

Hay dos modos: solo lectura (cualquiera puede ver el cuadro) y edición colaborativa (otros entrenadores autenticados pueden introducir resultados).

El enlace funciona sin necesidad de tener cuenta. Para editar, sí es necesario estar autenticado.

Puedes revocar el acceso en cualquier momento desde la configuración de compartición del cuadro.`,
    tags: ['compartir', 'playoffs', 'enlace', 'colaborativo'],
    updatedAt: '2026-04-25',
  },

  // ─── COMPETITION RULES ────────────────────────────────────────────────────

  {
    id: 'rules-league-format',
    slug: 'formato-liga-todos-contra-todos',
    category: 'competition-rules',
    title: 'Formato liga (todos contra todos)',
    summary:
      'En una liga, cada equipo juega una o dos veces contra todos los demás. Los puntos por resultado y los criterios de desempate los fija cada competición.',
    body: `> El formato exacto de tu competición puede variar — consulta siempre las bases oficiales.

La liga o formato round-robin es un formato habitual en competiciones regulares de baloncesto.

En una liga simple, cada equipo juega UNA vez contra todos los demás.

En una liga doble (liguilla de vuelta), cada equipo juega DOS veces contra cada rival (una en casa, una fuera).

La clasificación se decide por los puntos acumulados según el resultado de cada partido, y los criterios de desempate los fija cada competición.

La liga es el formato más equitativo porque minimiza el efecto del azar.

Muchas competiciones usan una fase de liga regular seguida de una fase de playoffs eliminatoria.`,
    tags: ['liga', 'round-robin', 'clasificacion', 'formato'],
    updatedAt: '2026-04-25',
  },

  {
    id: 'rules-elimination-format',
    slug: 'formato-eliminatoria-directa',
    category: 'competition-rules',
    title: 'Formato eliminatoria directa (copa)',
    summary:
      'En la eliminatoria directa, perder significa quedar eliminado. El seeding determina los emparejamientos y los BYEs aparecen cuando el número de equipos no es potencia de 2.',
    body: `> El formato exacto de tu competición puede variar — consulta siempre las bases oficiales.

En la eliminatoria directa o formato copa, el equipo que pierde queda eliminado inmediatamente.

El cuadro se dibuja antes del inicio del torneo y los emparejamientos están prefijados.

La ventaja es que requiere menos partidos totales que una liga.

El seeding (cabezas de serie) determina los emparejamientos: un ejemplo habitual sería que el 1º de un grupo juegue contra el 2º de otro grupo. Los emparejamientos exactos dependen de las bases del torneo.

Las posibles BYE rounds ocurren cuando el número de equipos no es potencia de 2 — los equipos con BYE avanzan directamente a la siguiente ronda sin jugar.`,
    tags: ['eliminatoria', 'copa', 'seeding', 'bye'],
    updatedAt: '2026-04-25',
  },

  {
    id: 'rules-series-formats',
    slug: 'formatos-de-serie-bo1-bo2-bo3-bo5',
    category: 'competition-rules',
    title: 'Formatos de serie: BO1, BO2, BO3, BO5',
    summary:
      'Las eliminatorias pueden jugarse en partido único (BO1) o en series de 2, 3, 5 o 7 partidos. El formato concreto lo determinan las bases de cada competición.',
    body: `> El formato exacto de tu competición puede variar — consulta siempre las bases oficiales.

Las eliminatorias de playoffs suelen jugarse en series en lugar de partido único:

- BO1 (Best of 1): Un solo partido. El ganador avanza. Es el formato más rápido.
- BO2 (Best of 2): Dos partidos con marcador global. En caso de empate (1-1), se usa diferencia de puntos o partido de desempate.
- BO3 (Best of 3): Se juega hasta que un equipo gane 2 partidos. Máximo 3 partidos.
- BO5 (Best of 5): Se juega hasta que un equipo gane 3 partidos. Máximo 5 partidos.
- BO7 (Best of 7): Se juega hasta que un equipo gane 4 partidos.

El equipo con mejor clasificación suele tener ventaja de campo (juega más partidos en casa).`,
    tags: ['serie', 'bo3', 'bo1', 'playoffs'],
    updatedAt: '2026-04-25',
  },

  {
    id: 'rules-spanish-basketball-categories',
    slug: 'categorias-baloncesto-espanol',
    category: 'competition-rules',
    title: 'Categorías del baloncesto español',
    summary:
      'El baloncesto federado español se organiza por tramos de edad: minibasket, alevín, infantil, cadete, júnior y sénior, cada una con su balón, canasta y reglamento específico.',
    body: `> El formato exacto de tu competición puede variar — consulta siempre las bases oficiales.

Las categorías del baloncesto español por tramo de edad (los años de nacimiento concretos varían cada temporada y los publica cada federación):

- Minibasket (prebenjamín/benjamín): aproximadamente 6-9 años. Pista reducida, canasta a 2.60m, balón talla 5.
- Alevín: aproximadamente 10-11 años. Canasta a 2.60m (en algunas federaciones a 3.05m), balón talla 5.
- Infantil: aproximadamente 12-13 años. Canasta reglamentaria (3.05m), balón talla 6.
- Cadete: aproximadamente 14-15 años. Canasta reglamentaria, balón talla 7 (masculino) o 6 (femenino).
- Júnior: aproximadamente 16-17 años. Reglamento completo.
- Sénior: 18 años en adelante. Reglamento completo.

En competición federada, los jugadores pueden jugar en categorías superiores (sube) pero no inferiores (baja), salvo casos especiales.`,
    tags: ['categorias', 'edad', 'federacion', 'reglamento'],
    updatedAt: '2026-04-25',
  },

  {
    id: 'rules-group-stage-playoffs',
    slug: 'fase-de-grupos-y-playoffs',
    category: 'competition-rules',
    title: 'Fase de grupos + playoffs',
    summary:
      'Muchas competiciones combinan una fase de grupos (liga interna) con una fase de playoffs eliminatoria. El seeding cruza grupos para evitar repetir rivales hasta la final.',
    body: `> El formato exacto de tu competición puede variar — consulta siempre las bases oficiales.

Muchas competiciones combinan una fase de grupos (liga) con una fase de playoffs:

1. Fase de grupos: Todos los equipos se dividen en grupos y juegan una liga interna.
2. Clasificación: Los primeros de cada grupo (el número exacto lo fijan las bases) pasan a playoffs.
3. Playoffs: Eliminatorias directas o en series con los clasificados.

El seeding para los playoffs suele cruzar grupos para evitar que dos equipos del mismo grupo se encuentren hasta la final.

Por ejemplo: 1º Grupo A vs 2º Grupo B, y 1º Grupo B vs 2º Grupo A.

Las bases de competición de cada torneo especifican exactamente el criterio de clasificación y el formato de los playoffs.`,
    tags: ['grupos', 'playoffs', 'seeding', 'clasificacion'],
    updatedAt: '2026-04-25',
  },

  // ─── BRACKET ENGINE ───────────────────────────────────────────────────────

  {
    id: 'bracket-power-of-2',
    slug: 'cuadro-potencia-de-2',
    category: 'bracket-engine',
    title: 'Por qué el cuadro necesita potencia de 2',
    summary:
      'El motor de cuadros de Pick&Coach requiere 4, 8, 16 o 32 partidos en primera ronda. Si la competición tiene un número distinto, se añaden BYEs automáticamente.',
    body: `El sistema de cuadros de playoffs de Pick&Coach requiere que el número de partidos en la primera ronda sea exactamente una potencia de 2: 4, 8, 16 o 32 partidos.

Esto se debe a la estructura de árbol binario que usa el motor del cuadro: cada partido tiene exactamente un ganador que avanza al partido padre.

Si la competición tiene un número de cruces que no es potencia de 2 (por ejemplo 6 o 12), se añaden BYEs automáticamente hasta completar la potencia de 2 superior.

Un BYE significa que un equipo avanza directamente a la siguiente ronda sin rival (team2 = null). Los equipos mejor clasificados suelen recibir los BYEs.`,
    tags: ['potencia', 'bye', 'cuadro', 'estructura'],
    updatedAt: '2026-04-25',
  },

  {
    id: 'bracket-winner-propagation',
    slug: 'propagacion-de-ganadores-en-el-cuadro',
    category: 'bracket-engine',
    title: 'Cómo se propagan los ganadores en el cuadro',
    summary:
      'Al introducir resultados, el ganador de la serie avanza automáticamente al siguiente partido. Puedes editar resultados anteriores y el cuadro se recalcula hacia arriba.',
    body: `Cuando introduces el resultado de un partido en el cuadro, el ganador de la serie avanza automáticamente al siguiente partido.

En BO1: el ganador del partido avanza.

En BO2: el ganador se determina por marcador global de los dos partidos. En caso de empate de victorias (1-1), se usa la diferencia de puntos total.

En BO3: el ganador es el primero en ganar 2 partidos. Se juegan entre 2 y 3 partidos.

El cuadro siempre muestra "Por determinar" en los partidos futuros hasta que se resuelvan los previos.

Puedes editar resultados anteriores y el cuadro se recalcula automáticamente hacia arriba.`,
    tags: ['ganador', 'resultado', 'propagacion', 'cuadro'],
    updatedAt: '2026-04-25',
  },

  {
    id: 'bracket-bye-rounds',
    slug: 'rondas-con-bye-pases-directos',
    category: 'bracket-engine',
    title: 'Rondas con BYE (pases directos)',
    summary:
      'Un BYE es un pase directo a la siguiente ronda sin jugar. Se usan cuando el número de equipos no llena todas las plazas de primera ronda, y se asignan a los mejor clasificados.',
    body: `Un BYE es un pase directo que permite a un equipo avanzar a la siguiente ronda sin jugar.

Se usan cuando el número de equipos no llena perfectamente todas las plazas de la primera ronda.

Por ejemplo, con 12 equipos en un cuadro de 16 plazas, hay 4 BYEs: 4 equipos pasan directamente a segunda ronda.

Los BYEs se asignan típicamente a los equipos mejor clasificados (1º, 2º, 3º, 4º de la liga).

En Pick&Coach, cuando creas el cuadro desde las bases de competición, la IA detecta automáticamente qué equipos tienen BYE y los posiciona correctamente en el cuadro.`,
    tags: ['bye', 'pase-directo', 'cuadro', 'clasificacion'],
    updatedAt: '2026-04-25',
  },

  {
    id: 'bracket-editing',
    slug: 'editar-el-cuadro-manualmente',
    category: 'bracket-engine',
    title: 'Editar el cuadro manualmente',
    summary:
      'Puedes editar equipos, resultados y cruces en cualquier momento. El cuadro tiene historial de cambios con deshacer y rehacer, y guarda automáticamente en la nube.',
    body: `Puedes editar cualquier aspecto del cuadro de playoffs manualmente:

- Editar equipos: pulsa en el nombre de cualquier equipo en el cuadro para modificarlo.
- Introducir resultados: pulsa en el partido y rellena los marcadores de cada juego de la serie.
- Deshacer/rehacer: el cuadro tiene historial de cambios, puedes deshacer con \`Ctrl+Z\` o el botón de deshacer.
- Añadir/quitar equipos: en la vista de edición puedes cambiar los equipos de los cruces iniciales.
- Las rondas futuras se recalculan automáticamente cuando cambias resultados previos.

El cuadro guarda automáticamente en la nube cada vez que haces un cambio.`,
    tags: ['editar', 'cuadro', 'deshacer', 'resultados'],
    updatedAt: '2026-04-25',
  },

  // ─── BASKETBALL CONCEPTS ─────────────────────────────────────────────────

  {
    id: 'bb-basic-positions',
    slug: 'posiciones-basicas-en-baloncesto',
    category: 'basketball-concepts',
    title: 'Posiciones básicas en baloncesto',
    summary:
      'El baloncesto tiene cinco posiciones: base (1), escolta (2), alero (3), ala-pívot (4) y pívot (5). En categorías inferiores no se asignan posiciones fijas para favorecer el desarrollo.',
    body: `Las posiciones en baloncesto:

- Base (1, PG - Point Guard): Director de juego. Maneja el balón, organiza el ataque, generalmente el más rápido y hábil con el balón.
- Escolta (2, SG - Shooting Guard): Tirador exterior, complementa al base. Buena técnica de tiro y desmarque.
- Alero (3, SF - Small Forward): Versátil. Puede anotar desde fuera y cerca del aro, defiende varios puestos.
- Ala-Pívot (4, PF - Power Forward): Juega cerca del aro, importante en el rebote y en el juego interior.
- Pívot (5, C - Center): El más alto generalmente, domina la zona, referencia interior en ataque y defensa.

En categorías inferiores (minibasket, alevín) no se asignan posiciones fijas para favorecer el desarrollo integral del jugador.`,
    tags: ['posiciones', 'base', 'pivote', 'baloncesto'],
    updatedAt: '2026-04-25',
  },

  {
    id: 'bb-basic-offense',
    slug: 'conceptos-basicos-de-ataque',
    category: 'basketball-concepts',
    title: 'Conceptos básicos de ataque',
    summary:
      'Los fundamentos ofensivos incluyen el pick and roll, cortes sin balón, juego de poste bajo, triple amenaza, transición y sistemas como el 4 fuera 1 dentro o la motion offense.',
    body: `Conceptos ofensivos básicos en baloncesto:

- Pick and roll (bloqueo directo): Un jugador bloquea al defensor del base para que este pueda penetrar o tirar. El bloqueador "rueda" hacia el aro para recibir.
- Corte en V / corte en L: Movimientos sin balón para desmarcarse del defensor.
- Juego de poste bajo: Aprovechar la superioridad de un pívot cerca del aro para recibir y anotar.
- Triple amenaza: Posición con balón desde la que el jugador puede botar, pasar o tirar.
- Transición: Ataque rápido tras robo o rebote defensivo antes de que la defensa se organice.
- Sistemas de ataque: 4 fuera 1 dentro, doble torre, motion offense (ataque libre con principios).`,
    tags: ['ataque', 'pick-and-roll', 'ofensiva', 'sistemas'],
    updatedAt: '2026-04-25',
  },

  {
    id: 'bb-basic-defense',
    slug: 'conceptos-basicos-de-defensa',
    category: 'basketball-concepts',
    title: 'Conceptos básicos de defensa',
    summary:
      'Los sistemas defensivos van desde la individual (man-to-man) hasta zonas 2-3 y 3-2, pressing a todo campo, trap y la ayuda defensiva como principio fundamental.',
    body: `Conceptos defensivos básicos en baloncesto:

- Defensa individual (man-to-man): Cada defensor marca a un atacante específico.
- Zona 2-3: Dos defensores arriba y tres abajo. Protege bien el interior pero es vulnerable al tiro exterior.
- Zona 3-2: Tres arriba y dos abajo. Más activa en el perímetro.
- Pressing (presión): Defensa que comienza antes de que el equipo rival pueda organizar el ataque. Puede ser a todo campo o a medio campo.
- Trap (trampa): Dos defensores presionan al portador del balón simultáneamente para forzar el error.
- Defensa en la ayuda (help defense): Principio fundamental. Cuando el atacante penetra, los compañeros deben "ayudar" cerrando el carril.`,
    tags: ['defensa', 'zona', 'pressing', 'man-to-man'],
    updatedAt: '2026-04-25',
  },

  {
    id: 'bb-minibasket-sextos',
    slug: 'minibasket-y-planilla-de-sextos',
    category: 'basketball-concepts',
    title: 'Minibasket y Planilla de Sextos',
    summary:
      'El minibasket tiene reglas adaptadas a niños de 6-9 años: canasta a 2.60m y balón talla 5. Algunas federaciones usan puntuación en sextos. La Planilla de Sextos está disponible en Pick&Coach.',
    body: `El minibasket tiene reglas específicas adaptadas a los más pequeños:

- Pista reducida o pista completa según la federación.
- Canasta a 2.60m de altura.
- Balón talla 5.
- La puntuación en sextos (fracciones en lugar de 1-2-3 puntos) es propia de algunas federaciones autonómicas; el reglamento de puntuación varía según la competición.

La Planilla de Sextos es una hoja de registro específica de minibasket que recoge el marcador en formato de sextos.

En Pick&Coach, la función \`Planilla de Sextos\` está disponible solo para equipos de categoría minibasket.

En el partido de minibasket se permite tiempo muerto, cambios libres y el marcador parcial se anota por cuartos.`,
    tags: ['minibasket', 'sextos', 'planilla', 'categorias'],
    updatedAt: '2026-04-25',
  },

  {
    id: 'bb-training-structure',
    slug: 'estructura-tipica-de-entrenamiento',
    category: 'basketball-concepts',
    title: 'Estructura típica de un entrenamiento de baloncesto',
    summary:
      'Un entrenamiento bien estructurado tiene calentamiento, parte principal y vuelta a la calma. Las duraciones orientativas varían según la categoría y el grupo.',
    body: `Un entrenamiento de baloncesto bien estructurado tiene tres partes:

1. Calentamiento (habitualmente entre 10 y 15 min, según la categoría): Activación cardiovascular, movilidad articular dinámica, manejo de balón suave. Objetivo: preparar el cuerpo y la mente para el esfuerzo.
2. Parte principal (variable, habitualmente entre 40 y 60 min): Trabajo técnico-táctico dividido en bloques temáticos. Cada bloque tiene ejercicios progresivos (del fácil al difícil, del analítico al global).
3. Vuelta a la calma (habitualmente entre 5 y 10 min): Partido libre reducido, tiros libres, estiramientos estáticos, reflexión grupal sobre lo trabajado.

La duración total varía según la categoría y el grupo: orientativamente 75-90 min para categorías superiores, 60-75 min para infantil-cadete, 60 min para alevín, 45-60 min para minibasket.

Un entrenamiento de calidad suele incluir varios ejercicios diferentes en la parte principal (el número depende de la duración y los objetivos de la sesión).`,
    tags: ['entrenamiento', 'estructura', 'calentamiento', 'planificacion'],
    updatedAt: '2026-04-25',
  },

  {
    id: 'bb-common-drills',
    slug: 'ejercicios-clasicos-de-baloncesto',
    category: 'basketball-concepts',
    title: 'Ejercicios clásicos de baloncesto',
    summary:
      'Los ejercicios más habituales incluyen el 3 en raya, situaciones de superioridad numérica (2x1, 3x2), tiro en movimiento, rondo y juegos reducidos 3x3 o 4x4.',
    body: `Ejercicios típicos en los entrenamientos de baloncesto:

- 3 en raya (3 corredores): 3 jugadores en línea que avanzan en transición, el del centro pasa alternativamente y los extremos definen. Trabaja transición y finalización.
- 2x1 / 3x2: Situaciones de superioridad numérica para trabajar la toma de decisiones.
- Tiro en movimiento: El jugador recibe en movimiento y tira. Trabaja el tiro en condiciones reales.
- Defensa de bote: El atacante bota y el defensor le acompaña practicando la posición defensiva correcta.
- Rondo (posesión): Grupo en círculo mantiene la posesión contra 1-2 defensores centrales. Trabaja el pase, la lectura y la presión.
- Juego reducido 3x3 / 4x4: Partido en espacio reducido para mayor participación y más tomas de decisión por jugador.`,
    tags: ['ejercicios', 'drills', 'rondo', 'entrenamiento'],
    updatedAt: '2026-04-25',
  },

  {
    id: 'bb-season-planning',
    slug: 'planificacion-de-la-temporada',
    category: 'basketball-concepts',
    title: 'Planificación de la temporada',
    summary:
      'La temporada se divide en pretemporada, fase competitiva, parón navideño, liga regular y playoffs. El entrenador debe periodizar la carga para llegar al máximo en la fase final.',
    body: `Una temporada de baloncesto se divide típicamente en:

- Pretemporada (sep-oct): Trabajo físico general, recuperación técnica individual, integración de nuevos jugadores.
- Fase competitiva 1 (oct-ene): Primeros partidos de liga. Trabajo técnico-táctico, consolidación del sistema.
- Parón navideño: Torneos o mini-campus. Buena oportunidad para trabajar aspectos específicos.
- Fase competitiva 2 (ene-mar): Liga regular. Mantenimiento de forma, ajustes tácticos según rival.
- Playoffs / fase final (mar-may): Preparación específica para la eliminatoria. Mayor intensidad competitiva.

El entrenador debe planificar la carga de trabajo para que el equipo llegue en su mejor momento a la fase de playoffs.`,
    tags: ['temporada', 'planificacion', 'pretemporada', 'playoffs'],
    updatedAt: '2026-04-25',
  },
];
