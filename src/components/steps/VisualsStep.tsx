import { useState, KeyboardEvent } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const visualTasteOptions = [
  { id: "balanced", label: "Balanced (default)" },
  { id: "cinematic", label: "Cinematic (dramatic)" },
  { id: "dreamlike", label: "Dreamlike (artsy)" },
  { id: "action", label: "Action (energy)" },
  { id: "exaggerated", label: "Exaggerated (extreme)" }
];

export default function VisualsStep({
  data,
  updateData
}: VisualsStepProps) {
  const [tagInput, setTagInput] = useState('');
  const [showVisualGeneration, setShowVisualGeneration] = useState(false);
  const [showVisualOptions, setShowVisualOptions] = useState(false);
  const [selectedVisualOption, setSelectedVisualOption] = useState<number | null>(null);
  const [showDimensions, setShowDimensions] = useState(false);
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

  const handleReadyToGenerate = () => {
    console.log("handleReadyToGenerate called, current state:", {
      showVisualGeneration,
      customVisuals: data.visuals?.customVisuals
    });
    setShowVisualGeneration(true);
    console.log("Set showVisualGeneration to true");
  };

  const handleVisualTasteChange = (tasteId: string) => {
    updateData({
      visuals: {
        ...data.visuals,
        visualTaste: tasteId
      }
    });
  };

  const handleGenerateVisuals = () => {
    console.log("Generate visuals with:", {
      style: data.visuals?.style,
      option: data.visuals?.option,
      customVisuals: data.visuals?.customVisuals,
      visualTaste: data.visuals?.visualTaste
    });
    setShowVisualOptions(true);
  };

  const handleVisualOptionSelect = (optionIndex: number) => {
    setSelectedVisualOption(optionIndex);
    updateData({
      visuals: {
        ...data.visuals,
        selectedVisualOption: optionIndex,
        generatedVisual: visualOptionsSamples[optionIndex]
      }
    });
    setShowVisualOptions(false);
    setShowDimensions(true);
  };

  const handleDimensionSelect = (dimensionId: string) => {
    updateData({
      visuals: {
        ...data.visuals,
        dimension: dimensionId
      }
    });
    setShowDimensions(false);
  };

  const selectedStyle = visualStyles.find(style => style.id === data.visuals?.style);
  const selectedOption = visualOptions.find(option => option.id === data.visuals?.option);
  const hasSelectedStyle = !!data.visuals?.style;
  const hasSelectedOption = !!data.visuals?.option;
  const isComplete = hasSelectedStyle && hasSelectedOption;

  // Sample visual options (filler content)
  const visualOptionsSamples = [
    "Visual concept with vibrant colors and dynamic composition featuring modern elements and creative typography.",
    "Minimalist design approach with clean lines, balanced negative space and subtle color palette for elegant presentation.",
    "Bold and energetic visual style with striking contrasts, dramatic lighting and eye-catching graphic elements.",
    "Artistic and creative interpretation with unique textures, organic shapes and harmonious color combinations."
  ];

  const dimensionOptions = [
    {
      id: "square",
      title: "Square",
      description: "1:1 aspect ratio"
    },
    {
      id: "landscape", 
      title: "Landscape",
      description: "16:9 aspect ratio"
    },
    {
      id: "portrait",
      title: "Portrait", 
      description: "9:16 aspect ratio"
    },
    {
      id: "custom",
      title: "Custom",
      description: "Define your own dimensions"
    }
  ];

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

              {/* Visuals Row - only show after ready to generate (whether or not there are visuals) */}
              {showVisualGeneration && data.visuals?.option === "ai-assist" && (
                <>
                  <div className="h-px bg-border"></div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-foreground">Visuals - </span>
                      <span className="text-sm text-foreground">
                        {data.visuals?.customVisuals && data.visuals.customVisuals.length > 0 ? (
                          data.visuals.customVisuals.map((visual: string, index: number) => 
                            `"${visual}"${index < data.visuals.customVisuals.length - 1 ? ', ' : ''}`
                          ).join('')
                        ) : (
                          'none chosen'
                        )}
                      </span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setShowVisualGeneration(false)}
                      className="text-xs text-cyan-500"
                    >
                      Edit
                    </Button>
                  </div>
                </>
              )}

              {/* Style Row - only show after visual generation */}
              {showVisualGeneration && data.visuals?.visualTaste && (
                <>
                  <div className="h-px bg-border"></div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-foreground">Style - </span>
                      <span className="text-sm text-foreground">
                        {visualTasteOptions.find(option => option.id === data.visuals?.visualTaste)?.label}
                      </span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setShowVisualGeneration(false);
                        setShowVisualOptions(false);
                        setShowDimensions(false);
                      }}
                      className="text-xs text-cyan-500"
                    >
                      Edit
                    </Button>
                  </div>
                </>
              )}

              {/* Visual Summary Row - only show after visual selection */}
              {selectedVisualOption !== null && (
                <>
                  <div className="h-px bg-border"></div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-foreground">Visual Summary - </span>
                      <span className="text-sm text-foreground">
                        {visualOptionsSamples[selectedVisualOption].substring(0, 15)}...
                      </span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setSelectedVisualOption(null);
                        setShowVisualOptions(true);
                        setShowDimensions(false);
                      }}
                      className="text-xs text-cyan-500"
                    >
                      Edit
                    </Button>
                  </div>
                </>
              )}

              {/* Dimension Row - only show after dimension selection */}
              {data.visuals?.dimension && (
                <>
                  <div className="h-px bg-border"></div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-foreground">Dimension - </span>
                      <span className="text-sm text-foreground">
                        {dimensionOptions.find(option => option.id === data.visuals?.dimension)?.title}
                      </span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setShowDimensions(true);
                        updateData({
                          visuals: {
                            ...data.visuals,
                            dimension: ""
                          }
                        });
                      }}
                      className="text-xs text-cyan-500"
                    >
                      Edit
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Custom Visuals Input for AI Assist - only show before generation */}
          {data.visuals?.option === "ai-assist" && !showVisualGeneration && (
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
                <button 
                  onClick={handleReadyToGenerate}
                  className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors"
                >
                  {data.visuals?.customVisuals && data.visuals.customVisuals.length > 0 ? 
                    "I'm ready to generate my visuals" : 
                    "I don't want any specific visuals"
                  }
                </button>
              </div>
            </div>
          )}

          {/* Style Selection and Generate Button - show after ready to generate but before style is selected */}
          {data.visuals?.option === "ai-assist" && showVisualGeneration && !showVisualOptions && !data.visuals?.visualTaste && (
            <div className="space-y-4">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-foreground">
                  Style
                </label>
                <Select value={data.visuals?.visualTaste || ""} onValueChange={handleVisualTasteChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose style" />
                  </SelectTrigger>
                  <SelectContent>
                    {visualTasteOptions.map(option => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                onClick={handleGenerateVisuals}
                className="w-full bg-cyan-400 hover:bg-cyan-500 text-white h-12 text-base font-medium"
                disabled={!data.visuals?.visualTaste}
              >
                Generate Visuals
              </Button>
            </div>
          )}


          {/* Visual Options - show after generate is clicked */}
          {showVisualOptions && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-foreground">
                  Choose your visual:
                </h2>
              </div>
              
              <div className="space-y-3">
                {visualOptionsSamples.map((visual, index) => (
                  <Card 
                    key={index}
                    className={cn(
                      "p-4 cursor-pointer transition-all duration-200 border-2",
                      selectedVisualOption === index 
                        ? "border-primary bg-accent" 
                        : "border-border hover:border-primary/50"
                    )}
                    onClick={() => handleVisualOptionSelect(index)}
                  >
                    <p className="text-sm text-foreground leading-relaxed">
                      {visual}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Dimensions Selection - show after visual option is selected */}
          {showDimensions && !data.visuals?.dimension && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-foreground">
                  Choose your dimensions:
                </h2>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {dimensionOptions.map(dimension => (
                  <Card 
                    key={dimension.id} 
                    className={cn(
                      "cursor-pointer text-center transition-all duration-300 ease-spring hover:shadow-card-hover hover:scale-105", 
                      "border-2 bg-gradient-card p-4", 
                      {
                        "border-primary shadow-primary bg-accent": data.visuals?.dimension === dimension.id,
                        "border-border": data.visuals?.dimension !== dimension.id
                      }
                    )} 
                    onClick={() => handleDimensionSelect(dimension.id)}
                  >
                    <h4 className="mb-1 text-sm font-medium text-foreground">
                      {dimension.title}
                    </h4>
                    <p className="text-xs text-muted-foreground">{dimension.description}</p>
                  </Card>
                ))}
              </div>
            </div>
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

              {/* Custom Visuals Input for AI Assist - only show before generation */}
              {data.visuals?.option === "ai-assist" && !showVisualGeneration && (
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
                      <button 
                        onClick={handleReadyToGenerate}
                        className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors"
                      >
                        {data.visuals?.customVisuals && data.visuals.customVisuals.length > 0 ? 
                          "I'm ready to generate my visuals" : 
                          "I don't want any specific visuals"
                        }
                      </button>
                    </div>
                </div>
              )}

              {/* Visual Generation Section - only show after ready to generate */}
              {data.visuals?.option === "ai-assist" && showVisualGeneration && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-foreground">
                      Style
                    </label>
                    <Select value={data.visuals?.visualTaste || ""} onValueChange={handleVisualTasteChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose style" />
                      </SelectTrigger>
                      <SelectContent>
                        {visualTasteOptions.map(option => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button 
                    onClick={handleGenerateVisuals}
                    className="w-full bg-cyan-400 hover:bg-cyan-500 text-white h-12 text-base font-medium"
                    disabled={!data.visuals?.visualTaste}
                  >
                    Generate Visuals
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}