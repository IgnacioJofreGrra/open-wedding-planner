import type { TranslationKey } from "../stores/ui-language-store";

const CATEGORY_KEY_BY_NAME: Record<string, TranslationKey> = {
  Venue: "category.venue",
  "Food/Beverage": "category.foodBeverage",
  Ceremony: "category.ceremony",
  "Photography/Videography": "category.photographyVideography",
  Decor: "category.decor",
  Stationery: "category.stationery",
  Attire: "category.attire",
  Entertainment: "category.entertainment",
  "Planner/Coordinator": "category.plannerCoordinator",
  Miscellaneous: "category.miscellaneous",
  Contingency: "category.contingency",
};

export function getCategoryLabel(name: string, t: (key: TranslationKey) => string): string {
  const key = CATEGORY_KEY_BY_NAME[name];
  return key ? t(key) : name;
}
