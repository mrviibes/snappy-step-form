import { useEffect, useState, useRef } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Download, RefreshCw, Zap, Maximize, X, Bug } from "lucide-react";
import { generateFinalPrompt, generateImage } from "@/lib/api";



interface SummaryStepProps {
  data: any;
  updateData: (data: any) => void;
  onNext: () => void;
}

interface PromptTemplate {
  name: string;
  positive: string;
  negative: string;
  description: string;
}

export default function SummaryStep({ data, updateData }: SummaryStepProps) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Request token to prevent concurrent generations and late responses
  const currentRequestRef = useRef<string | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);


  // Generate templates on mount and auto-generate with first template
  // Only depend on core data fields, not the entire data object to avoid infinite loops
  useEffect(() => {
    // Prevent concurrent template generation
    if (templates.length > 0) return;
    
    const generateTemplates = async () => {
      const requestToken = Date.now().toString();
      currentRequestRef.current = requestToken;
      
      try {
        // Build the final prompt parameters from all collected data
        const completed_text = data.text?.generatedText || data.text?.customText || '';
        
        const params = {
          completed_text,
          category: data.category || '',
          subcategory: data.subcategory || '',
          tone: data.text?.tone || 'Humorous',
          rating: data.text?.rating || 'PG',
          insertWords: data.text?.specificWords || [],
          image_style: data.visuals?.style || 'general',
          text_layout: data.text?.layout || 'lower-banner',
          image_dimensions: data.visuals?.dimension || 'square',
          composition_modes: data.visuals?.compositionMode ? [data.visuals.compositionMode] : [],
          visual_recommendation: data.visuals?.selectedVisualRecommendation?.description || data.visuals?.selectedVisualRecommendation?.interpretation,
          provider: 'ideogram' as const,
        };

        console.log('Generating templates with params:', params);
        

        const response = await generateFinalPrompt(params);
        
        // Check if this request is still current
        if (currentRequestRef.current !== requestToken) {
          console.log('Template request was superseded, ignoring response');
          return;
        }
        
        if (response.templates && response.templates.length > 0) {
          setTemplates(response.templates);
          
          
          // Auto-select and generate with first template (Cinematic)
          const firstTemplate = response.templates[0];
          setSelectedTemplate(firstTemplate);
          generateImageFromTemplate(firstTemplate, requestToken);
        } else {
          throw new Error('No templates returned from API');
        }
      } catch (error) {
        if (currentRequestRef.current === requestToken) {
          console.error('Error generating templates:', error);
          
          
          setImageError(`Template generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } finally {
        if (currentRequestRef.current === requestToken) {
          setIsLoadingTemplates(false);
        }
      }
    };

    generateTemplates();
  }, [data.category, data.subcategory, data.theme, data.text?.generatedText, data.text?.customText, data.text?.tone, data.text?.style, data.text?.layout, data.text?.rating, data.visuals?.style, data.visuals?.dimension]);

  const generateImageFromTemplate = async (template: PromptTemplate, requestToken?: string) => {
    const currentToken = requestToken || Date.now().toString();
    currentRequestRef.current = currentToken;
    
    // Clear any existing timeouts
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    
    setIsLoadingImage(true);
    setImageError(null);
    setGeneratedImage(null);
    
    // Safety timeout - 75 seconds maximum
    safetyTimeoutRef.current = setTimeout(() => {
      if (currentRequestRef.current === currentToken) {
        console.log('Safety timeout reached, stopping image generation');
        setIsLoadingImage(false);
        setImageError('Image generation timed out after 75 seconds. Please try again.');
        currentRequestRef.current = null;
      }
    }, 75000);
    
    try {
      console.log('Generating image with template:', template.name);
      
      const imageParams = {
        prompt: template.positive,
        negativePrompt: template.negative,
        image_dimensions: data.visuals?.dimension?.toLowerCase() as 'square' | 'portrait' | 'landscape' || 'square',
        quality: 'high' as const,
        provider: 'ideogram' as const
      };

      const response = await generateImage(imageParams);
      
      // Check if this request is still current
      if (currentRequestRef.current !== currentToken) {
        console.log('Image generation request was superseded, ignoring response');
        return;
      }
      
      // Handle successful response with explicit success check
      if (response.success === false) {
        throw new Error(response.error || 'Image generation failed');
      }
      
      if ('imageData' in response && response.imageData) {
        // Sync response - image is ready immediately
        if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current);
          safetyTimeoutRef.current = null;
        }
        
        
        setGeneratedImage(response.imageData);
        updateData({
          generation: {
            ...data.generation,
            images: [response.imageData],
            selectedImage: response.imageData,
            selectedTemplate: template,
            isComplete: true
          }
        });
        setIsLoadingImage(false);
        currentRequestRef.current = null;
      } else if ('jobId' in response && response.jobId) {
        // Async response - need to poll for completion
        console.log('Polling for image completion, job ID:', response.jobId);
        
        
        pollForImageCompletion(response.jobId, response.provider, template, currentToken);
      } else {
        throw new Error('Invalid response format from image generation API');
      }
    } catch (error) {
      if (currentRequestRef.current === currentToken) {
        console.error('Error generating image:', error);
        
        
        setImageError(error instanceof Error ? error.message : 'Failed to generate image');
        setIsLoadingImage(false);
        currentRequestRef.current = null;
        
        if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current);
          safetyTimeoutRef.current = null;
        }
      }
    }
  };

  const pollForImageCompletion = async (jobId: string, provider: 'ideogram' | 'openai' | 'gemini', template: PromptTemplate, requestToken: string) => {
    const maxAttempts = 20; // Max 20 attempts (up to 1 minute)
    let attempts = 0;
    
    const poll = async () => {
      // Check if this request is still current
      if (currentRequestRef.current !== requestToken) {
        console.log('Polling request was superseded, stopping');
        return;
      }
      
      attempts++;
      try {
        const { pollImageStatus } = await import('@/lib/api');
        const status = await pollImageStatus(jobId, provider);
        
        // Check again if this request is still current
        if (currentRequestRef.current !== requestToken) {
          console.log('Polling response received for superseded request, ignoring');
          return;
        }
        
        if (status.status === 'completed' && status.imageData) {
          if (safetyTimeoutRef.current) {
            clearTimeout(safetyTimeoutRef.current);
            safetyTimeoutRef.current = null;
          }
          
          setGeneratedImage(status.imageData);
          updateData({
            generation: {
              ...data.generation,
              images: [status.imageData],
              selectedImage: status.imageData,
              selectedTemplate: template,
              isComplete: true
            }
          });
          setIsLoadingImage(false);
          currentRequestRef.current = null;
        } else if (status.status === 'failed') {
          if (safetyTimeoutRef.current) {
            clearTimeout(safetyTimeoutRef.current);
            safetyTimeoutRef.current = null;
          }
          
          setImageError(status.error || 'Image generation failed');
          setIsLoadingImage(false);
          currentRequestRef.current = null;
        } else if (status.status === 'pending' && attempts < maxAttempts) {
          // Continue polling
          pollingTimeoutRef.current = setTimeout(poll, 3000); // Poll every 3 seconds
        } else {
          // Max attempts reached
          if (safetyTimeoutRef.current) {
            clearTimeout(safetyTimeoutRef.current);
            safetyTimeoutRef.current = null;
          }
          
          setImageError('Image generation timed out. Please try again.');
          setIsLoadingImage(false);
          currentRequestRef.current = null;
        }
      } catch (error) {
        if (currentRequestRef.current === requestToken) {
          console.error('Error polling image status:', error);
          setImageError('Failed to check image generation status');
          setIsLoadingImage(false);
          currentRequestRef.current = null;
          
          if (safetyTimeoutRef.current) {
            clearTimeout(safetyTimeoutRef.current);
            safetyTimeoutRef.current = null;
          }
        }
      }
    };
    
    // Start polling after 2 seconds
    pollingTimeoutRef.current = setTimeout(poll, 2000);
  };

  const handleTemplateSelect = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    generateImageFromTemplate(template);
  };
  
  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
      currentRequestRef.current = null;
    };
  }, []);


  const handleDownloadImage = () => {
    if (!generatedImage) return;
    
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = 'viibe-generated-image.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRegenerateImage = () => {
    if (selectedTemplate) {
      generateImageFromTemplate(selectedTemplate);
    }
  };


  const formatArrayValue = (value: any) => {
    if (Array.isArray(value) && value.length > 0) {
      return value.join(', ');
    }
    return value || 'None';
  };

  const summaryData = [
    { label: '1. category', value: data.category },
    { label: '2. subcategory', value: data.subcategory },
    { label: '3. tone', value: data.text?.tone },
    { label: '4. rating', value: data.text?.rating },
    { label: '5. completed_text', value: data.text?.generatedText || data.text?.customText || 'No text' },
    { label: '6. text_layout', value: data.text?.layout },
    { label: '7. image_style', value: data.visuals?.style },
    { label: '8. image_dimensions', value: data.visuals?.dimension },
    { label: '9. specific_visuals', value: formatArrayValue(data.visuals?.insertedVisuals) },
    { label: '10. composition_mode', value: data.visuals?.compositionMode || 'None' },
    { label: '11. visual_recommendation', value: data.visuals?.selectedVisualRecommendation?.description || data.visuals?.selectedVisualRecommendation?.interpretation || 'None' },
  ];

  // Generate custom prompt using user's format
  // Note: Using template.positive from generate-final-prompt endpoint instead of custom prompt generation

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Your Generated Image
        </h2>
        <p className="text-sm text-muted-foreground">
          Generate your final image using Ideogram
        </p>
      </div>

      {/* Debug Panel */}
      <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="debug-info" className="border-none">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <Bug className="h-4 w-4 text-orange-600" />
                <span className="font-medium text-orange-700 dark:text-orange-300">
                  Debug Information (All Parameters & Prompt)
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4">
                {/* Form Parameters */}
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Form Parameters:</h4>
                  <div className="grid gap-2 text-xs">
                    {summaryData.map((item, index) => (
                      <div key={index} className="flex gap-2">
                        <span className="text-muted-foreground min-w-[120px]">{item.label}:</span>
                        <span className="text-foreground font-mono break-all">{item.value || 'Not set'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="bg-orange-200 dark:bg-orange-800" />

                {/* Generated Prompt */}
                {selectedTemplate && (
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-2">Generated Prompt ({selectedTemplate.name}):</h4>
                    <div className="bg-background border rounded-lg p-3">
                      <pre className="text-xs text-foreground font-mono whitespace-pre-wrap break-words">
                        {selectedTemplate.positive}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Template Info */}
                {templates.length > 0 && (
                  <>
                    <Separator className="bg-orange-200 dark:bg-orange-800" />
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-2">Available Templates:</h4>
                      <div className="text-xs text-muted-foreground">
                        {templates.map((template, index) => (
                          <div key={index} className="mb-1">
                            • {template.name} - {template.description}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      {/* Generated Image Section */}
      <Card className="p-4">
        {/* Template Selection */}
        <div className="mb-4">
          <label className="text-sm font-medium text-foreground mb-2 block">
            Choose Template ({templates.length} available) - Provider: Ideogram
          </label>
        </div>
        {isLoadingImage ? (
          <div className="space-y-3">
            <div className="relative aspect-square w-full rounded-lg bg-muted flex items-center justify-center">
              {/* Loading animation with icon */}
              <div className="flex flex-col items-center gap-4 text-muted-foreground">
                <div className="relative">
                  <Zap className="h-12 w-12 animate-pulse" />
                  <div className="absolute -inset-2 border-2 border-primary/20 rounded-full animate-ping" />
                </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Generating your image...</p>
                    <p className="text-xs opacity-70">Using Ideogram</p>
                  </div>
              </div>
            </div>
          </div>
        ) : imageError ? (
          <div className="text-center space-y-3">
            <div className="text-sm text-destructive max-w-md mx-auto">
              {imageError}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRegenerateImage}
              className="flex items-center gap-2"
              disabled={!selectedTemplate}
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        ) : generatedImage ? (
          <div className="space-y-3">
            <div className="relative group">
              <img 
                src={generatedImage} 
                alt="Generated viibe image" 
                className="w-full rounded-lg shadow-lg"
              />
              {/* Fullscreen Button */}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setIsFullscreen(true)}
                className="absolute top-2 right-2 opacity-80 hover:opacity-100 transition-opacity z-10"
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2 justify-center">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDownloadImage}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRegenerateImage}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Regenerate
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center text-sm text-muted-foreground">
            {isLoadingTemplates ? 'Loading templates...' : 'Image will generate automatically with Cinematic style'}
          </div>
        )}
      </Card>

      {/* Fullscreen Modal */}
      {isFullscreen && generatedImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setIsFullscreen(false)}
        >
          <div className="relative max-w-full max-h-full">
            <img 
              src={generatedImage} 
              alt="Generated viibe image - Fullscreen" 
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsFullscreen(false)}
              className="absolute top-4 right-4 z-10 bg-white/20 hover:bg-white/30"
            >
              <X className="h-4 w-4" />
            </Button>
            {/* Download button in fullscreen mode */}
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadImage();
              }}
              className="absolute bottom-4 right-4 z-10 bg-white/20 hover:bg-white/30 flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
      )}


      <Separator />

      {/* Summary Section */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Summary & Technical Details
        </h3>
        <p className="text-sm text-muted-foreground">
          Review your choices and technical prompts
        </p>
      </div>

      {/* Values Table */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <h3 className="font-semibold text-foreground">Your Choices</h3>
        </div>
        <div className="divide-y divide-border">
          {summaryData.map((item, index) => (
            <div key={index} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
              <div className="flex flex-col">
                <span className="font-medium text-foreground text-sm">
                  {item.label.replace(/^\d+\.\s*/, '')}
                </span>
              </div>
              <div className="text-right max-w-[60%]">
                <span className="text-sm text-foreground break-words">
                  {item.value || 'Not set'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Selected Template Details */}
      {selectedTemplate && (
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground">Selected Template Details</h3>
          
          {/* Positive Prompt */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="default" className="bg-green-100 text-green-800">
                Positive Prompt (from Generate-Final-Prompt)
              </Badge>
            </div>
            <p className="text-sm text-foreground leading-relaxed">
              {selectedTemplate.positive.split('. ').map((line, i, arr) => (
                <span key={i}>
                  {line}{i < arr.length - 1 ? '.' : ''}
                  {i < arr.length - 1 && <br />}
                </span>
              ))}
            </p>
          </Card>

          {/* Negative Prompt */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="default" className="bg-red-100 text-red-800">
                Negative Prompt
              </Badge>
            </div>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
              {selectedTemplate.negative}
            </p>
          </Card>

        </div>
      )}
    </div>
  );
}