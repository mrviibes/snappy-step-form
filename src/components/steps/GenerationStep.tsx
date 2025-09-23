import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, Download, RefreshCw, Sparkles, AlertCircle } from "lucide-react";
import { generateFinalPrompt } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface GenerationStepProps {
  data: any;
  updateData: (data: any) => void;
  onNext: () => void;
}

// Template variations for different compositions
const TEMPLATE_VARIATIONS = [
  {
    id: 'cinematic',
    title: 'Cinematic',
    description: 'Dramatic depth and bold colors'
  },
  {
    id: 'close_up',
    title: 'Close-up',
    description: 'Focused on main elements'
  },
  {
    id: 'crowd_reaction',
    title: 'Crowd Reaction',
    description: 'Candid energy and humor'
  },
  {
    id: 'minimalist',
    title: 'Minimalist',
    description: 'Clean with negative space'
  }
];

export default function GenerationStep({
  data,
  updateData
}: GenerationStepProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<Array<{
    id: string;
    imageUrl: string;
    variation: string;
    prompt: string;
  }>>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<any>(null);

  // Build the final prompt parameters from all collected data
  const buildPromptParams = () => {
    // Get the final text based on user's choice
    const finalText = data.text?.generatedText || data.text?.customText || '';
    
    return {
      finalText,
      category: data.category || '',
      subcategory: data.subcategory || '',
      tone: data.text?.tone || 'Humorous',
      textStyle: data.text?.style || 'Generic',
      rating: data.text?.rating || 'PG',
      insertWords: data.text?.specificWords || [],
      comedianStyle: data.text?.comedianStyle || '',
      visualStyle: data.visuals?.style || 'general',
      layout: data.text?.layout || 'Lower Banner',
      dimension: data.visuals?.dimension || 'square',
      insertedVisuals: Array.isArray(data.visuals?.customVisuals) ? data.visuals.customVisuals : 
                        (data.visuals?.customVisuals ? data.visuals.customVisuals.split(',').map(s => s.trim()) : []),
      customVisualDescription: data.visuals?.customVisualDescription || ''
    };
  };

  // Generate the master prompt structure
  const generateMasterPrompts = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const params = buildPromptParams();
      
      // Generate the base prompt components
      const response = await generateFinalPrompt(params);
      
      const masterPrompts = {
        inputs: params,
        templates: TEMPLATE_VARIATIONS.map(variation => ({
          id: `tpl_${variation.id}`,
          variation: variation.id,
          title: variation.title,
          description: variation.description,
          positivePrompt: buildPositivePrompt(params, variation.id, response.positivePrompt),
          negativePrompt: buildNegativePrompt(params),
          constraints: {
            text_overlay_max_fraction: 0.25,
            overlay_layout: params.layout,
            spelling_strict: true,
            no_duplicate_text: true
          }
        }))
      };
      
      setPrompts(masterPrompts);
      
      // For demo purposes, we'll simulate image generation
      // In production, you'd call Ideogram API here
      await simulateImageGeneration(masterPrompts);
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate images');
    } finally {
      setIsGenerating(false);
    }
  };

  // Build positive prompt based on all variables
  const buildPositivePrompt = (params: any, variation: string, basePrompt: string) => {
    const dimensionWord = getDimensionWord(params.dimension);
    const visualStylePhrase = getVisualStylePhrase(params.visualStyle);
    const tonePhrase = getTonePhrase(params.tone, params.textStyle);
    const variationBody = getVariationBody(variation);
    const categoryCue = getCategoryCue(params.category, params.subcategory);
    const propsClause = getPropsClause(params.insertedVisuals);
    const overlayClause = getOverlayClause(params.finalText, params.layout);
    const visualHint = params.customVisualDescription ? `Visual style: ${params.customVisualDescription}.` : '';

    return `${dimensionWord} ${visualStylePhrase}, ${tonePhrase}. ${variationBody} ${categoryCue} ${propsClause} ${overlayClause} ${visualHint}`.trim();
  };

  // Build negative prompt to exclude unwanted elements
  const buildNegativePrompt = (params: any) => {
    const styleBans = getStyleBans(params.visualStyle);
    return `No ${styleBans.join(', ')}, no duplicated text, no extra captions, no spelling errors, no watermark, no UI chrome. No confetti clichés unless listed in inserted visuals.`;
  };

  // Helper functions for prompt building
  const getDimensionWord = (dimension: string) => {
    switch (dimension.toLowerCase()) {
      case 'portrait': return 'portrait 9:16';
      case 'landscape': return 'landscape 16:9';
      case 'square': 
      default: return 'square';
    }
  };

  const getVisualStylePhrase = (style: string) => {
    switch (style.toLowerCase()) {
      case 'realistic': return 'photorealistic realistic style';
      case 'anime': return 'anime cel-shaded style';
      case 'design': return 'flat graphic design style';
      case '3d-render': return 'CGI 3D rendered style';
      case 'general':
      default: return 'clean artistic style';
    }
  };

  const getTonePhrase = (tone: string, textStyle: string) => {
    const toneMap: Record<string, string> = {
      'Humorous': 'humorous',
      'Sarcastic': 'sarcastic humorous',
      'Sentimental': 'warm sentimental',
      'Romantic': 'romantic heartfelt',
      'Inspirational': 'uplifting inspirational'
    };
    
    const styleMap: Record<string, string> = {
      'Sarcastic': 'dry sarcastic delivery',
      'Wholesome': 'warm wholesome delivery',
      'Weird': 'quirky offbeat delivery',
      'Generic': 'neutral delivery'
    };

    return `${toneMap[tone] || 'neutral'} tone, ${styleMap[textStyle] || 'neutral delivery'}`;
  };

  const getVariationBody = (variation: string) => {
    switch (variation) {
      case 'cinematic': return 'Cinematic environment with realistic depth and bold color grading.';
      case 'close_up': return 'Close-up composition focusing on primary prop(s) with dramatic shadows and shallow depth of field.';
      case 'crowd_reaction': return 'Candid crowd reaction scene capturing energy and humor.';
      case 'minimalist': return 'Minimal composition emphasizing a single focal prop with ample negative space and moody lighting.';
      default: return 'Balanced composition with good lighting.';
    }
  };

  const getCategoryCue = (category: string, subcategory: string) => {
    if (category.toLowerCase().includes('celebration')) {
      return 'Festive context, subtle party cues.';
    }
    return `${category} context.`;
  };

  const getPropsClause = (visuals: string[]) => {
    if (visuals && visuals.length > 0) {
      return `Include ${visuals.join(' and ')}.`;
    }
    return '';
  };

  const getOverlayClause = (finalText: string, layout: string) => {
    const layoutMap: Record<string, string> = {
      'Lower Banner': 'Lower-third banner',
      'Side Bar': 'Side-positioned',
      'Meme Text': 'Top and bottom text',
      'Open Space': 'Centered overlay',
      'Badge Callout': 'Corner badge',
      'Caption': 'Bottom caption'
    };

    const layoutPhrase = layoutMap[layout] || 'Lower-third banner';
    return `${layoutPhrase} overlay with exact mapped text: "${finalText}". Overlay text clean sans serif, crisp, ≤25% of frame, no spelling errors.`;
  };

  const getStyleBans = (visualStyle: string) => {
    switch (visualStyle.toLowerCase()) {
      case 'realistic':
        return ['cartoon', 'anime', 'cel', 'vector', 'flat graphic', 'CGI', 'ray-traced', 'PBR'];
      case 'anime':
        return ['photorealistic', 'realistic', 'photography'];
      case 'design':
        return ['photorealistic', 'realistic', 'photography', '3D', 'CGI'];
      case '3d-render':
        return ['flat', '2D', 'cartoon', 'anime'];
      default:
        return ['low quality', 'blurry'];
    }
  };

  // Simulate image generation (replace with actual Ideogram API)
  const simulateImageGeneration = async (masterPrompts: any) => {
    const mockImages = masterPrompts.templates.map((template: any, index: number) => ({
      id: template.id,
      imageUrl: `https://picsum.photos/512/512?random=${index + 1}`,
      variation: template.variation,
      title: template.title,
      prompt: template.positivePrompt
    }));

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    setGeneratedImages(mockImages);
    
    // Update form data with generated images
    updateData({
      generation: {
        prompts: masterPrompts,
        images: mockImages,
        isComplete: true
      }
    });
  };

  const handleImageSelect = (imageId: string) => {
    setSelectedImage(imageId);
  };

  const handleRegenerate = () => {
    setGeneratedImages([]);
    setSelectedImage(null);
    generateMasterPrompts();
  };

  // Auto-generate on component mount
  useEffect(() => {
    if (!prompts && !isGenerating) {
      generateMasterPrompts();
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Generating Your Images
        </h2>
        <p className="text-sm text-muted-foreground">
          Creating 4 variations with your text and visual preferences
        </p>
      </div>

      {/* Show all variables being used */}
      <Card className="p-4 border-2 border-primary/20 bg-accent/50">
        <h3 className="font-semibold text-sm mb-3">Using These Variables:</h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><strong>Text:</strong> "{data.text?.generatedText || data.text?.customText || 'None'}"</div>
          <div><strong>Style:</strong> {data.visuals?.style}</div>
          <div><strong>Tone:</strong> {data.text?.tone}</div>
          <div><strong>Layout:</strong> {data.text?.layout}</div>
          <div><strong>Dimension:</strong> {data.visuals?.dimension}</div>
          <div><strong>Rating:</strong> {data.text?.rating}</div>
          {data.text?.specificWords && data.text.specificWords.length > 0 && (
            <div className="col-span-2"><strong>Include:</strong> {data.text.specificWords.join(', ')}</div>
          )}
          {data.visuals?.customVisuals && data.visuals.customVisuals.length > 0 && (
            <div className="col-span-2"><strong>Visuals:</strong> {data.visuals.customVisuals.join(', ')}</div>
          )}
        </div>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert className="border-destructive bg-destructive/10">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-destructive">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Generation Status */}
      {isGenerating && (
        <Card className="p-8 text-center">
          <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-primary" />
          <h3 className="font-semibold mb-2">Generating Images...</h3>
          <p className="text-sm text-muted-foreground">
            This may take 30-60 seconds. We're creating 4 different variations for you.
          </p>
        </Card>
      )}

      {/* Generated Images Grid */}
      {generatedImages.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Choose Your Favorite:</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              className="text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Regenerate
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {generatedImages.map((image) => (
              <Card
                key={image.id}
                className={cn(
                  "cursor-pointer transition-all duration-200 overflow-hidden",
                  selectedImage === image.id
                    ? "border-2 border-primary bg-accent"
                    : "border border-border hover:border-primary/50"
                )}
                onClick={() => handleImageSelect(image.id)}
              >
                <div className="aspect-square relative">
                  <img
                    src={image.imageUrl}
                    alt={`Generated image - ${image.variation}`}
                    className="w-full h-full object-cover"
                  />
                  {selectedImage === image.id && (
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                      <Sparkles className="h-3 w-3" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h4 className="font-semibold text-sm">{TEMPLATE_VARIATIONS.find(t => t.id === image.variation)?.title}</h4>
                  <p className="text-xs text-muted-foreground">
                    {TEMPLATE_VARIATIONS.find(t => t.id === image.variation)?.description}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Download Selected */}
      {selectedImage && (
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Ready to Download!</h3>
              <p className="text-xs text-muted-foreground">
                Your selected image with perfect text overlay
              </p>
            </div>
            <Button className="bg-primary hover:bg-primary/90">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </Card>
      )}

      {/* Debug: Show effective prompts */}
      {prompts && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground mb-2">
            View Generated Prompts (Debug)
          </summary>
          <pre className="bg-muted p-2 rounded overflow-auto max-h-40 text-xs">
            {JSON.stringify(prompts, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}