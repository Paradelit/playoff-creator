/**
 * Knowledge base content for the CoachApp AI assistant.
 * Each entry will be embedded and stored in Firestore for semantic search.
 * Sections are chunked by topic for retrieval granularity.
 */

export interface KnowledgeEntry {
  id: string;
  category: "app-usage" | "competition-rules" | "bracket-engine" | "basketball-concepts";
  title: string;
  content: string;
}

export const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  // ─── APP USAGE ────────────────────────────────────────────────────────────

  {
    id: "app-create-team",
    category: "app-usage",
    title: "Cómo crear un equipo",
    content: `Para crear un equipo en CoachApp ve a la sección "Equipos" (icono de personas en la barra lateral) y pulsa el botón "Nuevo equipo".
Rellena los campos: nombre del club, categoría (minibasket, alevín, infantil, cadete, júnior, sénior), año de nacimiento, letra (A/B/C), género y división.
Una vez creado podrás añadir jugadores desde la pestaña "Plantilla" del equipo.
Cada equipo tiene su propio cuaderno, calendario de sesiones y biblioteca de entrenamientos.`,
  },

  {
    id: "app-add-players",
    category: "app-usage",
    title: "Cómo añadir jugadores a un equipo",
    content: `Para añadir jugadores a un equipo, entra en el detalle del equipo y ve a la pestaña "Plantilla" o "Jugadores".
Pulsa "Añadir jugador" o "Añadir miembro".
Puedes añadir jugadores (con dorsal, posición, datos personales) y staff técnico (entrenador, asistente, delegado).
El tipo "jugador" aparece en las estadísticas de asistencia y en la planilla. El tipo "staff" aparece solo en la plantilla.`,
  },

  {
    id: "app-generate-training",
    category: "app-usage",
    title: "Cómo generar un entrenamiento con IA",
    content: `Para generar un entrenamiento con IA, abre el chat del copiloto (icono de chat) y escribe algo como:
"Genera un entrenamiento de 75 minutos para mis infantiles centrado en el tiro y la defensa en zona".
El asistente te mostrará una previsualización del entrenamiento con calentamiento, bloques principales y vuelta a la calma.
Puedes pedirle ajustes: "hazlo más corto", "añade un bloque de juego 3x3", "adapta para 8 jugadores".
Cuando estés conforme, pulsa "Confirmar" para guardarlo en el equipo.
También puedes crear entrenamientos manualmente desde la sección de entrenamientos del equipo.`,
  },

  {
    id: "app-calendar-import",
    category: "app-usage",
    title: "Cómo importar el calendario desde Excel",
    content: `Para importar el cuadrante de entrenamientos desde un archivo Excel, ve a la sección "Calendario" y pulsa el botón de importar.
Sube tu archivo Excel con el cuadrante. El asistente IA lo analizará y detectará automáticamente los horarios de entrenamientos y partidos de tus equipos.
Revisarás un resumen de lo que se va a crear y confirmarás la importación.
Los entrenamientos regulares se crean como sesiones recurrentes (por ejemplo, "todos los martes a las 18:00").
Los partidos con fecha concreta se crean como sesiones específicas con rival y lugar.`,
  },

  {
    id: "app-create-bracket",
    category: "app-usage",
    title: "Cómo crear un cuadro de playoffs",
    content: `Para crear un cuadro de playoffs, ve a la sección "Playoffs" en la barra de navegación.
Pulsa "Nuevo playoff" y sube los documentos: las bases de competición (PDF) y la clasificación final (PDF o texto).
La IA analizará los documentos y generará automáticamente los emparejamientos según las bases.
Podrás revisar y editar los cruces antes de confirmar.
Una vez creado, puedes introducir resultados partido a partido y el cuadro avanzará automáticamente.
También puedes compartir el cuadro con un enlace público para que otros puedan verlo.`,
  },

  {
    id: "app-cuaderno",
    category: "app-usage",
    title: "Qué es el cuaderno del entrenador",
    content: `El cuaderno es una sección privada por equipo donde el entrenador puede guardar información cualitativa:
- Jugadores destacados: notas sobre jugadores de otros equipos que te interesan para el futuro.
- Test de tiro: resultados del test de tiro libre (series de 10 tiros por jugador).
- Notas: anotaciones libres sobre el equipo, la temporada o cualquier aspecto.
- Pilares: los valores o principios de juego del equipo (máximo 5).
- Normas: las reglas de convivencia del equipo.
- Informe de jugadores: valoraciones y estado de forma de cada jugador de la plantilla.
Toda esta información es privada y solo visible para el entrenador autenticado.`,
  },

  {
    id: "app-exercise-library",
    category: "app-usage",
    title: "Biblioteca de ejercicios",
    content: `La biblioteca de ejercicios es una colección personal de ejercicios que puedes crear, guardar y reutilizar.
Cada ejercicio tiene: nombre, descripción, categorías (ataque, defensa, tiro, físico, etc.), tags libres, y opcionalmente un dibujo de pista.
Puedes marcar ejercicios como favoritos para encontrarlos más rápido.
Al generar entrenamientos con IA, puedes pedirle que use ejercicios de tu biblioteca: "genera un entrenamiento usando mis ejercicios favoritos de tiro".
Los ejercicios se pueden compartir con otros entrenadores mediante un enlace.`,
  },

  {
    id: "app-scouting-analysis",
    category: "app-usage",
    title: "Scouting y análisis de partidos",
    content: `Para cada partido del calendario puedes crear un informe de scouting del rival y un análisis post-partido.
El scouting pre-partido recoge observaciones sobre el equipo rival: sistemas ofensivos, defensivos, jugadores clave.
El análisis post-partido recoge reflexiones sobre el rendimiento de tu equipo.
Puedes subir el acta del partido (PDF) y la IA extraerá automáticamente los marcadores y los registrará en el cuadro de playoffs si hay uno activo.
Estos informes quedan vinculados a la sesión del calendario para consultarlos en el futuro.`,
  },

  {
    id: "app-sharing-bracket",
    category: "app-usage",
    title: "Compartir un cuadro de playoffs",
    content: `Puedes compartir cualquier cuadro de playoffs con un enlace público.
Desde el cuadro de playoffs, pulsa el icono de compartir. Se genera un código y un enlace.
Hay dos modos: solo lectura (cualquiera puede ver el cuadro) y edición colaborativa (otros entrenadores autenticados pueden introducir resultados).
El enlace funciona sin necesidad de tener cuenta. Para editar, sí es necesario estar autenticado.
Puedes revocar el acceso en cualquier momento desde la configuración de compartición del cuadro.`,
  },

  // ─── COMPETITION RULES ────────────────────────────────────────────────────

  {
    id: "rules-league-format",
    category: "competition-rules",
    title: "Formato liga (todos contra todos)",
    content: `La liga o formato round-robin es el más común en competiciones regulares de baloncesto.
En una liga simple, cada equipo juega UNA vez contra todos los demás.
En una liga doble (liguilla de vuelta), cada equipo juega DOS veces contra cada rival (una en casa, una fuera).
La clasificación se decide por: puntos (2 por victoria, 1 por derrota), y en caso de empate: diferencia de puntos en los partidos directos entre los equipos empatados.
La liga es el formato más equitativo porque minimiza el efecto del azar.
Muchas competiciones usan una fase de liga regular seguida de una fase de playoffs eliminatoria.`,
  },

  {
    id: "rules-elimination-format",
    category: "competition-rules",
    title: "Formato eliminatoria directa (copa)",
    content: `En la eliminatoria directa o formato copa, el equipo que pierde queda eliminado inmediatamente.
El cuadro se dibuja antes del inicio del torneo y los emparejamientos están prefijados.
La ventaja es que requiere menos partidos totales que una liga.
El seeding (cabezas de serie) determina los emparejamientos: el 1º del grupo A juega contra el último del grupo B, etc.
Las posibles BYE rounds ocurren cuando el número de equipos no es potencia de 2 — los equipos con BYE avanzan directamente a la siguiente ronda sin jugar.`,
  },

  {
    id: "rules-series-formats",
    category: "competition-rules",
    title: "Formatos de serie: BO1, BO2, BO3, BO5",
    content: `Las eliminatorias de playoffs suelen jugarse en series en lugar de partido único:
- BO1 (Best of 1): Un solo partido. El ganador avanza. Es el formato más rápido.
- BO2 (Best of 2): Dos partidos con marcador global. En caso de empate (1-1), se usa diferencia de puntos o partido de desempate. Poco común.
- BO3 (Best of 3): Se juega hasta que un equipo gane 2 partidos. Máximo 3 partidos. Es el más común en playoffs de baloncesto juvenil español.
- BO5 (Best of 5): Se juega hasta que un equipo gane 3 partidos. Máximo 5 partidos. Usado en competiciones de alto nivel.
- BO7 (Best of 7): Se juega hasta que un equipo gane 4 partidos. Propio de la NBA y ACB.
El equipo con mejor clasificación suele tener ventaja de campo (juega más partidos en casa).`,
  },

  {
    id: "rules-spanish-basketball-categories",
    category: "competition-rules",
    title: "Categorías del baloncesto español",
    content: `Las categorías del baloncesto español por edad:
- Minibasket (prebenjamín/benjamín): nacidos en 2016-2019. Pista reducida, canasta a 2.60m, balón talla 5.
- Alevín: nacidos en 2014-2015. Canasta a 2.60m (en algunas federaciones a 3.05m), balón talla 5.
- Infantil: nacidos en 2012-2013. Canasta reglamentaria (3.05m), balón talla 6.
- Cadete: nacidos en 2010-2011. Canasta reglamentaria, balón talla 7 (masculino) o 6 (femenino).
- Júnior: nacidos en 2008-2009. Reglamento completo.
- Sénior: nacidos antes de 2008. Reglamento completo.
En competición federada, los jugadores pueden jugar en categorías superiores (sube) pero no inferiores (baja), salvo casos especiales.`,
  },

  {
    id: "rules-group-stage-playoffs",
    category: "competition-rules",
    title: "Fase de grupos + playoffs",
    content: `Muchas competiciones combinan una fase de grupos (liga) con una fase de playoffs:
1. Fase de grupos: Todos los equipos se dividen en grupos y juegan una liga interna.
2. Clasificación: Los mejores de cada grupo (típicamente los 2 primeros) pasan a playoffs.
3. Playoffs: Eliminatorias directas o en series con los clasificados.
El seeding para los playoffs suele cruzar grupos para evitar que dos equipos del mismo grupo se encuentren hasta la final.
Por ejemplo: 1º Grupo A vs 2º Grupo B, y 1º Grupo B vs 2º Grupo A.
Las bases de competición de cada torneo especifican exactamente el criterio de clasificación y el formato de los playoffs.`,
  },

  // ─── BRACKET ENGINE ───────────────────────────────────────────────────────

  {
    id: "bracket-power-of-2",
    category: "bracket-engine",
    title: "Por qué el cuadro necesita potencia de 2",
    content: `El sistema de cuadros de playoffs de CoachApp requiere que el número de partidos en la primera ronda sea exactamente una potencia de 2: 4, 8, 16 o 32 partidos.
Esto se debe a la estructura de árbol binario que usa el motor del cuadro: cada partido tiene exactamente un ganador que avanza al partido padre.
Si la competición tiene un número de cruces que no es potencia de 2 (por ejemplo 6 o 12), se añaden BYEs automáticamente hasta completar la potencia de 2 superior.
Un BYE significa que un equipo avanza directamente a la siguiente ronda sin rival (team2 = null). Los equipos mejor clasificados suelen recibir los BYEs.`,
  },

  {
    id: "bracket-winner-propagation",
    category: "bracket-engine",
    title: "Cómo se propagan los ganadores en el cuadro",
    content: `Cuando introduces el resultado de un partido en el cuadro, el ganador de la serie avanza automáticamente al siguiente partido.
En BO1: el ganador del partido avanza.
En BO2: el ganador se determina por marcador global de los dos partidos. En caso de empate de victorias (1-1), se usa la diferencia de puntos total.
En BO3: el ganador es el primero en ganar 2 partidos. Se juegan entre 2 y 3 partidos.
El cuadro siempre muestra "Por determinar" en los partidos futuros hasta que se resuelvan los previos.
Puedes editar resultados anteriores y el cuadro se recalcula automáticamente hacia arriba.`,
  },

  {
    id: "bracket-bye-rounds",
    category: "bracket-engine",
    title: "Rondas con BYE (pases directos)",
    content: `Un BYE es un pase directo que permite a un equipo avanzar a la siguiente ronda sin jugar.
Se usan cuando el número de equipos no llena perfectamente todas las plazas de la primera ronda.
Por ejemplo, con 12 equipos en un cuadro de 16 plazas, hay 4 BYEs: 4 equipos pasan directamente a segunda ronda.
Los BYEs se asignan típicamente a los equipos mejor clasificados (1º, 2º, 3º, 4º de la liga).
En CoachApp, cuando creas el cuadro desde las bases de competición, la IA detecta automáticamente qué equipos tienen BYE y los posiciona correctamente en el cuadro.`,
  },

  {
    id: "bracket-editing",
    category: "bracket-engine",
    title: "Editar el cuadro manualmente",
    content: `Puedes editar cualquier aspecto del cuadro de playoffs manualmente:
- Editar equipos: pulsa en el nombre de cualquier equipo en el cuadro para modificarlo.
- Introducir resultados: pulsa en el partido y rellena los marcadores de cada juego de la serie.
- Deshacer/rehacer: el cuadro tiene historial de cambios, puedes deshacer con Ctrl+Z o el botón de deshacer.
- Añadir/quitar equipos: en la vista de edición puedes cambiar los equipos de los cruces iniciales.
- Las rondas futuras se recalculan automáticamente cuando cambias resultados previos.
El cuadro guarda automáticamente en la nube cada vez que haces un cambio.`,
  },

  // ─── BASKETBALL CONCEPTS ─────────────────────────────────────────────────

  {
    id: "bb-basic-positions",
    category: "basketball-concepts",
    title: "Posiciones básicas en baloncesto",
    content: `Las posiciones en baloncesto:
- Base (1, PG - Point Guard): Director de juego. Maneja el balón, organiza el ataque, generalmente el más rápido y hábil con el balón.
- Escolta (2, SG - Shooting Guard): Tirador exterior, complementa al base. Buena técnica de tiro y desmarque.
- Alero (3, SF - Small Forward): Versátil. Puede anotar desde fuera y cerca del aro, defiende varios puestos.
- Ala-Pívot (4, PF - Power Forward): Juega cerca del aro, importante en el rebote y en el juego interior.
- Pívot (5, C - Center): El más alto generalmente, domina la zona, referencia interior en ataque y defensa.
En categorías inferiores (minibasket, alevín) no se asignan posiciones fijas para favorecer el desarrollo integral del jugador.`,
  },

  {
    id: "bb-basic-offense",
    category: "basketball-concepts",
    title: "Conceptos básicos de ataque",
    content: `Conceptos ofensivos básicos en baloncesto:
- Pick and roll (bloqueo directo): Un jugador bloquea al defensor del base para que este pueda penetrar o tirar. El bloqueador "rueda" hacia el aro para recibir.
- Corte en V / corte en L: Movimientos sin balón para desmarcarse del defensor.
- Juego de poste bajo: Aprovechar la superioridad de un pívot cerca del aro para recibir y anotar.
- Triple amenaza: Posición con balón desde la que el jugador puede botar, pasar o tirar.
- Transición: Ataque rápido tras robo o rebote defensivo antes de que la defensa se organice.
- Sistemas de ataque: 4 fuera 1 dentro, doble torre, motion offense (ataque libre con principios).`,
  },

  {
    id: "bb-basic-defense",
    category: "basketball-concepts",
    title: "Conceptos básicos de defensa",
    content: `Conceptos defensivos básicos en baloncesto:
- Defensa individual (man-to-man): Cada defensor marca a un atacante específico.
- Zona 2-3: Dos defensores arriba y tres abajo. Protege bien el interior pero es vulnerable al tiro exterior.
- Zona 3-2: Tres arriba y dos abajo. Más activa en el perímetro.
- Pressing (presión): Defensa que comienza antes de que el equipo rival pueda organizar el ataque. Puede ser a todo campo o a medio campo.
- Trap (trampa): Dos defensores presionan al portador del balón simultáneamente para forzar el error.
- Defensa en la ayuda (help defense): Principio fundamental. Cuando el atacante penetra, los compañeros deben "ayudar" cerrando el carril.`,
  },

  {
    id: "bb-minibasket-sextos",
    category: "basketball-concepts",
    title: "Minibasket y Planilla de Sextos",
    content: `El minibasket tiene reglas específicas adaptadas a niños de 8-10 años:
- Pista reducida o pista completa según la federación.
- Canasta a 2.60m de altura.
- Balón talla 5.
- Se puntúa con sextos: en lugar de 1-2-3 puntos, se usan fracciones de sexto.
La Planilla de Sextos es una hoja de registro específica de minibasket que recoge el marcador en formato de sextos.
En CoachApp, la función "Planilla de Sextos" está disponible solo para equipos de categoría minibasket (filtrado por la propiedad isMinibasketSextos).
En el partido de minibasket se permite tiempo muerto, cambios libres y el marcador parcial se anota por cuartos.`,
  },

  {
    id: "bb-training-structure",
    category: "basketball-concepts",
    title: "Estructura típica de un entrenamiento de baloncesto",
    content: `Un entrenamiento de baloncesto bien estructurado tiene tres partes:
1. Calentamiento (10-15 min): Activación cardiovascular, movilidad articular dinámica, manejo de balón suave. Objetivo: preparar el cuerpo y la mente para el esfuerzo.
2. Parte principal (variable, 45-60 min): Trabajo técnico-táctico dividido en bloques temáticos. Cada bloque tiene ejercicios progresivos (del fácil al difícil, del analítico al global).
3. Vuelta a la calma (5-10 min): Partido libre reducido, tiros libres, estiramientos estáticos, reflexión grupal sobre lo trabajado.
La duración total varía: 75-90 min para categorías superiores, 60-75 min para infantil-cadete, 60 min para alevín, 45-60 min para minibasket.
Un entrenamiento de calidad tiene entre 3 y 5 ejercicios diferentes en la parte principal.`,
  },

  {
    id: "bb-common-drills",
    category: "basketball-concepts",
    title: "Ejercicios clásicos de baloncesto",
    content: `Ejercicios típicos en los entrenamientos de baloncesto:
- 3 en raya (3 corredores): 3 jugadores en línea que avanzan en transición, el del centro pasa alternativamente y los extremos definen. Trabaja transición y finalización.
- 2x1 / 3x2: Situaciones de superioridad numérica para trabajar la toma de decisiones.
- Tiro en movimiento: El jugador recibe en movimiento y tira. Trabaja el tiro en condiciones reales.
- Defensa de bote: El atacante bota y el defensor le acompaña practicando la posición defensiva correcta.
- Rondo (posesión): Grupo en círculo mantiene la posesión contra 1-2 defensores centrales. Trabaja el pase, la lectura y la presión.
- Juego reducido 3x3 / 4x4: Partido en espacio reducido para mayor participación y más tomas de decisión por jugador.`,
  },

  {
    id: "bb-season-planning",
    category: "basketball-concepts",
    title: "Planificación de la temporada",
    content: `Una temporada de baloncesto se divide típicamente en:
- Pretemporada (sep-oct): Trabajo físico general, recuperación técnica individual, integración de nuevos jugadores.
- Fase competitiva 1 (oct-ene): Primeros partidos de liga. Trabajo técnico-táctico, consolidación del sistema.
- Parón navideño: Torneos o mini-campus. Buena oportunidad para trabajar aspectos específicos.
- Fase competitiva 2 (ene-mar): Liga regular. Mantenimiento de forma, ajustes tácticos según rival.
- Playoffs / fase final (mar-may): Preparación específica para la eliminatoria. Mayor intensidad competitiva.
El entrenador debe planificar la carga de trabajo para que el equipo llegue en su mejor momento a la fase de playoffs.`,
  },
];
