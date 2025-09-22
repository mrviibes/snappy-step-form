import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface VisualsStepProps {
  data: any;
  updateData: (data: any) => void;
  onNext: () => void;
}

const visualStyles = [
  {
    id: "minimal",
    title: "Minimal",
    description: "Clean and simple design",
    preview: "🎯",
  },
  {
    id: "bold",
    title: "Bold",
    description: "Vibrant and energetic",
    preview: "⚡",
  },
  {
    id: "nature",
    title: "Nature",
    description: "Organic and calming",
    preview: "🌿",
  },
  {
    id: "tech",
    title: "Tech",
    description: "Modern and futuristic",
    preview: "🚀",
  },
];

const colorPalettes = [
  { id: "blue", colors: ["#3B82F6", "#1D4ED8", "#1E40AF"], name: "Ocean Blue" },
  { id: "green", colors: ["#10B981", "#059669", "#047857"], name: "Forest Green" },
  { id: "purple", colors: ["#8B5CF6", "#7C3AED", "#6D28D9"], name: "Royal Purple" },
  { id: "orange", colors: ["#F59E0B", "#D97706", "#B45309"], name: "Sunset Orange" },
  { id: "pink", colors: ["#EC4899", "#DB2777", "#BE185D"], name: "Cherry Pink" },
  { id: "gray", colors: ["#6B7280", "#4B5563", "#374151"], name: "Monochrome" },
];

export default function VisualsStep({ data, updateData }: VisualsStepProps) {
  const handleStyleChange = (styleId: string) => {
    updateData({
      visuals: {
        ...data.visuals,
        style: styleId,
      },
    });
  };

  const handleColorChange = (colorId: string) => {
    updateData({
      visuals: {
        ...data.visuals,
        colors: [colorId],
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="mb-2 text-xl font-semibold text-foreground">
          Choose your visual style
        </h2>
        <p className="text-sm text-muted-foreground">
          Pick a style and color palette that resonates with you
        </p>
      </div>

      {/* Style Selection */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Visual Style</h3>
        <div className="grid grid-cols-2 gap-3">
          {visualStyles.map((style) => (
            <Card
              key={style.id}
              className={cn(
                "cursor-pointer p-4 text-center transition-all duration-300 ease-spring hover:shadow-card-hover hover:scale-105",
                "border-2 bg-gradient-card",
                {
                  "border-primary shadow-primary bg-accent": data.visuals?.style === style.id,
                  "border-border": data.visuals?.style !== style.id,
                }
              )}
              onClick={() => handleStyleChange(style.id)}
            >
              <div className="mb-2 text-2xl">{style.preview}</div>
              <h4 className="mb-1 text-sm font-medium text-foreground">
                {style.title}
              </h4>
              <p className="text-xs text-muted-foreground">{style.description}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Color Palette Selection */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Color Palette</h3>
        <div className="grid grid-cols-2 gap-3">
          {colorPalettes.map((palette) => (
            <Card
              key={palette.id}
              className={cn(
                "cursor-pointer p-3 transition-all duration-300 ease-spring hover:shadow-card-hover hover:scale-105",
                "border-2 bg-gradient-card",
                {
                  "border-primary shadow-primary bg-accent": data.visuals?.colors?.[0] === palette.id,
                  "border-border": data.visuals?.colors?.[0] !== palette.id,
                }
              )}
              onClick={() => handleColorChange(palette.id)}
            >
              <div className="mb-2 flex justify-center space-x-1">
                {palette.colors.map((color, index) => (
                  <div
                    key={index}
                    className="h-4 w-4 rounded-full border border-border"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <p className="text-center text-xs font-medium text-foreground">
                {palette.name}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}