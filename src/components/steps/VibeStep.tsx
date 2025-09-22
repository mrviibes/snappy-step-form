import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RefreshCw, Download, Star, Expand, Sparkles } from "lucide-react";
import birthdayImage from "@/assets/birthday-celebration.jpg";
interface VibeStepProps {
  data: any;
  updateData: (data: any) => void;
  onNext: () => void;
}
const personalities = [{
  id: "motivator",
  title: "The Motivator",
  description: "Energetic and encouraging",
  icon: "🔥"
}, {
  id: "zen",
  title: "The Zen Master",
  description: "Calm and mindful",
  icon: "🧘"
}, {
  id: "coach",
  title: "The Coach",
  description: "Direct and results-focused",
  icon: "💪"
}, {
  id: "friend",
  title: "The Friend",
  description: "Supportive and understanding",
  icon: "❤️"
}];
const intensityLabels = ["Gentle", "Moderate", "Intense", "Extreme"];
export default function VibeStep({
  data,
  updateData
}: VibeStepProps) {
  const handlePersonalityChange = (personalityId: string) => {
    updateData({
      vibe: {
        ...data.vibe,
        personality: personalityId
      }
    });
  };
  const handleIntensityChange = (value: number[]) => {
    const intensityMap = ["gentle", "moderate", "intense", "extreme"];
    updateData({
      vibe: {
        ...data.vibe,
        intensity: intensityMap[value[0] - 1]
      }
    });
  };
  const getCurrentIntensity = () => {
    const intensityMap = {
      gentle: 1,
      moderate: 2,
      intense: 3,
      extreme: 4
    };
    return intensityMap[data.vibe?.intensity as keyof typeof intensityMap] || 2;
  };
  return <div className="space-y-6">
      <div className="text-center">
        <h2 className="mb-2 text-xl font-semibold text-foreground">Your Viibe Preview</h2>
        
      </div>

      {/* Output Gallery */}
      <div className="space-y-4">
        <Card className="overflow-hidden bg-card">
          {/* Header with icons */}
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
            <h3 className="text-sm font-medium text-foreground">Output Gallery</h3>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Star className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Expand className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Image content */}
          <div className="p-4">
            <div className="relative overflow-hidden rounded-lg">
              <img src={birthdayImage} alt="Generated birthday celebration meme" className="h-64 w-full object-cover" />
            </div>
            
            {/* Download button */}
            <div className="mt-4 flex justify-center">
              <Button variant="outline" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Download Image
              </Button>
            </div>
          </div>
        </Card>

        {/* Generation Tips */}
        <Card className="bg-muted/50 p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">Generation Tips</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Use detailed descriptions for more accurate results
          </p>
        </Card>
      </div>

      {/* Personality Selection */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Personality Type</h3>
        <div className="grid grid-cols-2 gap-3">
          {personalities.map(personality => <Card key={personality.id} className={cn("cursor-pointer p-4 text-center transition-all duration-300 ease-spring hover:shadow-card-hover hover:scale-105", "border-2 bg-gradient-card", {
          "border-primary shadow-primary bg-accent": data.vibe?.personality === personality.id,
          "border-border": data.vibe?.personality !== personality.id
        })} onClick={() => handlePersonalityChange(personality.id)}>
              <div className="mb-2 text-2xl">{personality.icon}</div>
              <h4 className="mb-1 text-sm font-medium text-foreground">
                {personality.title}
              </h4>
              <p className="text-xs text-muted-foreground">{personality.description}</p>
            </Card>)}
        </div>
      </div>

      {/* Intensity Slider */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">Training Intensity</h3>
        <div className="space-y-4">
          <Slider value={[getCurrentIntensity()]} onValueChange={handleIntensityChange} max={4} min={1} step={1} className="w-full" />
          <div className="flex justify-between text-xs text-muted-foreground">
            {intensityLabels.map((label, index) => <span key={label} className={cn("transition-colors duration-300", {
            "font-medium text-primary": getCurrentIntensity() === index + 1
          })}>
                {label}
              </span>)}
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-lg bg-accent/50 p-4">
        <p className="text-xs text-muted-foreground">
          🎯 <strong>Your Vibe:</strong>{" "}
          {data.vibe?.personality ? personalities.find(p => p.id === data.vibe.personality)?.title : "Not selected"} with {data.vibe?.intensity || "moderate"} intensity training
        </p>
      </div>
    </div>;
}