import { useState, KeyboardEvent, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { generateVisualOptions, type VisualRecommendation, type GenerateVisualsResponse } from "@/lib/api";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
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

const visualStyles = [
  { id: "auto",        title: "Auto",      description: "Smart default",   preview: autoImage },
  { id: "realistic",   title: "Realistic", description: "True photo",       preview: realisticImage },
  { id: "general",     title: "General",   description: "Clean standard",   preview: generalImage },
  { id: "design",      title: "Design",    description: "Flat graphic",     preview: designImage },
  { id: "3d-render",   title: "3D Render", description: "CGI model",        preview: renderImage },
  { id: "anime",       title: "Anime",     description: "Japanese cartoon", preview: animeImage }
];

const dimensionOptions = [
  { id: "square",    title: "Square",    description: "1:1 aspect ratio" },
  { id: "landscape", title: "Landscape", description: "16:9 aspect ratio" },
  { id: "portrait",  title: "Portrait",  description: "9:16 aspect ratio" },
  { id: "custom",    title: "Custom",    description: "Define your own dimensions" }
];

export default function VisualsStep({ data, updateData }: VisualsStepProps) {
  const [generatedVisuals, setGeneratedVisuals] = useState<VisualRecommendation[]>([]);
  const [isGeneratingVisuals, setIsGeneratingVisuals] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVisualOption, setSelectedVisualOption] = useState<number | null>(null);
  const [editingStyle, setEditingStyle] = useState(false);
  const [editingDimension, setEditingDimension] = useState(false);
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

  const handleGenerateVisuals = async () => {
    if (!data.text?.selectedLine && !data.text?.generatedText && !data.text?.customText) {
      setError("Please complete Step 2 (Text) first before generating visuals.");
      return;
    }
    setError(null);
    setIsGeneratingVisuals(true);
    try {
      const finalText = data.text?.selectedLine || data.text.generatedText || data.text.customText;
      const tags = data.tags || [];
      
      // Map tags to backend fields
      const category = tags[0] || "general";
      const subcategory = tags[1] || tags[0] || "general";
      
      const params = {
        category,
        subcategory,
        tone: data.vibe?.tone || "Humorous",
        style: data.visuals?.style || "general",
        layout: data.text?.textLayout || "Open Space",
        completed_text: finalText
      };

      setDebugInfo({
        timestamp: new Date().toISOString(),
        step: 'API_CALL_START',
        params,
        formData: {
          tags: data.tags,
          text: data.text,
          vibe: data.vibe,
          visuals: data.visuals
        }
      });

      updateData({ visuals: { ...data.visuals, isGeneratingVisuals: true } });

      const response: GenerateVisualsResponse = await generateVisualOptions(params);
      console.log('📥 Received visuals from API:', response);

      setDebugInfo(prev => ({
        ...prev!,
        step: 'API_CALL_SUCCESS',
        apiResponse: response,
        visualsCount: response.visuals.length,
        model: response.model || 'gpt-5-mini'
      }));
      setGeneratedVisuals(response.visuals);
      console.log('💾 Set generatedVisuals to:', response.visuals);
    } catch (error) {
      console.error("Failed to generate visuals:", error);
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
      updateData({ visuals: { ...data.visuals, isGeneratingVisuals: false } });
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
    updateData({ visuals: { ...data.visuals, dimension: dimensionId } });
    setEditingDimension(false);
  };

  const handleWritingProcessSelect = (process: 'ai' | 'manual' | 'random') => {
    updateData({ visuals: { ...data.visuals, writingProcess: process } });
    if (process === 'manual' || process === 'random') {
      updateData({ visuals: { ...data.visuals, writingProcess: process, isComplete: true } });
    }
  };

  const handleEditStyle = () => { setEditingStyle(true); setEditingDimension(false); };
  const handleEditDimension = () => { setEditingDimension(true); setEditingStyle(false); };
  const handleEditProcess = () => { updateData({ visuals: { ...data.visuals, writingProcess: undefined } }); };
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
  const hasSelectedStyle = !!data.visuals?.style;
  const hasSelectedDimension = !!data.visuals?.dimension;
  const hasSelectedWritingProcess = !!data.visuals?.writingProcess;
  const showGenerateButton = hasSelectedStyle && hasSelectedDimension && hasSelectedWritingProcess && data.visuals?.writingProcess === 'ai';
  const showVisualOptions = generatedVisuals.length > 0;
  const isComplete = !!data.visuals?.isComplete;

  return (
    <div className="space-y-6">
      {/* Tags Breadcrumb */}
      {data.tags && data.tags.length > 0 && (
        <div className="text-left mb-1">
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold">Your topics:</span> {data.tags.join(' > ')}
          </div>
        </div>
      )}

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
      {(hasSelectedStyle || hasSelectedDimension || hasSelectedWritingProcess || isComplete) && !editingStyle && !editingDimension && (
        <div className="rounded-xl border-2 border-cyan-400 bg-card overflow-hidden">
          {hasSelectedStyle && (
            <div className="flex items-center justify-between p-4">
              <div className="text-sm text-foreground">
                <span className="font-semibold">Style</span> - {selectedStyle?.title}
              </div>
              <button onClick={handleEditStyle} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">
                Edit
              </button>
            </div>
          )}

          {hasSelectedDimension && (
            <div className={cn("flex items-center justify-between p-4", hasSelectedStyle && "border-t border-border")}>
              <div className="text-sm text-foreground">
                <span className="font-semibold">Dimension</span> - {data.visuals?.dimension?.charAt(0).toUpperCase() + data.visuals?.dimension?.slice(1)}
              </div>
              <button onClick={handleEditDimension} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">
                Edit
              </button>
            </div>
          )}

          {hasSelectedWritingProcess && (
            <div className={cn("flex items-center justify-between p-4", (hasSelectedStyle || hasSelectedDimension) && "border-t border-border")}>
              <div className="text-sm text-foreground">
                <span className="font-semibold">Process</span> - {data.visuals?.writingProcess === 'ai' ? 'AI Assist' : data.visuals?.writingProcess === 'manual' ? 'Create Myself' : 'Random'}
              </div>
              <button onClick={handleEditProcess} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">
                Edit
              </button>
            </div>
          )}

          {/* Visual Concept Row */}
          {isComplete && data.visuals?.selectedVisualRecommendation && (
            <div className={cn("flex items-center justify-between p-4", (hasSelectedStyle || hasSelectedDimension || hasSelectedWritingProcess) && "border-t border-border")}>
              <div className="text-sm text-foreground">
                <span className="font-semibold">Visual Concept</span> - Option {(data.visuals?.selectedVisualOption ?? 0) + 1}
              </div>
              <button onClick={handleEditVisualConcept} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">
                Edit
              </button>
            </div>
          )}
        </div>
      )}

      {/* Visual Style Selection */}
      {(!hasSelectedStyle || editingStyle) && (
        <>
          <div className="text-center">
            <h2 className="mb-2 text-xl font-semibold text-foreground">Choose your visual style</h2>
            <p className="text-sm text-muted-foreground mb-4">Select the artistic style for your image</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {visualStyles.map(style => (
              <Card
                key={style.id}
                className={cn(
                  "cursor-pointer transition-all duration-200 overflow-hidden border-2 hover:shadow-md",
                  data.visuals?.style === style.id ? "border-primary bg-accent ring-2 ring-primary/20" : "border-border hover:border-primary/50"
                )}
                onClick={() => handleStyleChange(style.id)}
              >
                <div className="aspect-video relative">
                  <img src={style.preview} alt={style.title} className="w-full h-full object-cover" />
                  {data.visuals?.style === style.id && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <div className="w-3 h-3 bg-white rounded-full" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-sm text-foreground">{style.title}</h3>
                  <p className="text-xs text-muted-foreground">{style.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Dimensions Selection */}
      {hasSelectedStyle && !editingStyle && (!hasSelectedDimension || editingDimension) && (
        <>
          <div className="text-center pt-6 pb-2">
            <h2 className="text-xl font-semibold text-foreground">Choose your dimensions</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {dimensionOptions.map(dimension => (
              <Card
                key={dimension.id}
                className={cn(
                  "cursor-pointer text-center transition-all duration-200 border-2 p-4 flex flex-col justify-center h-32",
                  data.visuals?.dimension === dimension.id ? "border-primary bg-accent" : "border-border hover:border-primary/50",
                  dimension.id === "custom" && "border-dashed"
                )}
                onClick={() => handleDimensionSelect(dimension.id)}
              >
                <div className="flex justify-center mb-2">
                  <div
                    className={cn("border-2 border-muted-foreground/30 bg-muted/20", {
                      "w-6 h-10": dimension.id === "portrait",
                      "w-8 h-8": dimension.id === "square",
                      "w-12 h-6": dimension.id === "landscape",
                      "w-8 h-6 border-dashed": dimension.id === "custom"
                    })}
                  />
                </div>
                <h4 className="mb-1 text-sm font-medium text-foreground">{dimension.title}</h4>
                <p className="text-xs text-muted-foreground">{dimension.description}</p>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Writing Process Selection */}
      {hasSelectedStyle && !editingStyle && hasSelectedDimension && !editingDimension && !hasSelectedWritingProcess && (
        <>
          <div className="text-center pt-6 pb-2">
            <h2 className="text-xl font-semibold text-foreground">Choose Your Visual Process</h2>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <Card className="cursor-pointer transition-all duration-200 border-2 hover:border-primary/50 hover:shadow-md p-4 text-center" onClick={() => handleWritingProcessSelect('ai')}>
              <div className="text-lg font-medium text-foreground">AI Assist</div>
              <div className="text-sm text-muted-foreground mt-2">Let AI help generate your content</div>
            </Card>
            <Card className="cursor-pointer transition-all duration-200 border-2 hover:border-primary/50 hover:shadow-md p-4 text-center" onClick={() => handleWritingProcessSelect('manual')}>
              <div className="text-lg font-medium text-foreground">Create Myself</div>
              <div className="text-sm text-muted-foreground mt-2">Create your own custom visuals</div>
            </Card>
            <Card className="cursor-pointer transition-all duration-200 border-2 hover:border-primary/50 hover:shadow-md p-4 text-center" onClick={() => handleWritingProcessSelect('random')}>
              <div className="text-lg font-medium text-foreground">Random</div>
              <div className="text-sm text-muted-foreground mt-2">Generate instantly</div>
            </Card>
          </div>
        </>
      )}

      {/* Generate Button */}
      {showGenerateButton && !showVisualOptions && !isComplete && !editingStyle && !editingDimension && (
        <div className="pt-4 space-y-4">
          {error && (
            <Alert className="mb-4 border-destructive bg-destructive/10">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-destructive">{error}</AlertDescription>
            </Alert>
          )}

          <Button onClick={handleGenerateVisuals} disabled={isGeneratingVisuals} className="w-full h-12 text-base font-medium">
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
      )}

      {/* Visual Selection */}
      {(showVisualOptions || isGeneratingVisuals) && !isComplete && !editingStyle && !editingDimension && (
        <>
          {debugInfo && (
            <DebugPanel
              title="Visual Generation Debug"
              model={debugInfo.model || "gpt-5-mini"}
              status={
                debugInfo.step === 'API_CALL_START' ? 'sending...' :
                debugInfo.step === 'API_CALL_SUCCESS' ? 'completed' :
                debugInfo.step === 'API_CALL_ERROR' ? 'error' : 'idle'
              }
              endpoint="generate-visuals"
              timestamp={debugInfo.timestamp}
              requestPayload={debugInfo.params}
              responseData={{
                ...debugInfo.apiResponse,
                req_id: debugInfo.apiResponse?.req_id,
                diversity: debugInfo.apiResponse?.debug?.diversityCheck,
                composition_count: debugInfo.apiResponse?.debug?.compositionCount
              }}
              formData={debugInfo.formData}
              error={debugInfo.error}
              className="mb-6"
            />
          )}

          <div className="text-center mb-6 pt-6">
            <h2 className="text-xl font-semibold text-foreground mb-2">Select a visual recommendation</h2>
            <p className="text-sm text-muted-foreground">Select one of these AI-generated recommendations:</p>
          </div>

          {generatedVisuals.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {generatedVisuals.map((visual, index) => (
                <Card
                  key={index}
                  className={cn(
                    "cursor-pointer transition-all duration-200 border-2 p-4",
                    selectedVisualOption === index ? "border-primary bg-accent" : "border-border hover:border-primary/50"
                  )}
                  onClick={() => handleVisualOptionSelect(index)}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-base text-foreground">{visual.title}</h3>
                      {selectedVisualOption === index && <div className="w-2 h-2 bg-primary rounded-full" />}
                    </div>
                    
                    {/* Subject & Setting */}
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Subject:</span> {visual.subject}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Setting:</span> {visual.setting}
                    </p>
                    
                    {/* Action */}
                    <p className="text-xs text-muted-foreground/80 italic">
                      {visual.action}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          ) : isGeneratingVisuals ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-muted-foreground mb-4">No visual recommendations generated. Please try again.</div>
              <Button variant="outline" onClick={() => setGeneratedVisuals([])}>Try Again</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
