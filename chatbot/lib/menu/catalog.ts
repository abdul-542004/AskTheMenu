import rawMenuItems from "@/data/menu.json";
import rawValidationReport from "@/data/menu-validation.json";
import {
  type MenuItem,
  type MenuValidationReport,
  menuItemsSchema,
  menuValidationReportSchema,
} from "./schema";

export const menuValidationReport: MenuValidationReport =
  menuValidationReportSchema.parse(rawValidationReport);

if (menuValidationReport.warnings.length > 0) {
  throw new Error(
    `Menu validation failed: ${menuValidationReport.warnings.join("; ")}`
  );
}

export const menuItems: MenuItem[] = menuItemsSchema.parse(rawMenuItems);
