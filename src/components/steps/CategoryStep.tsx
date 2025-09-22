import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import birthdayImage from "@/assets/birthday-celebration.jpg";
import coffeeImage from "@/assets/coffee-morning.jpg";
import footballImage from "@/assets/football-player.jpg";
import paparazziImage from "@/assets/paparazzi-scene.jpg";
import comedianImage from "@/assets/comedian-performance.jpg";
import sorceressImage from "@/assets/sorceress-majestic.jpg";
interface CategoryStepProps {
  data: any;
  updateData: (data: any) => void;
  onNext: () => void;
}
const fitnessGoals = [{
  id: "celebrations",
  title: "Celebrations",
  description: "Birthdays, holidays, and special events",
  icon: "🎉",
  image: birthdayImage,
  subcategories: [{
    id: "birthday",
    title: "Birthday"
  }, {
    id: "wedding",
    title: "Wedding"
  }, {
    id: "engagement",
    title: "Engagement"
  }, {
    id: "graduation",
    title: "Graduation"
  }, {
    id: "baby-shower",
    title: "Baby shower"
  }, {
    id: "retirement",
    title: "Retirement"
  }, {
    id: "anniversary",
    title: "Anniversary"
  }, {
    id: "new-job",
    title: "New job"
  }, {
    id: "promotion",
    title: "Promotion"
  }, {
    id: "house-warming",
    title: "House warming"
  }, {
    id: "adoption-day",
    title: "Adoption day"
  }, {
    id: "citizenship",
    title: "Citizenship"
  }, {
    id: "family-reunion",
    title: "Family reunion"
  }, {
    id: "cancer-survival",
    title: "Cancer survival"
  }, {
    id: "divorce-party",
    title: "Divorce party"
  }, {
    id: "quit-job",
    title: "Quit job"
  }, {
    id: "sobriety-milestone",
    title: "Sobriety milestone"
  }, {
    id: "name-change",
    title: "Name change"
  }, {
    id: "gender-affirm",
    title: "Gender affirm"
  }, {
    id: "exam-pass",
    title: "Exam pass"
  }, {
    id: "new-year",
    title: "New Year"
  }, {
    id: "valentines-day",
    title: "Valentine's Day"
  }, {
    id: "easter-sunday",
    title: "Easter Sunday"
  }, {
    id: "mothers-day",
    title: "Mother's Day"
  }, {
    id: "fathers-day",
    title: "Father's Day"
  }, {
    id: "canada-day",
    title: "Canada Day"
  }, {
    id: "fourth-july",
    title: "Fourth July"
  }, {
    id: "labor-day",
    title: "Labor Day"
  }, {
    id: "thanksgiving-us",
    title: "Thanksgiving (US)"
  }, {
    id: "halloween-night",
    title: "Halloween night"
  }, {
    id: "hanukkah-week",
    title: "Hanukkah week"
  }, {
    id: "christmas-day",
    title: "Christmas Day"
  }, {
    id: "boxing-day",
    title: "Boxing Day"
  }, {
    id: "kwanzaa-week",
    title: "Kwanzaa week"
  }, {
    id: "diwali-festival",
    title: "Diwali festival"
  }, {
    id: "lunar-new",
    title: "Lunar New"
  }, {
    id: "mardi-gras",
    title: "Mardi Gras"
  }, {
    id: "pride-parade",
    title: "Pride parade"
  }, {
    id: "memorial-day",
    title: "Memorial Day"
  }, {
    id: "veterans-day",
    title: "Veterans Day"
  }, {
    id: "mlk-day",
    title: "MLK Day"
  }, {
    id: "presidents-day",
    title: "Presidents Day"
  }, {
    id: "columbus-day",
    title: "Columbus Day"
  }, {
    id: "juneteenth-holiday",
    title: "Juneteenth holiday"
  }, {
    id: "earth-day",
    title: "Earth Day"
  }, {
    id: "arbor-day",
    title: "Arbor Day"
  }, {
    id: "flag-day",
    title: "Flag Day"
  }, {
    id: "victoria-day",
    title: "Victoria Day"
  }, {
    id: "family-day",
    title: "Family Day"
  }, {
    id: "civic-holiday",
    title: "Civic Holiday"
  }, {
    id: "truth-day",
    title: "Truth Day"
  }, {
    id: "indigenous-day",
    title: "Indigenous Day"
  }, {
    id: "pearl-harbor",
    title: "Pearl Harbor"
  }, {
    id: "patriot-day",
    title: "Patriot Day"
  }, {
    id: "groundhog-day",
    title: "Groundhog Day"
  }, {
    id: "super-bowl",
    title: "Super Bowl"
  }, {
    id: "stanley-cup",
    title: "Stanley Cup"
  }, {
    id: "nba-finals",
    title: "NBA Finals"
  }, {
    id: "world-series",
    title: "World Series"
  }, {
    id: "march-madness",
    title: "March Madness"
  }, {
    id: "summer-olympics",
    title: "Summer Olympics"
  }, {
    id: "winter-olympics",
    title: "Winter Olympics"
  }, {
    id: "world-cup",
    title: "World Cup"
  }, {
    id: "the-masters",
    title: "The Masters"
  }, {
    id: "kentucky-derby",
    title: "Kentucky Derby"
  }, {
    id: "daytona-500",
    title: "Daytona 500"
  }, {
    id: "wrestle-mania",
    title: "Wrestle Mania"
  }, {
    id: "ufc-fight",
    title: "UFC Fight"
  }, {
    id: "game-launch",
    title: "Game launch"
  }, {
    id: "music-concert",
    title: "Music concert"
  }, {
    id: "album-drop",
    title: "Album drop"
  }, {
    id: "book-launch",
    title: "Book launch"
  }, {
    id: "art-exhibit",
    title: "Art exhibit"
  }, {
    id: "first-car",
    title: "First car"
  }, {
    id: "driving-test",
    title: "Driving test"
  }, {
    id: "new-pet",
    title: "New pet"
  }, {
    id: "pet-birthday",
    title: "Pet birthday"
  }, {
    id: "loan-payoff",
    title: "Loan payoff"
  }, {
    id: "first-paycheck",
    title: "First paycheck"
  }, {
    id: "debt-free",
    title: "Debt free"
  }, {
    id: "mortgage-free",
    title: "Mortgage free"
  }, {
    id: "fitness-goal",
    title: "Fitness goal"
  }, {
    id: "marathon-run",
    title: "Marathon run"
  }, {
    id: "iron-man",
    title: "Iron man"
  }, {
    id: "gym-start",
    title: "Gym start"
  }, {
    id: "travel-sendoff",
    title: "Travel sendoff"
  }, {
    id: "travel-return",
    title: "Travel return"
  }, {
    id: "bucket-list",
    title: "Bucket list"
  }, {
    id: "first-kiss",
    title: "First kiss"
  }, {
    id: "first-date",
    title: "First date"
  }, {
    id: "proposal-night",
    title: "Proposal night"
  }, {
    id: "baby-arrival",
    title: "Baby arrival"
  }, {
    id: "baby-baptism",
    title: "Baby baptism"
  }, {
    id: "bar-mitzvah",
    title: "Bar mitzvah"
  }, {
    id: "quinceanera",
    title: "Quinceañera"
  }, {
    id: "sweet-sixteen",
    title: "Sweet sixteen"
  }, {
    id: "prom-night",
    title: "Prom night"
  }, {
    id: "home-coming",
    title: "Home coming"
  }, {
    id: "tour-reunion",
    title: "Tour reunion"
  }, {
    id: "farewell-party",
    title: "Farewell party"
  }, {
    id: "house-buying",
    title: "House buying"
  }, {
    id: "lease-signing",
    title: "Lease signing"
  }, {
    id: "job-offer",
    title: "Job offer"
  }, {
    id: "first-shift",
    title: "First shift"
  }, {
    id: "pay-raise",
    title: "Pay raise"
  }, {
    id: "pension-fund",
    title: "Pension fund"
  }, {
    id: "lottery-win",
    title: "Lottery win"
  }, {
    id: "jackpot-win",
    title: "Jackpot win"
  }, {
    id: "bonus-check",
    title: "Bonus check"
  }, {
    id: "overtime-pay",
    title: "Overtime pay"
  }, {
    id: "new-office",
    title: "New office"
  }, {
    id: "grand-opening",
    title: "Grand opening"
  }, {
    id: "ribbon-cutting",
    title: "Ribbon cutting"
  }, {
    id: "launch-party",
    title: "Launch party"
  }, {
    id: "business-milestone",
    title: "Business milestone"
  }, {
    id: "work-anniversary",
    title: "Work anniversary"
  }, {
    id: "team-building",
    title: "Team building"
  }, {
    id: "promotion-day",
    title: "Promotion day"
  }, {
    id: "last-day",
    title: "Last day"
  }, {
    id: "resignation-party",
    title: "Resignation party"
  }, {
    id: "christmas-eve",
    title: "Christmas Eve"
  }, {
    id: "new-years-eve",
    title: "New Year's Eve"
  }, {
    id: "star-wars",
    title: "Star Wars"
  }, {
    id: "pi-day",
    title: "Pi Day"
  }, {
    id: "donut-day",
    title: "Donut Day"
  }, {
    id: "pizza-day",
    title: "Pizza Day"
  }, {
    id: "taco-day",
    title: "Taco Day"
  }, {
    id: "hot-dog",
    title: "Hot dog"
  }, {
    id: "beer-day",
    title: "Beer Day"
  }, {
    id: "coffee-day",
    title: "Coffee Day"
  }, {
    id: "margarita-day",
    title: "Margarita Day"
  }, {
    id: "ice-cream",
    title: "Ice cream"
  }, {
    id: "best-friends",
    title: "Best friends"
  }, {
    id: "boyfriend-day",
    title: "Boyfriend Day"
  }, {
    id: "girlfriend-day",
    title: "Girlfriend Day"
  }, {
    id: "singles-day",
    title: "Singles Day"
  }, {
    id: "galentines-day",
    title: "Galentine's Day"
  }, {
    id: "siblings-day",
    title: "Siblings Day"
  }, {
    id: "dog-day",
    title: "Dog Day"
  }, {
    id: "cat-day",
    title: "Cat Day"
  }, {
    id: "video-games",
    title: "Video games"
  }, {
    id: "movie-night",
    title: "Movie night"
  }, {
    id: "binge-watch",
    title: "Binge watch"
  }, {
    id: "film-premiere",
    title: "Film premiere"
  }, {
    id: "season-finale",
    title: "Season finale"
  }, {
    id: "comic-con",
    title: "Comic Con"
  }, {
    id: "cos-play",
    title: "Cos play"
  }, {
    id: "karaoke-night",
    title: "Karaoke night"
  }, {
    id: "dance-off",
    title: "Dance off"
  }, {
    id: "game-night",
    title: "Game night"
  }, {
    id: "quiz-night",
    title: "Quiz night"
  }, {
    id: "trivia-night",
    title: "Trivia night"
  }, {
    id: "spelling-bee",
    title: "Spelling bee"
  }, {
    id: "science-fair",
    title: "Science fair"
  }, {
    id: "hack-a-thon",
    title: "Hack a thon"
  }, {
    id: "summer-festival",
    title: "Summer festival"
  }, {
    id: "city-parade",
    title: "City parade"
  }, {
    id: "fire-works",
    title: "Fire works"
  }, {
    id: "picnic-day",
    title: "Picnic day"
  }, {
    id: "barbecue-party",
    title: "Barbecue party"
  }, {
    id: "pool-party",
    title: "Pool party"
  }, {
    id: "beach-day",
    title: "Beach day"
  }, {
    id: "camping-trip",
    title: "Camping trip"
  }, {
    id: "road-trip",
    title: "Road trip"
  }, {
    id: "ski-trip",
    title: "Ski trip"
  }, {
    id: "hiking-trip",
    title: "Hiking trip"
  }, {
    id: "fishing-trip",
    title: "Fishing trip"
  }, {
    id: "hunting-trip",
    title: "Hunting trip"
  }, {
    id: "boat-ride",
    title: "Boat ride"
  }, {
    id: "sail-trip",
    title: "Sail trip"
  }, {
    id: "surf-trip",
    title: "Surf trip"
  }, {
    id: "ice-skating",
    title: "Ice skating"
  }, {
    id: "snow-day",
    title: "Snow day"
  }, {
    id: "snow-man",
    title: "Snow man"
  }, {
    id: "ice-fishing",
    title: "Ice fishing"
  }, {
    id: "sled-ride",
    title: "Sled ride"
  }, {
    id: "spring-break",
    title: "Spring break"
  }, {
    id: "summer-break",
    title: "Summer break"
  }, {
    id: "fall-festival",
    title: "Fall festival"
  }, {
    id: "winter-fest",
    title: "Winter fest"
  }, {
    id: "harvest-fair",
    title: "Harvest fair"
  }, {
    id: "october-fest",
    title: "October fest"
  }, {
    id: "wine-tasting",
    title: "Wine tasting"
  }, {
    id: "beer-fest",
    title: "Beer fest"
  }, {
    id: "cider-fest",
    title: "Cider fest"
  }, {
    id: "food-truck",
    title: "Food truck"
  }, {
    id: "farmers-market",
    title: "Farmers market"
  }, {
    id: "block-party",
    title: "Block party"
  }, {
    id: "street-fair",
    title: "Street fair"
  }, {
    id: "tail-gate",
    title: "Tail gate"
  }, {
    id: "watch-party",
    title: "Watch party"
  }, {
    id: "championship-win",
    title: "Championship win"
  }, {
    id: "draft-day",
    title: "Draft day"
  }, {
    id: "all-star",
    title: "All Star"
  }, {
    id: "rivalry-game",
    title: "Rivalry game"
  }, {
    id: "home-opener",
    title: "Home opener"
  }, {
    id: "closing-game",
    title: "Closing game"
  }, {
    id: "trophy-win",
    title: "Trophy win"
  }, {
    id: "medal-win",
    title: "Medal win"
  }, {
    id: "award-show",
    title: "Award show"
  }, {
    id: "graduation-ball",
    title: "Graduation ball"
  }, {
    id: "stage-debut",
    title: "Stage debut"
  }, {
    id: "album-release",
    title: "Album release"
  }, {
    id: "product-showcase",
    title: "Product showcase"
  }, {
    id: "spotlight-show",
    title: "Spotlight show"
  }, {
    id: "curtain-call",
    title: "Curtain call"
  }, {
    id: "closing-night",
    title: "Closing night"
  }, {
    id: "standing-ovation",
    title: "Standing ovation"
  }, {
    id: "final-encore",
    title: "Final encore"
  }, {
    id: "song-release",
    title: "Song release"
  }, {
    id: "playlist-party",
    title: "Playlist party"
  }, {
    id: "listening-party",
    title: "Listening party"
  }, {
    id: "dj-set",
    title: "DJ set"
  }, {
    id: "open-mic",
    title: "Open mic"
  }, {
    id: "poetry-slam",
    title: "Poetry slam"
  }, {
    id: "book-club",
    title: "Book club"
  }, {
    id: "author-signing",
    title: "Author signing"
  }, {
    id: "launch-event",
    title: "Launch event"
  }, {
    id: "milestone-day",
    title: "Milestone day"
  }, {
    id: "new-partner",
    title: "New partner"
  }, {
    id: "company-merger",
    title: "Company merger"
  }, {
    id: "deal-closed",
    title: "Deal closed"
  }, {
    id: "ipo-day",
    title: "IPO day"
  }, {
    id: "crowd-fund",
    title: "Crowd fund"
  }, {
    id: "investor-day",
    title: "Investor day"
  }, {
    id: "charity-dinner",
    title: "Charity dinner"
  }, {
    id: "fund-raiser",
    title: "Fund raiser"
  }, {
    id: "fun-run",
    title: "Fun run"
  }, {
    id: "gala-night",
    title: "Gala night"
  }, {
    id: "live-auction",
    title: "Live auction"
  }, {
    id: "awards-night",
    title: "Awards night"
  }, {
    id: "community-day",
    title: "Community day"
  }, {
    id: "block-clean",
    title: "Block clean"
  }, {
    id: "volunteer-day",
    title: "Volunteer day"
  }, {
    id: "protest-march",
    title: "Protest march"
  }, {
    id: "heritage-day",
    title: "Heritage day"
  }, {
    id: "culture-day",
    title: "Culture day"
  }, {
    id: "folk-fest",
    title: "Folk fest"
  }, {
    id: "language-day",
    title: "Language day"
  }, {
    id: "history-day",
    title: "History day"
  }, {
    id: "science-day",
    title: "Science day"
  }, {
    id: "star-gazing",
    title: "Star gazing"
  }, {
    id: "eclipse-night",
    title: "Eclipse night"
  }, {
    id: "summer-solstice",
    title: "Summer solstice"
  }, {
    id: "winter-solstice",
    title: "Winter solstice"
  }, {
    id: "fall-equinox",
    title: "Fall equinox"
  }, {
    id: "meteor-shower",
    title: "Meteor shower"
  }, {
    id: "space-day",
    title: "Space day"
  }, {
    id: "tech-day",
    title: "Tech day"
  }, {
    id: "robotics-fair",
    title: "Robotics fair"
  }, {
    id: "ai-summit",
    title: "AI summit"
  }, {
    id: "innovation-day",
    title: "Innovation day"
  }, {
    id: "startup-pitch",
    title: "Startup pitch"
  }, {
    id: "hack-day",
    title: "Hack day"
  }, {
    id: "demo-day",
    title: "Demo day"
  }, {
    id: "beta-launch",
    title: "Beta launch"
  }, {
    id: "app-release",
    title: "App release"
  }, {
    id: "viral-trend",
    title: "Viral trend"
  }, {
    id: "meme-drop",
    title: "Meme drop"
  }, {
    id: "stream-party",
    title: "Stream party"
  }, {
    id: "influencer-day",
    title: "Influencer day"
  }, {
    id: "collab-drop",
    title: "Collab drop"
  }, {
    id: "partner-day",
    title: "Partner day"
  }, {
    id: "brand-day",
    title: "Brand day"
  }, {
    id: "store-reopen",
    title: "Store reopen"
  }, {
    id: "home-remodel",
    title: "Home remodel"
  }, {
    id: "ribbon-cut",
    title: "Ribbon cut"
  }, {
    id: "brand-launch",
    title: "Brand launch"
  }, {
    id: "logo-reveal",
    title: "Logo reveal"
  }, {
    id: "product-drop",
    title: "Product drop"
  }, {
    id: "sneak-peek",
    title: "Sneak peek"
  }, {
    id: "unboxing-day",
    title: "Unboxing day"
  }, {
    id: "countdown-night",
    title: "Countdown night"
  }, {
    id: "film-trailer",
    title: "Film trailer"
  }, {
    id: "press-day",
    title: "Press day"
  }, {
    id: "media-event",
    title: "Media event"
  }, {
    id: "photo-shoot",
    title: "Photo shoot"
  }, {
    id: "meet-greet",
    title: "Meet greet"
  }, {
    id: "autograph-signing",
    title: "Autograph signing"
  }, {
    id: "fan-meet",
    title: "Fan meet"
  }, {
    id: "reunion-show",
    title: "Reunion show"
  }, {
    id: "tour-launch",
    title: "Tour launch"
  }, {
    id: "tour-finale",
    title: "Tour finale"
  }, {
    id: "farewell-tour",
    title: "Farewell tour"
  }, {
    id: "festival-set",
    title: "Festival set"
  }, {
    id: "collab-stage",
    title: "Collab stage"
  }, {
    id: "charity-gig",
    title: "Charity gig"
  }, {
    id: "tribute-show",
    title: "Tribute show"
  }, {
    id: "memorial-service",
    title: "Memorial day"
  }, {
    id: "candle-light",
    title: "Candle light"
  }, {
    id: "silent-vigil",
    title: "Silent vigil"
  }, {
    id: "remembrance-day",
    title: "Remembrance day"
  }, {
    id: "legacy-night",
    title: "Legacy night"
  }, {
    id: "hero-tribute",
    title: "Hero tribute"
  }, {
    id: "ancestor-day",
    title: "Ancestor day"
  }, {
    id: "life-celebration",
    title: "Life celebration"
  }, {
    id: "final-tribute",
    title: "Final tribute"
  }]
}, {
  id: "daily-life",
  title: "Daily Life",
  description: "Everyday activities and routines",
  icon: "☀️",
  image: coffeeImage,
  subcategories: [{
    id: "morning-routine",
    title: "Morning Routine"
  }, {
    id: "work-life",
    title: "Work Life"
  }, {
    id: "cooking",
    title: "Cooking"
  }, {
    id: "family-time",
    title: "Family Time"
  }, {
    id: "self-care",
    title: "Self Care"
  }, {
    id: "weekend",
    title: "Weekend"
  }]
}, {
  id: "sports",
  title: "Sports",
  description: "Athletic activities and competitions",
  icon: "⚽",
  image: footballImage,
  subcategories: [{
    id: "football",
    title: "Football"
  }, {
    id: "basketball",
    title: "Basketball"
  }, {
    id: "tennis",
    title: "Tennis"
  }, {
    id: "fitness",
    title: "Fitness"
  }, {
    id: "running",
    title: "Running"
  }, {
    id: "team-sports",
    title: "Team Sports"
  }]
}, {
  id: "pop-culture",
  title: "Pop Culture",
  description: "Movies, music, and trending topics",
  icon: "🎬",
  image: paparazziImage,
  subcategories: [{
    id: "movies",
    title: "Movies"
  }, {
    id: "music",
    title: "Music"
  }, {
    id: "tv-shows",
    title: "TV Shows"
  }, {
    id: "celebrities",
    title: "Celebrities"
  }, {
    id: "social-media",
    title: "Social Media"
  }, {
    id: "trending",
    title: "Trending"
  }]
}, {
  id: "jokes",
  title: "Jokes",
  description: "Funny content and humor",
  icon: "😂",
  image: comedianImage,
  subcategories: [{
    id: "dad-jokes",
    title: "Dad Jokes"
  }, {
    id: "puns",
    title: "Puns"
  }, {
    id: "observational",
    title: "Observational"
  }, {
    id: "one-liners",
    title: "One-liners"
  }, {
    id: "situational",
    title: "Situational"
  }, {
    id: "wordplay",
    title: "Wordplay"
  }]
}, {
  id: "custom",
  title: "Custom",
  description: "Create your own unique content",
  icon: "✨",
  image: sorceressImage,
  subcategories: [{
    id: "creative-writing",
    title: "Creative Writing"
  }, {
    id: "personal-story",
    title: "Personal Story"
  }, {
    id: "fictional",
    title: "Fictional"
  }, {
    id: "educational",
    title: "Educational"
  }, {
    id: "inspirational",
    title: "Inspirational"
  }, {
    id: "other",
    title: "Other"
  }]
}];
export default function CategoryStep({
  data,
  updateData,
  onNext
}: CategoryStepProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [subcategorySearchQuery, setSubcategorySearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showingSubcategories, setShowingSubcategories] = useState(false);
  const filteredGoals = fitnessGoals.filter(goal => goal.title.toLowerCase().includes(searchQuery.toLowerCase()) || goal.description.toLowerCase().includes(searchQuery.toLowerCase()));
  const selectedCategoryData = selectedCategory ? fitnessGoals.find(goal => goal.id === selectedCategory) : null;
  const filteredSubcategories = selectedCategoryData ? selectedCategoryData.subcategories.filter(subcategory => subcategory.title.toLowerCase().includes(subcategorySearchQuery.toLowerCase())) : [];
  
  const handleCategorySelection = (goalId: string) => {
    setSelectedCategory(goalId);
    setShowingSubcategories(true);
    setSearchQuery("");
    setSubcategorySearchQuery("");
  };
  
  const handleSubcategorySelection = (subcategoryId: string) => {
    updateData({
      category: selectedCategory,
      subcategory: subcategoryId
    });
  };
  
  const handleEditCategory = () => {
    setShowingSubcategories(false);
    setSelectedCategory(null);
    setSearchQuery("");
    setSubcategorySearchQuery("");
    updateData({
      category: "",
      subcategory: ""
    });
  };
  
  const handleEditSubcategory = () => {
    updateData({
      subcategory: ""
    });
  };
  
  const handleBack = () => {
    setShowingSubcategories(false);
    setSelectedCategory(null);
    setSearchQuery("");
    setSubcategorySearchQuery("");
  };

  // If both category and subcategory are selected, show the compact view
  if (data.category && data.subcategory) {
    const categoryData = fitnessGoals.find(goal => goal.id === data.category);
    const subcategoryData = categoryData?.subcategories.find(sub => sub.id === data.subcategory);
    
    return (
      <div className="bg-white rounded-lg border border-primary overflow-hidden">
        {/* Selected Category */}
        <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent border-b border-border" onClick={handleEditCategory}>
          <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
            <img src={categoryData?.image} alt={categoryData?.title} className="w-full h-full object-cover" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">{categoryData?.title}</h3>
            <p className="text-sm text-primary">Edit</p>
          </div>
        </div>

        {/* Selected Subcategory */}
        <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent" onClick={handleEditSubcategory}>
          <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
            <span className="text-lg">{categoryData?.icon}</span>
          </div>
          <div>
            <h3 className="font-medium text-foreground">{subcategoryData?.title}</h3>
            <p className="text-sm text-primary">Edit</p>
          </div>
        </div>
      </div>
    );
  }
  if (showingSubcategories && selectedCategoryData) {
    return <div className="space-y-6">
        {/* Selected Category Header */}
        

        {/* Compact Selected Category */}
        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-primary">
          <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
            <img src={selectedCategoryData.image} alt={selectedCategoryData.title} className="w-full h-full object-cover" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">{selectedCategoryData.title}</h3>
            <p className="text-sm text-primary">Edit</p>
          </div>
        </div>

        {/* Subcategory Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
          <Input type="text" placeholder="Search subcategories..." value={subcategorySearchQuery} onChange={e => setSubcategorySearchQuery(e.target.value)} className="pl-10 py-3" />
        </div>

        {/* Subcategories */}
        <ScrollArea className="h-64">
          <div className="space-y-2">
            {filteredSubcategories.map(subcategory => <Card key={subcategory.id} className={cn("cursor-pointer p-4 transition-all duration-200 hover:bg-accent hover:border-primary", "border-2 bg-card", {
            "border-primary shadow-primary bg-accent": data.subcategory === subcategory.id,
            "border-border": data.subcategory !== subcategory.id
          })} onClick={() => handleSubcategorySelection(subcategory.id)}>
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-foreground">{subcategory.title}</h4>
                  <div className="text-muted-foreground">→</div>
                </div>
              </Card>)}
          </div>
        </ScrollArea>
      </div>;
  }
  return <div className="space-y-6">
      <div className="text-center">
        
        
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
        <Input type="text" placeholder="Search categories..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 py-3" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {filteredGoals.map(goal => <Card key={goal.id} className={cn("cursor-pointer overflow-hidden text-center transition-all duration-300 hover:scale-105", "border-2 bg-card hover:bg-accent hover:border-primary", {
        "border-primary shadow-primary bg-accent": data.category === goal.id,
        "border-border": data.category !== goal.id
      })} onClick={() => handleCategorySelection(goal.id)}>
            {goal.image ? <>
                <div className="w-full h-24 overflow-hidden">
                  <img src={goal.image} alt={goal.title} className="w-full h-full object-cover" />
                </div>
                <div className="p-3 pt-2">
                  <h3 className="text-sm font-medium text-foreground">
                    {goal.title}
                  </h3>
                </div>
              </> : <div className="p-3">
                <div className="mb-2 text-2xl">{goal.icon}</div>
                <h3 className="text-sm font-medium text-foreground">
                  {goal.title}
                </h3>
              </div>}
          </Card>)}
      </div>
    </div>;
}