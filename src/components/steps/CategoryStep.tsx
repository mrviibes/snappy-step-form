import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
interface CategoryStepProps {
  data: any;
  updateData: (data: any) => void;
  onNext: () => void;
}
const fitnessGoals = [{
  id: "lose-weight",
  title: "Lose weight",
  description: "Burn calories and shed pounds",
  icon: "🏃‍♀️"
}, {
  id: "gain-muscle",
  title: "Gain muscle",
  description: "Build strength and mass",
  icon: "💪"
}, {
  id: "improve-health",
  title: "Improve health",
  description: "Feel better overall",
  icon: "❤️"
}, {
  id: "repair-injury",
  title: "Repair injury",
  description: "Recover and rehabilitate",
  icon: "🩹"
}, {
  id: "be-flexible",
  title: "Be more flexible",
  description: "Increase mobility and range",
  icon: "🧘‍♀️"
}, {
  id: "train-event",
  title: "Train for event",
  description: "Prepare for competition",
  icon: "🏆"
}];
export default function CategoryStep({
  data,
  updateData,
  onNext
}: CategoryStepProps) {
  const [searchQuery, setSearchQuery] = useState("");
  
  const filteredGoals = fitnessGoals.filter(goal =>
    goal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    goal.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <Input
          type="text"
          placeholder="Search categories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {filteredGoals.map(goal => <Card key={goal.id} className={cn("cursor-pointer p-4 text-center transition-all duration-300 ease-spring hover:shadow-card-hover hover:scale-105", "border-2 bg-gradient-card", {
        "border-primary shadow-primary bg-accent": data.category === goal.id,
        "border-border": data.category !== goal.id
      })} onClick={() => handleSelection(goal.id)}>
            <div className="mb-2 text-2xl">{goal.icon}</div>
            <h3 className="mb-1 text-sm font-medium text-foreground">
              {goal.title}
            </h3>
            <p className="text-xs text-muted-foreground">{goal.description}</p>
          </Card>)}
      </div>
    </div>;
}