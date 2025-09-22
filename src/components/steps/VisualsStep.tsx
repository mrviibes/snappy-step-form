import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import autoImage from "@/assets/visual-style-auto.jpg";
import generalImage from "@/assets/visual-style-general.jpg";
import realisticImage from "@/assets/visual-style-realistic.jpg";
import designImage from "@/assets/visual-style-design.jpg";
import renderImage from "@/assets/visual-style-3d-render.jpg";
import animeImage from "@/assets/visual-style-anime.jpg";
interface VisualsStepProps {
  data: any;
  updateData: (data: any) => void;
  onNext: () => void;
}
const visualStyles = [{
  id: "auto",
  title: "Auto",
  description: "Smart default",
  preview: autoImage
}, {
  id: "general",
  title: "General",
  description: "Clean standard",
  preview: generalImage
}, {
  id: "realistic",
  title: "Realistic",
  description: "True photo",
  preview: realisticImage
}, {
  id: "design",
  title: "Design",
  description: "Flat graphic",
  preview: designImage
}, {
  id: "3d-render",
  title: "3D Render",
  description: "CGI model",
  preview: renderImage
}, {
  id: "anime",
  title: "Anime",
  description: "Japanese cartoon",
  preview: animeImage
}];

const visualOptions = [
  { id: "ai-assist", title: "Option 1 - AI Visuals Assist" },
  { id: "design-myself", title: "Option 2 - Design Visuals Myself" },
  { id: "no-visuals", title: "Option 3 - Don't Want Visuals" }
];

export default function VisualsStep({
  data,
  updateData
}: VisualsStepProps) {
  const handleStyleChange = (styleId: string) => {
    updateData({
      visuals: {
        ...data.visuals,
        style: styleId
      }
    });
  };

  const handleVisualOptionChange = (optionId: string) => {
    updateData({
      visuals: {
        ...data.visuals,
        option: optionId
      }
    });
  };

  const selectedStyle = visualStyles.find(style => style.id === data.visuals?.style);
  const hasSelectedStyle = !!data.visuals?.style;
  return <div className="space-y-6">
      {!hasSelectedStyle && (
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            Choose your visual style
          </h2>
        </div>
      )}

      {/* Style Selection or Selected Style Summary */}
      {!hasSelectedStyle ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {visualStyles.map(style => <Card key={style.id} className={cn("cursor-pointer text-center transition-all duration-300 ease-spring hover:shadow-card-hover hover:scale-105", "border-2 bg-gradient-card overflow-hidden", {
            "border-primary shadow-primary bg-accent": data.visuals?.style === style.id,
            "border-border": data.visuals?.style !== style.id
          })} onClick={() => handleStyleChange(style.id)}>
                <div className="relative">
                  <img 
                    src={style.preview} 
                    alt={style.title}
                    className="w-full h-24 object-cover"
                  />
                </div>
                <div className="p-3">
                  <h4 className="mb-1 text-sm font-medium text-foreground">
                    {style.title}
                  </h4>
                  <p className="text-xs text-muted-foreground">{style.description}</p>
                </div>
              </Card>)}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Selected Style Summary */}
          <Card className="border-2 border-primary bg-accent p-3">
            <div className="flex items-center space-x-3">
              <img 
                src={selectedStyle?.preview} 
                alt={selectedStyle?.title}
                className="w-12 h-12 rounded object-cover"
              />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-foreground">
                  {selectedStyle?.title}
                </h4>
                <p className="text-xs text-muted-foreground">{selectedStyle?.description}</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleStyleChange("")}
                className="text-xs"
              >
                Change
              </Button>
            </div>
          </Card>

          {/* Visual Options */}
          <div className="space-y-3">
            {visualOptions.map(option => (
              <Button
                key={option.id}
                variant={data.visuals?.option === option.id ? "default" : "outline"}
                className={cn(
                  "w-full h-12 text-sm font-medium transition-all duration-300",
                  data.visuals?.option === option.id 
                    ? "bg-gradient-primary shadow-primary" 
                    : "hover:bg-accent"
                )}
                onClick={() => handleVisualOptionChange(option.id)}
              >
                {option.title}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>;
}