import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

export const extractTextFromFile = async (file) => {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('El archivo es demasiado grande (máx. 10 MB). Comprime el PDF e inténtalo de nuevo.');
  }
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('El PDF tardó demasiado en procesarse. Prueba con otro archivo.')), 30000)
    );
    const extract = async () => {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(' ') + '\n';
      }
      return text;
    };
    return await Promise.race([extract(), timeout]);
  } else {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }
};

const callGemini = async (prompt, onStatus) => {
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
  const models = geminiApiKey
    ? ['gemini-flash-latest', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b']
    : ['gemini-2.5-flash-preview-09-2025', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  let modelIndex = 0;
  const getUrl = () => `https://generativelanguage.googleapis.com/v1beta/models/${models[modelIndex]}:generateContent?key=${geminiApiKey}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" }
  };

  while (modelIndex < models.length) {
    try {
      if (onStatus) onStatus(`La IA está analizando... (modelo: ${models[modelIndex]})`);
      const response = await fetch(getUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.status === 429) throw new Error("RATE_LIMIT");
      if (response.status === 403) throw new Error("FORBIDDEN");
      if (response.status === 503) {
        console.warn(`Modelo ${models[modelIndex]} saturado, probando siguiente...`);
        modelIndex++;
        if (modelIndex < models.length) await new Promise(res => setTimeout(res, 1000));
        continue;
      }
      if (!response.ok) {
        const errData = await response.text();
        console.error("Detalle del error de Gemini:", errData);
        throw new Error('API Error');
      }
      const data = await response.json();
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanText);
    } catch (err) {
      if (err.message === "RATE_LIMIT" || err.message === "FORBIDDEN") throw err;
      if (err.message !== 'API Error') { modelIndex++; continue; }
      throw new Error("Fallo en la comunicación con la IA.");
    }
  }
  throw new Error("Todos los modelos de Gemini están saturados. Inténtalo más tarde.");
};

export const callGeminiForBracket = async (basesText, clasifText, userInstructions, { onStatus, onError }) => {
  let prompt = `
      Actúa como el comité de competición de la Federación de Baloncesto.
      He aquí dos textos extraídos de documentos:

      --- DOCUMENTO 1: BASES DE COMPETICIÓN ---
      ${basesText.substring(0, 45000)}

      --- DOCUMENTO 2: CLASIFICACIÓN FINAL ---
      ${clasifText.substring(0, 45000)}

      INSTRUCCIONES CRÍTICAS PARA GENERAR EL CUADRO:
      1. Identifica qué competición es y localiza las reglas para la Primera Ronda de Eliminatorias/Playoffs.
      2. Identifica el número de partidos (cruces) que hay en esta primera ronda (SIEMPRE potencia de 2: 8, 16...).
      3. Analiza las bases de competición paso a paso. Busca qué posición de qué grupo juega cada partido (Ej. "1º Gr.1 Oro contra 2º Gr. 4 Plata").
      4. Busca en la Clasificación el nombre real de los equipos que ocupan esas posiciones. ¡Atención! Cruza bien el número de grupo y la posición (Ej. Busca exactamente al 2º del Grupo 1 y pon su nombre real).
      5. Construye el array "initialMatches" con la cantidad de partidos detectada.
      6. IMPORTANTE EL ORDEN: El array "initialMatches" DEBE ESTAR ORDENADO EXACTAMENTE EN ESTA SECUENCIA MATEMÁTICA PARA QUE EL CUADRO SE DIBUJE BIEN:
         - Si son 16 partidos, el orden del array DEBE SER los Partidos: 1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11.
         - Si son 8 partidos, el orden del array DEBE SER los Partidos: 1, 8, 4, 5, 2, 7, 3, 6.
      7. Si la plaza es directa (Fija), pon el nombre en "team1" o "team2" y deja sus arrays de Opciones VACÍOS [].
      8. Si la plaza es POR SORTEO, deja "team1" o "team2" como null, y pon los posibles rivales en el array "team1Options" o "team2Options".
      9. En "team1Origin" y "team2Origin" detalla de dónde viene esa plaza (Ej. "1º Grupo 1").
      10. Busca el calendario/fechas de la competición y crea el array 'rounds' indicando: 'name', 'dates' (formato "DD/MM/AAAA"), 'format' y 'gamesCount'.
      11. Usa el campo "analysis" para razonar tu lógica de emparejamientos y cruce de datos antes de generar el array.

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

  if (userInstructions && userInstructions.trim() !== '') {
    prompt += `\n\nINSTRUCCIONES ADICIONALES DEL USUARIO:\n${userInstructions.trim()}`;
  }

  try {
    return await callGemini(prompt, onStatus);
  } catch (err) {
    if (err.message === "RATE_LIMIT") onError("Demasiadas peticiones a Gemini. Espera 60 segundos.");
    else if (err.message === "FORBIDDEN") onError("Error 403: La API Key no tiene acceso a la IA.");
    throw err;
  }
};

export const callGeminiForResults = async (bracketStateSimplified, resultsText, { onError }) => {
  const prompt = `
      Actúa como un asistente de datos deportivos.
      JSON del cuadro: ${JSON.stringify(bracketStateSimplified)}
      Texto del acta: ${resultsText.substring(0, 45000)}

      Extrae las puntuaciones reales del documento para los partidos del cuadro.
      Devuelve ÚNICAMENTE un JSON con la estructura:
      {
        "updatedMatches": [
          { "id": "R1-M0", "scores": [{ "s1": "85", "s2": "80" }, { "s1": "", "s2": "" }, { "s1": "", "s2": "" }] }
        ]
      }
    `;

  try {
    return await callGemini(prompt, null);
  } catch (err) {
    if (err.message === "RATE_LIMIT") onError("Límite de peticiones de Google alcanzado. Espera un minuto.");
    else if (err.message === "FORBIDDEN") onError("Error 403: API Key incorrecta para la IA de Gemini.");
    throw err;
  }
};
