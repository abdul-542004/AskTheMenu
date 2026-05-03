import "server-only";

import { GoogleGenAI } from "@google/genai";
import postgres from "postgres";
import { traceError, traceLog } from "@/lib/ai/trace";
import { getDatabaseUrl, isSupabasePoolerUrl } from "@/lib/db/url";

const EMBEDDING_MODEL = "gemini-embedding-2-preview";
const DEFAULT_LIMIT = 8;

// ── Database Connection ─────────────────────────────────────────────────────

const databaseUrl = getDatabaseUrl();
const isSupabasePooler = isSupabasePoolerUrl(databaseUrl);

const sql = postgres(
  databaseUrl || "postgres://postgres:postgres@127.0.0.1:65432/postgres",
  {
    connect_timeout: 1,
    prepare: databaseUrl ? !isSupabasePooler : false,
  }
);

// ── Gemini Client ───────────────────────────────────────────────────────────

const googleApiKey = process.env.GOOGLE_API_KEY;

let genai: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!genai) {
    if (!googleApiKey) {
      throw new Error(
        "GOOGLE_API_KEY is required for vector search. Set it in .env.local"
      );
    }
    genai = new GoogleGenAI({ apiKey: googleApiKey });
  }
  return genai;
}

// ── Query Embedding ─────────────────────────────────────────────────────────

async function embedQuery(queryText: string): Promise<number[]> {
  const client = getGenAI();

  traceLog("model.gemini.request", {
    operation: "query_embedding",
    model: EMBEDDING_MODEL,
    taskType: "RETRIEVAL_QUERY",
    input: queryText,
  });

  const response = await client.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: queryText,
    config: {
      taskType: "RETRIEVAL_QUERY",
    },
  });

  const embedding = response.embeddings?.[0]?.values;
  if (!embedding) {
    throw new Error("Failed to generate query embedding");
  }

  traceLog("model.gemini.response", {
    operation: "query_embedding",
    model: EMBEDDING_MODEL,
    dimensions: embedding.length,
    used: true,
  });

  return embedding;
}

// ── Vector Search ───────────────────────────────────────────────────────────

export type VectorSearchResult = {
  id: string;
  name: string;
  ingredients: string[];
  allergens: string[];
  dietary: string;
  spiceLevel: string;
  cuisineType: string;
  specialty: boolean;
  pairings: string[];
  pricePkr: number;
  unitLabel: string;
  serving: string;
  similarity: number;
};

/**
 * Search menu items by semantic similarity using PGVector cosine distance.
 *
 * @param query - User's natural language query
 * @param restaurantId - Optional restaurant UUID. If omitted, searches all.
 * @param limit - Maximum number of results (default 8)
 * @returns Matching menu items sorted by relevance
 */
export async function searchMenuByVector(
  query: string,
  restaurantId?: string,
  limit: number = DEFAULT_LIMIT
): Promise<VectorSearchResult[]> {
  const normalizedRestaurantId =
    typeof restaurantId === "string" && restaurantId.trim().length > 0
      ? restaurantId.trim()
      : undefined;

  traceLog("retrieval.vector_search.started", {
    query,
    restaurantId: normalizedRestaurantId,
    limit,
    embeddingModel: EMBEDDING_MODEL,
  });

  // Generate embedding for the user's query
  const queryVector = await embedQuery(query);
  const vectorLiteral = `[${queryVector.join(",")}]`;

  // Cosine similarity search via PGVector's <=> operator
  // Lower distance = more similar, so we order ascending
  // Similarity = 1 - distance
  const results = normalizedRestaurantId
    ? await sql`
        SELECT
          mi."id",
          mi."name",
          mi."ingredients",
          mi."allergens",
          mi."dietary",
          mi."spiceLevel",
          mi."cuisineType",
          mi."specialty",
          mi."pairings",
          mi."pricePkr",
          mi."unitLabel",
          mi."serving",
          1 - (mie."embedding" <=> ${vectorLiteral}::vector) AS similarity
        FROM "MenuItemEmbedding" mie
        JOIN "MenuItem" mi ON mi."id" = mie."menuItemId"
        WHERE mie."restaurantId" = ${normalizedRestaurantId}
          AND mie."model" = ${EMBEDDING_MODEL}
          AND mi."isAvailable" = true
        ORDER BY mie."embedding" <=> ${vectorLiteral}::vector ASC
        LIMIT ${limit}
      `
    : await sql`
        SELECT
          mi."id",
          mi."name",
          mi."ingredients",
          mi."allergens",
          mi."dietary",
          mi."spiceLevel",
          mi."cuisineType",
          mi."specialty",
          mi."pairings",
          mi."pricePkr",
          mi."unitLabel",
          mi."serving",
          1 - (mie."embedding" <=> ${vectorLiteral}::vector) AS similarity
        FROM "MenuItemEmbedding" mie
        JOIN "MenuItem" mi ON mi."id" = mie."menuItemId"
        WHERE mie."model" = ${EMBEDDING_MODEL}
          AND mi."isAvailable" = true
        ORDER BY mie."embedding" <=> ${vectorLiteral}::vector ASC
        LIMIT ${limit}
      `;

  const mappedResults = results.map((row) => ({
    id: row.id,
    name: row.name,
    ingredients: row.ingredients ?? [],
    allergens: row.allergens ?? [],
    dietary: row.dietary,
    spiceLevel: row.spiceLevel,
    cuisineType: row.cuisineType,
    specialty: row.specialty ?? false,
    pairings: row.pairings ?? [],
    pricePkr: row.pricePkr,
    unitLabel: row.unitLabel ?? "serving",
    serving: row.serving,
    similarity: Number.parseFloat(row.similarity),
  }));

  traceLog("retrieval.vector_search.completed", {
    query,
    restaurantId: normalizedRestaurantId,
    limit,
    resultCount: mappedResults.length,
    results: mappedResults.map((item) => ({
      name: item.name,
      similarity: item.similarity,
      pricePkr: item.pricePkr,
      dietary: item.dietary,
      allergens: item.allergens,
    })),
  });

  return mappedResults;
}

/**
 * Build a formatted menu context string from vector search results,
 * suitable for injecting into an LLM system prompt.
 *
 * Returns the formatted context string or throws an error if vector search fails.
 */
export async function buildVectorMenuContext(
  query: string,
  restaurantId?: string,
  limit: number = DEFAULT_LIMIT
): Promise<string | null> {
  const results = await searchMenuByVector(query, restaurantId, limit);

  if (results.length === 0) {
    return null;
  }

  return results
    .map(
      (item) =>
        `- ${item.name}: ${item.cuisineType}, ${item.dietary}, spice ${item.spiceLevel}, allergens ${item.allergens.length ? item.allergens.join(", ") : "none"}, ingredients ${item.ingredients.join(", ")}, pairings ${item.pairings.join(", ") || "none"}, serving ${item.serving}${item.unitLabel === item.serving ? "" : ` (${item.unitLabel})`}, price PKR ${item.pricePkr}/${item.unitLabel}${item.specialty ? ", specialty" : ""}`
    )
    .join("\n");
}

// ── Name-based Recall Lookup ────────────────────────────────────────────────

const MAX_RECALL_ITEMS = 5;

/**
 * Fetch menu items by exact name (case-insensitive).
 *
 * Used to recall previously-discussed dishes without an embedding call.
 * Returns the same `VectorSearchResult` shape with `similarity` set to 1.0.
 */
export async function fetchMenuItemsByName(
  names: string[],
  restaurantId?: string
): Promise<VectorSearchResult[]> {
  if (names.length === 0) {
    return [];
  }

  const normalizedRestaurantId =
    typeof restaurantId === "string" && restaurantId.trim().length > 0
      ? restaurantId.trim()
      : undefined;

  // Deduplicate & cap
  const uniqueNames = [...new Set(names)].slice(0, MAX_RECALL_ITEMS);

  traceLog("retrieval.name_lookup.started", {
    names: uniqueNames,
    restaurantId: normalizedRestaurantId,
  });

  try {
    const results = normalizedRestaurantId
      ? await sql`
          SELECT
            "id", "name", "ingredients", "allergens", "dietary",
            "spiceLevel", "cuisineType", "specialty", "pairings",
            "pricePkr", "unitLabel", "serving"
          FROM "MenuItem"
          WHERE "name" ILIKE ANY(${uniqueNames})
            AND "isAvailable" = true
            AND "restaurantId" = ${normalizedRestaurantId}
          LIMIT ${MAX_RECALL_ITEMS}
        `
      : await sql`
          SELECT
            "id", "name", "ingredients", "allergens", "dietary",
            "spiceLevel", "cuisineType", "specialty", "pairings",
            "pricePkr", "unitLabel", "serving"
          FROM "MenuItem"
          WHERE "name" ILIKE ANY(${uniqueNames})
            AND "isAvailable" = true
          LIMIT ${MAX_RECALL_ITEMS}
        `;

    const mapped = results.map((row) => ({
      id: row.id,
      name: row.name,
      ingredients: row.ingredients ?? [],
      allergens: row.allergens ?? [],
      dietary: row.dietary,
      spiceLevel: row.spiceLevel,
      cuisineType: row.cuisineType,
      specialty: row.specialty ?? false,
      pairings: row.pairings ?? [],
      pricePkr: row.pricePkr,
      unitLabel: row.unitLabel ?? "serving",
      serving: row.serving,
      similarity: 1.0, // exact match by name
    }));

    traceLog("retrieval.name_lookup.completed", {
      requestedNames: uniqueNames,
      foundCount: mapped.length,
      foundNames: mapped.map((m) => m.name),
    });

    return mapped;
  } catch (error) {
    traceError("retrieval.name_lookup.failed", {
      names: uniqueNames,
      restaurantId: normalizedRestaurantId,
      error,
    });
    return [];
  }
}
