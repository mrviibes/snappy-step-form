import { useState, KeyboardEvent } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  { id: "ai-assist", title: "AI Visuals Assist", fullTitle: "Option 1 - AI Visuals Assist" },
  { id: "design-myself", title: "Design Visuals Myself", fullTitle: "Option 2 - Design Visuals Myself" },
  { id: "no-visuals", title: "Don't Want Visuals", fullTitle: "Option 3 - Don't Want Visuals" }
];

export default function VisualsStep({
  data,
  updateData
}: VisualsStepProps) {
  const [tagInput, setTagInput] = useState('');
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

  const handleAddTag = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      const currentVisuals = data.visuals?.customVisuals || [];
      if (!currentVisuals.includes(tagInput.trim())) {
        updateData({
          visuals: {
            ...data.visuals,
            customVisuals: [...currentVisuals, tagInput.trim()]
          }
        });
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (visualToRemove: string) => {
    const currentVisuals = data.visuals?.customVisuals || [];
    updateData({
      visuals: {
        ...data.visuals,
        customVisuals: currentVisuals.filter((visual: string) => visual !== visualToRemove)
      }
    });
  };

  const selectedStyle = visualStyles.find(style => style.id === data.visuals?.style);
  const selectedOption = visualOptions.find(option => option.id === data.visuals?.option);
  const hasSelectedStyle = !!data.visuals?.style;
  const hasSelectedOption = !!data.visuals?.option;
  const isComplete = hasSelectedStyle && hasSelectedOption;

  return (
    <div className="space-y-6">
      {!hasSelectedStyle && (
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            Choose your visual style
          </h2>
        </div>
      )}

      {/* Complete Summary */}
      {isComplete ? (
        <div className="space-y-4">
          <Card className="border-2 border-cyan-400 bg-cyan-50/50 p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-foreground">Style - </span>
                  <span className="text-sm text-foreground">{selectedStyle?.title}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => updateData({ visuals: { style: "", option: "" } })}
                  className="text-xs text-cyan-500"
                >
                  Edit
                </Button>
              </div>
              
              <div className="h-px bg-border"></div>
              
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-foreground">Process - </span>
                  <span className="text-sm text-foreground">{selectedOption?.title}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => updateData({ visuals: { ...data.visuals, option: "" } })}
                  className="text-xs text-cyan-500"
                >
                  Edit
                </Button>
              </div>
            </div>
          </Card>

          {/* Custom Visuals Input for AI Assist */}
          {data.visuals?.option === "ai-assist" && (
            <Card className="border-2 border-border bg-card p-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Any Specific Visuals? (optional)
                  </label>
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleAddTag}
                    placeholder="enter visuals here and hit return"
                    className="w-full"
                  />
                </div>
                
                {/* Display visual tags */}
                {data.visuals?.customVisuals && data.visuals.customVisuals.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {data.visuals.customVisuals.map((visual: string, index: number) => (
                      <div key={index} className="flex items-center gap-2 bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm">
                        <span>{visual}</span>
                        <button 
                          onClick={() => handleRemoveTag(visual)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-center">
                  <button className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">
                    {data.visuals?.customVisuals && data.visuals.customVisuals.length > 0 ? 
                      "I'm ready to generate my visuals" : 
                      "I don't want any specific visuals"
                    }
                  </button>
                </div>
              </div>
            </Card>
          )}
        </div>
      ) : (
        <>
          {/* Style Selection or Selected Style Summary */}
          {!hasSelectedStyle ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {visualStyles.map(style => (
                  <Card key={style.id} className={cn("cursor-pointer text-center transition-all duration-300 ease-spring hover:shadow-card-hover hover:scale-105", "border-2 bg-gradient-card overflow-hidden", {
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
                  </Card>
                ))}
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
                        ? "bg-cyan-400 hover:bg-cyan-500 text-white border-cyan-400" 
                        : "hover:bg-accent border-border"
                    )}
                    onClick={() => handleVisualOptionChange(option.id)}
                  >
                    {option.fullTitle}
                  </Button>
                ))}
              </div>

              {/* Custom Visuals Input for AI Assist */}
              {data.visuals?.option === "ai-assist" && (
                <Card className="border-2 border-border bg-card p-4">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Any Specific Visuals? (optional)
                      </label>
                      <Input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleAddTag}
                        placeholder="enter visuals here and hit return"
                        className="w-full"
                      />
                    </div>
                    
                    {/* Display visual tags */}
                    {data.visuals?.customVisuals && data.visuals.customVisuals.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {data.visuals.customVisuals.map((visual: string, index: number) => (
                          <div key={index} className="flex items-center gap-2 bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm">
                            <span>{visual}</span>
                            <button 
                              onClick={() => handleRemoveTag(visual)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="text-center">
                      <button className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">
                        {data.visuals?.customVisuals && data.visuals.customVisuals.length > 0 ? 
                          "I'm ready to generate my visuals" : 
                          "I don't want any specific visuals"
                        }
                      </button>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}