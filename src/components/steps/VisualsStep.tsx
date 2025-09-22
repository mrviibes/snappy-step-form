import { useState, KeyboardEvent } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { generateVisualOptions, type VisualRecommendation } from "@/lib/api";
import { Sparkles, Loader2 } from "lucide-react";
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
  const [showSpecificVisualsChoice, setShowSpecificVisualsChoice] = useState(false);
  const [generatedVisuals, setGeneratedVisuals] = useState<VisualRecommendation[]>([]);
  const [isGeneratingVisuals, setIsGeneratingVisuals] = useState(false);
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

    // If "AI Visuals Assist" is selected, show specific visuals choice
    if (optionId === 'ai-assist') {
      setShowSpecificVisualsChoice(true);
    }
  };

  const handleSpecificVisualsChoice = (hasVisuals: boolean) => {
    if (hasVisuals) {
      setShowSpecificVisualsChoice(false);
      // Show the input section (current behavior)
    } else {
      setShowSpecificVisualsChoice(false);
      setShowVisualGeneration(true); // Skip to generation step
    }
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
      
      // Automatically proceed to generation step when they add their first visual
      if (!data.visuals?.customVisuals || data.visuals.customVisuals.length === 0) {
        setShowVisualGeneration(true);
      }
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
    // Automatically show visual options when style is selected
    setShowVisualOptions(true);
  };

  const handleGenerateVisuals = async () => {
    if (!data.text?.generatedText && !data.text?.customText) {
      console.error("No text available for visual generation");
      return;
    }

    setIsGeneratingVisuals(true);
    
    try {
      const finalText = data.text.generatedText || data.text.customText;
      
      const params = {
        finalText,
        category: data.category || "",
        subcategory: data.subcategory || "",
        tone: data.vibe?.tone || "Humorous",
        textStyle: data.vibe?.style || "Sarcastic", 
        rating: data.vibe?.rating || "PG",
        insertWords: data.vibe?.insertWords || [],
        visualStyle: data.visuals?.style || "general"
      };

      console.log("Generating visuals with params:", params);
      
      const visuals = await generateVisualOptions(params);
      
      setGeneratedVisuals(visuals);
      setShowVisualOptions(true);
      
      console.log("Generated visuals:", visuals);
      
    } catch (error) {
      console.error("Failed to generate visuals:", error);
      // Fallback to sample visuals if generation fails
      setGeneratedVisuals([]);
      setShowVisualOptions(true);
    } finally {
      setIsGeneratingVisuals(false);
    }
  };

  const handleVisualOptionSelect = (optionIndex: number) => {
    setSelectedVisualOption(optionIndex);
    const selectedVisual = generatedVisuals.length > 0 ? generatedVisuals[optionIndex] : null;
    
    updateData({
      visuals: {
        ...data.visuals,
        selectedVisualOption: optionIndex,
        generatedVisual: selectedVisual || visualOptionsSamples[optionIndex]
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
      {/* Text Summary from Step 2 */}
      <div className="text-center mb-6">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold">Your text: </span>
          <span>
            {data.text?.generatedText || data.text?.customText ? 
              `"${data.text.generatedText || data.text.customText}"` : 
              'no text chosen'
            }
          </span>
        </div>
      </div>

      {!hasSelectedStyle && (
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            Choose your visual style
          </h2>
        </div>
      )}

      {/* Visual Style Selection */}
      {!hasSelectedStyle && (
        <div className="grid grid-cols-2 gap-4">
          {visualStyles.map(style => (
            <Card 
              key={style.id}
              className={cn(
                "cursor-pointer transition-all duration-200 overflow-hidden border-2",
                data.visuals?.style === style.id 
                  ? "border-primary bg-accent" 
                  : "border-border hover:border-primary/50"
              )}
              onClick={() => handleStyleChange(style.id)}
            >
              <div className="aspect-video relative">
                <img 
                  src={style.preview}
                  alt={style.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-3">
                <h3 className="font-semibold text-sm text-foreground">{style.title}</h3>
                <p className="text-xs text-muted-foreground">{style.description}</p>
              </div>
            </Card>
          ))}
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
                  onClick={() => {
                    updateData({ visuals: { ...data.visuals, option: "" } });
                    setShowSpecificVisualsChoice(false);
                  }}
                  className="text-xs text-cyan-500"
                >
                  Edit
                </Button>
              </div>

              {/* Inserted Visuals Section - show after choosing yes for AI assist */}
              {data.visuals?.option === 'ai-assist' && !showSpecificVisualsChoice && (
                <>
                  <div className="h-px bg-border"></div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-foreground">Inserted Visuals - </span>
                      <span className="text-sm text-foreground">
                        {data.visuals?.customVisuals && data.visuals.customVisuals.length > 0 ? 
                          data.visuals.customVisuals.join(', ') : 'chosen'}
                      </span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setShowVisualGeneration(false);
                        setShowSpecificVisualsChoice(true);
                      }}
                      className="text-xs text-cyan-500"
                    >
                      Edit
                    </Button>
                  </div>
                </>
              )}

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
                        setShowVisualGeneration(true);
                        setShowVisualOptions(false);
                        setShowDimensions(false);
                        // Clear the visual taste so user can select again
                        updateData({
                          visuals: {
                            ...data.visuals,
                            visualTaste: ""
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

          {/* Specific Visuals Choice Section - only show for AI Visuals Assist */}
          {showSpecificVisualsChoice && data.visuals?.option === 'ai-assist' && (
            <div className="space-y-4 pt-4">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-foreground">Do you have any specific visuals you want included?</h2>
                <div className="mt-3">
                  <p className="text-sm text-muted-foreground text-center">eg. Dogs, Mountains, Cars, etc.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => handleSpecificVisualsChoice(true)}
                  className="rounded-lg border-2 p-6 text-center transition-all duration-300 ease-smooth border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-accent/50"
                >
                  <div className="font-semibold text-lg">Yes</div>
                </button>
                <button 
                  onClick={() => handleSpecificVisualsChoice(false)}
                  className="rounded-lg border-2 p-6 text-center transition-all duration-300 ease-smooth border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-accent/50"
                >
                  <div className="font-semibold text-lg">No</div>
                </button>
              </div>
            </div>
          )}

          {/* Custom Visuals Input for AI Assist - only show before generation and NOT when showing choice */}
          {data.visuals?.option === "ai-assist" && !showVisualGeneration && !showSpecificVisualsChoice && (
            <div className="space-y-4 pt-4">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-foreground">Inserted Visuals (optional)</h2>
                <div className="mt-3">
                  <p className="text-sm text-muted-foreground text-center">eg. Dogs, Mountains, Cars etc.</p>
                </div>
              </div>

              <div className="space-y-3">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder="Enter visuals you want included into your final image"
                  className="w-full py-6 min-h-[72px] text-center"
                />
                
                {/* Display visual tags right under input box */}
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

                {/* Show ready button only if no visuals added yet, hide once they start adding visuals */}
                {(!data.visuals?.customVisuals || data.visuals.customVisuals.length === 0) && (
                  <div className="text-center">
                    <button 
                      onClick={handleReadyToGenerate}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-lg font-medium transition-colors border-2 border-primary shadow-md hover:shadow-lg"
                    >
                      I don't want any specific visuals
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Style Selection - show after ready to generate */}
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
            </div>
          )}


          {/* Visual Options - show after generate is clicked */}
          {showVisualOptions && data.visuals?.option === "ai-assist" && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-foreground">
                  Choose your visual:
                </h2>
              </div>
              
              <div className="space-y-3">
                {(generatedVisuals.length > 0 ? generatedVisuals : visualOptionsSamples).map((visual, index) => (
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
                    {generatedVisuals.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">
                            {visual.visualStyle}
                          </span>
                          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
                            {visual.layout.replace('-', ' ')}
                          </span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">
                          {visual.description}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground leading-relaxed">
                        {visual}
                      </p>
                    )}
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
          {/* Selected Style Summary */}
          {hasSelectedStyle && (
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
                    <div className="flex gap-3 items-end">
                      <div className="flex-1">
                        <Select value={data.visuals?.visualTaste || ""} onValueChange={handleVisualTasteChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Choose style" />
                          </SelectTrigger>
                          <SelectContent className="bg-background border border-border shadow-lg z-50">
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
                        className="bg-cyan-400 hover:bg-cyan-500 text-white h-10 px-6 font-medium"
                        disabled={!data.visuals?.visualTaste || isGeneratingVisuals}
                      >
                        {isGeneratingVisuals ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Generate Visuals
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}