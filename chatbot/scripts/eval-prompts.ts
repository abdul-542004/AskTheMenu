/**
 * eval-prompts.ts
 *
 * A collection of ~25 test prompts across 8 categories for evaluating
 * the AskTheMenu chatbot. Each prompt includes the expected behavior
 * so the eval runner can perform basic checks.
 *
 * Categories:
 *   1. Allergen questions
 *   2. Budget questions
 *   3. Spice questions
 *   4. Pairing questions
 *   5. Dietary questions
 *   6. Multi-person recommendations
 *   7. Out-of-menu requests
 *   8. Order confirmation
 */

export type EvalPrompt = {
  id: string;
  category: string;
  prompt: string;
  /** What the response SHOULD contain or do */
  expectedBehavior: string;
  /** Strings that should NOT appear in the response (invented dishes, etc.) */
  forbiddenPatterns?: string[];
  /** If true, this prompt is included in the "quick" (5-prompt) run */
  quickRun: boolean;
};

export const evalPrompts: EvalPrompt[] = [
  // ── 1. Allergen Questions ──────────────────────────────────────────────────
  {
    id: "allergen-1",
    category: "allergen",
    prompt: "Do you have anything without dairy?",
    expectedBehavior:
      "Should recommend dishes that do not list dairy in allergens. Should not claim allergen-free without data support.",
    quickRun: true,
  },
  {
    id: "allergen-2",
    category: "allergen",
    prompt: "Is the Chicken Karahi gluten-free?",
    expectedBehavior:
      "Should check the allergen data for Chicken Karahi and answer based on what's listed. Should not guess.",
    quickRun: false,
  },
  {
    id: "allergen-3",
    category: "allergen",
    prompt: "I'm allergic to nuts. What can I eat?",
    expectedBehavior:
      "Should list dishes without 'nuts' in their allergens. Should warn about cross-contamination if relevant.",
    quickRun: false,
  },
  {
    id: "allergen-4",
    category: "allergen",
    prompt: "Does any dish contain shellfish?",
    expectedBehavior:
      "Should check allergen fields for 'shellfish' and list any matches, or say none are flagged.",
    quickRun: false,
  },
  {
    id: "allergen-5",
    category: "allergen",
    prompt: "My friend is lactose intolerant, what sides can she have?",
    expectedBehavior:
      "Should recommend sides without dairy allergens. Should not invent allergen data.",
    quickRun: false,
  },

  // ── 2. Budget Questions ────────────────────────────────────────────────────
  {
    id: "budget-1",
    category: "budget",
    prompt: "What's the best dish under PKR 1500?",
    expectedBehavior:
      "Should recommend dishes with pricePkr < 1500. Prices must match menu data exactly.",
    quickRun: false,
  },
  {
    id: "budget-2",
    category: "budget",
    prompt: "What can I get for PKR 500?",
    expectedBehavior:
      "Should list affordable items (sides, beverages, breads) within the PKR 500 range.",
    quickRun: false,
  },
  {
    id: "budget-3",
    category: "budget",
    prompt: "What's your most expensive dish?",
    expectedBehavior:
      "Should identify the highest-priced item from the menu context.",
    quickRun: true,
  },

  // ── 3. Spice Questions ─────────────────────────────────────────────────────
  {
    id: "spice-1",
    category: "spice",
    prompt: "What's your spiciest dish?",
    expectedBehavior:
      "Should recommend dishes with spiceLevel 'hot'. Should only use data from the menu.",
    quickRun: false,
  },
  {
    id: "spice-2",
    category: "spice",
    prompt: "I don't like spicy food, what do you recommend?",
    expectedBehavior:
      "Should recommend dishes with spiceLevel 'non-spicy' or 'mild'. Should not suggest 'hot' dishes.",
    quickRun: false,
  },
  {
    id: "spice-3",
    category: "spice",
    prompt: "Give me something medium spice in desi food",
    expectedBehavior:
      "Should filter for cuisineType 'desi' AND spiceLevel 'medium'.",
    quickRun: true,
  },

  // ── 4. Pairing Questions ───────────────────────────────────────────────────
  {
    id: "pairing-1",
    category: "pairing",
    prompt: "What goes well with biryani?",
    expectedBehavior:
      "Should recommend pairings listed in the biryani menu item's 'pairings' field.",
    quickRun: false,
  },
  {
    id: "pairing-2",
    category: "pairing",
    prompt: "What drink pairs with the Chicken Karahi?",
    expectedBehavior:
      "Should check the pairings field for Chicken Karahi and suggest listed beverages.",
    quickRun: false,
  },
  {
    id: "pairing-3",
    category: "pairing",
    prompt: "I'm having naan, what main course should I get?",
    expectedBehavior:
      "Should suggest main courses that list naan in their pairings or are commonly paired with bread.",
    quickRun: false,
  },

  // ── 5. Dietary Questions ───────────────────────────────────────────────────
  {
    id: "dietary-1",
    category: "dietary",
    prompt: "Do you have vegan options?",
    expectedBehavior:
      "Should list dishes with dietary 'vegan'. Should not suggest non-vegan dishes.",
    quickRun: false,
  },
  {
    id: "dietary-2",
    category: "dietary",
    prompt: "What vegetarian dishes do you have?",
    expectedBehavior:
      "Should list dishes with dietary 'vegetarian' or 'vegan'. Should not include non-vegetarian items.",
    quickRun: false,
  },
  {
    id: "dietary-3",
    category: "dietary",
    prompt: "I only eat non-veg. What's your best chicken dish?",
    expectedBehavior:
      "Should suggest non-vegetarian chicken dishes. Should mention specialties if relevant.",
    quickRun: true,
  },

  // ── 6. Multi-person Recommendations ────────────────────────────────────────
  {
    id: "multi-1",
    category: "multi-person",
    prompt: "What should two people order?",
    expectedBehavior:
      "Should suggest a mix of shareable dishes and individual servings. Should consider variety.",
    quickRun: false,
  },
  {
    id: "multi-2",
    category: "multi-person",
    prompt: "We're a group of 4, suggest a spread",
    expectedBehavior:
      "Should recommend a balanced spread with variety across cuisines, including sides and drinks.",
    quickRun: false,
  },
  {
    id: "multi-3",
    category: "multi-person",
    prompt:
      "I'm ordering for two, one person likes spicy and the other doesn't",
    expectedBehavior:
      "Should suggest one spicy and one mild/non-spicy dish. Should acknowledge both preferences.",
    quickRun: false,
  },

  // ── 7. Out-of-menu Requests ────────────────────────────────────────────────
  {
    id: "oom-1",
    category: "out-of-menu",
    prompt: "Do you have pizza?",
    expectedBehavior:
      "Should say pizza is not on the menu. Should suggest a similar alternative from the menu.",
    forbiddenPatterns: ["Yes, we have pizza", "Our pizza"],
    quickRun: false,
  },
  {
    id: "oom-2",
    category: "out-of-menu",
    prompt: "Can I get sushi?",
    expectedBehavior:
      "Should say sushi is not available. Should suggest a similar alternative (e.g. Chinese or seafood options).",
    forbiddenPatterns: ["Yes, we have sushi", "Our sushi"],
    quickRun: true,
  },

  // ── 8. Order Confirmation ──────────────────────────────────────────────────
  {
    id: "order-1",
    category: "order",
    prompt: "I want 2x Chicken Karahi and 1x Garlic Naan",
    expectedBehavior:
      "Should confirm the items and quantities with the diner before calling placeOrder. Should NOT call placeOrder without confirmation.",
    quickRun: false,
  },
  {
    id: "order-2",
    category: "order",
    prompt: "Place my order",
    expectedBehavior:
      "Should ask what the diner wants to order since no items were specified. Should NOT call placeOrder with empty items.",
    quickRun: false,
  },
  {
    id: "order-3",
    category: "order",
    prompt: "I'll have the Malai Boti, make it extra spicy please",
    expectedBehavior:
      "Should confirm the order (1x Malai Boti with note 'extra spicy') and ask for confirmation before placing.",
    quickRun: false,
  },
];

/**
 * Returns only the prompts marked for the quick (5-prompt) evaluation run.
 * These cover one prompt from each broad category for a fast sanity check.
 */
export function getQuickRunPrompts(): EvalPrompt[] {
  return evalPrompts.filter((p) => p.quickRun);
}

/**
 * Returns all prompts, optionally filtered by category.
 */
export function getPromptsByCategory(category?: string): EvalPrompt[] {
  if (!category) return evalPrompts;
  return evalPrompts.filter((p) => p.category === category);
}
