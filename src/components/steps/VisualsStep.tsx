import { useState, KeyboardEvent } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { generateVisualOptions, type VisualRecommendation } from "@/lib/api";
import { Sparkles, Loader2, AlertCircle, X } from "lucide-react";
import DebugPanel from "@/components/DebugPanel";
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
const customVisualStyles = [{
  value: "cinematic",
  label: "Cinematic – Wide"
}, {
  value: "closeup",
  label: "Close-up – Detail"
}, {
  value: "crowd",
  label: "Crowd Reaction – Group"
}, {
  value: "minimalist",
  label: "Minimalist – Simple"
}, {
  value: "exaggerated",
  label: "Exaggerated Proportions – Exaggerated"
}, {
  value: "goofy",
  label: "Goofy Absurd – Goofy"
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
  const [editingStyle, setEditingStyle] = useState(false);
  const [editingDimension, setEditingDimension] = useState(false);
  const [selectedCustomVisualStyle, setSelectedCustomVisualStyle] = useState<string>("cinematic");
  const [debugInfo, setDebugInfo] = useState<{
    timestamp: string;
    step: string;
    params?: any;
    formData?: any;
    apiResponse?: any;
    visualsCount?: number;
    error?: any;
  } | null>(null);
  const handleStyleChange = (styleId: string) => {
    updateData({
      visuals: {
        ...data.visuals,
        style: styleId
      }
    });
    setEditingStyle(false);
  };
  const resetToStyleSelection = () => {
    setGeneratedVisuals([]);
    setSelectedVisualOption(null);
    setEditingStyle(true);
    setEditingDimension(false);
    updateData({
      visuals: {
        ...data.visuals,
        isComplete: false
      }
    });
  };
  const handleAddTag = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      const currentVisuals = data.visuals?.insertedVisuals || [];
      if (!currentVisuals.includes(tagInput.trim())) {
        updateData({
          visuals: {
            ...data.visuals,
            insertedVisuals: [...currentVisuals, tagInput.trim()]
          }
        });
      }
      setTagInput('');
    }
  };
  const handleRemoveTag = (visualToRemove: string) => {
    const currentVisuals = data.visuals?.insertedVisuals || [];
    updateData({
      visuals: {
        ...data.visuals,
        insertedVisuals: currentVisuals.filter((visual: string) => visual !== visualToRemove)
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
        tone: data.vibe?.tone || "Humorous",
        textStyle: data.vibe?.style || "Sarcastic",
        rating: data.vibe?.rating || "PG",
        insertWords: data.vibe?.insertWords || [],
        visualStyle: data.visuals?.style || "general",
        insertedVisuals: data.visuals?.insertedVisuals || [],
        dimension: data.visuals?.dimension || "square"
      };
      // Set debug info before API call
      setDebugInfo({
        timestamp: new Date().toISOString(),
        step: 'API_CALL_START',
        params,
        formData: {
          category: data.category,
          subcategory: data.subcategory,
          theme: data.theme,
          text: data.text,
          vibe: data.vibe,
          visuals: data.visuals
        }
      });

      const visuals = await generateVisualOptions(params);
      console.log('📥 Received visuals from API:', visuals);
      
      // Update debug info with API response
      setDebugInfo(prev => ({
        ...prev!,
        step: 'API_CALL_SUCCESS',
        apiResponse: visuals,
        visualsCount: visuals.length
      }));
      
      setGeneratedVisuals(visuals);
      console.log('💾 Set generatedVisuals to:', visuals);
    } catch (error) {
      console.error("Failed to generate visuals:", error);
      
      // Update debug info with error
      setDebugInfo(prev => ({
        ...prev!,
        step: 'API_CALL_ERROR',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          type: typeof error,
          raw: error
        }
      }));
      
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
        option: `visual-concept-${optionIndex + 1}`,
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
    setEditingDimension(false);
  };
  // Initialize with no default style to force selection
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
            <span className="font-semibold">Your selection:</span> {data.category} &gt; {data.subcategory}{data.theme ? ` > ${data.theme}` : ''}
          </div>
        </div>
      )}

      {/* Text Summary */}
      <div className="text-left mb-6">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold">Your text: </span>
          <span>
            {data.text?.generatedText || data.text?.customText ? `"${data.text.generatedText || data.text.customText}"` : 'no text chosen'}
          </span>
        </div>
      </div>

      {/* Compact Style Summary - Consistent with other edit sections */}
      {hasSelectedStyle && !editingStyle && <Card className="p-4 bg-card border-2 border-cyan-400">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">Style: {selectedStyle?.title}</div>
              <div className="text-xs text-muted-foreground">{selectedStyle?.description}</div>
            </div>
            <button onClick={() => setEditingStyle(true)} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">
              Edit
            </button>
          </div>
        </Card>}

      {/* Visual Style Selection - Always show first, more prominent */}
      {(!hasSelectedStyle || editingStyle) && <>
          <div className="text-center">
            <h2 className="mb-2 text-xl font-semibold text-foreground">
              Choose your visual style
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Select the artistic style for your image
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {visualStyles.map(style => <Card key={style.id} className={cn("cursor-pointer transition-all duration-200 overflow-hidden border-2 hover:shadow-md", data.visuals?.style === style.id ? "border-primary bg-accent ring-2 ring-primary/20" : "border-border hover:border-primary/50")} onClick={() => handleStyleChange(style.id)}>
                <div className="aspect-video relative">
                  <img src={style.preview} alt={style.title} className="w-full h-full object-cover" />
                  {data.visuals?.style === style.id && <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <div className="w-3 h-3 bg-white rounded-full" />
                    </div>}
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-sm text-foreground">{style.title}</h3>
                  <p className="text-xs text-muted-foreground">{style.description}</p>
                </div>
              </Card>)}
          </div>
        </>}

      {/* Compact Dimension Summary */}
      {hasSelectedDimension && !editingDimension && hasSelectedStyle && !editingStyle && <Card className="p-4 bg-card border-2 border-cyan-400">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">Dimension: {data.visuals?.dimension?.charAt(0).toUpperCase() + data.visuals?.dimension?.slice(1)}</div>
              <div className="text-xs text-muted-foreground">
                {dimensionOptions.find(d => d.id === data.visuals?.dimension)?.description}
              </div>
            </div>
            <button onClick={() => setEditingDimension(true)} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">
              Edit
            </button>
          </div>
        </Card>}

      {/* Dimensions Selection */}
      {hasSelectedStyle && !editingStyle && (!hasSelectedDimension || editingDimension) && <>
          <div className="text-center pt-6 pb-2">
            <h2 className="text-xl font-semibold text-foreground">
              Choose your dimensions
            </h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {dimensionOptions.map(dimension => <Card key={dimension.id} className={cn("cursor-pointer text-center transition-all duration-200 border-2 p-4 flex flex-col justify-center h-32", data.visuals?.dimension === dimension.id ? "border-primary bg-accent" : "border-border hover:border-primary/50", dimension.id === "custom" && "border-dashed")} onClick={() => handleDimensionSelect(dimension.id)}>
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
              </Card>)}
          </div>
        </>}

      {/* Visual Tags and Generate */}
      {showGenerateButton && !showVisualOptions && !isComplete && !editingStyle && !editingDimension && <>
          
          
          {/* Optional Visual Tags */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Optional - any specific visuals?</h3>
            </div>
            
            <div className="flex gap-2">
              <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleAddTag} placeholder="e.g., dogs, mountains, cars..." className="flex-1" />
            </div>

            {data.visuals?.insertedVisuals && data.visuals.insertedVisuals.length > 0 && <div className="flex flex-wrap gap-2">
                {data.visuals.insertedVisuals.map((visual: string, index: number) => <div key={index} className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-full text-sm">
                    <span>{visual}</span>
                    <button onClick={() => handleRemoveTag(visual)} className="hover:text-primary/60">
                      <X className="h-3 w-3" />
                    </button>
                  </div>)}
              </div>}
          </div>

          {/* Generate Section with Dropdown */}
          <div className="pt-4 space-y-4">
            {error && <Alert className="mb-4 border-destructive bg-destructive/10">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-destructive">
                  {error}
                </AlertDescription>
              </Alert>}
            
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                
                <Select value={selectedCustomVisualStyle} onValueChange={setSelectedCustomVisualStyle}>
                  <SelectTrigger className="w-full h-12 bg-background border-2 border-border hover:border-primary/50 focus:border-primary z-50">
                    <SelectValue placeholder="Visual Style" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border shadow-lg z-50">
                    {customVisualStyles.map(style => <SelectItem key={style.value} value={style.value} className="hover:bg-accent">
                        {style.label}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              
              <Button onClick={handleGenerateVisuals} disabled={isGeneratingVisuals} className="flex-1 h-12 text-base font-medium">
                {isGeneratingVisuals ? <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </> : <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate 4 AI Visuals
                  </>}
              </Button>
            </div>
          </div>
        </>}

          {/* Visual Selection */}
          {(showVisualOptions || isGeneratingVisuals) && !isComplete && !editingStyle && !editingDimension && <>
              {/* Debug Panel for Visuals Generation */}
              {debugInfo && (
                <DebugPanel
                  title="Visual Generation Debug"
                  model="server-selected"
                  status={debugInfo.step === 'API_CALL_START' ? 'sending...' : 
                         debugInfo.step === 'API_CALL_SUCCESS' ? 'completed' :
                         debugInfo.step === 'API_CALL_ERROR' ? 'error' : 'idle'}
                  endpoint="generate-visuals"
                  timestamp={debugInfo.timestamp}
                  requestPayload={debugInfo.params}
                  responseData={debugInfo.apiResponse}
                  formData={debugInfo.formData}
                  error={debugInfo.error}
                  className="mb-6"
                />
              )}

              <div className="text-center mb-6 pt-6">
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Select a visual recommendation
                </h2>
                <p className="text-sm text-muted-foreground">
                  Select one of these AI-generated recommendations:
                </p>
              </div>

          {generatedVisuals.length > 0 ? <div className="grid grid-cols-1 gap-4">
              {generatedVisuals.map((visual, index) => <Card key={index} className={cn("cursor-pointer transition-all duration-200 border-2 p-4", selectedVisualOption === index ? "border-primary bg-accent" : "border-border hover:border-primary/50")} onClick={() => handleVisualOptionSelect(index)}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm text-foreground">
                        Visual Concept {index + 1}
                      </h3>
                      {selectedVisualOption === index && <div className="w-2 h-2 bg-primary rounded-full" />}
                    </div>
                    <p className="text-xs text-muted-foreground text-left">
                      {visual.description || visual.interpretation || `Visual recommendation ${index + 1}`}
                    </p>
                  </div>
                </Card>)}
            </div> : isGeneratingVisuals ? <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            </div> : <div className="text-center py-8">
              <div className="text-muted-foreground mb-4">
                No visual recommendations generated. Please try again.
              </div>
              <Button variant="outline" onClick={() => setGeneratedVisuals([])}>
                Try Again
              </Button>
            </div>}
        </>}

      {/* Completion State - Compact Summary */}
      {isComplete && <Card className="cursor-pointer border-2 border-primary bg-accent/50 p-4" onClick={resetToStyleSelection}>
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
        </Card>}
    </div>;
}