import { hasDatabaseUrl } from "@/lib/db/url";
import { menuItems } from "@/lib/menu/catalog";
import type { MenuItem } from "@/lib/menu/schema";

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

const allergenAliases: Record<string, string[]> = {
  dairy: ["dairy", "milk", "cheese", "cream", "butter", "yogurt", "yoghurt"],
  eggs: ["egg", "eggs", "mayo", "mayonnaise"],
  gluten: ["gluten", "wheat", "bread"],
  nuts: ["nut", "nuts", "peanut", "peanuts", "cashew", "almond"],
  seafood: ["seafood", "fish", "prawn", "prawns", "shellfish"],
  sesame: ["sesame"],
  soy: ["soy", "soya"],
};

const cuisineAliases: Record<MenuItem["cuisineType"], string[]> = {
  desi: ["desi", "pakistani", "south asian", "traditional"],
  chinese: ["chinese", "noodles", "fried rice", "manchurian"],
  continental: ["continental", "western", "steak", "pasta", "burger"],
  fusion: ["fusion"],
  staple: ["side", "sides", "bread", "drink", "beverage"],
};

const proteinTerms = ["chicken", "beef", "mutton", "fish", "prawn", "paneer"];

export type MenuIntent =
  | "recommendation"
  | "availability"
  | "dietary"
  | "allergen"
  | "pairing"
  | "budget"
  | "group_order";

export type MenuQueryProfile = {
  intent: MenuIntent;
  budgetPkr?: number;
  dietary?: MenuItem["dietary"];
  avoidedAllergens: string[];
  spicePreference?: MenuItem["spiceLevel"] | "spicy";
  cuisines: MenuItem["cuisineType"][];
  proteins: string[];
  wantsShareable: boolean;
  mentionedItemNames: string[];
};

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseBudgetPkr(query: string) {
  const normalized = query.toLowerCase().replace(/,/g, "");
  const budgetMatch = normalized.match(
    /(?:under|below|less than|within|up to|upto|max(?:imum)?|budget(?: of)?|around)\s*(?:pkr|rs\.?|rupees)?\s*(\d{2,6})|(?:pkr|rs\.?|rupees)\s*(\d{2,6})/
  );

  const amount = budgetMatch?.[1] ?? budgetMatch?.[2];
  return amount ? Number.parseInt(amount, 10) : undefined;
}

function getDietaryPreference(query: string): MenuQueryProfile["dietary"] {
  const normalized = normalizeText(query);

  if (/\bvegan\b/.test(normalized)) {
    return "vegan";
  }

  if (/\bveg\b|\bvegetarian\b/.test(normalized)) {
    return "vegetarian";
  }

  if (
    /\bnon veg\b|\bnon vegetarian\b|\bmeat\b|\bchicken\b|\bbeef\b|\bmutton\b|\bfish\b|\bprawn\b/.test(
      normalized
    )
  ) {
    return "non-vegetarian";
  }

  return undefined;
}

function getAvoidedAllergens(query: string) {
  const normalized = normalizeText(query);
  const hasAvoidanceLanguage =
    /\b(no|without|avoid|allergic|allergy|free|cannot have|can t have|dont have|don t have)\b/.test(
      normalized
    );

  if (!hasAvoidanceLanguage) {
    return [];
  }

  return Object.entries(allergenAliases)
    .filter(([, aliases]) =>
      aliases.some((alias) => normalized.includes(normalizeText(alias)))
    )
    .map(([allergen]) => allergen);
}

function getSpicePreference(
  query: string
): MenuQueryProfile["spicePreference"] {
  const normalized = normalizeText(query);

  if (
    /\bnon spicy\b|\bnot spicy\b|\bno spice\b|\bno spicy\b/.test(normalized)
  ) {
    return "non-spicy";
  }

  if (/\bmild\b/.test(normalized)) {
    return "mild";
  }

  if (/\bmedium\b/.test(normalized)) {
    return "medium";
  }

  if (/\bhot\b|\bspicy\b|\bchilli\b|\bchili\b/.test(normalized)) {
    return "spicy";
  }

  return undefined;
}

function getCuisines(query: string) {
  const normalized = normalizeText(query);

  return Object.entries(cuisineAliases)
    .filter(([, aliases]) =>
      aliases.some((alias) => normalized.includes(normalizeText(alias)))
    )
    .map(([cuisine]) => cuisine as MenuItem["cuisineType"]);
}

function getProteins(query: string) {
  const normalized = normalizeText(query);
  return proteinTerms.filter((protein) => normalized.includes(protein));
}

function getMentionedItems(query: string) {
  const normalized = normalizeText(query);
  const directMatches = menuItems.filter((item) =>
    normalized.includes(normalizeText(item.name))
  );

  if (directMatches.length > 0) {
    return directMatches.map((item) => item.name);
  }

  return menuItems
    .filter((item) =>
      normalizeText(item.name)
        .split(" ")
        .some(
          (token) =>
            token.length > 4 &&
            normalized.includes(token) &&
            !["chicken", "spicy"].includes(token)
        )
    )
    .map((item) => item.name);
}

export function classifyMenuIntent(query: string): MenuQueryProfile {
  const normalized = normalizeText(query);
  const budgetPkr = parseBudgetPkr(query);
  const dietary = getDietaryPreference(query);
  const avoidedAllergens = getAvoidedAllergens(query);
  const wantsShareable =
    /\b(two|2|couple|people|persons|group|share|sharing|family)\b/.test(
      normalized
    );

  let intent: MenuIntent = "recommendation";

  if (
    /\b(pair|pairs|pairing|goes with|go with|alongside|side with)\b/.test(
      normalized
    )
  ) {
    intent = "pairing";
  } else if (budgetPkr !== undefined) {
    intent = "budget";
  } else if (avoidedAllergens.length > 0) {
    intent = "allergen";
  } else if (dietary && dietary !== "non-vegetarian") {
    intent = "dietary";
  } else if (wantsShareable) {
    intent = "group_order";
  } else if (/\bdo you have\b|\bavailable\b|\bserve\b/.test(normalized)) {
    intent = "availability";
  }

  return {
    intent,
    budgetPkr,
    dietary,
    avoidedAllergens,
    spicePreference: getSpicePreference(query),
    cuisines: getCuisines(query),
    proteins: getProteins(query),
    wantsShareable,
    mentionedItemNames: getMentionedItems(query),
  };
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

function itemHasAvoidedAllergen(item: MenuItem, avoidedAllergens: string[]) {
  return item.allergens.some((itemAllergen) =>
    avoidedAllergens.some((avoided) =>
      normalizeText(itemAllergen).includes(normalizeText(avoided))
    )
  );
}

function matchesDietary(item: MenuItem, dietary?: MenuItem["dietary"]) {
  if (!dietary) {
    return true;
  }

  if (dietary === "vegetarian") {
    return item.dietary === "vegetarian" || item.dietary === "vegan";
  }

  return item.dietary === dietary;
}

function getPairedItems(targetItems: MenuItem[]) {
  const targetNames = new Set(targetItems.map((item) => item.name));
  const pairingNames = new Set(targetItems.flatMap((item) => item.pairings));

  return menuItems.filter(
    (item) =>
      pairingNames.has(item.name) ||
      item.pairings.some((pairing) => targetNames.has(pairing))
  );
}

function uniqueItems(items: MenuItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

function getIntentInstruction(profile: MenuQueryProfile) {
  switch (profile.intent) {
    case "allergen":
      return `The guest is avoiding ${profile.avoidedAllergens.join(", ")}. Do not recommend items containing those allergens.`;
    case "budget":
      return `The guest asked for options under PKR ${profile.budgetPkr}. Keep recommendations within that budget.`;
    case "dietary":
      return `The guest asked for ${profile.dietary} options. Recommend only matching dishes.`;
    case "group_order":
      return "The guest is ordering for more than one person. Prefer shareable dishes or a concise combination.";
    case "pairing":
      return "The guest is asking what pairs well with a menu item. Answer with pairings from the menu context.";
    case "availability":
      return "The guest is checking availability. Answer from the menu context only.";
    default:
      return "The guest is asking for a recommendation. Offer the best grounded options from the menu context.";
  }
}

function shouldUseStructuredRetrieval(profile: MenuQueryProfile) {
  return (
    profile.intent !== "recommendation" ||
    profile.budgetPkr !== undefined ||
    profile.dietary !== undefined ||
    profile.avoidedAllergens.length > 0 ||
    profile.wantsShareable
  );
}

export function getRelevantMenuItems(
  query: string,
  limit = 12,
  profile = classifyMenuIntent(query)
) {
  const expandedQuery = [
    query,
    profile.spicePreference === "spicy" ? "hot medium" : "",
    profile.wantsShareable ? "shareable" : "",
    profile.dietary ?? "",
    profile.cuisines.join(" "),
    profile.proteins.join(" "),
  ].join(" ");
  const tokens = tokenize(expandedQuery);
  const mentionedItems = menuItems.filter((item) =>
    profile.mentionedItemNames.includes(item.name)
  );

  if (profile.intent === "pairing" && mentionedItems.length > 0) {
    const pairedItems = getPairedItems(mentionedItems);
    return uniqueItems([...mentionedItems, ...pairedItems]).slice(0, limit);
  }

  if (tokens.length === 0) {
    return menuItems.filter((item) => item.specialty).slice(0, limit);
  }

  return menuItems
    .filter((item) => {
      if (
        profile.budgetPkr !== undefined &&
        item.price.amount > profile.budgetPkr
      ) {
        return false;
      }

      if (!matchesDietary(item, profile.dietary)) {
        return false;
      }

      if (itemHasAvoidedAllergen(item, profile.avoidedAllergens)) {
        return false;
      }

      return true;
    })
    .map((item) => {
      const searchable = itemText(item);
      const score = tokens.reduce(
        (total, token) => {
          if (item.name.toLowerCase().includes(token)) {
            return total + 4;
          }
          if (searchable.includes(token)) {
            return total + 1;
          }
          return total;
        },
        item.specialty ? 0.25 : 0
      );

      const constraintScore =
        (profile.wantsShareable && item.serving === "shareable" ? 3 : 0) +
        (profile.spicePreference === "spicy" && item.spiceLevel === "hot"
          ? 3
          : 0) +
        (profile.spicePreference === "spicy" && item.spiceLevel === "medium"
          ? 1
          : 0) +
        (profile.spicePreference &&
        profile.spicePreference !== "spicy" &&
        item.spiceLevel === profile.spicePreference
          ? 2
          : 0) +
        (profile.cuisines.includes(item.cuisineType) ? 2 : 0) +
        (profile.proteins.some((protein) => itemText(item).includes(protein))
          ? 3
          : 0) +
        (profile.mentionedItemNames.includes(item.name) ? 8 : 0);

      return { item, score: score + constraintScore };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item);
}

function buildKeywordMenuContext(
  query: string,
  profile = classifyMenuIntent(query)
) {
  const relevantItems = getRelevantMenuItems(query, 12, profile);

  if (relevantItems.length === 0) {
    return [
      `Detected intent: ${profile.intent}.`,
      getIntentInstruction(profile),
      "No menu items matched the requested constraints. Say that clearly, then ask one short follow-up question or explain available cuisines: desi, chinese, continental, fusion, staples, beverages.",
    ].join("\n");
  }

  return [
    `Detected intent: ${profile.intent}.`,
    getIntentInstruction(profile),
    "Relevant menu items:",
    ...relevantItems.map(
      (item) =>
        `- ${item.name}: ${item.cuisineType}, ${item.dietary}, spice ${item.spiceLevel}, allergens ${item.allergens.length ? item.allergens.join(", ") : "none"}, ingredients ${item.ingredients.join(", ")}, pairings ${item.pairings.join(", ") || "none"}, serving ${item.serving}${item.portionLabel !== item.serving ? ` (${item.portionLabel})` : ""}, price ${item.price.display}${item.specialty ? ", specialty" : ""}`
    ),
  ].join("\n");
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
  const profile = classifyMenuIntent(query);

  if (
    !shouldUseStructuredRetrieval(profile) &&
    hasDatabaseUrl() &&
    process.env.GOOGLE_API_KEY
  ) {
    try {
      const { buildVectorMenuContext } = await import(
        "@/lib/menu/vector-search"
      );
      const vectorContext = await buildVectorMenuContext(
        query,
        restaurantId,
        12
      );

      if (vectorContext) {
        return [
          `Detected intent: ${profile.intent}.`,
          getIntentInstruction(profile),
          "Relevant menu items:",
          vectorContext,
        ].join("\n");
      }
    } catch (error) {
      // Vector search failed — fall through to keyword search.
      console.warn(
        "Vector search unavailable, falling back to keyword search:",
        error
      );
    }
  }

  // Keyword fallback
  return buildKeywordMenuContext(query, profile);
}
