import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import birthdayImage from "@/assets/birthday-celebration.jpg";
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
  image: birthdayImage
}, {
  id: "daily-life",
  title: "Daily Life",
  description: "Everyday activities and routines",
  icon: "☀️"
}, {
  id: "sports",
  title: "Sports",
  description: "Athletic activities and competitions",
  icon: "⚽"
}, {
  id: "pop-culture",
  title: "Pop Culture",
  description: "Movies, music, and trending topics",
  icon: "🎬"
}, {
  id: "jokes",
  title: "Jokes",
  description: "Funny content and humor",
  icon: "😂"
}, {
  id: "custom",
  title: "Custom",
  description: "Create your own unique content",
  icon: "✨"
}];
export default function CategoryStep({
  data,
  updateData,
  onNext
}: CategoryStepProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const filteredGoals = fitnessGoals.filter(goal => goal.title.toLowerCase().includes(searchQuery.toLowerCase()) || goal.description.toLowerCase().includes(searchQuery.toLowerCase()));
  const handleSelection = (goalId: string) => {
    updateData({
      category: goalId
    });
    // Auto-advance after selection with a small delay for visual feedback
    setTimeout(() => {
      onNext();
    }, 300);
  };
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
      })} onClick={() => handleSelection(goal.id)}>
            {goal.image ? (
              <>
                <div className="w-full h-24 overflow-hidden">
                  <img 
                    src={goal.image} 
                    alt={goal.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3 pt-2">
                  <h3 className="text-sm font-medium text-foreground">
                    {goal.title}
                  </h3>
                </div>
              </>
            ) : (
              <div className="p-3">
                <div className="mb-2 text-2xl">{goal.icon}</div>
                <h3 className="text-sm font-medium text-foreground">
                  {goal.title}
                </h3>
              </div>
            )}
          </Card>)}
      </div>
    </div>;
}