import { Suspense } from "react";
import Link from "next/link";
import { getMenuItemsFromDatabase } from "@/lib/db/queries";
import { hasDatabaseUrl } from "@/lib/db/url";
import { menuItems } from "@/lib/menu/catalog";
import type { MenuItem } from "@/lib/menu/schema";

const sectionOrder = [
  "Desi Cuisines",
  "Chinese",
  "Continental",
  "Fusion",
  "Staple",
] as const;

const sectionTitles: Record<(typeof sectionOrder)[number], string> = {
  "Desi Cuisines": "Desi",
  Chinese: "Chinese",
  Continental: "Continental",
  Fusion: "Fusion",
  Staple: "Sides, Breads, Salads & Beverages",
};

type PageMenuItem = {
  id: string;
  name: string;
  ingredients: string[];
  allergens: string[];
  dietary: string;
  spiceLevel: string;
  cuisineType: string;
  specialty: boolean;
  pairings: string[];
  serving: string;
  portionLabel: string;
  priceDisplay: string;
  sourceSection: (typeof sectionOrder)[number];
};

const sourceSectionByCuisine = {
  desi: "Desi Cuisines",
  chinese: "Chinese",
  continental: "Continental",
  fusion: "Fusion",
  other: "Staple",
} as const;

function formatPrice(amount: number, unitLabel: string) {
  return `PKR ${amount.toLocaleString("en-PK")}/${unitLabel}`;
}

function fromLocalMenuItem(item: MenuItem): PageMenuItem {
  return {
    id: item.id,
    name: item.name,
    ingredients: item.ingredients,
    allergens: item.allergens,
    dietary: item.dietary,
    spiceLevel: item.spiceLevel,
    cuisineType: item.cuisineType,
    specialty: item.specialty,
    pairings: item.pairings,
    serving: item.serving,
    portionLabel: item.portionLabel,
    priceDisplay: item.price.display,
    sourceSection: item.sourceSection,
  };
}

async function getPageMenuItems() {
  if (!hasDatabaseUrl()) {
    return {
      items: menuItems.map(fromLocalMenuItem),
      source: "local" as const,
    };
  }

  try {
    const databaseItems = await getMenuItemsFromDatabase();

    if (databaseItems.length === 0) {
      return {
        items: menuItems.map(fromLocalMenuItem),
        source: "local" as const,
      };
    }

    return {
      items: databaseItems.map(
        (item): PageMenuItem => ({
          id: item.id,
          name: item.name,
          ingredients: item.ingredients,
          allergens: item.allergens,
          dietary: item.dietary,
          spiceLevel: item.spiceLevel,
          cuisineType:
            item.cuisineType === "other" ? "staple" : item.cuisineType,
          specialty: item.specialty,
          pairings: item.pairings,
          serving: item.serving,
          portionLabel: item.unitLabel,
          priceDisplay: formatPrice(item.pricePkr, item.unitLabel),
          sourceSection: sourceSectionByCuisine[item.cuisineType],
        })
      ),
      source: "database" as const,
    };
  } catch (_error) {
    return {
      items: menuItems.map(fromLocalMenuItem),
      source: "local" as const,
    };
  }
}

function groupBySection(items: readonly PageMenuItem[]) {
  const grouped = new Map<string, PageMenuItem[]>();

  for (const item of items) {
    const existing = grouped.get(item.sourceSection);
    if (existing) {
      existing.push(item);
    } else {
      grouped.set(item.sourceSection, [item]);
    }
  }

  return grouped;
}

async function MenuPageContent() {
  const { items, source } = await getPageMenuItems();
  const grouped = groupBySection(items);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">
            Restaurant Menu
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Browse all dishes, pairings, dietary tags, allergens, and prices
            from {source === "database" ? "Supabase" : "local menu data"}.
          </p>
        </div>
        <Link
          className="rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-muted"
          href="/chat/table-1"
        >
          Back to chat
        </Link>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        {sectionOrder.map((section) => (
          <a
            className="rounded-full border border-border px-3 py-1.5 text-xs transition-colors hover:bg-muted"
            href={`#${section.toLowerCase().replace(/\s+/g, "-")}`}
            key={section}
          >
            {sectionTitles[section]}
          </a>
        ))}
      </div>

      <div className="space-y-8">
        {sectionOrder.map((section) => {
          const items = grouped.get(section) ?? [];

          return (
            <section
              id={section.toLowerCase().replace(/\s+/g, "-")}
              key={section}
            >
              <h2 className="mb-3 font-medium text-lg">
                {sectionTitles[section]}
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {items.map((item) => (
                  <article
                    className="rounded-xl border border-border/70 bg-card p-4"
                    key={item.id}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-sm md:text-base">
                        {item.name}
                      </h3>
                      <span className="whitespace-nowrap font-medium text-sm">
                        {item.priceDisplay}
                      </span>
                    </div>

                    <p className="mt-2 text-muted-foreground text-xs md:text-sm">
                      {item.ingredients.join(", ")}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] md:text-xs">
                      <span className="rounded-full bg-muted px-2 py-1">
                        {item.dietary}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-1">
                        spice: {item.spiceLevel}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-1">
                        serving:{" "}
                        {item.portionLabel === item.serving
                          ? item.serving
                          : `${item.serving} (${item.portionLabel})`}
                      </span>
                    </div>

                    <p className="mt-3 text-[11px] text-muted-foreground md:text-xs">
                      Allergens:{" "}
                      {item.allergens.length
                        ? item.allergens.join(", ")
                        : "none"}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground md:text-xs">
                      Pairings: {item.pairings.join(", ")}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

export default function MenuPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col items-center justify-center px-4 py-6">
          <p className="text-muted-foreground text-sm">Loading menu…</p>
        </main>
      }
    >
      <MenuPageContent />
    </Suspense>
  );
}
