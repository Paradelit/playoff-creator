/**
 * indexKnowledge.ts — offline script to embed the help articles and store them in Firestore.
 *
 * Run from the functions/ directory:
 *   npx tsx scripts/indexKnowledge.ts
 *
 * Prerequisites:
 *   1. Set GEMINI_API_KEY in your environment (or .env file).
 *   2. Set GOOGLE_APPLICATION_CREDENTIALS to your Firebase service account JSON,
 *      OR run `firebase login` and use the default ADC credentials.
 *   3. Set FIREBASE_PROJECT_ID to your Firebase project ID.
 *
 * What it does:
 *   - Reads all entries from HELP_ARTICLES (src/content/helpArticles.ts at repo root)
 *   - Generates a text-embedding-004 vector for each entry (title + summary + body)
 *   - Upserts each entry into Firestore at `knowledgeBase/{entry.id}`
 *   - Deletes any stale entries no longer present in the local source
 *
 * Safe to re-run: uses upsert (set with merge), only re-embeds if body changed.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HELP_ARTICLES } from "../../src/content/helpArticles";

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
  console.log(`\n🏀 Pick&Coach Help Indexer`);
  console.log(`📚 Indexing ${HELP_ARTICLES.length} entries into Firestore...\n`);

  const col = db.collection("knowledgeBase");
  const knownIds = new Set(HELP_ARTICLES.map((e) => e.id));

  // Fetch existing docs to check if body changed
  const existingSnap = await col.get();
  const existingMap = new Map<string, string>();
  for (const doc of existingSnap.docs) {
    const data = doc.data();
    // Backward compat: read either body (new) or content (old indexed records)
    existingMap.set(doc.id, (data.body as string) || (data.content as string) || "");
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const entry of HELP_ARTICLES) {
    const textToEmbed = `${entry.title}\n\n${entry.summary}\n\n${entry.body}`;
    const existingBody = existingMap.get(entry.id);

    // Skip if body hasn't changed
    if (existingBody === entry.body) {
      console.log(`  ⏭️  Skipping "${entry.title}" (unchanged)`);
      skipped++;
      continue;
    }

    process.stdout.write(`  🔄 Embedding "${entry.title}"...`);
    try {
      const embedding = await embedText(textToEmbed);
      await col.doc(entry.id).set({
        id: entry.id,
        slug: entry.slug,
        category: entry.category,
        title: entry.title,
        summary: entry.summary,
        body: entry.body,
        tags: entry.tags || [],
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
  console.log(`   Total in Firestore: ${HELP_ARTICLES.length - deleted + created} entries\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
