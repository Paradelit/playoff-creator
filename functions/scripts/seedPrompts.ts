/**
 * Seed script: uploads all local prompt templates to Langfuse via the Public API.
 *
 * Usage:
 *   LANGFUSE_PUBLIC_KEY=pk-lf-... LANGFUSE_SECRET_KEY=sk-lf-... npx tsx scripts/seedPrompts.ts
 *
 * This creates (or adds a new version of) each prompt in the Langfuse dashboard
 * with the label "production".
 *
 * Safe to run multiple times — it simply adds new versions.
 */

import { LOCAL_PROMPTS } from "../src/ai/promptManager";

const LANGFUSE_PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY;
const LANGFUSE_SECRET_KEY = process.env.LANGFUSE_SECRET_KEY;
const LANGFUSE_BASE_URL = process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com";

if (!LANGFUSE_PUBLIC_KEY || !LANGFUSE_SECRET_KEY) {
  console.error("❌ Missing LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY env vars.");
  console.error("   Usage: LANGFUSE_PUBLIC_KEY=pk-lf-... LANGFUSE_SECRET_KEY=sk-lf-... npx tsx scripts/seedPrompts.ts");
  process.exit(1);
}

const API_URL = `${LANGFUSE_BASE_URL}/api/public/v2/prompts`;
const AUTH_HEADER = "Basic " + Buffer.from(`${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}`).toString("base64");

async function createPrompt(name: string, promptText: string): Promise<void> {
  const body = {
    name,
    type: "text",
    prompt: promptText,
    labels: ["production"],
    config: {},
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: AUTH_HEADER,
    },
    body: JSON.stringify(body),
  });

  if (response.ok) {
    const data = await response.json();
    console.log(`  ✅ ${name} → version ${data.version || "?"} (production)`);
  } else {
    const errorText = await response.text();
    console.error(`  ❌ ${name} → HTTP ${response.status}: ${errorText}`);
  }
}

async function main() {
  const promptNames = Object.keys(LOCAL_PROMPTS);
  console.log(`\n🚀 Seeding ${promptNames.length} prompts to Langfuse (${LANGFUSE_BASE_URL})...\n`);

  for (const name of promptNames) {
    await createPrompt(name, LOCAL_PROMPTS[name]);
  }

  console.log("\n✅ Done! Check your Langfuse dashboard to review the prompts.\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
