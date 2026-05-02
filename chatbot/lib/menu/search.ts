import { traceError, traceLog } from "@/lib/ai/trace";
import { hasDatabaseUrl } from "@/lib/db/url";

/** Maximum combined items (primary + recalled) in the context */
const MAX_CONTEXT_ITEMS = 15;
/** Primary vector search limit */
const PRIMARY_SEARCH_LIMIT = 8;

/**
 * Builds menu context for the LLM system prompt using RAG with
 * context accumulation for previously-discussed items.
 *
 * Strategy:
 * 1. Vector search for the current search query (primary results)
 * 2. Name-based lookup for recall items not already in primary results
 * 3. Merge, deduplicate, and cap to keep token budget flat
 */
export async function buildMenuContext(
  searchQuery: string,
  recallItems: string[] = [],
  restaurantId?: string
): Promise<string> {
  const databaseConfigured = hasDatabaseUrl();
  const googleConfigured = Boolean(process.env.GOOGLE_API_KEY);

  traceLog("retrieval.plan", {
    searchQuery,
    recallItems,
    restaurantId,
    ragOnly: true,
    vectorEligible: databaseConfigured && googleConfigured,
    missingDependencies: [
      databaseConfigured ? null : "database_url_missing",
      googleConfigured ? null : "google_api_key_missing",
    ].filter(Boolean),
  });

  if (!databaseConfigured || !googleConfigured) {
    const error =
      "RAG requires both GOOGLE_API_KEY and DATABASE_URL. Configure them in .env.local";
    traceError("retrieval.rag_unavailable", {
      searchQuery,
      restaurantId,
      error,
    });
    throw new Error(error);
  }

  try {
    const { buildVectorMenuContext, fetchMenuItemsByName } = await import(
      "@/lib/menu/vector-search"
    );

    // ── Step 1: Primary vector search ───────────────────────────────────
    const vectorContext = await buildVectorMenuContext(
      searchQuery,
      restaurantId,
      PRIMARY_SEARCH_LIMIT
    );

    // Parse the vector context back into item names for dedup
    // Each line starts with "- ItemName: ..."
    const primaryNames = new Set<string>();
    const primaryLines: string[] = [];
    if (vectorContext) {
      for (const line of vectorContext.split("\n")) {
        primaryLines.push(line);
        const match = line.match(/^- ([^:]+):/);
        if (match) {
          primaryNames.add(match[1].trim().toLowerCase());
        }
      }
    }

    // ── Step 2: Recall previously-discussed items ───────────────────────
    // Find which recall items are missing from the primary results
    const missingRecallNames = recallItems.filter(
      (name) => !primaryNames.has(name.toLowerCase())
    );

    let recalledLines: string[] = [];

    if (missingRecallNames.length > 0) {
      const remaining = MAX_CONTEXT_ITEMS - primaryLines.length;
      if (remaining > 0) {
        const recalledItems = await fetchMenuItemsByName(
          missingRecallNames,
          restaurantId
        );

        // Use a compact format for recalled items (no ingredients list)
        // to save tokens — the user already discussed these, so they
        // need a reminder, not a full description
        recalledLines = recalledItems.slice(0, remaining).map(
          (item) =>
            `- ${item.name}: ${item.cuisineType}, ${item.dietary}, spice ${item.spiceLevel}, allergens ${item.allergens.length ? item.allergens.join(", ") : "none"}, pairings ${item.pairings.join(", ") || "none"}, price PKR ${item.pricePkr}/${item.unitLabel}${item.specialty ? ", specialty" : ""}`
        );
      }
    }

    // ── Step 3: Merge ───────────────────────────────────────────────────
    if (primaryLines.length === 0 && recalledLines.length === 0) {
      const error = `No relevant menu items found for query: "${searchQuery}"`;
      traceError("retrieval.rag_no_results", {
        searchQuery,
        recallItems,
        restaurantId,
        error,
      });
      throw new Error(error);
    }

    // Build the combined context with clear sections
    const parts: string[] = [];

    if (primaryLines.length > 0) {
      parts.push(primaryLines.join("\n"));
    }

    if (recalledLines.length > 0) {
      parts.push(
        `Previously discussed items (still on the menu):\n${recalledLines.join("\n")}`
      );
    }

    const context = `Relevant menu items for the query "${searchQuery}":\n${parts.join("\n\n")}`;

    traceLog("retrieval.selected", {
      strategy: "rag_with_recall",
      geminiUsed: true,
      searchQuery,
      recallItems,
      restaurantId,
      primaryCount: primaryLines.length,
      recalledCount: recalledLines.length,
      totalCount: primaryLines.length + recalledLines.length,
      context,
    });

    return context;
  } catch (error) {
    traceError("retrieval.rag_failed", {
      searchQuery,
      recallItems,
      restaurantId,
      error,
    });
    throw error;
  }
}
