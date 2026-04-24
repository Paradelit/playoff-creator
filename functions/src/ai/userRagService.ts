import type { Firestore } from "firebase-admin/firestore";
import { embedText, cosineSimilarity } from "./embeddingService";

export interface UserContextChunk {
  id: string;
  category: "notes" | "training" | "analysis" | "scouting" | "player-report" | "memory";
  title: string;
  content: string;
  teamId?: string;
  teamName?: string;
  sourceCollection: string;
  docId: string;
}

export interface RankedChunk extends UserContextChunk {
  score: number;
}

const MAX_CHUNKS_TO_PROCESS = 30;
const MIN_SIMILARITY_SCORE = 0.45;

function userBase(db: Firestore, appId: string, userId: string) {
  return db.collection("artifacts").doc(appId).collection("users").doc(userId);
}

/**
 * Gather the most recent and relevant chunks of user data from Firestore.
 * Each chunk is a short text piece that can be embedded and searched semantically.
 */
export async function getUserContextChunks(
  db: Firestore,
  appId: string,
  userId: string
): Promise<UserContextChunk[]> {
  const base = userBase(db, appId, userId);
  const chunks: UserContextChunk[] = [];

  // ── 1. Memories (already compact, always include) ──────────────────────
  try {
    const memSnap = await base.collection("copilotMemory")
      .orderBy("lastUsedAt", "desc")
      .limit(20)
      .get();
    for (const doc of memSnap.docs) {
      const data = doc.data();
      const content = String(data.content || "").trim();
      if (!content) continue;
      chunks.push({
        id: "mem_" + doc.id,
        category: "memory",
        title: "Memoria: " + content.slice(0, 60),
        content,
        sourceCollection: "copilotMemory",
        docId: doc.id,
      });
    }
  } catch {
    // Collection may not exist yet
  }

  // ── 2. Teams — gather teamId + teamName for sub-collections ────────────
  const teamsSnap = await base.collection("teams").get();
  const teams = teamsSnap.docs.map((d) => {
    const data = d.data();
    const name = [data.teamName, data.categoria, data.año, data.letra]
      .filter(Boolean)
      .join(" ") || "(sin nombre)";
    return { id: d.id, name };
  });

  for (const team of teams) {
    // ── 3. Cuaderno notes ────────────────────────────────────────────────
    try {
      const notasSnap = await base
        .collection("teams").doc(team.id)
        .collection("cuaderno").doc("notas")
        .get();
      if (notasSnap.exists) {
        const data = notasSnap.data() || {};
        const contenido = String(data.contenido || data.content || "").trim();
        if (contenido.length > 20) {
          chunks.push({
            id: "notas_" + team.id,
            category: "notes",
            title: "Notas del cuaderno — " + team.name,
            content: contenido.slice(0, 1500),
            teamId: team.id,
            teamName: team.name,
            sourceCollection: "cuaderno/notas",
            docId: "notas",
          });
        }
      }
    } catch { /* empty */ }

    // ── 4. Player report ─────────────────────────────────────────────────
    try {
      const reportSnap = await base
        .collection("teams").doc(team.id)
        .collection("cuaderno").doc("informe-jugadores")
        .get();
      if (reportSnap.exists) {
        const data = reportSnap.data() || {};
        const entries = data.players || data.jugadores || [];
        if (Array.isArray(entries) && entries.length > 0) {
          const text = entries
            .map((p: Record<string, unknown>) =>
              [p.nombre, p.estado, p.notas].filter(Boolean).join(": ")
            )
            .join("\n");
          if (text.length > 10) {
            chunks.push({
              id: "report_" + team.id,
              category: "player-report",
              title: "Informe de jugadores — " + team.name,
              content: text.slice(0, 1500),
              teamId: team.id,
              teamName: team.name,
              sourceCollection: "cuaderno/informe-jugadores",
              docId: "informe-jugadores",
            });
          }
        }
      }
    } catch { /* empty */ }

    // ── 5. Recent trainings (last 5 per team) ────────────────────────────
    try {
      const trainSnap = await base
        .collection("teams").doc(team.id)
        .collection("trainings")
        .orderBy("meta.fecha", "desc")
        .limit(5)
        .get();
      for (const doc of trainSnap.docs) {
        const data = doc.data();
        const meta = data.meta || {};
        const title = meta.titulo || "Entrenamiento " + (meta.fecha || doc.id);
        const parts: string[] = [];
        if (meta.fecha) parts.push("Fecha: " + meta.fecha);
        if (meta.duracion) parts.push("Duración: " + meta.duracion + " min");
        if (meta.objetivos) parts.push("Objetivos: " + meta.objetivos);
        if (data.notes || data.notas) parts.push("Notas: " + (data.notes || data.notas));
        const content = parts.join("\n").trim();
        if (content.length > 10) {
          chunks.push({
            id: "train_" + doc.id,
            category: "training",
            title: title + " — " + team.name,
            content,
            teamId: team.id,
            teamName: team.name,
            sourceCollection: "trainings",
            docId: doc.id,
          });
        }
      }
    } catch { /* empty */ }
  }

  // ── 6. Recent match analyses (last 5) ───────────────────────────────────
  try {
    const analysisSnap = await base.collection("analisis")
      .orderBy("fecha", "desc")
      .limit(5)
      .get();
    for (const doc of analysisSnap.docs) {
      const data = doc.data();
      const parts: string[] = [];
      if (data.fecha) parts.push("Fecha: " + data.fecha);
      if (data.rival) parts.push("Rival: " + data.rival);
      if (data.resultado) parts.push("Resultado: " + data.resultado);
      if (data.notas || data.analisis || data.content) {
        parts.push(String(data.notas || data.analisis || data.content || "").slice(0, 800));
      }
      const content = parts.join("\n").trim();
      if (content.length > 10) {
        chunks.push({
          id: "analisis_" + doc.id,
          category: "analysis",
          title: "Análisis de partido — " + (data.rival || doc.id),
          content,
          sourceCollection: "analisis",
          docId: doc.id,
        });
      }
    }
  } catch { /* empty */ }

  // ── 7. Recent scouting reports (last 5) ─────────────────────────────────
  try {
    const scoutSnap = await base.collection("scoutings")
      .orderBy("fecha", "desc")
      .limit(5)
      .get();
    for (const doc of scoutSnap.docs) {
      const data = doc.data();
      const parts: string[] = [];
      if (data.fecha) parts.push("Fecha: " + data.fecha);
      if (data.rival) parts.push("Rival: " + data.rival);
      if (data.notas || data.contenido || data.content) {
        parts.push(String(data.notas || data.contenido || data.content || "").slice(0, 800));
      }
      const content = parts.join("\n").trim();
      if (content.length > 10) {
        chunks.push({
          id: "scouting_" + doc.id,
          category: "scouting",
          title: "Scouting — " + (data.rival || doc.id),
          content,
          sourceCollection: "scoutings",
          docId: doc.id,
        });
      }
    }
  } catch { /* empty */ }

  return chunks;
}

/**
 * Get or generate the embedding for a chunk, caching it in Firestore.
 * Returns the embedding vector.
 */
async function getOrCreateEmbedding(
  chunk: UserContextChunk,
  db: Firestore,
  appId: string,
  userId: string,
  geminiApiKey: string
): Promise<number[]> {
  const base = userBase(db, appId, userId);
  const ref = base.collection("ragIndex").doc(chunk.id);
  const snap = await ref.get();

  if (snap.exists) {
    const cached = snap.data() || {};
    // Reuse if content hasn't changed
    if (cached.contentHash === hashContent(chunk.content)) {
      return cached.embedding as number[];
    }
  }

  // Generate new embedding
  const textToEmbed = chunk.title + "\n\n" + chunk.content;
  const embedding = await embedText(textToEmbed, geminiApiKey);

  // Cache it
  await ref.set({
    id: chunk.id,
    category: chunk.category,
    title: chunk.title,
    contentHash: hashContent(chunk.content),
    embedding,
    embeddedAt: new Date().toISOString(),
  });

  return embedding;
}

/** Simple 32-bit hash for change detection — avoids storing full content in ragIndex. */
function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(36);
}

/**
 * Search the user's personal context for chunks relevant to the given query.
 *
 * Uses lazy embedding: embeddings are generated on first access and cached
 * in Firestore under `artifacts/{appId}/users/{uid}/ragIndex/`.
 *
 * Limits processing to MAX_CHUNKS_TO_PROCESS to stay within Cloud Function timeouts.
 */
export async function searchUserContext(
  query: string,
  db: Firestore,
  appId: string,
  userId: string,
  geminiApiKey: string,
  topK = 5
): Promise<RankedChunk[]> {
  const chunks = await getUserContextChunks(db, appId, userId);
  if (chunks.length === 0) return [];

  // Limit to avoid timeout — prioritize first chunks (memories + notes come first)
  const toProcess = chunks.slice(0, MAX_CHUNKS_TO_PROCESS);

  // Embed query
  const queryEmbedding = await embedText(query, geminiApiKey);

  // Get embeddings for all chunks (with caching)
  const scored: RankedChunk[] = [];
  await Promise.all(
    toProcess.map(async (chunk) => {
      try {
        const embedding = await getOrCreateEmbedding(chunk, db, appId, userId, geminiApiKey);
        const score = cosineSimilarity(queryEmbedding, embedding);
        if (score >= MIN_SIMILARITY_SCORE) {
          scored.push({ ...chunk, score });
        }
      } catch {
        // Skip chunks that fail to embed
      }
    })
  );

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
