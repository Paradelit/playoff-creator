import { AgentDescriptor, ScreenContextData } from "./types";

interface PromptTemplate {
  version: string;
  build: (...args: unknown[]) => string;
}

function bracketCreation(basesText: string, clasifText: string, userInstructions?: string): string {
  let prompt = `
      Actúa como el comité de competición de la Federación de Baloncesto.
      He aquí dos textos extraídos de documentos:

      --- DOCUMENTO 1: BASES DE COMPETICIÓN ---
      ${basesText.substring(0, 45000)}

      --- DOCUMENTO 2: CLASIFICACIÓN FINAL ---
      ${clasifText.substring(0, 45000)}

      INSTRUCCIONES CRÍTICAS PARA GENERAR EL CUADRO:
      1. Identifica qué competición es y localiza las reglas para la Primera Ronda de Eliminatorias/Playoffs.
      2. Identifica el número de partidos (cruces) que hay en esta primera ronda. initialMatches.length DEBE SER EXACTAMENTE una potencia de 2: 4, 8, 16 o 32. NO se acepta ningún otro número. Si la competición tiene un número distinto de cruces (ej. 6, 10, 12...), redondea a la potencia de 2 superior y rellena los cruces sobrantes con BYEs (team1 = equipo clasificado, team2 = null, team2Origin = "BYE").
      3. Analiza las bases de competición paso a paso. Busca qué posición de qué grupo juega cada partido (Ej. "1º Gr.1 Oro contra 2º Gr. 4 Plata").
      4. Busca en la Clasificación el nombre real de los equipos que ocupan esas posiciones. ¡Atención! Cruza bien el número de grupo y la posición (Ej. Busca exactamente al 2º del Grupo 1 y pon su nombre real).
      4b. IMPORTANTE: Si el equipo está determinado por la clasificación, SIEMPRE pon su nombre real en "team1" o "team2". Solo usa null cuando genuinamente no se puede determinar el equipo (sorteo pendiente). NUNCA dejes null si la posición y grupo están definidos en las bases.
      5. Construye el array "initialMatches" con la cantidad EXACTA de partidos (potencia de 2). Verifica antes de generar el JSON que initialMatches.length es 4, 8, 16 o 32.
      6. ORDEN DEL ARRAY: El array initialMatches debe seguir un orden específico de emparejamiento para que el cuadro se dibuje correctamente. Cada "Partido N" indica la posición lógica del cruce según las bases. El ORDEN en el que aparecen en el array debe seguir estas secuencias:
         - Si son 4 partidos, el orden del array DEBE SER los Partidos: 1, 4, 2, 3.
         - Si son 8 partidos, el orden del array DEBE SER los Partidos: 1, 8, 4, 5, 2, 7, 3, 6.
         - Si son 16 partidos, el orden del array DEBE SER los Partidos: 1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11.
         - Si son 32 partidos, el orden del array DEBE SER los Partidos: 1, 32, 16, 17, 8, 25, 9, 24, 4, 29, 13, 20, 5, 28, 12, 21, 2, 31, 15, 18, 7, 26, 10, 23, 3, 30, 14, 19, 6, 27, 11, 22.
      7. Si la plaza es directa (Fija), pon el nombre en "team1" o "team2" y deja sus arrays de Opciones VACÍOS [].
      8. Si la plaza es POR SORTEO, deja "team1" o "team2" como null, y pon los posibles rivales en el array "team1Options" o "team2Options".
      9. En "team1Origin" y "team2Origin" detalla de dónde viene esa plaza (Ej. "1º Grupo 1").
      10. Busca el calendario/fechas de la competición y crea el array 'rounds' indicando: 'name', 'dates' (formato "DD/MM/AAAA"), 'format' y 'gamesCount'.
      11. Usa el campo "analysis" para razonar tu lógica de emparejamientos y cruce de datos antes de generar el array. En el analysis, CONFIRMA cuántos cruces has generado y que es potencia de 2.

      DEVUELVE ÚNICAMENTE UN JSON ESTRICTAMENTE VÁLIDO.
      {
        "tournamentName": "Nombre Competición",
        "analysis": "Razonamiento paso a paso...",
        "rounds": [
          { "name": "Dieciseisavos", "dates": ["12/04/2026", "19/04/2026", "26/04/2026"], "format": "Mejor de 3", "gamesCount": 3 }
        ],
        "initialMatches": [
          {
            "title": "Partido 1",
            "team1": "Nombre",
            "team1Origin": "1º Gr. 1",
            "team1Options": [],
            "team2": null,
            "team2Origin": "Sorteo Bombo B",
            "team2Options": ["A", "B", "C", "D"]
          }
        ]
      }
    `;

  if (userInstructions && userInstructions.trim() !== "") {
    prompt += `\n\nINSTRUCCIONES ADICIONALES DEL USUARIO:\n${userInstructions.trim()}`;
  }

  return prompt;
}

function calendarImport(excelText: string, teams: Array<{ id: string; teamName: string }>): string {
  const teamsJson = JSON.stringify(teams);
  return `
Eres un asistente de planificación deportiva para un club de baloncesto.
Se te entrega el contenido de un archivo Excel que contiene el CUADRANTE DE ENTRENAMIENTOS del club para la temporada.

--- CONTENIDO DEL EXCEL ---
${excelText.substring(0, 45000)}
----------------------------

EQUIPOS CONOCIDOS DEL ENTRENADOR (solo genera entradas para estos equipos; usa su id exacto):
${teamsJson}

CONCEPTOS CLAVE:
- HORARIO RECURRENTE: Una sesión sin fecha específica que ocurre cada semana en un día fijo (ej: "los lunes", "martes y jueves"). Va en el array "recurring".
- FECHA ESPECÍFICA: Una sesión con una fecha concreta (ej: 07/01/2026, sábado 12 de abril). Va en el array "specific".

INSTRUCCIONES:
1. Analiza el Excel y clasifica cada sesión como RECURRENTE o ESPECÍFICA.
2. SOLO incluye equipos que aparezcan en la lista de EQUIPOS CONOCIDOS. Ignora el resto.
3. Para cada entrada RECURRENTE extrae:
   - teamId: id del equipo conocido (nunca null, solo equipos que coincidan)
   - teamName: nombre del equipo
   - diaSemana: número del día 0=Lunes, 1=Martes, 2=Miércoles, 3=Jueves, 4=Viernes, 5=Sábado, 6=Domingo
   - horaInicio: HH:MM en 24h (o "" si no aparece)
   - horaFin: HH:MM en 24h (o "" si no aparece)
   - lugar: instalación (o "" si no aparece)
   - tipo: "entrenamiento" (la mayoría) o "partido"
4. Para cada entrada ESPECÍFICA extrae:
   - teamId, teamName (igual que antes)
   - fecha: YYYY-MM-DD obligatorio
   - horaInicio, horaFin, lugar, tipo (igual que antes)
   - rival: nombre del rival si es partido (o "")
5. Ignora filas de encabezados, totales o notas.

DEVUELVE ÚNICAMENTE UN JSON ESTRICTAMENTE VÁLIDO con esta estructura:
{
  "analysis": "Breve descripción de lo encontrado...",
  "recurring": [
    {
      "teamId": "id-del-equipo",
      "teamName": "Nombre del equipo",
      "diaSemana": 1,
      "horaInicio": "18:00",
      "horaFin": "19:30",
      "lugar": "Pabellón Norte",
      "tipo": "entrenamiento"
    }
  ],
  "specific": [
    {
      "teamId": "id-del-equipo",
      "teamName": "Nombre del equipo",
      "fecha": "2026-01-07",
      "horaInicio": "10:00",
      "horaFin": "12:00",
      "lugar": "Pabellón Sur",
      "tipo": "entrenamiento",
      "rival": ""
    }
  ]
}
  `;
}

function resultsExtract(
  bracketState: Array<{ id: string; title: string; team1: string | null; team2: string | null; gamesCount: number; format: string }>,
  resultsText: string
): string {
  return `
      Actúa como un asistente de datos deportivos.
      JSON del cuadro: ${JSON.stringify(bracketState)}
      Texto del acta: ${resultsText.substring(0, 45000)}

      Extrae las puntuaciones reales del documento para los partidos del cuadro.
      Devuelve ÚNICAMENTE un JSON con la estructura:
      {
        "updatedMatches": [
          { "id": "R1-M0", "scores": [{ "s1": "85", "s2": "80" }, { "s1": "", "s2": "" }, { "s1": "", "s2": "" }] }
        ]
      }
    `;
}

function intentRouting(
  userMessage: string,
  agents: AgentDescriptor[],
  context: Record<string, unknown>,
  screenContext?: ScreenContextData,
  conversationHistory?: Array<{ role: string; content: string }>
): string {
  const agentList = agents
    .filter((a) => a.name !== "conversational")
    .map((a) => `- ${a.name}: ${a.description} (input: ${a.inputSchema})`)
    .join("\n");

  const screenInfo = screenContext
    ? `\nPANTALLA ACTUAL: ${screenContext.screen} (ruta: ${screenContext.route})${screenContext.data ? `\nDatos de pantalla: ${JSON.stringify(screenContext.data)}` : ""}`
    : "";

  const historyInfo =
    conversationHistory && conversationHistory.length > 0
      ? `\nÚLTIMOS MENSAJES:\n${conversationHistory.slice(-5).map((m) => `${m.role}: ${m.content}`).join("\n")}`
      : "";

  return `
Eres un clasificador de intenciones para una aplicación de gestión de baloncesto.
El usuario ha enviado un mensaje de texto libre. Tu trabajo es determinar si alguno de los agentes ESPECIALIZADOS puede responder, o si debe ir al agente conversacional.

AGENTES ESPECIALIZADOS:
${agentList}

AGENTE POR DEFECTO:
- conversational: Responde preguntas generales, ayuda con navegación, da consejos. Se usa cuando ningún agente especializado encaja con confianza >= 0.5.

CONTEXTO DEL USUARIO:
${JSON.stringify(context)}${screenInfo}${historyInfo}

MENSAJE DEL USUARIO:
"${userMessage}"

INSTRUCCIONES:
1. Analiza el mensaje del usuario, el contexto y la pantalla actual.
2. Determina si algún agente ESPECIALIZADO puede responder (confidence >= 0.5).
3. Si un agente especializado coincide, extrae los datos de entrada necesarios.
4. Si ningún agente especializado coincide con suficiente confianza, usa "conversational".
5. El agente "conversational" es el fallback para saludos, preguntas generales, navegación, ayuda, etc.

DEVUELVE ÚNICAMENTE un JSON válido:
{
  "agent": "nombre_del_agente",
  "confidence": 0.0-1.0,
  "input": { ... datos extraídos para el agente ... },
  "fallbackMessage": "mensaje si no hay match (solo si agent es null)"
}
  `;
}

function conversational(
  userMessage: string,
  screenContext?: ScreenContextData,
  conversationHistory?: Array<{ role: string; content: string }>
): string {
  const screenInfo = screenContext
    ? `\nPANTALLA ACTUAL: ${screenContext.screen} (ruta: ${screenContext.route})${screenContext.data ? `\nDatos visibles: ${JSON.stringify(screenContext.data)}` : ""}`
    : "";

  const historyInfo =
    conversationHistory && conversationHistory.length > 0
      ? `\nHISTORIAL DE CONVERSACIÓN:\n${conversationHistory.slice(-10).map((m) => `${m.role}: ${m.content}`).join("\n")}`
      : "";

  return `
Eres el asistente IA de una app de gestión de baloncesto llamada CoachApp.
Respondes SIEMPRE en español, con tono profesional pero cercano.

RUTAS DE LA APP (para acciones de navegación):
- / → Inicio (dashboard con resumen de equipos, eventos de hoy, playoffs activos)
- /calendar → Calendario (sesiones de entrenamiento y partidos)
- /teams → Lista de equipos
- /teams/:id → Detalle de equipo (plantilla, jugadores)
- /teams/:id/trainings/:id → Editor de entrenamiento
- /teams/:id/cuaderno → Cuaderno del equipo (notas, pilares, normas)
- /playoffs → Playoffs (brackets de eliminatorias)
- /exercises → Biblioteca de ejercicios
- /settings → Ajustes

CAPACIDADES:
- Puedo generar entrenamientos completos adaptados a categorías
- Puedo importar calendarios desde archivos Excel
- Puedo crear cuadros de playoffs desde documentos de competición
- Puedo extraer resultados de actas de partidos
- Puedo ayudar con navegación y uso de la app
${screenInfo}${historyInfo}

MENSAJE DEL USUARIO:
"${userMessage}"

INSTRUCCIONES:
1. Responde de forma natural y útil al mensaje del usuario.
2. Ten en cuenta la pantalla actual y el historial para dar contexto.
3. Si el usuario pide ir a algún sitio, incluye la acción de navegación.
4. Si la respuesta es corta (1-2 frases), sugiere modo "panel". Si es larga o compleja, sugiere "column".

DEVUELVE ÚNICAMENTE un JSON válido:
{
  "naturalResponse": "Tu respuesta en español...",
  "suggestedMode": "panel",
  "actions": [
    { "type": "navigate", "label": "Ir al calendario", "path": "/calendar" }
  ]
}

El array "actions" puede estar vacío si no hay acciones sugeridas.
Los tipos de acción son: "navigate" (con path) o "create" (con label descriptivo).
  `;
}

function naturalResponseWrapper(
  agentName: string,
  rawResult: unknown,
  screenContext?: ScreenContextData
): string {
  const screenInfo = screenContext ? `Pantalla actual: ${screenContext.screen}` : "";

  return `
Eres el asistente IA de CoachApp. Acaba de ejecutarse el agente "${agentName}" y ha devuelto este resultado:

${JSON.stringify(rawResult, null, 2)}

${screenInfo}

INSTRUCCIONES:
1. Genera un resumen amigable y natural en español del resultado.
2. No incluyas JSON crudo ni detalles técnicos internos.
3. Destaca los puntos más importantes del resultado.
4. Si el resultado incluye datos que el usuario debería revisar, menciónalo.
5. Sugiere el modo de visualización: "panel" si el resumen es corto, "column" si es largo/complejo.
6. Incluye acciones de seguimiento relevantes si las hay.

DEVUELVE ÚNICAMENTE un JSON válido:
{
  "naturalResponse": "Resumen amigable...",
  "suggestedMode": "panel",
  "actions": []
}
  `;
}

interface TrainingGenInput {
  teamCategory: string;
  duration: number;
  objectives: string;
  focusAreas?: string[];
  playerCount?: number;
  constraints?: string;
}

function trainingGeneration(input: TrainingGenInput): string {
  const focusStr = input.focusAreas?.length ? `\nÁreas de enfoque: ${input.focusAreas.join(", ")}` : "";
  const playersStr = input.playerCount ? `\nNúmero de jugadores: ${input.playerCount}` : "";
  const constraintsStr = input.constraints ? `\nRestricciones: ${input.constraints}` : "";

  return `
Eres un entrenador experto de baloncesto español. Genera una sesión de entrenamiento completa.

CATEGORÍAS Y ADAPTACIÓN:
- minibasket (8-10 años): Ejercicios lúdicos, juegos reducidos, fundamentos básicos. Explicaciones sencillas.
- alevín (10-12 años): Fundamentos individuales, juegos con reglas, introducción al juego en equipo.
- infantil (12-14 años): Técnica individual avanzada, conceptos tácticos básicos, juego 5x5.
- cadete (14-16 años): Táctica de equipo, sistemas ofensivos/defensivos básicos, preparación física.
- junior (16-18 años): Sistemas complejos, lectura de juego, intensidad competitiva.
- senior (18+): Táctica avanzada, preparación física específica, situaciones de partido.

DATOS DE LA SESIÓN:
- Categoría: ${input.teamCategory}
- Duración total: ${input.duration} minutos
- Objetivos: ${input.objectives}${focusStr}${playersStr}${constraintsStr}

ESTRUCTURA OBLIGATORIA:
1. Calentamiento (10-15 min): Activación, movilidad articular, ejercicios dinámicos con balón.
2. Bloques principales (variable): 2-4 bloques temáticos con ejercicios progresivos.
3. Vuelta a la calma (5-10 min): Estiramientos, tiros libres, reflexión grupal.

Para CADA ejercicio incluye:
- name: nombre descriptivo
- duration: minutos
- description: explicación detallada del ejercicio
- setup: disposición en pista (cómo colocar conos, jugadores, etc.)
- variations: array con 1-2 variantes (más fácil / más difícil)
- players: agrupación ("parejas", "tríos", "todo el grupo", "2 equipos", etc.)
- materials: array de material necesario (["balones", "conos", "petos"])

DEVUELVE ÚNICAMENTE un JSON válido:
{
  "title": "Título descriptivo de la sesión",
  "totalDuration": ${input.duration},
  "warmup": { "name": "...", "duration": 10, "description": "...", "setup": "...", "variations": ["..."], "players": "...", "materials": ["..."] },
  "mainBlocks": [
    { "name": "...", "duration": 20, "description": "...", "setup": "...", "variations": ["..."], "players": "...", "materials": ["..."] }
  ],
  "cooldown": { "name": "...", "duration": 5, "description": "...", "setup": "...", "variations": ["..."], "players": "...", "materials": ["..."] },
  "notes": "Notas adicionales para el entrenador..."
}
  `;
}

export const PROMPTS: Record<string, PromptTemplate> = {
  BRACKET_CREATION: {
    version: "1.0.0",
    build: (basesText: unknown, clasifText: unknown, userInstructions: unknown) =>
      bracketCreation(basesText as string, clasifText as string, userInstructions as string | undefined),
  },
  CALENDAR_IMPORT: {
    version: "1.0.0",
    build: (excelText: unknown, teams: unknown) =>
      calendarImport(excelText as string, teams as Array<{ id: string; teamName: string }>),
  },
  RESULTS_EXTRACT: {
    version: "1.0.0",
    build: (bracketState: unknown, resultsText: unknown) =>
      resultsExtract(
        bracketState as Array<{ id: string; title: string; team1: string | null; team2: string | null; gamesCount: number; format: string }>,
        resultsText as string
      ),
  },
  INTENT_ROUTING: {
    version: "2.0.0",
    build: (userMessage: unknown, agents: unknown, context: unknown, screenContext: unknown, conversationHistory: unknown) =>
      intentRouting(
        userMessage as string,
        agents as AgentDescriptor[],
        context as Record<string, unknown>,
        screenContext as ScreenContextData | undefined,
        conversationHistory as Array<{ role: string; content: string }> | undefined
      ),
  },
  CONVERSATIONAL: {
    version: "1.0.0",
    build: (userMessage: unknown, screenContext: unknown, conversationHistory: unknown) =>
      conversational(
        userMessage as string,
        screenContext as ScreenContextData | undefined,
        conversationHistory as Array<{ role: string; content: string }> | undefined
      ),
  },
  NATURAL_RESPONSE_WRAPPER: {
    version: "1.0.0",
    build: (agentName: unknown, rawResult: unknown, screenContext: unknown) =>
      naturalResponseWrapper(agentName as string, rawResult, screenContext as ScreenContextData | undefined),
  },
  TRAINING_GENERATION: {
    version: "1.0.0",
    build: (input: unknown) => trainingGeneration(input as TrainingGenInput),
  },
};
