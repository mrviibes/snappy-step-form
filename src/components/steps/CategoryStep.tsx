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
  subcategories: [
    // Daily Actions & Habits (1–300)
    { id: "wake-up", title: "Wake up" },
    { id: "brush-teeth", title: "Brush teeth" },
    { id: "take-shower", title: "Take shower" },
    { id: "drink-water", title: "Drink water" },
    { id: "eat-breakfast", title: "Eat breakfast" },
    { id: "check-phone", title: "Check phone" },
    { id: "check-email", title: "Check email" },
    { id: "get-dressed", title: "Get dressed" },
    { id: "use-bathroom", title: "Use bathroom" },
    { id: "drive-car", title: "Drive car" },
    { id: "commute-work", title: "Commute work" },
    { id: "start-work", title: "Start work" },
    { id: "text-message", title: "Text message" },
    { id: "make-coffee", title: "Make coffee" },
    { id: "eat-lunch", title: "Eat lunch" },
    { id: "wash-hands", title: "Wash hands" },
    { id: "grocery-shop", title: "Grocery shop" },
    { id: "cook-dinner", title: "Cook dinner" },
    { id: "wash-dishes", title: "Wash dishes" },
    { id: "do-laundry", title: "Do laundry" },
    { id: "take-trash", title: "Take trash" },
    { id: "watch-tv", title: "Watch TV" },
    { id: "scroll-social", title: "Scroll social" },
    { id: "talk-family", title: "Talk family" },
    { id: "walk-outside", title: "Walk outside" },
    { id: "feed-pet", title: "Feed pet" },
    { id: "pet-animal", title: "Pet animal" },
    { id: "lock-door", title: "Lock door" },
    { id: "wash-face", title: "Wash face" },
    { id: "comb-hair", title: "Comb hair" },
    { id: "tie-shoes", title: "Tie shoes" },
    { id: "make-bed", title: "Make bed" },
    { id: "charge-phone", title: "Charge phone" },
    { id: "drink-tea", title: "Drink tea" },
    { id: "stretch-body", title: "Stretch body" },
    { id: "pack-lunch", title: "Pack lunch" },
    { id: "take-bus", title: "Take bus" },
    { id: "call-friend", title: "Call friend" },
    { id: "write-notes", title: "Write notes" },
    { id: "read-news", title: "Read news" },
    { id: "pay-bills", title: "Pay bills" },
    { id: "online-shop", title: "Online shop" },
    { id: "play-music", title: "Play music" },
    { id: "answer-call", title: "Answer call" },
    { id: "schedule-meeting", title: "Schedule meeting" },
    { id: "water-plants", title: "Water plants" },
    { id: "sweep-floor", title: "Sweep floor" },
    { id: "mop-floor", title: "Mop floor" },
    { id: "vacuum-carpet", title: "Vacuum carpet" },
    { id: "wash-car", title: "Wash car" },
    { id: "check-mail", title: "Check mail" },
    { id: "eat-snack", title: "Eat snack" },
    { id: "take-medicine", title: "Take medicine" },
    { id: "take-vitamins", title: "Take vitamins" },
    { id: "pack-bag", title: "Pack bag" },
    { id: "clean-desk", title: "Clean desk" },
    { id: "check-locks", title: "Check locks" },
    { id: "set-alarm", title: "Set alarm" },
    { id: "fill-gas", title: "Fill gas" },
    { id: "walk-dog", title: "Walk dog" },
    { id: "pick-kids", title: "Pick kids" },
    { id: "open-windows", title: "Open windows" },
    { id: "close-windows", title: "Close windows" },
    { id: "turn-lights", title: "Turn lights" },
    { id: "journal-writing", title: "Journal writing" },
    { id: "listen-music", title: "Listen music" },
    { id: "podcast-listen", title: "Podcast listen" },
    { id: "online-video", title: "Online video" },
    { id: "play-games", title: "Play games" },
    { id: "take-nap", title: "Take nap" },
    { id: "order-food", title: "Order food" },
    { id: "eat-dinner", title: "Eat dinner" },
    { id: "stir-pot", title: "Stir pot" },
    { id: "boil-water", title: "Boil water" },
    { id: "set-table", title: "Set table" },
    { id: "clear-table", title: "Clear table" },
    { id: "wipe-counter", title: "Wipe counter" },
    { id: "shave-face", title: "Shave face" },
    { id: "apply-makeup", title: "Apply makeup" },
    { id: "trim-nails", title: "Trim nails" },
    { id: "fold-clothes", title: "Fold clothes" },
    { id: "pack-groceries", title: "Pack groceries" },
    { id: "stock-fridge", title: "Stock fridge" },
    { id: "replace-trash", title: "Replace trash" },
    { id: "light-candle", title: "Light candle" },
    { id: "open-blinds", title: "Open blinds" },
    { id: "sort-laundry", title: "Sort laundry" },
    { id: "dry-clothes", title: "Dry clothes" },
    { id: "change-sheets", title: "Change sheets" },
    { id: "wash-sheets", title: "Wash sheets" },
    { id: "sweep-porch", title: "Sweep porch" },
    { id: "rinse-dishes", title: "Rinse dishes" },
    { id: "sort-mail", title: "Sort mail" },
    { id: "recycle-cans", title: "Recycle cans" },
    { id: "take-photos", title: "Take photos" },
    { id: "browse-web", title: "Browse web" },
    { id: "check-weather", title: "Check weather" },
    { id: "plug-charger", title: "Plug charger" },
    { id: "turn-heater", title: "Turn heater" },
    { id: "brew-coffee", title: "Brew coffee" },
    { id: "clean-mug", title: "Clean mug" },
    { id: "stream-show", title: "Stream show" },
    { id: "post-selfie", title: "Post selfie" },
    { id: "like-photo", title: "Like photo" },
    { id: "send-emoji", title: "Send emoji" },
    { id: "scroll-feed", title: "Scroll feed" },
    { id: "delete-email", title: "Delete email" },
    { id: "reply-email", title: "Reply email" },
    { id: "search-google", title: "Search Google" },
    { id: "check-calendar", title: "Check calendar" },
    { id: "set-reminder", title: "Set reminder" },
    { id: "download-file", title: "Download file" },
    { id: "save-file", title: "Save file" },
    { id: "print-file", title: "Print file" },
    { id: "scan-document", title: "Scan document" },
    { id: "restart-computer", title: "Restart computer" },
    { id: "log-in", title: "Log in" },
    { id: "update-status", title: "Update status" },
    { id: "watch-tiktok", title: "Watch TikTok" },
    { id: "film-video", title: "Film video" },
    { id: "record-voice", title: "Record voice" },
    { id: "draw-sketch", title: "Draw sketch" },
    { id: "paint-wall", title: "Paint wall" },
    { id: "fix-chair", title: "Fix chair" },
    { id: "replace-battery", title: "Replace battery" },
    { id: "write-essay", title: "Write essay" },
    { id: "read-chapter", title: "Read chapter" },
    { id: "bookmark-page", title: "Bookmark page" },
    { id: "clean-keyboard", title: "Clean keyboard" },
    { id: "dust-screen", title: "Dust screen" },
    { id: "charge-laptop", title: "Charge laptop" },
    { id: "install-app", title: "Install app" },
    { id: "empty-trash", title: "Empty trash" },
    { id: "clear-cache", title: "Clear cache" },
    { id: "wash-hair", title: "Wash hair" },
    { id: "curl-hair", title: "Curl hair" },
    { id: "dye-hair", title: "Dye hair" },
    { id: "clip-nails", title: "Clip nails" },
    { id: "paint-nails", title: "Paint nails" },
    { id: "apply-lotion", title: "Apply lotion" },
    { id: "spray-perfume", title: "Spray perfume" },
    { id: "wear-deodorant", title: "Wear deodorant" },
    { id: "floss-teeth", title: "Floss teeth" },
    { id: "gargle-mouthwash", title: "Gargle mouthwash" },
    { id: "blow-nose", title: "Blow nose" },
    { id: "clean-phone", title: "Clean phone" },
    { id: "scrub-toilet", title: "Scrub toilet" },
    { id: "clean-sink", title: "Clean sink" },
    { id: "empty-bin", title: "Empty bin" },
    { id: "sweep-kitchen", title: "Sweep kitchen" },
    { id: "mop-kitchen", title: "Mop kitchen" },
    { id: "dust-shelf", title: "Dust shelf" },
    { id: "fold-blanket", title: "Fold blanket" },
    { id: "arrange-shoes", title: "Arrange shoes" },
    { id: "organize-closet", title: "Organize closet" },
    { id: "empty-fridge", title: "Empty fridge" },
    { id: "toss-leftovers", title: "Toss leftovers" },
    { id: "freeze-meat", title: "Freeze meat" },
    { id: "defrost-meat", title: "Defrost meat" },
    { id: "wash-rice", title: "Wash rice" },
    { id: "cook-rice", title: "Cook rice" },
    { id: "fry-egg", title: "Fry egg" },
    { id: "bake-bread", title: "Bake bread" },
    { id: "toast-bread", title: "Toast bread" },
    { id: "pour-milk", title: "Pour milk" },
    { id: "drink-wine", title: "Drink wine" },
    { id: "mix-cocktail", title: "Mix cocktail" },
    { id: "crack-egg", title: "Crack egg" },
    { id: "chop-onion", title: "Chop onion" },
    { id: "grate-cheese", title: "Grate cheese" },
    { id: "roast-chicken", title: "Roast chicken" },
    { id: "grill-steak", title: "Grill steak" },
    { id: "bake-pie", title: "Bake pie" },
    { id: "frost-cake", title: "Frost cake" },
    { id: "eat-dessert", title: "Eat dessert" },
    { id: "microwave-food", title: "Microwave food" },
    { id: "reheat-pizza", title: "Reheat pizza" },
    { id: "season-dish", title: "Season dish" },
    { id: "serve-plate", title: "Serve plate" },
    { id: "deliver-meal", title: "Deliver meal" },
    { id: "carry-bag", title: "Carry bag" },
    { id: "open-box", title: "Open box" },
    { id: "tape-box", title: "Tape box" },
    { id: "open-letter", title: "Open letter" },
    { id: "mail-letter", title: "Mail letter" },
    { id: "track-package", title: "Track package" },
    { id: "sign-delivery", title: "Sign delivery" },
    { id: "shake-hand", title: "Shake hand" },
    { id: "hug-friend", title: "Hug friend" },
    { id: "kiss-cheek", title: "Kiss cheek" },
    { id: "pat-back", title: "Pat back" },
    { id: "high-five", title: "High five" },
    { id: "wave-hand", title: "Wave hand" },
    { id: "smile-face", title: "Smile face" },
    { id: "roll-eyes", title: "Roll eyes" },
    { id: "stretch-arms", title: "Stretch arms" },
    { id: "crack-knuckles", title: "Crack knuckles" },
    { id: "yawn-loudly", title: "Yawn loudly" },
    { id: "snore-sleep", title: "Snore sleep" },
    { id: "toss-turn", title: "Toss turn" },
    { id: "reset-pillow", title: "Reset pillow" },
    { id: "fall-asleep", title: "Fall asleep" },
    { id: "snooze-alarm", title: "Snooze alarm" },
    { id: "spill-coffee", title: "Spill coffee" },
    { id: "miss-bus", title: "Miss bus" },
    { id: "ride-subway", title: "Ride subway" },
    { id: "pay-fare", title: "Pay fare" },
    { id: "hold-door", title: "Hold door" },
    { id: "lock-door", title: "Lock door" },
    { id: "drop-keys", title: "Drop keys" },
    { id: "find-keys", title: "Find keys" },
    { id: "clean-ears", title: "Clean ears" },
    { id: "shave-legs", title: "Shave legs" },
    { id: "grow-beard", title: "Grow beard" },
    { id: "whiten-teeth", title: "Whiten teeth" },
    { id: "visit-doctor", title: "Visit doctor" },
    { id: "take-pill", title: "Take pill" },
    { id: "bandage-cut", title: "Bandage cut" },
    { id: "heat-pack", title: "Heat pack" },
    { id: "rub-cream", title: "Rub cream" },
    { id: "use-inhaler", title: "Use inhaler" },
    { id: "step-scale", title: "Step scale" },
    { id: "count-calories", title: "Count calories" },
    { id: "track-steps", title: "Track steps" },
    { id: "run-mile", title: "Run mile" },
    { id: "do-squats", title: "Do squats" },
    { id: "do-situps", title: "Do situps" },
    { id: "do-yoga", title: "Do yoga" },
    { id: "meditate-quietly", title: "Meditate quietly" },
    { id: "deep-breathe", title: "Deep breathe" },
    { id: "do-plank", title: "Do plank" },
    { id: "swim-laps", title: "Swim laps" },
    { id: "kick-ball", title: "Kick ball" },
    { id: "shoot-hoop", title: "Shoot hoop" },
    { id: "swing-bat", title: "Swing bat" },
    { id: "serve-tennis", title: "Serve tennis" },
    { id: "spike-volley", title: "Spike volley" },
    { id: "pass-soccer", title: "Pass soccer" },
    { id: "score-goal", title: "Score goal" },
    { id: "guard-net", title: "Guard net" },
    { id: "cheer-game", title: "Cheer game" },
    { id: "clap-hands", title: "Clap hands" },
    { id: "boo-loudly", title: "Boo loudly" },
    { id: "wave-flag", title: "Wave flag" },
    { id: "play-guitar", title: "Play guitar" },
    { id: "play-piano", title: "Play piano" },
    { id: "play-violin", title: "Play violin" },
    { id: "sing-song", title: "Sing song" },
    { id: "record-song", title: "Record song" },
    { id: "blast-music", title: "Blast music" },
    { id: "wear-headphones", title: "Wear headphones" },
    { id: "skip-track", title: "Skip track" },
    { id: "save-playlist", title: "Save playlist" },
    { id: "burn-cd", title: "Burn CD" },
    { id: "watch-concert", title: "Watch concert" },
    { id: "buy-ticket", title: "Buy ticket" },
    { id: "queue-concert", title: "Queue concert" },
    { id: "clap-encore", title: "Clap encore" },
    { id: "share-photo", title: "Share photo" },
    { id: "post-story", title: "Post story" },
    { id: "save-story", title: "Save story" },
    { id: "block-user", title: "Block user" },
    { id: "add-friend", title: "Add friend" },
    { id: "update-app", title: "Update app" },
    { id: "reset-password", title: "Reset password" },
    { id: "online-banking", title: "Online banking" },
    { id: "teacher-call", title: "Teacher call" },
    { id: "parent-call", title: "Parent call" },
    { id: "pay-rent", title: "Pay rent" },
    { id: "call-plumber", title: "Call plumber" },
    { id: "fix-leak", title: "Fix leak" },
    { id: "replace-bulb", title: "Replace bulb" },
    { id: "check-tire", title: "Check tire" },
    { id: "pump-gas", title: "Pump gas" },
    { id: "wash-window", title: "Wash window" },
    { id: "take-selfie", title: "Take selfie" },
    { id: "send-snap", title: "Send snap" },
    { id: "watch-story", title: "Watch story" },
    { id: "comment-post", title: "Comment post" },
    { id: "share-meme", title: "Share meme" },
    { id: "buy-clothes", title: "Buy clothes" },
    { id: "return-item", title: "Return item" },
    { id: "try-outfit", title: "Try outfit" },
    { id: "fold-sweater", title: "Fold sweater" },
    { id: "donate-clothes", title: "Donate clothes" },
    { id: "clean-shoes", title: "Clean shoes" },
    { id: "polish-shoes", title: "Polish shoes" },
    { id: "tie-tie", title: "Tie tie" },
    { id: "zip-jacket", title: "Zip jacket" },
    { id: "put-scarf", title: "Put scarf" },
    { id: "wear-gloves", title: "Wear gloves" },
    { id: "take-umbrella", title: "Take umbrella" },
    { id: "use-sunscreen", title: "Use sunscreen" },
    { id: "spray-bug", title: "Spray bug" },
    { id: "scratch-bite", title: "Scratch bite" },
    { id: "rub-lotion", title: "Rub lotion" },
    { id: "trim-hedge", title: "Trim hedge" },
    { id: "mow-lawn", title: "Mow lawn" },
    { id: "plant-flowers", title: "Plant flowers" },
    { id: "water-garden", title: "Water garden" },

    // Traits (301–450)
    { id: "kind", title: "Kind" },
    { id: "honest", title: "Honest" },
    { id: "patient", title: "Patient" },
    { id: "generous", title: "Generous" },
    { id: "loyal", title: "Loyal" },
    { id: "confident", title: "Confident" },
    { id: "creative", title: "Creative" },
    { id: "funny", title: "Funny" },
    { id: "ambitious", title: "Ambitious" },
    { id: "optimistic", title: "Optimistic" },
    { id: "hardworking", title: "Hardworking" },
    { id: "adventurous", title: "Adventurous" },
    { id: "forgiving", title: "Forgiving" },
    { id: "responsible", title: "Responsible" },
    { id: "empathetic", title: "Empathetic" },
    { id: "calm", title: "Calm" },
    { id: "brave", title: "Brave" },
    { id: "witty", title: "Witty" },
    { id: "caring", title: "Caring" },
    { id: "focused", title: "Focused" },
    { id: "lazy", title: "Lazy" },
    { id: "rude", title: "Rude" },
    { id: "arrogant", title: "Arrogant" },
    { id: "greedy", title: "Greedy" },
    { id: "jealous", title: "Jealous" },
    { id: "dishonest", title: "Dishonest" },
    { id: "impulsive", title: "Impulsive" },
    { id: "forgetful", title: "Forgetful" },
    { id: "negative", title: "Negative" },
    { id: "stubborn", title: "Stubborn" },
    { id: "wasteful", title: "Wasteful" },
    { id: "clumsy", title: "Clumsy" },
    { id: "sarcastic", title: "Sarcastic" },
    { id: "nerdy", title: "Nerdy" },
    { id: "sporty", title: "Sporty" },
    { id: "artsy", title: "Artsy" },
    { id: "outgoing", title: "Outgoing" },
    { id: "shy", title: "Shy" },
    { id: "loud", title: "Loud" },
    { id: "quiet", title: "Quiet" },
    { id: "extrovert", title: "Extrovert" },
    { id: "introvert", title: "Introvert" },
    { id: "perfectionist", title: "Perfectionist" },
    { id: "daydreamer", title: "Daydreamer" },
    { id: "workaholic", title: "Workaholic" },
    { id: "foodie", title: "Foodie" },
    { id: "gamer", title: "Gamer" },
    { id: "bookworm", title: "Bookworm" },
    { id: "overthinker", title: "Overthinker" },
    { id: "gossiping", title: "Gossiping" },
    { id: "sloppy", title: "Sloppy" },
    { id: "impatient", title: "Impatient" },
    { id: "anxious", title: "Anxious" },
    { id: "stressed", title: "Stressed" },
    { id: "moody", title: "Moody" },
    { id: "cheerful", title: "Cheerful" },
    { id: "silly", title: "Silly" },
    { id: "playful", title: "Playful" },
    { id: "supportive", title: "Supportive" },
    { id: "blunt", title: "Blunt" },
    { id: "critical", title: "Critical" },
    { id: "harsh", title: "Harsh" },
    { id: "polite", title: "Polite" },
    { id: "respectful", title: "Respectful" },
    { id: "lazybones", title: "Lazybones" },
    { id: "romantic", title: "Romantic" },
    { id: "sentimental", title: "Sentimental" },
    { id: "inspirational", title: "Inspirational" },
    { id: "savage", title: "Savage" },
    { id: "nostalgic", title: "Nostalgic" },
    { id: "weird", title: "Weird" },
    { id: "wholesome", title: "Wholesome" },
    { id: "edgy", title: "Edgy" },
    { id: "mellow", title: "Mellow" },
    { id: "driven", title: "Driven" },
    { id: "sensitive", title: "Sensitive" },
    { id: "loyalist", title: "Loyalist" },
    { id: "flaky", title: "Flaky" },
    { id: "messy", title: "Messy" },
    { id: "tidy", title: "Tidy" },
    { id: "organized", title: "Organized" },
    { id: "distracted", title: "Distracted" },
    { id: "bold", title: "Bold" },
    { id: "strong", title: "Strong" },
    { id: "weak", title: "Weak" },
    { id: "clever", title: "Clever" },
    { id: "goofy", title: "Goofy" },
    { id: "grumpy", title: "Grumpy" },
    { id: "stoic", title: "Stoic" },
    { id: "passionate", title: "Passionate" },
    { id: "warm", title: "Warm" },
    { id: "cold", title: "Cold" },
    { id: "sweet", title: "Sweet" },
    { id: "sour", title: "Sour" },
    { id: "serious", title: "Serious" },
    { id: "funnybone", title: "Funnybone" },
    { id: "vain", title: "Vain" },
    { id: "humble", title: "Humble" },
    { id: "faithful", title: "Faithful" },
    { id: "distrustful", title: "Distrustful" },
    { id: "kindhearted", title: "Kindhearted" },
    { id: "mean", title: "Mean" },
    { id: "bossy", title: "Bossy" },
    { id: "helpful", title: "Helpful" },
    { id: "cynical", title: "Cynical" },
    { id: "hopeful", title: "Hopeful" },
    { id: "reckless", title: "Reckless" },
    { id: "considerate", title: "Considerate" },
    { id: "sympathetic", title: "Sympathetic" },
    { id: "tactful", title: "Tactful" },
    { id: "daring", title: "Daring" },
    { id: "cooperative", title: "Cooperative" },
    { id: "curious", title: "Curious" },
    { id: "thoughtful", title: "Thoughtful" },
    { id: "naive", title: "Naive" },
    { id: "sincere", title: "Sincere" },
    { id: "fake", title: "Fake" },
    { id: "timid", title: "Timid" },
    { id: "fearless", title: "Fearless" },
    { id: "nervous", title: "Nervous" },
    { id: "friendly", title: "Friendly" },
    { id: "stern", title: "Stern" },
    { id: "dreamy", title: "Dreamy" },
    { id: "insecure", title: "Insecure" },

    // Emotions, States, Moods (451–550)
    { id: "happy", title: "Happy" },
    { id: "sad", title: "Sad" },
    { id: "angry", title: "Angry" },
    { id: "excited", title: "Excited" },
    { id: "bored", title: "Bored" },
    { id: "lonely", title: "Lonely" },
    { id: "relaxed", title: "Relaxed" },
    { id: "tired", title: "Tired" },
    { id: "sleepy", title: "Sleepy" },
    { id: "hungry", title: "Hungry" },
    { id: "thirsty", title: "Thirsty" },
    { id: "full", title: "Full" },
    { id: "broke", title: "Broke" },
    { id: "rich", title: "Rich" },
    { id: "loved", title: "Loved" },
    { id: "unloved", title: "Unloved" },
    { id: "energized", title: "Energized" },
    { id: "motivated", title: "Motivated" },
    { id: "unmotivated", title: "Unmotivated" },
    { id: "content", title: "Content" },
    { id: "restless", title: "Restless" },
    { id: "overwhelmed", title: "Overwhelmed" },
    { id: "free", title: "Free" },
    { id: "trapped", title: "Trapped" },
    { id: "confused", title: "Confused" },
    { id: "gloomy", title: "Gloomy" },
    { id: "bright", title: "Bright" },
    { id: "proud", title: "Proud" },
    { id: "ashamed", title: "Ashamed" },
    { id: "embarrassed", title: "Embarrassed" },
    { id: "grateful", title: "Grateful" },
    { id: "regretful", title: "Regretful" },
    { id: "sick", title: "Sick" },
    { id: "healthy", title: "Healthy" },
    { id: "dizzy", title: "Dizzy" },
    { id: "hungover", title: "Hungover" },
    { id: "tipsy", title: "Tipsy" },
    { id: "buzzed", title: "Buzzed" },
    { id: "drunk", title: "Drunk" },
    { id: "sober", title: "Sober" },
    { id: "high", title: "High" },
    { id: "low", title: "Low" },
    { id: "chill", title: "Chill" },
    { id: "panicked", title: "Panicked" },
    { id: "furious", title: "Furious" },
    { id: "blissful", title: "Blissful" },
    { id: "depressed", title: "Depressed" },
    { id: "sleepyhead", title: "Sleepyhead" },
    { id: "groggy", title: "Groggy" },
    { id: "wired", title: "Wired" },
    { id: "caffeinated", title: "Caffeinated" },
    { id: "overworked", title: "Overworked" },
    { id: "burned-out", title: "Burned-out" },
    { id: "peaceful", title: "Peaceful" },
    { id: "relieved", title: "Relieved" },
    { id: "guilty", title: "Guilty" },
    { id: "resigned", title: "Resigned" },
    { id: "giggly", title: "Giggly" },
    { id: "ecstatic", title: "Ecstatic" },
    { id: "joyful", title: "Joyful" },
    { id: "irritated", title: "Irritated" },
    { id: "shocked", title: "Shocked" },
    { id: "awkward", title: "Awkward" },
    { id: "excitable", title: "Excitable" },
    { id: "bright-eyed", title: "Bright-eyed" },
    { id: "blue", title: "Blue" },
    { id: "green-eyed", title: "Green-eyed" },
    { id: "warmhearted", title: "Warmhearted" },
    { id: "coldhearted", title: "Coldhearted" },
    { id: "lonelyheart", title: "Lonelyheart" },
    { id: "apathetic", title: "Apathetic" },

    // Animals & Pets (551–650)
    { id: "labrador", title: "Labrador" },
    { id: "poodle", title: "Poodle" },
    { id: "bulldog", title: "Bulldog" },
    { id: "husky", title: "Husky" },
    { id: "chihuahua", title: "Chihuahua" },
    { id: "beagle", title: "Beagle" },
    { id: "dachshund", title: "Dachshund" },
    { id: "boxer", title: "Boxer" },
    { id: "golden-retriever", title: "Golden retriever" },
    { id: "german-shepherd", title: "German shepherd" },
    { id: "persian-cat", title: "Persian cat" },
    { id: "siamese-cat", title: "Siamese cat" },
    { id: "bengal-cat", title: "Bengal cat" },
    { id: "sphynx-cat", title: "Sphynx cat" },
    { id: "hamster", title: "Hamster" },
    { id: "guinea-pig", title: "Guinea pig" },
    { id: "rabbit", title: "Rabbit" },
    { id: "parrot", title: "Parrot" },
    { id: "goldfish", title: "Goldfish" },
    { id: "betta-fish", title: "Betta fish" },
    { id: "cow", title: "Cow" },
    { id: "pig", title: "Pig" },
    { id: "chicken", title: "Chicken" },
    { id: "goat", title: "Goat" },
    { id: "horse", title: "Horse" },
    { id: "sheep", title: "Sheep" },
    { id: "duck", title: "Duck" },
    { id: "goose", title: "Goose" },
    { id: "turkey", title: "Turkey" },
    { id: "llama", title: "Llama" },
    { id: "alpaca", title: "Alpaca" },
    { id: "donkey", title: "Donkey" },
    { id: "camel", title: "Camel" },
    { id: "elephant", title: "Elephant" },
    { id: "lion", title: "Lion" },
    { id: "tiger", title: "Tiger" },
    { id: "bear", title: "Bear" },
    { id: "wolf", title: "Wolf" },
    { id: "fox", title: "Fox" },
    { id: "deer", title: "Deer" },
    { id: "moose", title: "Moose" },
    { id: "elk", title: "Elk" },
    { id: "bison", title: "Bison" },
    { id: "coyote", title: "Coyote" },
    { id: "eagle", title: "Eagle" },
    { id: "hawk", title: "Hawk" },
    { id: "falcon", title: "Falcon" },
    { id: "owl", title: "Owl" },
    { id: "penguin", title: "Penguin" },
    { id: "dolphin", title: "Dolphin" },
    { id: "whale", title: "Whale" },
    { id: "shark", title: "Shark" },
    { id: "octopus", title: "Octopus" },
    { id: "crab", title: "Crab" },
    { id: "lobster", title: "Lobster" },
    { id: "turtle", title: "Turtle" },
    { id: "snake", title: "Snake" },
    { id: "lizard", title: "Lizard" },
    { id: "frog", title: "Frog" },
    { id: "toad", title: "Toad" },
    { id: "butterfly", title: "Butterfly" },
    { id: "bee", title: "Bee" },
    { id: "ant", title: "Ant" },
    { id: "spider", title: "Spider" },
    { id: "ladybug", title: "Ladybug" },
    { id: "dragonfly", title: "Dragonfly" },
    { id: "moth", title: "Moth" },
    { id: "firefly", title: "Firefly" },
    { id: "caterpillar", title: "Caterpillar" },
    { id: "snail", title: "Snail" },
    { id: "slug", title: "Slug" },
    { id: "bat", title: "Bat" },
    { id: "gorilla", title: "Gorilla" },
    { id: "chimpanzee", title: "Chimpanzee" },
    { id: "monkey", title: "Monkey" },
    { id: "zebra", title: "Zebra" },
    { id: "giraffe", title: "Giraffe" },
    { id: "rhino", title: "Rhino" },
    { id: "hippo", title: "Hippo" },
    { id: "crocodile", title: "Crocodile" },
    { id: "alligator", title: "Alligator" },
    { id: "kangaroo", title: "Kangaroo" },
    { id: "koala", title: "Koala" },
    { id: "platypus", title: "Platypus" },
    { id: "wombat", title: "Wombat" },
    { id: "panda", title: "Panda" },
    { id: "red-panda", title: "Red panda" },
    { id: "polar-bear", title: "Polar bear" },
    { id: "seal", title: "Seal" },
    { id: "walrus", title: "Walrus" },
    { id: "otter", title: "Otter" },
    { id: "skunk", title: "Skunk" },
    { id: "raccoon", title: "Raccoon" },
    { id: "squirrel", title: "Squirrel" },
    { id: "chipmunk", title: "Chipmunk" },
    { id: "hedgehog", title: "Hedgehog" },
    { id: "armadillo", title: "Armadillo" },
    { id: "porcupine", title: "Porcupine" },
    { id: "sloth", title: "Sloth" },
    { id: "anteater", title: "Anteater" },

    // Food & Drink (651–750)
    { id: "pizza", title: "Pizza" },
    { id: "burger", title: "Burger" },
    { id: "hot-dog", title: "Hot dog" },
    { id: "sandwich", title: "Sandwich" },
    { id: "salad", title: "Salad" },
    { id: "pasta", title: "Pasta" },
    { id: "sushi", title: "Sushi" },
    { id: "burrito", title: "Burrito" },
    { id: "taco", title: "Taco" },
    { id: "fries", title: "Fries" },
    { id: "chips", title: "Chips" },
    { id: "pretzel", title: "Pretzel" },
    { id: "popcorn", title: "Popcorn" },
    { id: "candy", title: "Candy" },
    { id: "chocolate", title: "Chocolate" },
    { id: "cookie", title: "Cookie" },
    { id: "cake", title: "Cake" },
    { id: "pie", title: "Pie" },
    { id: "donut", title: "Donut" },
    { id: "muffin", title: "Muffin" },
    { id: "brownie", title: "Brownie" },
    { id: "croissant", title: "Croissant" },
    { id: "bagel", title: "Bagel" },
    { id: "waffle", title: "Waffle" },
    { id: "pancake", title: "Pancake" },
    { id: "cereal", title: "Cereal" },
    { id: "oatmeal", title: "Oatmeal" },
    { id: "egg", title: "Egg" },
    { id: "bacon", title: "Bacon" },
    { id: "sausage", title: "Sausage" },
    { id: "steak", title: "Steak" },
    { id: "chicken", title: "Chicken" },
    { id: "turkey", title: "Turkey" },
    { id: "ham", title: "Ham" },
    { id: "lamb", title: "Lamb" },
    { id: "fish", title: "Fish" },
    { id: "shrimp", title: "Shrimp" },
    { id: "lobster", title: "Lobster" },
    { id: "crab", title: "Crab" },
    { id: "clam", title: "Clam" },
    { id: "mussel", title: "Mussel" },
    { id: "scallop", title: "Scallop" },
    { id: "tofu", title: "Tofu" },
    { id: "lentils", title: "Lentils" },
    { id: "beans", title: "Beans" },
    { id: "rice", title: "Rice" },
    { id: "bread", title: "Bread" },
    { id: "toast", title: "Toast" },
    { id: "cheese", title: "Cheese" },
    { id: "butter", title: "Butter" },
    { id: "milk", title: "Milk" },
    { id: "cream", title: "Cream" },
    { id: "yogurt", title: "Yogurt" },
    { id: "ice-cream", title: "Ice cream" },
    { id: "smoothie", title: "Smoothie" },
    { id: "juice", title: "Juice" },
    { id: "soda", title: "Soda" },
    { id: "water", title: "Water" },
    { id: "coffee", title: "Coffee" },
    { id: "tea", title: "Tea" },
    { id: "beer", title: "Beer" },
    { id: "wine", title: "Wine" },
    { id: "whiskey", title: "Whiskey" },
    { id: "vodka", title: "Vodka" },
    { id: "rum", title: "Rum" },
    { id: "tequila", title: "Tequila" },
    { id: "gin", title: "Gin" },
    { id: "cocktail", title: "Cocktail" },
    { id: "cider", title: "Cider" },
    { id: "champagne", title: "Champagne" },
    { id: "mojito", title: "Mojito" },
    { id: "margarita", title: "Margarita" },
    { id: "espresso", title: "Espresso" },
    { id: "latte", title: "Latte" },
    { id: "cappuccino", title: "Cappuccino" },
    { id: "macchiato", title: "Macchiato" },
    { id: "cold-brew", title: "Cold brew" },
    { id: "hot-chocolate", title: "Hot chocolate" },
    { id: "lemonade", title: "Lemonade" },
    { id: "iced-tea", title: "Iced tea" },
    { id: "energy-drink", title: "Energy drink" },
    { id: "sports-drink", title: "Sports drink" },
    { id: "protein-shake", title: "Protein shake" },
    { id: "green-juice", title: "Green juice" },
    { id: "kombucha", title: "Kombucha" },
    { id: "soy-milk", title: "Soy milk" },
    { id: "almond-milk", title: "Almond milk" },
    { id: "oat-milk", title: "Oat milk" },
    { id: "coconut-water", title: "Coconut water" },
    { id: "sparkling-water", title: "Sparkling water" },
    { id: "mineral-water", title: "Mineral water" },
    { id: "tap-water", title: "Tap water" },
    { id: "spring-water", title: "Spring water" },
    { id: "bottled-water", title: "Bottled water" },
    { id: "distilled-water", title: "Distilled water" },
    { id: "herbal-tea", title: "Herbal tea" },
    { id: "matcha", title: "Matcha" },
    { id: "chai", title: "Chai" },
    { id: "yerba-mate", title: "Yerba mate" },
    { id: "ginger-ale", title: "Ginger ale" },

    // Courses in School (751–800)
    { id: "math", title: "Math" },
    { id: "algebra", title: "Algebra" },
    { id: "geometry", title: "Geometry" },
    { id: "calculus", title: "Calculus" },
    { id: "statistics", title: "Statistics" },
    { id: "trigonometry", title: "Trigonometry" },
    { id: "physics", title: "Physics" },
    { id: "chemistry", title: "Chemistry" },
    { id: "biology", title: "Biology" },
    { id: "astronomy", title: "Astronomy" },
    { id: "geology", title: "Geology" },
    { id: "oceanography", title: "Oceanography" },
    { id: "anatomy", title: "Anatomy" },
    { id: "physiology", title: "Physiology" },
    { id: "english", title: "English" },
    { id: "literature", title: "Literature" },
    { id: "creative-writing", title: "Creative writing" },
    { id: "history", title: "History" },
    { id: "geography", title: "Geography" },
    { id: "psychology", title: "Psychology" },
    { id: "sociology", title: "Sociology" },
    { id: "philosophy", title: "Philosophy" },
    { id: "political-science", title: "Political science" },
    { id: "economics", title: "Economics" },
    { id: "art", title: "Art" },
    { id: "music", title: "Music" },
    { id: "drama", title: "Drama" },
    { id: "dance", title: "Dance" },
    { id: "physical-education", title: "Physical education" },
    { id: "health", title: "Health" },
    { id: "computer-science", title: "Computer science" },
    { id: "programming", title: "Programming" },
    { id: "web-design", title: "Web design" },
    { id: "graphic-design", title: "Graphic design" },
    { id: "photography", title: "Photography" },
    { id: "film-studies", title: "Film studies" },
    { id: "journalism", title: "Journalism" },
    { id: "public-speaking", title: "Public speaking" },
    { id: "debate", title: "Debate" },
    { id: "foreign-language", title: "Foreign language" },
    { id: "spanish", title: "Spanish" },
    { id: "french", title: "French" },
    { id: "german", title: "German" },
    { id: "italian", title: "Italian" },
    { id: "japanese", title: "Japanese" },
    { id: "chinese", title: "Chinese" },
    { id: "latin", title: "Latin" },
    { id: "business", title: "Business" },
    { id: "accounting", title: "Accounting" },
    { id: "marketing", title: "Marketing" },
    { id: "entrepreneurship", title: "Entrepreneurship" }
  ]
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