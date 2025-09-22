import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
    id: "birthdays",
    title: "Birthdays"
  }, {
    id: "weddings",
    title: "Weddings"
  }, {
    id: "holidays",
    title: "Holidays"
  }, {
    id: "anniversaries",
    title: "Anniversaries"
  }, {
    id: "graduation",
    title: "Graduation"
  }, {
    id: "baby-shower",
    title: "Baby Shower"
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showingSubcategories, setShowingSubcategories] = useState(false);
  const filteredGoals = fitnessGoals.filter(goal => goal.title.toLowerCase().includes(searchQuery.toLowerCase()) || goal.description.toLowerCase().includes(searchQuery.toLowerCase()));
  const selectedCategoryData = selectedCategory ? fitnessGoals.find(goal => goal.id === selectedCategory) : null;
  const handleCategorySelection = (goalId: string) => {
    setSelectedCategory(goalId);
    setShowingSubcategories(true);
    setSearchQuery("");
  };
  const handleSubcategorySelection = (subcategoryId: string) => {
    updateData({
      category: selectedCategory,
      subcategory: subcategoryId
    });
    // Auto-advance after selection with a small delay for visual feedback
    setTimeout(() => {
      onNext();
    }, 300);
  };
  const handleBack = () => {
    setShowingSubcategories(false);
    setSelectedCategory(null);
    setSearchQuery("");
  };
  if (showingSubcategories && selectedCategoryData) {
    return <div className="space-y-6">
        {/* Selected Category Header */}
        <div className="flex items-center justify-between">
          <button onClick={handleBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={20} />
            <span>Back</span>
          </button>
        </div>

        {/* Compact Selected Category */}
        <div className="flex items-center gap-3 p-3 bg-accent rounded-lg border border-primary">
          <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
            <img src={selectedCategoryData.image} alt={selectedCategoryData.title} className="w-full h-full object-cover" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">{selectedCategoryData.title}</h3>
            
          </div>
        </div>

        {/* Subcategories */}
        <div className="space-y-2">
          {selectedCategoryData.subcategories.map(subcategory => <Card key={subcategory.id} className={cn("cursor-pointer p-4 transition-all duration-200 hover:bg-accent hover:border-primary", "border-2 bg-card", {
          "border-primary shadow-primary bg-accent": data.subcategory === subcategory.id,
          "border-border": data.subcategory !== subcategory.id
        })} onClick={() => handleSubcategorySelection(subcategory.id)}>
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-foreground">{subcategory.title}</h4>
                <div className="text-muted-foreground">→</div>
              </div>
            </Card>)}
        </div>
      </div>;
  }
  return <div className="space-y-6">
      <div className="text-center">
        
        
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
        <Input type="text" placeholder="Search categories..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
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