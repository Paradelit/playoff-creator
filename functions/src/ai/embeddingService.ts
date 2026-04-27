import type { Firestore } from "firebase-admin/firestore";

export interface KnowledgeChunk {
  id: string;
  slug?: string;
  category: string;
  title: string;
  summary: string;
  body: string;
  tags?: string[];
  score: number;
}

interface StoredKnowledgeDoc {
  id: string;
  slug?: string;
  category: string;
  title: string;
  summary?: string;
  body?: string;
  // Legacy field — older docs only have `content`; fallback when body missing.
  content?: string;
  tags?: string[];
  embedding: number[];
}

/**
 * Generate an embedding vector for a text using Google's gemini-embedding-001.
 * Returns a float array of 768 dimensions (Matryoshka-truncated).
 *
 * NOTE: query-time and index-time MUST use the same model AND
 * outputDimensionality — embedding spaces across model versions or different
 * truncation widths are not comparable for cosine similarity. Update the
 * indexer (functions/scripts/indexKnowledge.ts) and re-run if you change this.
 */
export async function embedText(text: string, apiKey: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      outputDimensionality: 768,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Embedding API error ${response.status}: ${errText}`);
  }

  const data = await response.json() as { embedding?: { values?: number[] } };
  const values = data?.embedding?.values;
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("Empty embedding returned from API");
  }
  return values;
}

/**
 * Compute the cosine similarity between two vectors.
 * Returns a value between -1 and 1 (higher = more similar).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Search the knowledge base for chunks relevant to the given query.
 *
 * Steps:
 * 1. Embed the query using Gemini gemini-embedding-001.
 * 2. Fetch all knowledge base documents from Firestore (global collection).
 * 3. Compute cosine similarity for each document.
 * 4. Return the top-K most relevant chunks.
 *
 * The knowledge base collection lives at the root: `knowledgeBase/{docId}`.
 * It is shared across all users and populated by the indexKnowledge script.
 */
export async function searchKnowledgeBase(
  query: string,
  db: Firestore,
  geminiApiKey: string,
  topK = 5,
): Promise<KnowledgeChunk[]> {
  // If no knowledge base is indexed yet, return empty gracefully
  const col = db.collection("knowledgeBase");
  const snap = await col.get();
  if (snap.empty) {
    return [];
  }

  // Embed the query
  const queryEmbedding = await embedText(query, geminiApiKey);

  // Score each document
  const scored: Array<StoredKnowledgeDoc & { score: number }> = snap.docs.map((doc) => {
    const data = doc.data() as StoredKnowledgeDoc;
    const score = cosineSimilarity(queryEmbedding, data.embedding || []);
    return { ...data, score };
  });

  // Sort by score descending and return top-K
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK).map(({ id, slug, category, title, summary, body, content, tags, score }) => ({
    id,
    slug,
    category,
    title,
    // Prefer new fields; fall back to legacy `content` if doc was indexed before the schema migration.
    summary: summary ?? "",
    body: body ?? content ?? "",
    tags: tags ?? [],
    score,
  }));
}
