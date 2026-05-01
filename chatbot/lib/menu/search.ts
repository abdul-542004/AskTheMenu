import { menuItems } from "@/lib/menu/catalog";
import type { MenuItem } from "@/lib/menu/schema";
import { buildVectorMenuContext } from "@/lib/menu/vector-search";

// ── Keyword-based search (fallback) ─────────────────────────────────────────

const stopWords = new Set([
  "about",
  "after",
  "also",
  "anything",
  "avoid",
  "best",
  "dish",
  "dishes",
  "food",
  "have",
  "like",
  "menu",
  "order",
  "people",
  "please",
  "recommend",
  "recommendation",
  "serve",
  "share",
  "should",
  "something",
  "under",
  "what",
  "which",
  "with",
  "would",
]);

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function itemText(item: MenuItem) {
  return [
    item.name,
    item.ingredients.join(" "),
    item.allergens.join(" "),
    item.dietary,
    item.spiceLevel,
    item.cuisineType,
    item.pairings.join(" "),
    item.serving,
    item.portionLabel,
  ]
    .join(" ")
    .toLowerCase();
}

export function getRelevantMenuItems(query: string, limit = 12) {
  const tokens = tokenize(query);

  if (tokens.length === 0) {
    return menuItems
      .filter((item) => item.specialty)
      .slice(0, limit);
  }

  return menuItems
    .map((item) => {
      const searchable = itemText(item);
      const score = tokens.reduce((total, token) => {
        if (item.name.toLowerCase().includes(token)) {
          return total + 4;
        }
        if (searchable.includes(token)) {
          return total + 1;
        }
        return total;
      }, item.specialty ? 0.25 : 0);

      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item);
}

function buildKeywordMenuContext(query: string) {
  const relevantItems = getRelevantMenuItems(query);

  if (relevantItems.length === 0) {
    return "No strong menu matches were found. Ask a short follow-up question or explain available cuisines: desi, chinese, continental, fusion, staples, beverages.";
  }

  return relevantItems
    .map(
      (item) =>
        `- ${item.name}: ${item.cuisineType}, ${item.dietary}, spice ${item.spiceLevel}, allergens ${item.allergens.length ? item.allergens.join(", ") : "none"}, ingredients ${item.ingredients.join(", ")}, pairings ${item.pairings.join(", ") || "none"}, serving ${item.serving}${item.portionLabel !== item.serving ? ` (${item.portionLabel})` : ""}, price ${item.price.display}${item.specialty ? ", specialty" : ""}`
    )
    .join("\n");
}

// ── Hybrid search: vector first, keyword fallback ───────────────────────────

/**
 * Builds menu context for the LLM system prompt.
 *
 * Strategy:
 * 1. Try vector search first (semantic similarity via Gemini embeddings)
 * 2. Fall back to keyword search if vector search fails or returns nothing
 *
 * This ensures the chatbot always has menu context, even if embeddings
 * haven't been ingested yet or the embedding API is temporarily unavailable.
 */
export async function buildMenuContext(
  query: string,
  restaurantId?: string
): Promise<string> {
  // Try vector search first
  try {
    const vectorContext = await buildVectorMenuContext(
      query,
      restaurantId,
      12
    );

    if (vectorContext) {
      return vectorContext;
    }
  } catch (error) {
    // Vector search failed — fall through to keyword search
    console.warn("Vector search unavailable, falling back to keyword search:", error);
  }

  // Keyword fallback
  return buildKeywordMenuContext(query);
}
