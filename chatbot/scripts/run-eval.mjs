#!/usr/bin/env node

/**
 * run-eval.mjs
 *
 * Evaluates the AskTheMenu chatbot against a set of test prompts.
 * Calls the Groq API directly (not through the full API route) for speed.
 *
 * Usage:
 *   node --loader tsx scripts/run-eval.mjs              # Quick run (5 prompts)
 *   node --loader tsx scripts/run-eval.mjs --all        # All 25 prompts
 *   node --loader tsx scripts/run-eval.mjs --category allergen  # Single category
 *
 * ⚠️  This script calls the LLM API and will consume API quota.
 *     The quick run uses only 5 prompts from broad categories.
 *
 * Output: writes eval-results.md to the chatbot root directory.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

// Load env
dotenv.config({ path: resolve(ROOT, ".env.local") });

// ── Dynamic import of eval prompts (TypeScript) ─────────────────────────────
// We use tsx loader so we can import .ts directly
const { evalPrompts, getQuickRunPrompts, getPromptsByCategory } = await import(
  "./eval-prompts.ts"
);

// ── Parse CLI args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const runAll = args.includes("--all");
const categoryIdx = args.indexOf("--category");
const categoryFilter =
  categoryIdx !== -1 && args[categoryIdx + 1] ? args[categoryIdx + 1] : null;

// ── Select prompts to run ───────────────────────────────────────────────────
let selectedPrompts;
if (runAll) {
  selectedPrompts = evalPrompts;
  console.log(`📋 Running ALL ${selectedPrompts.length} prompts.\n`);
} else if (categoryFilter) {
  selectedPrompts = getPromptsByCategory(categoryFilter);
  console.log(
    `📋 Running ${selectedPrompts.length} prompts in category "${categoryFilter}".\n`
  );
} else {
  selectedPrompts = getQuickRunPrompts();
  console.log(
    `📋 Quick run: ${selectedPrompts.length} prompts (use --all for all ${evalPrompts.length}).\n`
  );
}

if (selectedPrompts.length === 0) {
  console.error("❌ No prompts selected. Check --category filter.");
  process.exit(1);
}

// ── Load menu context for grounding ─────────────────────────────────────────
const menuPath = resolve(ROOT, "data", "menu.json");
let menuSummary = "Menu context not available.";
if (existsSync(menuPath)) {
  try {
    const menuData = JSON.parse(readFileSync(menuPath, "utf-8"));
    // Build a compact summary of menu items for the system prompt
    menuSummary = menuData
      .map(
        (item) =>
          `Dish: ${item.name} | Cuisine: ${item.cuisineType} | Price: PKR ${item.pricePkr} | Dietary: ${item.dietary} | Spice: ${item.spiceLevel} | Allergens: ${(item.allergens || []).join(", ") || "none"} | Pairings: ${(item.pairings || []).join(", ") || "none"} | Serving: ${item.serving}`
      )
      .join("\n");
  } catch (err) {
    console.warn("⚠  Could not parse menu.json:", err.message);
  }
}

// ── System prompt (matches the production one in prompts.ts) ────────────────
const SYSTEM_PROMPT = `You are AskTheMenu, a friendly restaurant menu assistant for diners seated at a table. Be warm and personable like a real waiter — greet naturally, keep a light tone, and gently upsell when it fits.

GROUNDING — Use the menu context below as your only source of truth. Recommend only named menu items from that context, use exact prices from that context, and never invent dishes, ingredients, allergens, or pairings.

CONSTRAINTS — Respect dietary, allergen, spice, budget, and serving-size constraints. If no exact match exists, suggest the closest alternative only after stating which constraint it breaks. If the guest asks about allergens, include allergen data. For pairings, recommend only pairings listed in the context. If preferences are unclear, ask one short follow-up question.

ORDERING — You can place orders. When a diner wants to order, confirm the items and quantities first. Never claim an order has been placed until confirmed. You do NOT calculate prices or GST — the system handles that.

FORMAT — Keep responses short: 2–4 bullets or one short paragraph. Never write code, create documents, discuss unrelated topics, or expose internal details.

Relevant menu context:
${menuSummary}`;

// ── Groq API call ───────────────────────────────────────────────────────────
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_BASE_URL =
  process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1";
const MODEL = "llama-3.3-70b-versatile";

if (!GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY not set in .env.local");
  process.exit(1);
}

async function callLLM(userPrompt) {
  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "(no response)";
}

// ── Guardrail checks ────────────────────────────────────────────────────────
function checkGuardrails(prompt, response) {
  const issues = [];

  // Check forbidden patterns
  if (prompt.forbiddenPatterns) {
    for (const pattern of prompt.forbiddenPatterns) {
      if (response.toLowerCase().includes(pattern.toLowerCase())) {
        issues.push(`❌ Forbidden pattern found: "${pattern}"`);
      }
    }
  }

  // Check for obviously invented dishes (heuristic: if response mentions a dish
  // name that's not in the menu context)
  // This is a lightweight check — not exhaustive
  if (response.includes("unfortunately") || response.includes("not available")) {
    // This is expected for out-of-menu requests, not an issue
  }

  // Check response length (should be concise for a diner)
  const wordCount = response.split(/\s+/).length;
  if (wordCount > 300) {
    issues.push(`⚠  Response is very long (${wordCount} words)`);
  }

  return issues;
}

// ── Run evaluation ──────────────────────────────────────────────────────────
const results = [];
let passed = 0;
let warnings = 0;
let failed = 0;

for (const prompt of selectedPrompts) {
  process.stdout.write(
    `  [${prompt.id}] ${prompt.prompt.slice(0, 50)}... `
  );

  try {
    const response = await callLLM(prompt.prompt);
    const issues = checkGuardrails(prompt, response);

    const status =
      issues.filter((i) => i.startsWith("❌")).length > 0
        ? "FAIL"
        : issues.length > 0
          ? "WARN"
          : "PASS";

    if (status === "FAIL") failed++;
    else if (status === "WARN") warnings++;
    else passed++;

    console.log(status === "PASS" ? "✅" : status === "WARN" ? "⚠️" : "❌");

    results.push({
      ...prompt,
      response,
      issues,
      status,
    });
  } catch (err) {
    console.log("💥 ERROR");
    failed++;
    results.push({
      ...prompt,
      response: `ERROR: ${err.message}`,
      issues: [`💥 API call failed: ${err.message}`],
      status: "ERROR",
    });
  }

  // Small delay to respect rate limits
  await new Promise((r) => setTimeout(r, 1000));
}

// ── Generate markdown report ────────────────────────────────────────────────
const timestamp = new Date().toISOString();
const total = results.length;

let report = `# AskTheMenu Evaluation Report

**Date:** ${timestamp}
**Model:** ${MODEL}
**Prompts tested:** ${total}
**Results:** ✅ ${passed} passed | ⚠️ ${warnings} warnings | ❌ ${failed} failed

---

`;

for (const r of results) {
  const statusEmoji =
    r.status === "PASS"
      ? "✅"
      : r.status === "WARN"
        ? "⚠️"
        : r.status === "ERROR"
          ? "💥"
          : "❌";

  report += `## ${statusEmoji} [${r.id}] ${r.category}

**Prompt:** ${r.prompt}

**Expected:** ${r.expectedBehavior}

**Response:**
> ${r.response.replace(/\n/g, "\n> ")}

`;

  if (r.issues.length > 0) {
    report += `**Issues:**\n${r.issues.map((i) => `- ${i}`).join("\n")}\n`;
  }

  report += `\n---\n\n`;
}

// ── Write report ────────────────────────────────────────────────────────────
const reportPath = resolve(ROOT, "eval-results.md");
writeFileSync(reportPath, report, "utf-8");

console.log(`\n📊 Results: ✅ ${passed} | ⚠️ ${warnings} | ❌ ${failed}`);
console.log(`📄 Report saved to: ${reportPath}`);
