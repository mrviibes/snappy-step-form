// Import category data from separate files
import { celebrationsCategory } from "./categories/celebrations";
import { dailyLifeCategory } from "./categories/daily-life";
import { sportsCategory } from "./categories/sports";
import { popCultureCategory } from "./categories/pop-culture";
import { jokesCategory } from "./categories/jokes";
import { miscellaneousCategory } from "./categories/miscellaneous";

export interface ThemeItem {
  id: string;
  title: string;
}

export interface SubcategoryItem {
  id: string;
  title: string;
  themes?: ThemeItem[];
}

export interface CategoryItem {
  id: string;
  title: string;
  description: string;
  icon?: string;
  image?: string;
  subcategories: SubcategoryItem[];
}

export const fitnessGoals: CategoryItem[] = [
  celebrationsCategory,
  dailyLifeCategory,
  sportsCategory,
  popCultureCategory,
  jokesCategory,
  miscellaneousCategory
];
