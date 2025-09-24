// Import images for categories
import birthdayImage from "@/assets/birthday-celebration.jpg";
import coffeeImage from "@/assets/coffee-morning.jpg";
import footballImage from "@/assets/football-player.jpg";
import paparazziImage from "@/assets/paparazzi-scene.jpg";
import comedianImage from "@/assets/comedian-performance.jpg";
import sorceressImage from "@/assets/sorceress-majestic.jpg";

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
  {
    id: "celebrations",
    title: "Celebrations",
    description: "Special occasions and memorable moments",
    image: birthdayImage,
    subcategories: [
      { id: "birthday", title: "Birthday Celebrations" },
      { id: "wedding", title: "Weddings & Anniversaries" },
      { id: "graduation", title: "Graduations & Achievements" },
      { id: "holiday", title: "Holidays & Festivals" },
      { id: "baby-shower", title: "Baby Showers & New Arrivals" },
      { id: "retirement", title: "Retirement Parties" },
      { id: "promotion", title: "Job Promotions & Career Milestones" },
      { id: "housewarming", title: "Housewarming & New Home" },
      { id: "engagement", title: "Engagement Parties" },
      { id: "reunion", title: "Family & School Reunions" }
    ]
  },
  {
    id: "daily-life",
    title: "Daily Life",
    description: "Everyday moments and routines",
    image: coffeeImage,
    subcategories: [
      { id: "morning-routine", title: "Morning Routines & Coffee Time" },
      { id: "work-life", title: "Work & Professional Life" },
      { id: "cooking", title: "Cooking & Meal Prep" },
      { id: "commuting", title: "Commuting & Travel" },
      { id: "cleaning", title: "Household Chores" },
      { id: "shopping", title: "Shopping & Errands" },
      { id: "family-time", title: "Family Time & Parenting" },
      { id: "pets", title: "Pet Life & Animal Companions" },
      { id: "hobbies", title: "Personal Hobbies & Interests" },
      { id: "weekend", title: "Weekend Activities" }
    ]
  },
  {
    id: "sports",
    title: "Sports",
    description: "Athletic activities and competitions",
    image: footballImage,
    subcategories: [
      { id: "football", title: "Football & Soccer" },
      { id: "basketball", title: "Basketball" },
      { id: "baseball", title: "Baseball & Softball" },
      { id: "tennis", title: "Tennis & Racquet Sports" },
      { id: "running", title: "Running & Marathon" },
      { id: "gym", title: "Gym & Fitness Training" },
      { id: "swimming", title: "Swimming & Water Sports" },
      { id: "cycling", title: "Cycling & Biking" },
      { id: "golf", title: "Golf" },
      { id: "martial-arts", title: "Martial Arts & Combat Sports" },
      { id: "winter-sports", title: "Winter Sports & Skiing" },
      { id: "extreme-sports", title: "Extreme Sports & Adventure" }
    ]
  },
  {
    id: "work-career",
    title: "Work & Career",
    description: "Professional life and workplace scenarios",
    subcategories: [
      { id: "meetings", title: "Meetings & Presentations" },
      { id: "deadlines", title: "Deadlines & Project Management" },
      { id: "office-life", title: "Office Culture & Workplace" },
      { id: "remote-work", title: "Remote Work & Home Office" },
      { id: "job-search", title: "Job Hunting & Interviews" },
      { id: "networking", title: "Professional Networking" },
      { id: "conferences", title: "Conferences & Business Travel" },
      { id: "leadership", title: "Leadership & Management" },
      { id: "startup", title: "Startup Life & Entrepreneurship" },
      { id: "freelancing", title: "Freelancing & Gig Economy" }
    ]
  },
  {
    id: "entertainment",
    title: "Entertainment",
    description: "Fun activities and pop culture",
    image: comedianImage,
    subcategories: [
      { id: "movies", title: "Movies & Cinema" },
      { id: "tv-shows", title: "TV Shows & Streaming" },
      { id: "music", title: "Music & Concerts" },
      { id: "gaming", title: "Video Games & Gaming" },
      { id: "comedy", title: "Comedy & Stand-up" },
      { id: "theater", title: "Theater & Performing Arts" },
      { id: "celebrity", title: "Celebrity Culture" },
      { id: "social-media", title: "Social Media & Internet Culture" },
      { id: "books", title: "Books & Reading" },
      { id: "podcasts", title: "Podcasts & Audio Content" }
    ]
  },
  {
    id: "jokes",
    title: "Random & Fun",
    description: "Jokes, memes, and random humor",
    image: sorceressImage,
    subcategories: [
      {
        id: "dad-jokes",
        title: "Dad Jokes",
        themes: [
          { id: "food-puns", title: "Food Puns" },
          { id: "animal-jokes", title: "Animal Jokes" },
          { id: "work-humor", title: "Work Humor" },
          { id: "family-jokes", title: "Family Jokes" },
          { id: "seasonal", title: "Seasonal Jokes" }
        ]
      },
      {
        id: "memes",
        title: "Internet Memes",
        themes: [
          { id: "viral-trends", title: "Viral Trends" },
          { id: "classic-memes", title: "Classic Memes" },
          { id: "reaction-memes", title: "Reaction Memes" },
          { id: "gaming-memes", title: "Gaming Memes" },
          { id: "work-memes", title: "Work Memes" }
        ]
      },
      {
        id: "puns",
        title: "Puns & Wordplay",
        themes: [
          { id: "clever-puns", title: "Clever Puns" },
          { id: "groan-worthy", title: "Groan-worthy Puns" },
          { id: "visual-puns", title: "Visual Puns" },
          { id: "double-meaning", title: "Double Meanings" },
          { id: "rhyme-time", title: "Rhyme Time" }
        ]
      },
      {
        id: "observational",
        title: "Observational Humor",
        themes: [
          { id: "everyday-life", title: "Everyday Life Observations" },
          { id: "technology", title: "Technology Humor" },
          { id: "generational", title: "Generational Differences" },
          { id: "social-situations", title: "Social Situations" },
          { id: "modern-problems", title: "Modern Problems" }
        ]
      },
      {
        id: "absurd",
        title: "Absurd & Surreal",
        themes: [
          { id: "nonsensical", title: "Nonsensical Humor" },
          { id: "unexpected", title: "Unexpected Twists" },
          { id: "bizarre", title: "Bizarre Scenarios" },
          { id: "anti-jokes", title: "Anti-jokes" },
          { id: "random", title: "Random Humor" }
        ]
      }
    ]
  }
];