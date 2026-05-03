import { traceError, traceLog } from "@/lib/ai/trace";
import { hasDatabaseUrl } from "@/lib/db/url";

/**
 * Builds menu context for the LLM system prompt using RAG only.
 *
 * Strategy:
 * 1. Rewrite the query to enhance retrieval quality
 * 2. Use vector search (semantic similarity via Gemini embeddings)
 * 3. Fail if vector search is unavailable
 *
 * This is a pure RAG approach without keyword fallback.
 */
export async function buildMenuContext(
  query: string,
  restaurantId?: string
): Promise<string> {
  if (!query.trim()) {
    traceLog("retrieval.skipped", {
      reason: "empty_query",
      restaurantId,
    });
    return "No menu context was retrieved because the query was empty.";
  }

  const databaseConfigured = hasDatabaseUrl();
  const googleConfigured = Boolean(process.env.GOOGLE_API_KEY);

  traceLog("retrieval.plan", {
    query,
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
      query,
      restaurantId,
      error,
    });
    throw new Error(error);
  }

  try {
    // The incoming `query` is expected to be rewritten by the LLM-based
    // rewriter upstream (only LLM rewriter enabled). Use it as-is.
    const rewrittenQuery = query;

    traceLog("retrieval.query_rewritten", {
      originalQuery: query,
      rewrittenQuery,
      note: "assumes LLM rewriter applied upstream",
    });

    const { buildVectorMenuContext } = await import("@/lib/menu/vector-search");
    const vectorContext = await buildVectorMenuContext(
      rewrittenQuery,
      restaurantId,
      12
    );

    if (!vectorContext) {
      const error = `No relevant menu items found for query: "${query}"`;
      traceError("retrieval.rag_no_results", {
        query,
        rewrittenQuery,
        restaurantId,
        error,
      });
      throw new Error(error);
    }

    const context = `Relevant menu items for the query "${query}":\n${vectorContext}`;

    traceLog("retrieval.selected", {
      strategy: "rag_only",
      geminiUsed: true,
      originalQuery: query,
      rewrittenQuery,
      restaurantId,
      resultCount: vectorContext.split("\n").length,
      context,
    });

    return context;
  } catch (error) {
    traceError("retrieval.rag_failed", {
      query,
      restaurantId,
      error,
    });
    throw error;
  }
}
