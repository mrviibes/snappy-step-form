import { useEffect, useState, useRef } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, RefreshCw, Zap } from "lucide-react";
import { generateFinalPrompt, generateImage } from "@/lib/api";
import DebugPanel from "@/components/DebugPanel";


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
  
  // Request token to prevent concurrent generations and late responses
  const currentRequestRef = useRef<string | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debug state for final prompt generation
  const [promptDebugInfo, setPromptDebugInfo] = useState<{
    timestamp: string;
    step: string;
    params?: any;
    apiResponse?: any;
    error?: any;
  } | null>(null);

  // Debug state for image generation
  const [imageDebugInfo, setImageDebugInfo] = useState<{
    timestamp: string;
    step: string;
    template?: any;
    params?: any;
    apiResponse?: any;
    error?: any;
  } | null>(null);

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
          composition_modes: Array.isArray(data.visuals?.customVisuals) ? data.visuals.customVisuals : 
                            (data.visuals?.customVisuals ? data.visuals.customVisuals.split(',').map(s => s.trim()) : [])
        };

        console.log('Generating templates with params:', params);
        
        // Set prompt debug info
        setPromptDebugInfo({
          timestamp: new Date().toISOString(),
          step: 'API_CALL_START',
          params
        });

        const response = await generateFinalPrompt(params);
        
        // Check if this request is still current
        if (currentRequestRef.current !== requestToken) {
          console.log('Template request was superseded, ignoring response');
          return;
        }
        
        if (response.templates && response.templates.length > 0) {
          setTemplates(response.templates);
          
          // Update prompt debug info with success
          setPromptDebugInfo(prev => ({
            ...prev!,
            step: 'API_CALL_SUCCESS',
            apiResponse: response.templates
          }));
          
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
          
          // Update prompt debug info with error
          setPromptDebugInfo(prev => ({
            ...prev!,
            step: 'API_CALL_ERROR',
            error: {
              message: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined,
              type: typeof error,
              raw: error
            }
          }));
          
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
      
      // Set image debug info
      const imageParams = {
        prompt: template.positive,
        negativePrompt: template.negative,
        image_dimensions: data.visuals?.dimension?.toLowerCase() as 'square' | 'portrait' | 'landscape' || 'square',
        quality: 'high' as const
      };
      
      setImageDebugInfo({
        timestamp: new Date().toISOString(),
        step: 'API_CALL_START',
        template: {
          name: template.name,
          description: template.description
        },
        params: imageParams
      });

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
        
        // Update image debug info with success
        setImageDebugInfo(prev => ({
          ...prev!,
          step: 'API_CALL_SUCCESS',
          apiResponse: { imageData: response.imageData.substring(0, 100) + '...' }
        }));
        
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
        
        // Update image debug info with job info
        setImageDebugInfo(prev => ({
          ...prev!,
          step: 'POLLING_START',
          apiResponse: { jobId: response.jobId, provider: response.provider }
        }));
        
        pollForImageCompletion(response.jobId, response.provider, template, currentToken);
      } else {
        throw new Error('Invalid response format from image generation API');
      }
    } catch (error) {
      if (currentRequestRef.current === currentToken) {
        console.error('Error generating image:', error);
        
        // Update image debug info with error
        setImageDebugInfo(prev => ({
          ...prev!,
          step: 'API_CALL_ERROR',
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            type: typeof error,
            raw: error
          }
        }));
        
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

  const pollForImageCompletion = async (jobId: string, provider: 'ideogram' | 'openai', template: PromptTemplate, requestToken: string) => {
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
    { label: '9. composition_modes', value: formatArrayValue(data.visuals?.customVisuals) },
    { label: '10. completed_visual_description', value: data.visuals?.completed_visual_description || 'None' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Your Generated Image
        </h2>
        <p className="text-sm text-muted-foreground">
          Choose a template and generate your final image
        </p>
      </div>

      {/* Generated Image Section */}
      <Card className="p-4">
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
                  <p className="text-xs opacity-70">Using Ideogram V3</p>
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
            <div className="relative">
              <img 
                src={generatedImage} 
                alt="Generated viibe image" 
                className="w-full rounded-lg shadow-lg"
              />
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

      <Separator />

      {/* Debug Panels for Summary Step */}
      <div className="space-y-4">
        {promptDebugInfo && (
          <DebugPanel
            title="Final Prompt Generation Debug"
            model="gpt-4o-mini"
            status={promptDebugInfo.step === 'API_CALL_START' ? 'sending...' : 
                   promptDebugInfo.step === 'API_CALL_SUCCESS' ? 'completed' :
                   promptDebugInfo.step === 'API_CALL_ERROR' ? 'error' : 'idle'}
            endpoint="generate-final-prompt"
            timestamp={promptDebugInfo.timestamp}
            requestPayload={promptDebugInfo.params}
            responseData={promptDebugInfo.apiResponse}
            error={promptDebugInfo.error}
          />
        )}

        {imageDebugInfo && (
          <DebugPanel
            title="Image Generation Debug"
            model="ideogram-v3"
            status={imageDebugInfo.step === 'API_CALL_START' ? 'sending...' : 
                   imageDebugInfo.step === 'POLLING_START' ? 'polling...' :
                   imageDebugInfo.step === 'API_CALL_SUCCESS' ? 'completed' :
                   imageDebugInfo.step === 'API_CALL_ERROR' ? 'error' : 'idle'}
            endpoint="generate-image"
            timestamp={imageDebugInfo.timestamp}
            requestPayload={imageDebugInfo.params}
            responseData={imageDebugInfo.apiResponse}
            formData={imageDebugInfo.template}
            error={imageDebugInfo.error}
          />
        )}
      </div>

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
      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-4 text-foreground">Your Choices</h3>
        <div className="space-y-1">
          {summaryData.map((item, index) => (
            <div key={index} className="flex items-start gap-4 text-sm">
              <span className="font-medium text-muted-foreground min-w-0">
                {item.label}:
              </span>
              <span className="text-foreground break-words">
                {item.value || 'Not set'}
              </span>
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
                Positive Prompt ({selectedTemplate.name})
              </Badge>
            </div>
            <p className="text-sm text-foreground leading-relaxed">
              {selectedTemplate.positive}
            </p>
          </Card>

          {/* Negative Prompt */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="destructive" className="bg-red-100 text-red-800">
                Negative Prompt ({selectedTemplate.name})
              </Badge>
            </div>
            <p className="text-sm text-foreground leading-relaxed">
              {selectedTemplate.negative}
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}