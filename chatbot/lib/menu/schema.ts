import { z } from "zod";

export const menuPriceSchema = z.object({
  currency: z.literal("PKR"),
  amount: z.number().int().nonnegative(),
  unit: z.string().min(1),
  display: z.string().min(1),
});

export const menuDietarySchema = z.enum([
  "vegetarian",
  "non-vegetarian",
  "vegan",
]);

export const menuSpiceLevelSchema = z.enum([
  "non-spicy",
  "mild",
  "medium",
  "hot",
]);

export const menuCuisineTypeSchema = z.enum([
  "desi",
  "chinese",
  "continental",
  "fusion",
  "staple",
]);

export const menuServingSchema = z.enum(["single", "shareable"]);

export const menuSourceSectionSchema = z.enum([
  "Desi Cuisines",
  "Chinese",
  "Continental",
  "Fusion",
  "Staple",
]);

export const menuItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  ingredients: z.array(z.string().min(1)).min(1),
  allergens: z.array(z.string().min(1)),
  dietary: menuDietarySchema,
  spiceLevel: menuSpiceLevelSchema,
  cuisineType: menuCuisineTypeSchema,
  specialty: z.boolean(),
  pairings: z.array(z.string().min(1)),
  serving: menuServingSchema,
  portionLabel: z.string().min(1),
  price: menuPriceSchema,
  sourceSection: menuSourceSectionSchema,
});

export const menuItemsSchema = z.array(menuItemSchema).length(100);

export const menuValidationReportSchema = z.object({
  itemCount: z.number().int().nonnegative(),
  cuisineCounts: z.record(z.string(), z.number().int().nonnegative()),
  sectionCounts: z.record(z.string(), z.number().int().nonnegative()),
  servingCounts: z.record(z.string(), z.number().int().nonnegative()),
  warnings: z.array(z.string()),
});

export type MenuItem = z.infer<typeof menuItemSchema>;
export type MenuValidationReport = z.infer<typeof menuValidationReportSchema>;
