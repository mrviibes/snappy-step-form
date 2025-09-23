import { useState, KeyboardEvent } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { generateVisualOptions, type VisualRecommendation } from "@/lib/api";
import { Sparkles, Loader2, AlertCircle, X } from "lucide-react";
import autoImage from "@/assets/visual-style-auto-new.jpg";
import generalImage from "@/assets/visual-style-general-new.jpg";
import realisticImage from "@/assets/visual-style-realistic-new.jpg";
import designImage from "@/assets/visual-style-design-new.jpg";
import renderImage from "@/assets/visual-style-3d-new.jpg";
import animeImage from "@/assets/visual-style-anime-new.jpg";

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
  id: "realistic",
  title: "Realistic",
  description: "True photo",
  preview: realisticImage
}, {
  id: "general",
  title: "General",
  description: "Clean standard",
  preview: generalImage
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

const dimensionOptions = [{
  id: "square",
  title: "Square",
  description: "1:1 aspect ratio"
}, {
  id: "landscape",
  title: "Landscape",
  description: "16:9 aspect ratio"
}, {
  id: "portrait",
  title: "Portrait",
  description: "9:16 aspect ratio"
}, {
  id: "custom",
  title: "Custom",
  description: "Define your own dimensions"
}];

export default function VisualsStep({
  data,
  updateData
}: VisualsStepProps) {
  const [tagInput, setTagInput] = useState('');
  const [generatedVisuals, setGeneratedVisuals] = useState<VisualRecommendation[]>([]);
  const [isGeneratingVisuals, setIsGeneratingVisuals] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVisualOption, setSelectedVisualOption] = useState<number | null>(null);
  const [currentSubStep, setCurrentSubStep] = useState(1); // 1: style, 2: dimensions, 3: generate, 4: select

  const handleStyleChange = (styleId: string) => {
    updateData({
      visuals: {
        ...data.visuals,
        style: styleId
      }
    });
  };

  const handleContinueToNextSubStep = () => {
    setCurrentSubStep(prev => prev + 1);
  };

  const handleBackToPreviousSubStep = () => {
    setCurrentSubStep(prev => prev - 1);
  };

  const resetToStyleSelection = () => {
    setCurrentSubStep(1);
    setGeneratedVisuals([]);
    setSelectedVisualOption(null);
    updateData({
      visuals: {
        ...data.visuals,
        isComplete: false
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

  const handleGenerateVisuals = async () => {
    // Check if we have any text available
    if (!data.text?.generatedText && !data.text?.customText) {
      setError("Please complete Step 2 (Text) first before generating visuals.");
      return;
    }

    setError(null);
    setIsGeneratingVisuals(true);
    
    try {
      const finalText = data.text.generatedText || data.text.customText;
      const params = {
        finalText,
        category: data.category || "",
        subcategory: data.subcategory || "",
        subSubcategory: data.subSubcategory || "",
        tone: data.vibe?.tone || "Humorous",
        textStyle: data.vibe?.style || "Sarcastic",
        rating: data.vibe?.rating || "PG",
        insertWords: data.vibe?.insertWords || [],
        visualStyle: data.visuals?.style || "general",
        visualTaste: "balanced",
        customVisuals: data.visuals?.customVisuals || [],
        dimension: data.visuals?.dimension || "square"
      };
      
      const visuals = await generateVisualOptions(params);
      setGeneratedVisuals(visuals);
    } catch (error) {
      console.error("Failed to generate visuals:", error);
      setError(`Failed to generate visuals: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setGeneratedVisuals([]);
    } finally {
      setIsGeneratingVisuals(false);
    }
  };

  const handleVisualOptionSelect = (optionIndex: number) => {
    setSelectedVisualOption(optionIndex);
    const selectedVisual = generatedVisuals[optionIndex];
    updateData({
      visuals: {
        ...data.visuals,
        selectedVisualOption: optionIndex,
        selectedVisualRecommendation: selectedVisual,
        isComplete: true
      }
    });
  };

  const handleDimensionSelect = (dimensionId: string) => {
    updateData({
      visuals: {
        ...data.visuals,
        dimension: dimensionId
      }
    });
  };

  const selectedStyle = visualStyles.find(style => style.id === data.visuals?.style);
  const hasSelectedStyle = !!data.visuals?.style;
  const hasSelectedDimension = !!data.visuals?.dimension;
  const showGenerateButton = hasSelectedStyle && hasSelectedDimension;
  const showVisualOptions = generatedVisuals.length > 0;
  const isComplete = !!data.visuals?.isComplete;

  return <div className="space-y-6">
      {/* Category Breadcrumb */}
      {data.category && data.subcategory && (
        <div className="text-left mb-2">
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold">Your selection:</span> {data.category} &gt; {data.subcategory}
          </div>
        </div>
      )}

      {/* Text Summary */}
      <div className="text-left mb-6">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold">Your text: </span>
          <span>
            {data.text?.generatedText || data.text?.customText 
              ? `"${data.text.generatedText || data.text.customText}"` 
              : 'no text chosen'
            }
          </span>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center justify-center mb-6">
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                step <= currentSubStep ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {step}
              </div>
              {step < 4 && (
                <div className={cn(
                  "w-8 h-0.5 mx-1",
                  step < currentSubStep ? "bg-primary" : "bg-muted"
                )} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Selection Summary */}
      {currentSubStep > 1 && (
        <Card className="p-4 bg-accent/20">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              {hasSelectedStyle && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">Style:</span> 
                  <span className="text-primary">{selectedStyle?.title}</span>
                  {currentSubStep > 2 && (
                    <Button variant="ghost" size="sm" onClick={() => setCurrentSubStep(1)} className="h-6 px-2 text-xs">
                      Edit
                    </Button>
                  )}
                </div>
              )}
              {hasSelectedDimension && currentSubStep > 2 && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">Dimension:</span> 
                  <span className="text-primary">{data.visuals?.dimension}</span>
                  {currentSubStep > 3 && (
                    <Button variant="ghost" size="sm" onClick={() => setCurrentSubStep(2)} className="h-6 px-2 text-xs">
                      Edit
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Step 1: Visual Style Selection */}
      {currentSubStep === 1 && (
        <>
          <div className="text-center">
            <h2 className="mb-2 text-xl font-semibold text-foreground">
              Step 1: Choose your visual style
            </h2>
          </div>
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
                  <img src={style.preview} alt={style.title} className="w-full h-full object-cover" />
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-sm text-foreground">{style.title}</h3>
                  <p className="text-xs text-muted-foreground">{style.description}</p>
                </div>
              </Card>
            ))}
          </div>
          
          {hasSelectedStyle && currentSubStep === 1 && (
            <div className="pt-4 text-center">
              <Button onClick={handleContinueToNextSubStep} className="w-full">
                Continue to Dimensions
              </Button>
            </div>
          )}
        </>
      )}

      {/* Step 2: Dimensions Selection */}
      {currentSubStep === 2 && hasSelectedStyle && (
        <>
          <div className="text-center pt-6 pb-2">
            <h2 className="text-xl font-semibold text-foreground">
              Step 2: Choose your dimensions
            </h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {dimensionOptions.map(dimension => (
              <Card 
                key={dimension.id} 
                className={cn(
                  "cursor-pointer text-center transition-all duration-200 border-2 p-4 flex flex-col justify-center h-32",
                  data.visuals?.dimension === dimension.id 
                    ? "border-primary bg-accent" 
                    : "border-border hover:border-primary/50",
                  dimension.id === "custom" && "border-dashed"
                )} 
                onClick={() => handleDimensionSelect(dimension.id)}
              >
                <div className="flex justify-center mb-2">
                  <div className={cn("border-2 border-muted-foreground/30 bg-muted/20", {
                    "w-6 h-10": dimension.id === "portrait",
                    "w-8 h-8": dimension.id === "square", 
                    "w-12 h-6": dimension.id === "landscape",
                    "w-8 h-6 border-dashed": dimension.id === "custom"
                  })} />
                </div>
                <h4 className="mb-1 text-sm font-medium text-foreground">
                  {dimension.title}
                </h4>
                <p className="text-xs text-muted-foreground">{dimension.description}</p>
              </Card>
            ))}
          </div>

          {hasSelectedDimension && currentSubStep === 2 && (
            <div className="pt-4 flex gap-3">
              <Button variant="outline" onClick={handleBackToPreviousSubStep} className="flex-1">
                Back
              </Button>
              <Button onClick={handleContinueToNextSubStep} className="flex-1">
                Continue to Generate
              </Button>
            </div>
          )}
        </>
      )}

      {/* Step 3: Visual Tags and Generate */}
      {currentSubStep === 3 && showGenerateButton && !showVisualOptions && !isComplete && (
        <>
          <div className="text-center pt-6 pb-2">
            <h2 className="text-xl font-semibold text-foreground">
              Step 3: Generate AI Visuals
            </h2>
          </div>
          
          {/* Optional Visual Tags */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                Add specific visuals (optional)
              </h3>
            </div>
            
            <div className="flex gap-2">
              <Input 
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="e.g., dogs, mountains, cars..."
                className="flex-1"
              />
            </div>

            {data.visuals?.customVisuals && data.visuals.customVisuals.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {data.visuals.customVisuals.map((visual: string, index: number) => (
                  <div 
                    key={index} 
                    className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-full text-sm"
                  >
                    <span>{visual}</span>
                    <button 
                      onClick={() => handleRemoveTag(visual)}
                      className="hover:text-primary/60"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Generate Button */}
          <div className="pt-4">
            {error && (
              <Alert className="mb-4 border-destructive bg-destructive/10">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-destructive">
                  {error}
                </AlertDescription>
              </Alert>
            )}
            
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleBackToPreviousSubStep} className="flex-1">
                Back
              </Button>
              <Button 
                onClick={() => {
                  handleGenerateVisuals();
                  setCurrentSubStep(4);
                }}
                disabled={isGeneratingVisuals}
                className="flex-1 h-12 text-base font-medium"
              >
                {isGeneratingVisuals ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate 4 AI Visuals
                  </>
                )}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Step 4: Visual Selection */}
      {currentSubStep === 4 && (showVisualOptions || isGeneratingVisuals) && !isComplete && (
        <>
          <div className="text-center mb-6 pt-6">
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Step 4: Choose your visual concept
            </h2>
            <p className="text-sm text-muted-foreground">
              Select one of these AI-generated recommendations:
            </p>
          </div>

          {generatedVisuals.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {generatedVisuals.map((visual, index) => (
                <Card 
                  key={index} 
                  className={cn(
                    "cursor-pointer transition-all duration-200 border-2 p-4",
                    selectedVisualOption === index 
                      ? "border-primary bg-accent" 
                      : "border-border hover:border-primary/50"
                  )} 
                  onClick={() => handleVisualOptionSelect(index)}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm text-foreground">
                        Visual Concept {index + 1}
                      </h3>
                      {selectedVisualOption === index && (
                        <div className="w-2 h-2 bg-primary rounded-full" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground text-left">
                      {visual.description || visual.interpretation || `Visual recommendation ${index + 1}`}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          ) : isGeneratingVisuals ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
              <div className="text-muted-foreground">
                Generating your visual recommendations...
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-muted-foreground mb-4">
                No visual recommendations generated. Please try again.
              </div>
              <Button 
                variant="outline" 
                onClick={() => {
                  setGeneratedVisuals([]);
                  setCurrentSubStep(3);
                }}
              >
                Try Again
              </Button>
            </div>
          )}

          {generatedVisuals.length > 0 && (
            <div className="pt-4">
              <Button 
                variant="outline" 
                onClick={() => setCurrentSubStep(3)} 
                className="w-full"
              >
                Generate Different Options
              </Button>
            </div>
          )}
        </>
      )}

      {/* Completion State - Compact Summary */}
      {isComplete && (
        <Card className="cursor-pointer border-2 border-primary bg-accent/50 p-4" 
              onClick={() => resetToStyleSelection()}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-primary rounded-full" />
              <div className="text-left">
                <div className="text-sm font-medium text-foreground">
                  Style: {selectedStyle?.title} • Dimension: {data.visuals?.dimension}
                </div>
                <div className="text-xs text-muted-foreground">
                  Visual Concept {(data.visuals?.selectedVisualOption ?? 0) + 1} selected
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-xs">
              Edit
            </Button>
          </div>
        </Card>
      )}
    </div>;
}