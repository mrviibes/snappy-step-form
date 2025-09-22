import { Card } from "@/components/ui/card";
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
export default function VisualsStep({
  data,
  updateData
}: VisualsStepProps) {
  const handleStyleChange = (styleId: string) => {
    updateData({
      visuals: {
        style: styleId
      }
    });
  };
  return <div className="space-y-6">
      <div className="text-center">
        <h2 className="mb-2 text-xl font-semibold text-foreground">
          Choose your visual style
        </h2>
        
      </div>

      {/* Style Selection */}
      <div className="space-y-3">
        
        <div className="grid grid-cols-2 gap-3">
          {visualStyles.map(style => <Card key={style.id} className={cn("cursor-pointer p-4 text-center transition-all duration-300 ease-spring hover:shadow-card-hover hover:scale-105", "border-2 bg-gradient-card", {
          "border-primary shadow-primary bg-accent": data.visuals?.style === style.id,
          "border-border": data.visuals?.style !== style.id
        })} onClick={() => handleStyleChange(style.id)}>
              <div className="mb-2">
                <img 
                  src={style.preview} 
                  alt={style.title}
                  className="w-12 h-12 mx-auto rounded object-cover"
                />
              </div>
              <h4 className="mb-1 text-sm font-medium text-foreground">
                {style.title}
              </h4>
              <p className="text-xs text-muted-foreground">{style.description}</p>
            </Card>)}
        </div>
      </div>
    </div>;
}