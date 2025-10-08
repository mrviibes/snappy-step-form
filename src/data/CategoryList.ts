// Import category data from consolidated file
import { 
  celebrationsCategory,
  dailyLifeCategory, 
  sportsCategory,
  popCultureCategory,
  jokesCategory,
  miscellaneousCategory
} from "./categories-all";

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
