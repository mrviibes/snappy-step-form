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
const dailyLifeCategories = [{
  id: "daily-actions",
  title: "Daily Actions & Habits",
  description: "Everyday activities and routines",
  icon: "🏠",
  image: coffeeImage,
  subcategories: [
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
    { id: "wash-car", title: "Wash car" }
  ]
}, {
  id: "personality-traits",
  title: "Personality Traits",
  description: "Character qualities and behaviors",
  icon: "😊",
  image: comedianImage,
  subcategories: [
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
    { id: "gossiping", title: "Gossiping" }
  ]
}, {
  id: "emotions-moods",
  title: "Emotions & Moods",
  description: "Feelings and mental states",
  icon: "🎭",
  image: paparazziImage,
  subcategories: [
    { id: "happy", title: "Happy" },
    { id: "sad", title: "Sad" },
    { id: "angry", title: "Angry" },
    { id: "excited", title: "Excited" },
    { id: "nervous", title: "Nervous" },
    { id: "bored", title: "Bored" },
    { id: "lonely", title: "Lonely" },
    { id: "relaxed", title: "Relaxed" },
    { id: "anxious", title: "Anxious" },
    { id: "hopeful", title: "Hopeful" },
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
    { id: "stressed", title: "Stressed" },
    { id: "calm", title: "Calm" },
    { id: "content", title: "Content" },
    { id: "restless", title: "Restless" },
    { id: "overwhelmed", title: "Overwhelmed" },
    { id: "free", title: "Free" },
    { id: "trapped", title: "Trapped" },
    { id: "curious", title: "Curious" },
    { id: "confused", title: "Confused" },
    { id: "focused", title: "Focused" },
    { id: "distracted", title: "Distracted" },
    { id: "gloomy", title: "Gloomy" },
    { id: "bright", title: "Bright" },
    { id: "proud", title: "Proud" },
    { id: "ashamed", title: "Ashamed" },
    { id: "embarrassed", title: "Embarrassed" },
    { id: "confident", title: "Confident" },
    { id: "insecure", title: "Insecure" },
    { id: "jealous", title: "Jealous" },
    { id: "grateful", title: "Grateful" },
    { id: "regretful", title: "Regretful" },
    { id: "nostalgic", title: "Nostalgic" },
    { id: "passionate", title: "Passionate" },
    { id: "cold", title: "Cold" },
    { id: "warm", title: "Warm" },
    { id: "sick", title: "Sick" },
    { id: "healthy", title: "Healthy" },
    { id: "strong", title: "Strong" }
  ]
}, {
  id: "animals-pets",
  title: "Animals & Pets",
  description: "Creatures and companions",
  icon: "🐕",
  image: birthdayImage,
  subcategories: [
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
    { id: "dolphin", title: "Dolphin" }
  ]
}, {
  id: "food-drink",
  title: "Food & Drink",
  description: "Meals, snacks and beverages",
  icon: "🍕",
  image: footballImage,
  subcategories: [
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
    { id: "coffee", title: "Coffee" },
    { id: "tea", title: "Tea" },
    { id: "beer", title: "Beer" },
    { id: "wine", title: "Wine" },
    { id: "water", title: "Water" },
    { id: "soda", title: "Soda" },
    { id: "juice", title: "Juice" },
    { id: "milk", title: "Milk" },
    { id: "smoothie", title: "Smoothie" },
    { id: "ice-cream", title: "Ice cream" }
  ]
}, {
  id: "school-subjects",
  title: "School Subjects",
  description: "Academic courses and studies",
  icon: "📚",
  image: sorceressImage,
  subcategories: [
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
    { id: "history", title: "History" },
    { id: "geography", title: "Geography" },
    { id: "social-studies", title: "Social studies" },
    { id: "psychology", title: "Psychology" },
    { id: "philosophy", title: "Philosophy" },
    { id: "art", title: "Art" },
    { id: "music", title: "Music" },
    { id: "drama", title: "Drama" },
    { id: "physical-education", title: "Physical education" },
    { id: "health", title: "Health" },
    { id: "computer-science", title: "Computer science" },
    { id: "programming", title: "Programming" },
    { id: "economics", title: "Economics" },
    { id: "business", title: "Business" }
  ]
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
  const filteredGoals = dailyLifeCategories.filter(goal => goal.title.toLowerCase().includes(searchQuery.toLowerCase()) || goal.description.toLowerCase().includes(searchQuery.toLowerCase()));
  const selectedCategoryData = selectedCategory ? dailyLifeCategories.find(goal => goal.id === selectedCategory) : null;
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
    const categoryData = dailyLifeCategories.find(goal => goal.id === data.category);
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