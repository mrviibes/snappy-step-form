import { useState, KeyboardEvent, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { generateVisualOptions, type GenerateVisualsResponse, type VisualOption } from "@/lib/api";
import { Loader2, AlertCircle, X } from "lucide-react";
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
const compositionModes = [{
  id: "cinematic",
  title: "Cinematic",
  description: "Wide, dramatic framing with storytelling energy"
}, {
  id: "close-up",
  title: "Close-Up",
  description: "Tight focus on a face or key detail"
}, {
  id: "goofy",
  title: "Goofy",
  description: "Fun, exaggerated, or absurd layouts"
}, {
  id: "surreal",
  title: "Surreal",
  description: "Dreamlike, artistic compositions"
}, {
  id: "minimal",
  title: "Minimal",
  description: "Clean, centered, simple framing"
}];
export default function VisualsStep({
  data,
  updateData
}: VisualsStepProps) {
  const [generatedVisuals, setGeneratedVisuals] = useState<VisualOption[]>([]);
  const [isGeneratingVisuals, setIsGeneratingVisuals] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVisualOption, setSelectedVisualOption] = useState<number | null>(null);
  const [editingStyle, setEditingStyle] = useState(false);
  const [editingDimension, setEditingDimension] = useState(false);
  const [editingComposition, setEditingComposition] = useState(false);
  const [visualInput, setVisualInput] = useState('');
  const [debugInfo, setDebugInfo] = useState<{
    timestamp: string;
    step: string;
    params?: any;
    formData?: any;
    apiResponse?: any;
    visualsCount?: number;
    model?: string;
    error?: any;
  } | null>(null);
  const handleAddVisual = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && visualInput.trim()) {
      const input = visualInput.trim().replace(/,$/g, '');
      const currentVisuals = data.visuals?.insertedVisuals || [];
      if (currentVisuals.length >= 3) {
        return;
      }
      if (input.length < 2 || input.length > 50) {
        return;
      }
      if (currentVisuals.some((v: string) => v.toLowerCase() === input.toLowerCase())) {
        return;
      }
      updateData({
        visuals: {
          ...data.visuals,
          insertedVisuals: [...currentVisuals, input]
        }
      });
      setVisualInput('');
      if (e.key === ',') e.preventDefault();
    }
  };
  const handleRemoveVisual = (visualToRemove: string) => {
    const currentVisuals = data.visuals?.insertedVisuals || [];
    updateData({
      visuals: {
        ...data.visuals,
        insertedVisuals: currentVisuals.filter((v: string) => v !== visualToRemove)
      }
    });
  };
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
  // Helper to build concrete scene descriptions from topics/tags
  const buildSubjectScene = (topics: string[], text: string): string => {
    const t = topics.map(s => s.toLowerCase());
    const hasPersonName = t.some(s => /\b[A-Z][a-z]+\b/.test(s));
    
    // Identity/lifestyle reframes to situational ad scenes
    if (t.some(s => /advertisement/.test(s))) {
      if (t.some(s => /\bgay|coming out|pride\b/.test(s))) {
        const name = topics.find(s => /\b[A-Z][a-z]+\b/.test(s)) || "Someone";
        return `${name} celebrating coming out with friends on a city street at sunset, pride flags and confetti in the background`;
      }
      if (t.some(s => /\bdrag|performance\b/.test(s))) {
        return "Drag performer backstage in a dressing room with mirror lights and makeup brushes";
      }
    }
    
    // Birthday/celebrations
    if (t.some(s => /birthday|celebration/.test(s))) {
      const name = topics.find(s => /\b[A-Z][a-z]+\b/.test(s)) || "Someone";
      return `${name} laughing with friends at a birthday party with cake and balloons`;
    }
    
    // Sports
    if (t.some(s => /sport|football|basketball|soccer/.test(s))) {
      return "Athlete in action on the field with teammates and stadium in background";
    }
    
    // Generic fallback with concrete elements
    if (hasPersonName) {
      const name = topics.find(s => /\b[A-Z][a-z]+\b/.test(s));
      return `${name} in a real-world setting that matches the caption's energy`;
    }
    
    return "A real person in a relatable environment that fits the caption";
  };

  const handleGenerateVisuals = async () => {
    const finalText = data.text?.selectedLine || data.text?.generatedText || data.text?.customText || "";
    const topics: string[] = Array.isArray(data.topics) ? data.topics.slice(0, 3) : Array.isArray(data.tags) ? data.tags.slice(0, 3) : [];
    const optional_visuals: string[] = data.visuals?.insertedVisuals || [];
    const customVisualStyles = [{
      value: "cinematic",
      label: "Cinematic"
    }, {
      value: "close-up",
      label: "Close-Up"
    }, {
      value: "goofy",
      label: "Goofy"
    }, {
      value: "surreal",
      label: "Surreal"
    }, {
      value: "minimal",
      label: "Minimal"
    }];
    const composition = customVisualStyles.find(s => s.value === data.visuals?.compositionMode)?.label || "Cinematic";
    if (!finalText.trim()) {
      setError("Please complete Step 2 (Text) first before generating visuals.");
      return;
    }
    
    // Build concrete subject scene
    const subjectScene = buildSubjectScene(topics, finalText);
    
    setIsGeneratingVisuals(true);
    setError(null);
    try {
      const resp = await generateVisualOptions({
        topics,
        text: finalText,
        optional_visuals,
        composition: composition as any,
        subjectScene
      });
      setGeneratedVisuals(resp.visuals);
      setDebugInfo({
        timestamp: new Date().toISOString(),
        step: "API_CALL_SUCCESS",
        params: {
          topics,
          optional_visuals,
          composition,
          text: finalText
        },
        apiResponse: resp,
        visualsCount: resp.visuals.length,
        model: resp.model
      });
    } catch (e: any) {
      setError(e?.message || "Failed to generate visuals");
      setGeneratedVisuals([]);
      setDebugInfo({
        timestamp: new Date().toISOString(),
        step: "API_CALL_ERROR",
        error: e
      });
    } finally {
      setIsGeneratingVisuals(false);
    }
  };
  const handleVisualOptionSelect = (optionIndex: number) => {
    setSelectedVisualOption(optionIndex);
    const selected = generatedVisuals[optionIndex];
    updateData({
      visuals: {
        ...data.visuals,
        selectedVisualOption: optionIndex,
        selectedVisualRecommendation: selected,
        // now a VisualOption object
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
  const handleWritingProcessSelect = (process: 'ai' | 'manual' | 'random') => {
    updateData({
      visuals: {
        ...data.visuals,
        writingProcess: process
      }
    });
    if (process === 'manual' || process === 'random') {
      updateData({
        visuals: {
          ...data.visuals,
          writingProcess: process,
          isComplete: true
        }
      });
    }
  };
  const handleCompositionSelect = (modeId: string) => {
    updateData({
      visuals: {
        ...data.visuals,
        compositionMode: modeId
      }
    });
    setEditingComposition(false);
  };
  const handleEditComposition = () => {
    setEditingComposition(true);
    updateData({
      visuals: {
        ...data.visuals,
        compositionMode: undefined
      }
    });
  };
  const handleEditStyle = () => {
    setEditingStyle(true);
    setEditingDimension(false);
  };
  const handleEditDimension = () => {
    setEditingDimension(true);
    setEditingStyle(false);
  };
  const handleEditProcess = () => {
    updateData({
      visuals: {
        ...data.visuals,
        writingProcess: undefined
      }
    });
  };
  const handleEditVisualConcept = () => {
    setGeneratedVisuals([]);
    setSelectedVisualOption(null);
    updateData({
      visuals: {
        ...data.visuals,
        selectedVisualOption: undefined,
        selectedVisualRecommendation: undefined,
        isComplete: false
      }
    });
  };
  const selectedStyle = visualStyles.find(style => style.id === data.visuals?.style);
  const selectedComposition = compositionModes.find(mode => mode.id === data.visuals?.compositionMode);
  const hasSelectedStyle = !!data.visuals?.style;
  const hasSelectedDimension = !!data.visuals?.dimension;
  const hasSelectedWritingProcess = !!data.visuals?.writingProcess;
  const hasSelectedComposition = !!data.visuals?.compositionMode;
  const showGenerateButton = hasSelectedStyle && hasSelectedDimension && hasSelectedWritingProcess && data.visuals?.writingProcess === 'ai';
  const showVisualOptions = generatedVisuals.length > 0;
  const isComplete = !!data.visuals?.isComplete;

  // Set default composition to cinematic
  useEffect(() => {
    if (hasSelectedWritingProcess && data.visuals?.writingProcess === 'ai' && !data.visuals?.compositionMode) {
      updateData({
        visuals: {
          ...data.visuals,
          compositionMode: 'cinematic'
        }
      });
    }
  }, [hasSelectedWritingProcess, data.visuals?.writingProcess, data.visuals?.compositionMode]);
  return <div className="space-y-6">
      {/* Tags Breadcrumb */}
      {data.tags && data.tags.length > 0 && <div className="text-left mb-1">
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold">Your topics:</span> {data.tags.join(' > ')}
          </div>
        </div>}

      {/* Text Summary */}
      <div className="text-left mb-4">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold">Your text: </span>
          <span>
            {data.text?.generatedText || data.text?.customText ? `"${data.text.generatedText || data.text.customText}"` : 'no text chosen'}
          </span>
        </div>
      </div>

      {/* Consolidated Summary Card */}
      {(hasSelectedStyle || hasSelectedDimension || hasSelectedWritingProcess || hasSelectedComposition || isComplete) && !editingStyle && !editingDimension && !editingComposition && <div className="rounded-xl border-2 border-cyan-400 bg-card overflow-hidden">
          {hasSelectedStyle && <div className="flex items-center justify-between p-4">
              <div className="text-sm text-foreground">
                <span className="font-semibold">Style</span> - {selectedStyle?.title}
              </div>
              <button onClick={handleEditStyle} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">
                Edit
              </button>
            </div>}

          {hasSelectedDimension && <div className={cn("flex items-center justify-between p-4", hasSelectedStyle && "border-t border-border")}>
              <div className="text-sm text-foreground">
                <span className="font-semibold">Dimension</span> - {data.visuals?.dimension?.charAt(0).toUpperCase() + data.visuals?.dimension?.slice(1)}
              </div>
              <button onClick={handleEditDimension} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">
                Edit
              </button>
            </div>}

          {hasSelectedWritingProcess && <div className={cn("flex items-center justify-between p-4", (hasSelectedStyle || hasSelectedDimension) && "border-t border-border")}>
              <div className="text-sm text-foreground">
                <span className="font-semibold">Process</span> - {data.visuals?.writingProcess === 'ai' ? 'AI Assist' : data.visuals?.writingProcess === 'manual' ? 'Create Myself' : 'Random'}
              </div>
              <button onClick={handleEditProcess} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">
                Edit
              </button>
            </div>}

          {/* Visual Concept Row */}
          {isComplete && data.visuals?.selectedVisualRecommendation && <div className={cn("flex items-center justify-between p-4", (hasSelectedStyle || hasSelectedDimension || hasSelectedWritingProcess) && "border-t border-border")}>
              <div className="text-sm text-foreground">
                <span className="font-semibold">Visual Concept</span> - 
                {typeof data.visuals.selectedVisualRecommendation === 'object' && data.visuals.selectedVisualRecommendation.design ? ` ${data.visuals.selectedVisualRecommendation.design}` : ` Option ${(data.visuals?.selectedVisualOption ?? 0) + 1}`}
              </div>
              <button onClick={handleEditVisualConcept} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">
                Edit
              </button>
            </div>}
        </div>}

      {/* Visual Style Selection */}
      {(!hasSelectedStyle || editingStyle) && <>
          <div className="text-center">
            <h2 className="mb-2 text-xl font-semibold text-foreground">Choose your visual style</h2>
            <p className="text-sm text-muted-foreground mb-4">Select the artistic style for your image</p>
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

      {/* Dimensions Selection */}
      {hasSelectedStyle && !editingStyle && (!hasSelectedDimension || editingDimension) && <>
          <div className="text-center pt-6 pb-2">
            <h2 className="text-xl font-semibold text-foreground">Choose your dimensions</h2>
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
                <h4 className="mb-1 text-sm font-medium text-foreground">{dimension.title}</h4>
                <p className="text-xs text-muted-foreground">{dimension.description}</p>
              </Card>)}
          </div>
        </>}

      {/* Writing Process Selection */}
      {hasSelectedStyle && !editingStyle && hasSelectedDimension && !editingDimension && !hasSelectedWritingProcess && <>
          <div className="text-center pt-6 pb-2">
            <h2 className="text-xl font-semibold text-foreground">How would you like to create your visuals?</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Card className={cn("cursor-pointer text-center transition-all duration-200 border-2 p-4 flex flex-col justify-center items-center aspect-square hover:shadow-md", data.visuals?.writingProcess === 'ai' ? "border-cyan-500 bg-accent ring-2 ring-cyan-500/20" : "border-border hover:border-cyan-500/50")} onClick={() => handleWritingProcessSelect('ai')}>
              <div className="h-6 flex items-center justify-center mb-2">
                <h4 className="text-sm font-semibold text-foreground">AI Assist</h4>
              </div>
              <div className="h-10 flex items-center justify-center">
                <p className="text-xs text-muted-foreground leading-tight">Generate visual concepts with AI</p>
              </div>
            </Card>
            
            <Card className={cn("cursor-pointer text-center transition-all duration-200 border-2 p-4 flex flex-col justify-center items-center aspect-square hover:shadow-md", data.visuals?.writingProcess === 'random' ? "border-cyan-500 bg-accent ring-2 ring-cyan-500/20" : "border-border hover:border-cyan-500/50")} onClick={() => handleWritingProcessSelect('random')}>
              <div className="h-6 flex items-center justify-center mb-2">
                <h4 className="text-sm font-semibold text-foreground">Random</h4>
              </div>
              <div className="h-10 flex items-center justify-center">
                <p className="text-xs text-muted-foreground leading-tight">Surprise me with random visuals</p>
              </div>
            </Card>
            
            <Card className={cn("cursor-pointer text-center transition-all duration-200 border-2 p-4 flex flex-col justify-center items-center aspect-square hover:shadow-md", data.visuals?.writingProcess === 'manual' ? "border-cyan-500 bg-accent ring-2 ring-cyan-500/20" : "border-border hover:border-cyan-500/50")} onClick={() => handleWritingProcessSelect('manual')}>
              <div className="h-6 flex items-center justify-center mb-2">
                <h4 className="text-sm font-semibold text-foreground">Create Myself</h4>
              </div>
              <div className="h-10 flex items-center justify-center">
                <p className="text-xs text-muted-foreground leading-tight">Create my own visuals manually</p>
              </div>
            </Card>
          </div>
        </>}

      {/* Optional Visuals Input */}
      {showGenerateButton && !showVisualOptions && !isComplete && <div className="space-y-4 pt-2">
          <div className="text-center">
            <h3 className="text-base font-medium text-foreground mb-1">Optional Visuals</h3>
            
          </div>
          
          <Input placeholder="Add visual element(s) by pressing comma or enter" value={visualInput} onChange={e => setVisualInput(e.target.value)} onKeyDown={handleAddVisual} className="text-base h-12 text-center placeholder:text-muted-foreground/60" disabled={(data.visuals?.insertedVisuals || []).length >= 3} />
          
          <div className="text-sm text-muted-foreground text-center">
            {(data.visuals?.insertedVisuals || []).length}/3 visuals added
          </div>
          
          {(data.visuals?.insertedVisuals || []).length > 0 && <div className="flex flex-wrap gap-2 justify-center">
              {(data.visuals?.insertedVisuals || []).map((visual: string) => <Badge key={visual} variant="secondary" className="text-sm py-1.5 px-3 flex items-center gap-2">
                  {visual}
                  <button onClick={() => handleRemoveVisual(visual)} className="hover:text-destructive transition-colors" type="button">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>)}
            </div>}
          
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
            <p className="text-xs font-semibold text-foreground mb-2">Examples:</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              "bald obese man", "coffee cup", or "birthday balloons and cake"
            </p>
          </div>
        </div>}

      {/* Generate Button with Composition Dropdown */}
      {showGenerateButton && !showVisualOptions && !isComplete && !editingStyle && !editingDimension && <div className="pt-4 space-y-4">
          {error && <Alert className="mb-4 border-destructive bg-destructive/10">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-destructive">{error}</AlertDescription>
            </Alert>}

          <div className="flex gap-3 items-center">
            <Select value={data.visuals?.compositionMode || 'cinematic'} onValueChange={handleCompositionSelect}>
              <SelectTrigger className="w-[180px] h-12 bg-background border-border z-50">
                <SelectValue placeholder="Composition" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border z-50">
                {compositionModes.map(mode => <SelectItem key={mode.id} value={mode.id} className="cursor-pointer hover:bg-accent">
                    {mode.title}
                  </SelectItem>)}
              </SelectContent>
            </Select>

            <Button onClick={handleGenerateVisuals} disabled={isGeneratingVisuals} className="flex-1 h-12 text-base font-medium">
              {isGeneratingVisuals ? <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </> : <>
                  Generate 4 AI Visuals
                </>}
            </Button>
          </div>
        </div>}

      {/* Visual Selection */}
      {showVisualOptions && !isGeneratingVisuals && !isComplete && !editingStyle && !editingDimension && <>
          <div className="flex justify-between items-center mb-6 pt-6">
            <div className="flex-1"></div>
            <Button variant="outline" onClick={handleGenerateVisuals} disabled={isGeneratingVisuals} className="gap-2">
              {isGeneratingVisuals ? <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Regenerating...
                </> : <>
                  Regenerate
                </>}
            </Button>
          </div>

          {generatedVisuals.length > 0 ? <div className="grid grid-cols-1 gap-4">
              {generatedVisuals.map((visual: VisualOption, index: number) => <Card key={index} onClick={() => handleVisualOptionSelect(index)} className={cn("cursor-pointer transition-all duration-200 border-2 p-5 bg-card", selectedVisualOption === index ? "border-primary bg-accent" : "border-border hover:border-primary/50 hover:bg-accent/50")}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-base text-foreground">
                        Option {index + 1}
                      </h3>
                      <span className="text-xs text-muted-foreground italic">
                        {visual.design}
                      </span>
                    </div>
                    <div className="text-sm text-foreground">
                      <span className="font-medium">Subject:</span> {visual.subject}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Setting:</span> {visual.setting}
                    </div>
                  </div>
                </Card>)}
            </div> : <div className="text-center py-8">
              <div className="text-muted-foreground mb-4">No visual recommendations generated. Please try again.</div>
              <Button variant="outline" onClick={() => setGeneratedVisuals([])}>Try Again</Button>
            </div>}
        </>}

      {/* Debug Panel at bottom */}
      {debugInfo && !isGeneratingVisuals && <div className="mt-8">
          <DebugPanel title="Visual Generation Debug" model={debugInfo.model || "gpt-5-mini"} status={debugInfo.step === 'API_CALL_START' ? 'sending...' : debugInfo.step === 'API_CALL_SUCCESS' ? 'completed' : debugInfo.step === 'API_CALL_ERROR' ? 'error' : 'idle'} endpoint="generate-visuals" timestamp={debugInfo.timestamp} requestPayload={debugInfo.params} responseData={{
        ...debugInfo.apiResponse,
        req_id: debugInfo.apiResponse?.req_id,
        diversity: debugInfo.apiResponse?.debug?.diversityCheck,
        composition_count: debugInfo.apiResponse?.debug?.compositionCount
      }} formData={debugInfo.formData} error={debugInfo.error} />
        </div>}
    </div>;
}