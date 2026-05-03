import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..", "..");
const menuPath = join(rootDir, "Menu.md");
const outputPath = join(__dirname, "..", "data", "menu.json");
const reportPath = join(__dirname, "..", "data", "menu-validation.json");
const expectedSectionCount = 20;
const sectionToCuisineType = {
  "Desi Cuisines": "desi",
  Chinese: "chinese",
  Continental: "continental",
  Fusion: "fusion",
  Staple: "staple",
};
const requiredFields = [
  "Ingredients",
  "Allergens",
  "Dietary",
  "Spice Level",
  "Cuisine Type",
  "Specialty",
  "Pairings",
  "Serving",
  "Price",
];

const pairingAliasMap = {
  "all curries": "Chicken Karahi",
  "all fast food": "Beef Burger",
  "all meals": "Chicken Biryani",
  bbq: "Chicken Tikka",
  biryani: "Chicken Biryani",
  breadsticks: "Garlic Naan",
  breakfast: "Hot Tea",
  "breakfast items": "Hot Tea",
  burgers: "Beef Burger",
  "butter naan": "Plain Naan",
  "chili prawns": "Fish in Hot Garlic Sauce",
  "chow mein": "Chicken Chow Mein",
  chutney: "Ketchup & Dips Set",
  "cold drink": "Cold Drink (Coke)",
  daal: "Daal Makhni",
  desserts: "Coffee",
  "fried chicken": "Spicy Honey Wings (Desi Style)",
  "fried items": "French Fries",
  "fried rice": "Schezwan Fried Rice",
  fries: "French Fries",
  "fusion dishes": "Chicken Tikka Pizza",
  "garlic bread": "Garlic Naan",
  "grilled chicken (optional)": "Grilled Chicken Steak",
  "grilled items": "Grilled Chicken Steak",
  "grilled vegetables": "Salad Bowl",
  handi: "Chicken Handi",
  karahi: "Chicken Karahi",
  kebabs: "Seekh Kebab",
  korma: "Chicken Korma",
  "lemon wedges": "Fresh Lime Water",
  manchurian: "Chicken Manchurian",
  "mashed potatoes": "Masala Fries",
  "mint chutney": "Ketchup & Dips Set",
  naan: "Garlic Naan",
  nuggets: "Chicken Nuggets",
  paratha: "Sriracha Chicken Paratha Roll",
  "prawn crackers": "Chicken Nuggets",
  pulao: "Chicken Pulao",
  raita: "Mint Raita",
  roti: "Tandoori Roti",
  sabzi: "Mix Sabzi",
  salad: "Salad Bowl",
  salsa: "Ketchup & Dips Set",
  sandwiches: "Club Sandwich",
  sauces: "Ketchup & Dips Set",
  "sautéed vegetables": "Salad Bowl",
  snacks: "French Fries",
  "soft drink": "Cold Drink (Coke)",
  "soy sauce": "Ketchup & Dips Set",
  spaghetti: "Spaghetti Bolognese",
  "spicy dishes": "Chicken Chili Dry",
  steak: "Grilled Chicken Steak",
  steaks: "Grilled Chicken Steak",
  "steamed rice": "Egg Fried Rice",
  "sweet chili sauce": "Ketchup & Dips Set",
  "tartar sauce": "Ketchup & Dips Set",
  wraps: "Seekh Kebab Wrap",
};

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function splitList(value) {
  const normalized = value.trim();

  if (!normalized || normalized.toLowerCase() === "none") {
    return [];
  }

  return normalized
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeAllergens(allergens) {
  return [...new Set(allergens.map((allergen) => allergen.toLowerCase()))];
}

function normalizeDietary(value, ingredients) {
  const normalized = value.toLowerCase();

  if (normalized.includes("vegan")) {
    return "vegan";
  }

  if (
    normalized.includes("non") ||
    /\b(chicken|beef|mutton|fish|prawn|seafood|meat)\b/i.test(ingredients)
  ) {
    return "non-vegetarian";
  }

  return "vegetarian";
}

function normalizeSpiceLevel(value) {
  const normalized = value.toLowerCase();

  if (normalized.includes("hot") || normalized.includes("spicy")) {
    return "hot";
  }

  if (normalized.includes("medium")) {
    return "medium";
  }

  if (normalized.includes("mild")) {
    return "mild";
  }

  return "non-spicy";
}

function normalizeCuisineType(rawValue, sourceSection) {
  const sectionCuisine = sectionToCuisineType[sourceSection];

  if (sectionCuisine) {
    return sectionCuisine;
  }

  const normalized = rawValue.toLowerCase();

  if (normalized.includes("desi")) {
    return "desi";
  }

  if (normalized.includes("chinese")) {
    return "chinese";
  }

  if (normalized.includes("continental")) {
    return "continental";
  }

  if (normalized.includes("fusion")) {
    return "fusion";
  }

  return "staple";
}

function normalizeServing(value) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return "single";
  }

  if (
    normalized.includes("share") ||
    /\b\d+\s*-\s*\d+\s*persons?\b/.test(normalized) ||
    /\b[2-9]\s*persons?\b/.test(normalized) ||
    normalized.includes("medium") ||
    normalized === "set"
  ) {
    return "shareable";
  }

  return "single";
}

function resolvePairing(pairing, itemNameMap) {
  const normalized = pairing.trim().toLowerCase();

  const exactMatch = itemNameMap.get(normalized);
  if (exactMatch) {
    return exactMatch;
  }

  const aliasMatch = pairingAliasMap[normalized];
  if (aliasMatch && itemNameMap.has(aliasMatch.toLowerCase())) {
    return aliasMatch;
  }

  if (normalized.endsWith("s")) {
    const singular = normalized.slice(0, -1);
    const singularMatch = itemNameMap.get(singular);
    if (singularMatch) {
      return singularMatch;
    }
  }

  return null;
}

function parsePrice(value) {
  const match = value.match(/^PKR\s+([\d,]+)\s*\/\s*(.+)$/i);

  if (!match) {
    throw new Error(`Invalid price format: ${value}`);
  }

  return {
    currency: "PKR",
    amount: Number.parseInt(match[1].replaceAll(",", ""), 10),
    unit: match[2].trim(),
    display: value.trim(),
  };
}

function parseMenu(markdown) {
  const lines = markdown.split(/\r?\n/);
  const items = [];
  const warnings = [];
  let currentSection = "uncategorized";
  let current = null;

  const flush = () => {
    if (!current) {
      return;
    }

    for (const field of requiredFields) {
      if (!current.fields[field]) {
        warnings.push(`${current.name}: missing ${field}`);
      }
    }

    try {
      items.push({
        id: slugify(current.name),
        name: current.name,
        ingredients: splitList(current.fields.Ingredients ?? ""),
        allergens: normalizeAllergens(
          splitList(current.fields.Allergens ?? "")
        ),
        dietary: normalizeDietary(
          (current.fields.Dietary ?? "").trim(),
          current.fields.Ingredients ?? ""
        ),
        spiceLevel: normalizeSpiceLevel(
          (current.fields["Spice Level"] ?? "").trim()
        ),
        cuisineType: normalizeCuisineType(
          (current.fields["Cuisine Type"] ?? "").trim(),
          current.sourceSection
        ),
        specialty:
          (current.fields.Specialty ?? "").trim().toLowerCase() === "yes",
        pairings: splitList(current.fields.Pairings ?? ""),
        serving: normalizeServing((current.fields.Serving ?? "").trim()),
        portionLabel: (current.fields.Serving ?? "").trim() || "single",
        price: parsePrice(current.fields.Price ?? "PKR 0/item"),
        sourceSection: current.sourceSection,
      });
    } catch (error) {
      warnings.push(`${current.name}: ${error.message ?? error}`);
    }
  };

  for (const line of lines) {
    const sectionMatch = line.match(/^#\s+\*{0,2}(.+?)\*{0,2}\s*$/);
    const dishMatch = line.match(/^###\s+(.+?)\s*$/);
    const fieldMatch = line.match(/^-\s*([^:]+):\s*(.+?)\s*$/);

    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      continue;
    }

    if (dishMatch) {
      flush();
      current = {
        name: dishMatch[1].trim(),
        fields: {},
        sourceSection: currentSection,
      };
      continue;
    }

    if (fieldMatch && current) {
      current.fields[fieldMatch[1].trim()] = fieldMatch[2].trim();
    }
  }

  flush();

  const cuisineCounts = items.reduce((acc, item) => {
    acc[item.cuisineType] = (acc[item.cuisineType] ?? 0) + 1;
    return acc;
  }, {});

  const sectionCounts = items.reduce((acc, item) => {
    acc[item.sourceSection] = (acc[item.sourceSection] ?? 0) + 1;
    return acc;
  }, {});

  const servingCounts = items.reduce((acc, item) => {
    acc[item.serving] = (acc[item.serving] ?? 0) + 1;
    return acc;
  }, {});

  const itemNameMap = new Map(
    items.map((item) => [item.name.toLowerCase(), item.name])
  );
  const ids = new Set();

  for (const item of items) {
    if (ids.has(item.id)) {
      warnings.push(`${item.name}: duplicate id ${item.id}`);
    }
    ids.add(item.id);

    item.pairings = [...new Set(item.pairings)]
      .map((pairing) => {
        const resolved = resolvePairing(pairing, itemNameMap);

        if (!resolved) {
          warnings.push(
            `${item.name}: pairing "${pairing}" is not a valid menu item name`
          );
          return null;
        }

        return resolved;
      })
      .filter(Boolean);
  }

  for (const [section, count] of Object.entries(sectionCounts)) {
    if (count !== expectedSectionCount) {
      warnings.push(
        `${section}: expected ${expectedSectionCount} items, found ${count}`
      );
    }
  }

  for (const section of Object.keys(sectionToCuisineType)) {
    if (!sectionCounts[section]) {
      warnings.push(`${section}: section is missing`);
    }
  }

  return {
    items,
    report: {
      itemCount: items.length,
      cuisineCounts,
      sectionCounts,
      servingCounts,
      warnings,
    },
  };
}

const markdown = readFileSync(menuPath, "utf8");
const { items, report } = parseMenu(markdown);
const isCheck = process.argv.includes("--check");

if (!isCheck) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(items, null, 2)}\n`);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

console.log(
  `Parsed ${report.itemCount} menu items across ${Object.keys(report.cuisineCounts).length} cuisine types.`
);

if (report.warnings.length > 0) {
  console.log(`${report.warnings.length} validation warnings found.`);
  for (const warning of report.warnings.slice(0, 12)) {
    console.log(`- ${warning}`);
  }
  if (report.warnings.length > 12) {
    console.log(`- ...and ${report.warnings.length - 12} more`);
  }
}

if (isCheck && report.warnings.length > 0) {
  process.exit(1);
}
