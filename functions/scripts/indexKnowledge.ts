/**
 * indexKnowledge.ts — offline script to embed the knowledge base and store it in Firestore.
 *
 * Run from the functions/ directory:
 *   npx ts-node --project tsconfig.json scripts/indexKnowledge.ts
 *
 * Prerequisites:
 *   1. Set GEMINI_API_KEY in your environment (or .env file).
 *   2. Set GOOGLE_APPLICATION_CREDENTIALS to your Firebase service account JSON,
 *      OR run `firebase login` and use the default ADC credentials.
 *   3. Set FIREBASE_PROJECT_ID to your Firebase project ID.
 *
 * What it does:
 *   - Reads all entries from KNOWLEDGE_BASE (src/ai/knowledge/index.ts)
 *   - Generates a text-embedding-004 vector for each entry
 *   - Upserts each entry into Firestore at `knowledgeBase/{entry.id}`
 *   - Deletes any stale entries no longer present in the local knowledge base
 *
 * Safe to re-run: uses upsert (set with merge), only re-embeds if content changed.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { KNOWLEDGE_BASE } from "../src/ai/knowledge/index";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "";

if (!GEMINI_API_KEY) {
  console.error("❌ Missing GEMINI_API_KEY environment variable.");
  process.exit(1);
}
if (!PROJECT_ID) {
  console.error("❌ Missing FIREBASE_PROJECT_ID environment variable.");
  process.exit(1);
}

// Initialize Firebase Admin
if (getApps().length === 0) {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    initializeApp({ credential: cert(credPath), projectId: PROJECT_ID });
  } else {
    // Use Application Default Credentials (firebase login)
    initializeApp({ projectId: PROJECT_ID });
  }
}

const db = getFirestore();

async function embedText(text: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/text-embedding-004",
      content: { parts: [{ text }] },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding API error ${response.status}: ${err}`);
  }

  const data = await response.json() as { embedding?: { values?: number[] } };
  const values = data?.embedding?.values;
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("Empty embedding returned");
  }
  return values;
}

async function main() {
  console.log(`\n🏀 CoachApp Knowledge Base Indexer`);
  console.log(`📚 Indexing ${KNOWLEDGE_BASE.length} entries into Firestore...\n`);

  const col = db.collection("knowledgeBase");
  const knownIds = new Set(KNOWLEDGE_BASE.map((e) => e.id));

  // Fetch existing docs to check if content changed
  const existingSnap = await col.get();
  const existingMap = new Map<string, string>();
  for (const doc of existingSnap.docs) {
    const data = doc.data();
    existingMap.set(doc.id, data.content as string || "");
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const entry of KNOWLEDGE_BASE) {
    const textToEmbed = `${entry.title}\n\n${entry.content}`;
    const existingContent = existingMap.get(entry.id);

    // Skip if content hasn't changed
    if (existingContent === entry.content) {
      console.log(`  ⏭️  Skipping "${entry.title}" (unchanged)`);
      skipped++;
      continue;
    }

    process.stdout.write(`  🔄 Embedding "${entry.title}"...`);
    try {
      const embedding = await embedText(textToEmbed);
      await col.doc(entry.id).set({
        id: entry.id,
        category: entry.category,
        title: entry.title,
        content: entry.content,
        embedding,
        indexedAt: new Date().toISOString(),
      });

      const isNew = !existingMap.has(entry.id);
      console.log(` ✅ ${isNew ? "created" : "updated"}`);
      if (isNew) created++; else updated++;

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.log(` ❌ Error: ${(err as Error).message}`);
    }
  }

  // Delete stale entries
  let deleted = 0;
  for (const doc of existingSnap.docs) {
    if (!knownIds.has(doc.id)) {
      await doc.ref.delete();
      console.log(`  🗑️  Deleted stale entry: ${doc.id}`);
      deleted++;
    }
  }

  console.log(`\n✨ Done!`);
  console.log(`   Created: ${created} | Updated: ${updated} | Skipped: ${skipped} | Deleted: ${deleted}`);
  console.log(`   Total in Firestore: ${KNOWLEDGE_BASE.length - deleted + created} entries\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
