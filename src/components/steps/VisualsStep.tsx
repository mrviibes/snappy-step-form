import { useState, KeyboardEvent } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { generateVisualOptions, type VisualRecommendation } from "@/lib/api";
import { Sparkles, Loader2, AlertCircle, ArrowRight } from "lucide-react";
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
  id: "realistic",
  title: "Realistic",
  description: "True photo",
  preview: realisticImage
}, {
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

const visualOptions = [{
  id: "ai-assist",
  title: "AI Visuals Assist",
  fullTitle: "Option 1 - AI Visuals Assist"
}, {
  id: "design-myself",
  title: "Design Visuals Myself",
  fullTitle: "Option 2 - Design Visuals Myself"
}, {
  id: "no-visuals",
  title: "Don't Want Visuals",
  fullTitle: "Option 3 - Don't Want Visuals"
}];

const visualTasteOptions = [{
  id: "balanced",
  label: "Balanced (default)"
}, {
  id: "cinematic",
  label: "Cinematic (dramatic)"
}, {
  id: "dreamlike",
  label: "Dreamlike (artsy)"
}, {
  id: "action",
  label: "Action (energy)"
}, {
  id: "exaggerated",
  label: "Exaggerated (extreme)"
}];

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
  
  const [showSpecificVisualsInput, setShowSpecificVisualsInput] = useState(false);
  const [generatedVisuals, setGeneratedVisuals] = useState<VisualRecommendation[]>([]);
  const [isGeneratingVisuals, setIsGeneratingVisuals] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customVisualDescription, setCustomVisualDescription] = useState('');
  const [showCustomVisualInput, setShowCustomVisualInput] = useState(false);
  const [showAiAssistComplete, setShowAiAssistComplete] = useState(false);

  const handleStyleChange = (styleId: string) => {
    updateData({
      visuals: {
        ...data.visuals,
        style: styleId
      }
    });
    // Immediately show dimensions after style selection
    setShowDimensions(true);
  };

  const handleVisualOptionChange = (optionId: string) => {
    // Clear any previous errors when switching options
    setError(null);
    
    updateData({
      visuals: {
        ...data.visuals,
        option: optionId,
        // Auto-set balanced as default when AI assist is selected
        visualTaste: optionId === 'ai-assist' ? 'balanced' : data.visuals?.visualTaste,
        // Clear any previous custom description if switching away from design-myself
        customVisualDescription: optionId === 'design-myself' ? data.visuals?.customVisualDescription || '' : undefined
      }
    });

    // If "AI Visuals Assist" is selected, show inline question (no popup)
    if (optionId === 'ai-assist') {
      setShowSpecificVisualsChoice(true);
      setShowCustomVisualInput(false);
      setShowSpecificVisualsInput(false);
      setShowVisualGeneration(false);
    } else if (optionId === 'design-myself') {
      // If "Design Visuals Myself" is selected, show custom input
      setShowCustomVisualInput(true);
      setShowSpecificVisualsChoice(false);
      setCustomVisualDescription(data.visuals?.customVisualDescription || '');
    } else {
      // For "no-visuals" option, hide all dialogs
      setShowSpecificVisualsChoice(false);
      setShowCustomVisualInput(false);
    }
  };

  const handleSpecificVisualsChoice = (hasVisuals: boolean) => {
    // Clear any previous errors
    setError(null);
    
    if (hasVisuals) {
      // Keep showing the choice section but switch to input mode
      setShowSpecificVisualsInput(true);
    } else {
      // For "No", go directly to completion
      setShowSpecificVisualsChoice(false);
      setShowAiAssistComplete(true);
      updateData({
        visuals: {
          ...data.visuals,
          aiAssistComplete: true
        }
      });
    }
  };

  const handleSaveCustomVisualDescription = () => {
    updateData({
      visuals: {
        ...data.visuals,
        customVisualDescription: customVisualDescription.trim()
      }
    });
    setShowCustomVisualInput(false);
    // Proceed to completion since we now have all required data
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

  const handleFinishAiAssist = () => {
    setShowSpecificVisualsChoice(false);
    setShowSpecificVisualsInput(false);
    setShowAiAssistComplete(true);
    updateData({
      visuals: {
        ...data.visuals,
        aiAssistComplete: true
      }
    });
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
    console.log("=== Visual Generation Debug ===");
    console.log("Current data structure:", {
      text: data.text,
      hasGeneratedText: !!data.text?.generatedText,
      hasCustomText: !!data.text?.customText,
      textComplete: data.text?.isComplete
    });

    // Check if we have any text available
    if (!data.text?.generatedText && !data.text?.customText) {
      console.error("No text available for visual generation");
      
      // Show error state instead of silent failure
      setError("Please complete Step 2 (Text) first before generating visuals.");
      setShowVisualGeneration(false);
      return;
    }

    // Clear any previous errors
    setError(null);
    setIsGeneratingVisuals(true);
    
    try {
      const finalText = data.text.generatedText || data.text.customText;
      console.log("Using text for generation:", finalText);
      
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
        visualTaste: data.visuals?.visualTaste || "balanced",
        customVisuals: data.visuals?.customVisuals || [],
        dimension: data.visuals?.dimension || "square"
      };

      console.log("Generating visuals with params:", params);
      const visuals = await generateVisualOptions(params);
      console.log("Generated visuals success:", visuals);
      
      setGeneratedVisuals(visuals);
      setShowVisualOptions(true);
    } catch (error) {
      console.error("Failed to generate visuals:", error);
      setError(`Failed to generate visuals: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Still show options but with empty generated visuals
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
  const hasSelectedDimension = !!data.visuals?.dimension;
  const hasSelectedOption = !!data.visuals?.option;
  const isComplete = hasSelectedStyle && hasSelectedDimension && hasSelectedOption;

  // Sample visual options (filler content)
  const visualOptionsSamples = [
    "Visual concept with vibrant colors and dynamic composition featuring modern elements and creative typography.",
    "Minimalist design approach with clean lines, balanced negative space and subtle color palette for elegant presentation.",
    "Bold and energetic visual style with striking contrasts, dramatic lighting and eye-catching graphic elements.",
    "Artistic and creative interpretation with unique textures, organic shapes and harmonious color combinations."
  ];

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

  return <div className="space-y-6">
      {/* Category Breadcrumb - Left aligned */}
      {data.category && data.subcategory && <div className="text-left mb-4">
          <div className="text-sm text-muted-foreground">
            Your selection: {data.category} &gt; {data.subcategory}
          </div>
        </div>}

      {/* Text Summary from Step 2 */}
      <div className="text-left mb-6">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold">Your text: </span>
          <span>
            {data.text?.generatedText || data.text?.customText ? `"${data.text.generatedText || data.text.customText}"` : 'no text chosen'}
          </span>
        </div>
      </div>

      {/* Step 1: Visual Style Selection */}
      {!hasSelectedStyle && <>
          <div className="text-center">
            <h2 className="mb-2 text-xl font-semibold text-foreground">
              Choose your visual style
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {visualStyles.map(style => <Card key={style.id} className={cn("cursor-pointer transition-all duration-200 overflow-hidden border-2", data.visuals?.style === style.id ? "border-primary bg-accent" : "border-border hover:border-primary/50")} onClick={() => handleStyleChange(style.id)}>
                <div className="aspect-video relative">
                  <img src={style.preview} alt={style.title} className="w-full h-full object-cover" />
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-sm text-foreground">{style.title}</h3>
                  <p className="text-xs text-muted-foreground">{style.description}</p>
                </div>
              </Card>)}
          </div>
        </>}

      {/* Step 2: Dimensions Selection - show after style selection */}
      {hasSelectedStyle && !hasSelectedDimension && <>
          {/* Selected Style Summary */}
          <Card className="border-2 border-primary bg-accent p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-foreground">
                Style - {selectedStyle?.title}
              </div>
              <Button variant="ghost" size="sm" onClick={() => {
            handleStyleChange("");
            setShowDimensions(false);
          }} className="text-xs text-cyan-500 hover:text-cyan-600 hover:bg-cyan-50">
                Edit
              </Button>
            </div>
          </Card>

          <div className="text-center pt-4 pb-2">
            <h2 className="text-xl font-semibold text-foreground">
              Choose your dimensions:
            </h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {dimensionOptions.map(dimension => <Card key={dimension.id} className={cn("cursor-pointer text-center transition-all duration-300 ease-spring hover:shadow-card-hover hover:scale-105", "border-2 bg-gradient-card p-4 flex flex-col justify-center h-32", {
          "border-primary shadow-primary bg-accent": data.visuals?.dimension === dimension.id,
          "border-border": data.visuals?.dimension !== dimension.id,
          "border-dashed": dimension.id === "custom"
        })} onClick={() => handleDimensionSelect(dimension.id)}>
                {/* Visual representation of aspect ratio */}
                <div className="flex justify-center mb-2">
                  <div className={cn("border-2 border-muted-foreground/30 bg-muted/20", {
              "w-6 h-10": dimension.id === "portrait",
              // 9:16 representation
              "w-8 h-8": dimension.id === "square",
              // 1:1 representation
              "w-12 h-6": dimension.id === "landscape",
              // 16:9 representation
              "w-8 h-6 border-dashed": dimension.id === "custom" // custom representation
            })} />
                </div>
                
                <h4 className="mb-1 text-sm font-medium text-foreground">
                  {dimension.title}
                </h4>
                <p className="text-xs text-muted-foreground">{dimension.description}</p>
              </Card>)}
          </div>
        </>}

      {/* Step 3: Visual Options - show after dimensions selection */}
      {hasSelectedStyle && hasSelectedDimension && !hasSelectedOption && <>
          {/* Selected Style and Dimension Summary */}
          <Card className="border-2 border-primary bg-accent p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">
                    Style - {selectedStyle?.title}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => {
              handleStyleChange("");
              setShowDimensions(false);
              updateData({
                visuals: {
                  style: "",
                  dimension: ""
                }
              });
            }} className="text-xs text-cyan-500 hover:text-cyan-600 hover:bg-cyan-50">
                  Edit
                </Button>
              </div>
              
              <div className="h-px bg-border"></div>
              
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-foreground">Dimension - </span>
                  <span className="text-sm text-foreground">
                    {dimensionOptions.find(option => option.id === data.visuals?.dimension)?.title}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => {
              setShowDimensions(true);
              updateData({
                visuals: {
                  ...data.visuals,
                  dimension: ""
                }
              });
            }} className="text-xs text-cyan-500">
                  Edit
                </Button>
              </div>
            </div>
          </Card>

          {/* Visual Options */}
          <div className="pt-4">
            <div className="text-center mb-4">
              <h2 className="text-xl font-semibold text-foreground">
                Choose your visual process
              </h2>
            </div>
            <div className="space-y-3">
              {visualOptions.map(option => <Button key={option.id} variant={data.visuals?.option === option.id ? "default" : "outline"} className={cn("w-full h-12 text-sm font-medium transition-all duration-300", data.visuals?.option === option.id ? "bg-cyan-400 hover:bg-cyan-500 text-white border-cyan-400" : "hover:bg-accent border-border")} onClick={() => handleVisualOptionChange(option.id)}>
                  {option.fullTitle}
                </Button>)}
            </div>
          </div>
        </>}

      {/* Step 4: AI Assist Flow and Completion - only when all options are selected */}
      {hasSelectedStyle && hasSelectedDimension && hasSelectedOption && <>
          {/* Selected Style and Dimension Summary - Always show when all are selected */}
          <Card className="border-2 border-primary bg-accent p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">
                    Style - {selectedStyle?.title}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => {
              handleStyleChange("");
              setShowDimensions(false);
              updateData({
                visuals: {
                  style: "",
                  dimension: ""
                }
              });
            }} className="text-xs text-cyan-500 hover:text-cyan-600 hover:bg-cyan-50">
                  Edit
                </Button>
              </div>
              
              <div className="h-px bg-border"></div>
              
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-foreground">Dimension - </span>
                  <span className="text-sm text-foreground">
                    {dimensionOptions.find(option => option.id === data.visuals?.dimension)?.title}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => {
              setShowDimensions(true);
              updateData({
                visuals: {
                  ...data.visuals,
                  dimension: ""
                }
                });
              }} className="text-xs text-cyan-500">
                  Edit
                </Button>
              </div>

              <div className="h-px bg-border"></div>
              
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-foreground">Process - </span>
                  <span className="text-sm text-foreground">
                    {selectedOption?.title}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => {
              updateData({
                visuals: {
                  ...data.visuals,
                  option: ""
                }
              });
            }} className="text-xs text-cyan-500">
                  Edit
                </Button>
              </div>
            </div>
          </Card>

          {/* All the remaining sections for AI Assist flow */}
          {data.visuals?.option === "ai-assist" && <>
              {/* Specific Visuals Choice Section */}
              {showSpecificVisualsChoice && <div className="space-y-4 pt-4">
                  <div className="text-center">
                    <h2 className="text-xl font-semibold text-foreground">Do you have any specific visuals you want included?</h2>
                    <div className="mt-3">
                      <p className="text-sm text-muted-foreground text-center">eg. Dogs, Mountains, Cars, etc.</p>
                    </div>
                  </div>

                  {!showSpecificVisualsInput ? (
                    <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => handleSpecificVisualsChoice(true)} className="rounded-lg border-2 p-6 text-center transition-all duration-300 ease-smooth border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-accent/50">
                        <div className="font-semibold text-lg">Yes</div>
                      </button>
                      <button onClick={() => handleSpecificVisualsChoice(false)} className="rounded-lg border-2 p-6 text-center transition-all duration-300 ease-smooth border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-accent/50">
                        <div className="font-semibold text-lg">No</div>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleAddTag} placeholder="Type a visual and press Enter" className="w-full py-3 text-center" />
                      
                      {/* Display visual tags */}
                      {data.visuals?.customVisuals && data.visuals.customVisuals.length > 0 && <div className="flex flex-wrap gap-2">
                          {data.visuals.customVisuals.map((visual: string, index: number) => <div key={index} className="flex items-center gap-2 bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm">
                              <span>{visual}</span>
                              <button onClick={() => handleRemoveTag(visual)} className="text-muted-foreground hover:text-foreground transition-colors">
                                ×
                              </button>
                            </div>)}
                        </div>}

                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowSpecificVisualsInput(false);
                          }}
                          className="flex-1"
                        >
                          Back
                        </Button>
                        <Button
                          onClick={() => {
                            setShowSpecificVisualsChoice(false);
                            setShowAiAssistComplete(true);
                            updateData({
                              visuals: {
                                ...data.visuals,
                                aiAssistComplete: true
                              }
                            });
                          }}
                          className="flex-1 bg-primary hover:bg-primary/90"
                        >
                          Continue
                        </Button>
                      </div>
                    </div>
                  )}
                </div>}

              {/* Custom Visuals Input */}
              {!showVisualGeneration && !showSpecificVisualsChoice && <div className="space-y-4 pt-4">
                  <div className="text-center">
                    <h2 className="text-xl font-semibold text-foreground">Inserted Visuals (optional)</h2>
                    <div className="mt-3">
                      <p className="text-sm text-muted-foreground text-center">eg. Dogs, Mountains, Cars etc.</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleAddTag} placeholder="Enter visuals you want included into your final image" className="w-full py-6 min-h-[72px] text-center" />
                    
                    {/* Enhanced visual feedback when tags are added */}
                    {data.visuals?.customVisuals && data.visuals.customVisuals.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-center space-x-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                          <span className="font-medium">
                            {data.visuals.customVisuals.length} visual{data.visuals.customVisuals.length !== 1 ? 's' : ''} saved
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {data.visuals.customVisuals.map((visual: string, index: number) => (
                            <div key={index} className="flex items-center space-x-2 bg-primary/10 border border-primary/20 rounded-full px-3 py-1">
                              <span className="text-xs font-medium text-primary">{visual}</span>
                              <button 
                                onClick={() => handleRemoveTag(visual)}
                                className="text-primary/60 hover:text-primary text-xs font-bold leading-none"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Done Adding Visuals Button - show when they have tags or want to finish */}
                    {(data.visuals?.customVisuals && data.visuals.customVisuals.length > 0) && (
                      <div className="text-center mt-4">
                        <Button 
                          onClick={handleFinishAiAssist}
                          className="bg-gradient-primary text-white px-8 py-3 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-xl"
                        >
                          Done Adding Visuals
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    {/* No Specific Visuals Button - show when no visuals added yet */}
                    {(!data.visuals?.customVisuals || data.visuals.customVisuals.length === 0) && (
                      <div className="text-center">
                        <Button 
                          onClick={handleFinishAiAssist}
                          variant="outline"
                          className="px-6 py-3 rounded-lg font-medium transition-colors"
                        >
                          I don't want any specific visuals
                        </Button>
                      </div>
                    )}
                  </div>
                </div>}

              {/* Style Selection and Generate Button - show together */}
              {showVisualGeneration && !showVisualOptions && <div className="space-y-4">
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-foreground">
                      Style
                    </label>
                    <Select value={data.visuals?.visualTaste || "balanced"} onValueChange={handleVisualTasteChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose style" />
                      </SelectTrigger>
                      <SelectContent>
                        {visualTasteOptions.map(option => <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Error Display */}
                  {error && (
                    <Alert className="border-destructive bg-destructive/10">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-destructive">
                        {error}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Generate Visuals Button */}
                  <div className="w-full space-y-3">
                    <Button onClick={handleGenerateVisuals} disabled={isGeneratingVisuals} className="w-full bg-cyan-400 hover:bg-cyan-500 disabled:bg-gray-400 text-white py-3 rounded-md font-medium min-h-[48px] text-base shadow-lg hover:shadow-xl transition-all duration-200">
                      {isGeneratingVisuals ? <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating visuals...
                        </> : <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Visuals
                        </>}
                    </Button>
                    
                    {/* Debug Info - remove in production */}
                    <div className="text-xs text-muted-foreground text-center">
                      Text available: {!!data.text?.generatedText || !!data.text?.customText ? '✓' : '✗'} |
                      Has generated: {!!data.text?.generatedText ? '✓' : '✗'} |
                      Has custom: {!!data.text?.customText ? '✓' : '✗'}
                    </div>
                  </div>
                </div>}

            </>}

          {/* Design Visuals Myself Flow */}
          {data.visuals?.option === "design-myself" && <>
            {showCustomVisualInput && (
              <div className="space-y-4 pt-4">
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-foreground">
                    Describe your visual
                  </h2>
                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground">
                      Describe what you want your visual to look like (max 100 characters)
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="relative">
                    <textarea
                      value={customVisualDescription}
                      onChange={(e) => {
                        if (e.target.value.length <= 100) {
                          setCustomVisualDescription(e.target.value);
                        }
                      }}
                      placeholder="e.g., A sunset over mountains with golden light..."
                      className="w-full p-4 border-2 border-border rounded-lg resize-none h-24 text-sm focus:outline-none focus:border-primary transition-colors"
                      maxLength={100}
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                      {customVisualDescription.length}/100
                    </div>
                  </div>

                  {error && (
                    <Alert className="border-destructive bg-destructive/10">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-destructive">
                        {error}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCustomVisualInput(false);
                        updateData({
                          visuals: {
                            ...data.visuals,
                            option: ""
                          }
                        });
                      }}
                      className="flex-1"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleSaveCustomVisualDescription}
                      disabled={customVisualDescription.trim().length === 0}
                      className="flex-1 bg-primary hover:bg-primary/90"
                    >
                      Save & Continue
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {!showCustomVisualInput && data.visuals?.customVisualDescription && (
              <div className="space-y-4 pt-4">
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-foreground mb-4">
                    Ready to complete!
                  </h2>
                </div>
                
                <Card className="p-4 border-2 border-primary bg-accent">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-foreground mb-1">
                        Your Visual Description:
                      </div>
                      <div className="text-sm text-muted-foreground">
                        "{data.visuals.customVisualDescription}"
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setShowCustomVisualInput(true);
                        setCustomVisualDescription(data.visuals?.customVisualDescription || '');
                      }}
                      className="text-xs text-cyan-500"
                    >
                      Edit
                    </Button>
                  </div>
                </Card>

                <div className="text-center">
                  <Button
                    onClick={() => {
                      // Mark as complete and proceed
                      updateData({
                        visuals: {
                          ...data.visuals,
                          isComplete: true
                        }
                      });
                    }}
                    className="w-full bg-primary hover:bg-primary/90 py-3"
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Complete Visuals Step
                  </Button>
                </div>
              </div>
            )}
          </>}

          {/* AI Assist Completion */}
          {data.visuals?.option === "ai-assist" && showAiAssistComplete && (
            <div className="space-y-4 pt-4">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  Ready to complete!
                </h2>
              </div>
              
              <Card className="p-4 border-2 border-primary bg-accent">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground mb-1">
                      Your Visual Process:
                    </div>
                    <div className="text-sm text-muted-foreground">
                      AI Visuals Assist {data.visuals?.customVisuals && data.visuals.customVisuals.length > 0 
                        ? `with custom visuals: ${data.visuals.customVisuals.join(', ')}`
                        : 'without specific visuals'
                      }
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setShowAiAssistComplete(false);
                      setShowSpecificVisualsChoice(true);
                    }}
                    className="text-xs text-cyan-500"
                  >
                    Edit
                  </Button>
                </div>
              </Card>

              <div className="text-center">
                <Button
                  onClick={() => {
                    // Mark as complete and proceed
                    updateData({
                      visuals: {
                        ...data.visuals,
                        isComplete: true
                      }
                    });
                  }}
                  className="w-full bg-primary hover:bg-primary/90 py-3"
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Complete Visuals Step
                </Button>
              </div>
            </div>
          )}
        </>}

    </div>;
}