/**
 * verifyRetrieval.ts — local check that the new embeddings return sensible
 * top-K matches for known queries. Exercises the same logic as the deployed
 * search_knowledge_base tool without needing a Cloud Functions deploy.
 *
 * Run: GOOGLE_APPLICATION_CREDENTIALS=... GEMINI_API_KEY=... FIREBASE_PROJECT_ID=...
 *      npx tsx functions/scripts/verifyRetrieval.ts
 */

import { initializeApp, applicationDefault, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "";

if (!GEMINI_API_KEY || !PROJECT_ID) {
  console.error("Missing GEMINI_API_KEY or FIREBASE_PROJECT_ID");
  process.exit(1);
}

if (getApps().length === 0) {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  let useCert = false;
  if (credPath) {
    try {
      const fs = require("node:fs");
      const json = JSON.parse(fs.readFileSync(credPath, "utf8"));
      useCert = json.type === "service_account";
    } catch {
      // ignore
    }
  }
  if (credPath && useCert) {
    initializeApp({ credential: cert(credPath), projectId: PROJECT_ID });
  } else if (credPath) {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  } else {
    initializeApp({ projectId: PROJECT_ID });
  }
}

const db = getFirestore();

async function embed(text: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: { parts: [{ text }] }, outputDimensionality: 768 }),
  });
  if (!res.ok) throw new Error(`Embed ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { embedding: { values: number[] } };
  return data.embedding.values;
}

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, nA = 0, nB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; nA += a[i]*a[i]; nB += b[i]*b[i]; }
  return nA === 0 || nB === 0 ? 0 : dot / (Math.sqrt(nA)*Math.sqrt(nB));
}

async function search(query: string, k = 3) {
  const q = await embed(query);
  const snap = await db.collection("knowledgeBase").get();
  const scored = snap.docs.map((d) => {
    const data = d.data() as { title: string; embedding: number[] };
    return { id: d.id, title: data.title, score: cosine(q, data.embedding) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

async function main() {
  const queries = [
    "¿Cómo creo un equipo?",
    "¿Qué formatos de serie hay?",
    "Explica el motor de cuadros",
    "Cómo funciona el cuaderno del entrenador",
    "Qué es minibasket",
  ];

  for (const q of queries) {
    console.log(`\nQ: ${q}`);
    const results = await search(q, 3);
    for (const r of results) {
      console.log(`  ${r.score.toFixed(3)}  ${r.id} — ${r.title}`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
