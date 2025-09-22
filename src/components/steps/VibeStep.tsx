import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface VibeStepProps {
  data: any;
  updateData: (data: any) => void;
  onNext: () => void;
}

const personalities = [
  {
    id: "motivator",
    title: "The Motivator",
    description: "Energetic and encouraging",
    icon: "🔥",
  },
  {
    id: "zen",
    title: "The Zen Master",
    description: "Calm and mindful",
    icon: "🧘",
  },
  {
    id: "coach",
    title: "The Coach",
    description: "Direct and results-focused",
    icon: "💪",
  },
  {
    id: "friend",
    title: "The Friend",
    description: "Supportive and understanding",
    icon: "❤️",
  },
];

const intensityLabels = ["Gentle", "Moderate", "Intense", "Extreme"];

export default function VibeStep({ data, updateData }: VibeStepProps) {
  const handlePersonalityChange = (personalityId: string) => {
    updateData({
      vibe: {
        ...data.vibe,
        personality: personalityId,
      },
    });
  };

  const handleIntensityChange = (value: number[]) => {
    const intensityMap = ["gentle", "moderate", "intense", "extreme"];
    updateData({
      vibe: {
        ...data.vibe,
        intensity: intensityMap[value[0] - 1],
      },
    });
  };

  const getCurrentIntensity = () => {
    const intensityMap = { gentle: 1, moderate: 2, intense: 3, extreme: 4 };
    return intensityMap[data.vibe?.intensity as keyof typeof intensityMap] || 2;
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="mb-2 text-xl font-semibold text-foreground">
          What's your vibe?
        </h2>
        <p className="text-sm text-muted-foreground">
          Help us match your personality and preferred intensity
        </p>
      </div>

      {/* Personality Selection */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Personality Type</h3>
        <div className="grid grid-cols-2 gap-3">
          {personalities.map((personality) => (
            <Card
              key={personality.id}
              className={cn(
                "cursor-pointer p-4 text-center transition-all duration-300 ease-spring hover:shadow-card-hover hover:scale-105",
                "border-2 bg-gradient-card",
                {
                  "border-primary shadow-primary bg-accent": data.vibe?.personality === personality.id,
                  "border-border": data.vibe?.personality !== personality.id,
                }
              )}
              onClick={() => handlePersonalityChange(personality.id)}
            >
              <div className="mb-2 text-2xl">{personality.icon}</div>
              <h4 className="mb-1 text-sm font-medium text-foreground">
                {personality.title}
              </h4>
              <p className="text-xs text-muted-foreground">{personality.description}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Intensity Slider */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">Training Intensity</h3>
        <div className="space-y-4">
          <Slider
            value={[getCurrentIntensity()]}
            onValueChange={handleIntensityChange}
            max={4}
            min={1}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            {intensityLabels.map((label, index) => (
              <span
                key={label}
                className={cn(
                  "transition-colors duration-300",
                  {
                    "font-medium text-primary": getCurrentIntensity() === index + 1,
                  }
                )}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-lg bg-accent/50 p-4">
        <p className="text-xs text-muted-foreground">
          🎯 <strong>Your Vibe:</strong>{" "}
          {data.vibe?.personality ? 
            personalities.find(p => p.id === data.vibe.personality)?.title : "Not selected"
          } with {data.vibe?.intensity || "moderate"} intensity training
        </p>
      </div>
    </div>
  );
}