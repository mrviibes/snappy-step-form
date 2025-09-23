import { useEffect, useState } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, RefreshCw } from "lucide-react";
import { generateFinalPrompt, generateImage } from "@/lib/api";

interface SummaryStepProps {
  data: any;
  updateData: (data: any) => void;
  onNext: () => void;
}

export default function SummaryStep({ data, updateData }: SummaryStepProps) {
  const [prompts, setPrompts] = useState<{positive: string, negative: string} | null>(null);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(true);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Generate prompts on mount
  useEffect(() => {
    const generatePrompts = async () => {
      try {
        // Build the final prompt parameters from all collected data
        const finalText = data.text?.generatedText || data.text?.customText || '';
        
        const params = {
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

        const response = await generateFinalPrompt(params);
        const newPrompts = {
          positive: response.positivePrompt,
          negative: response.negativePrompt
        };
        setPrompts(newPrompts);
        
        // Generate image after prompts are ready
        await generateImageFromPrompt(newPrompts.positive);
      } catch (error) {
        console.error('Error generating prompts:', error);
        setPrompts({
          positive: 'Error generating positive prompt',
          negative: 'Error generating negative prompt'
        });
      } finally {
        setIsLoadingPrompts(false);
      }
    };

    generatePrompts();
  }, [data]);

  const generateImageFromPrompt = async (prompt: string) => {
    if (!prompt || prompt.includes('Error')) return;
    
    setIsLoadingImage(true);
    setImageError(null);
    
    try {
      const imageData = await generateImage({
        prompt,
        dimension: data.visuals?.dimension?.toLowerCase() as 'square' | 'portrait' | 'landscape' || 'square',
        quality: 'high'
      });
      
      setGeneratedImage(imageData);
      
      // Update form data with generated image
      updateData({
        generation: {
          ...data.generation,
          images: [imageData],
          selectedImage: imageData,
          isComplete: true
        }
      });
    } catch (error) {
      console.error('Error generating image:', error);
      setImageError(error instanceof Error ? error.message : 'Failed to generate image');
    } finally {
      setIsLoadingImage(false);
    }
  };

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
    if (prompts?.positive) {
      generateImageFromPrompt(prompts.positive);
    }
  };

  const formatArrayValue = (value: any) => {
    if (Array.isArray(value) && value.length > 0) {
      return value.join(', ');
    }
    return value || 'None';
  };

  const summaryData = [
    { label: 'Category', value: data.category },
    { label: 'Subcategory', value: data.subcategory },
    { label: 'Final Text', value: data.text?.generatedText || data.text?.customText || 'No text' },
    { label: 'Tone', value: data.text?.tone },
    { label: 'Text Style', value: data.text?.style },
    { label: 'Writing Preference', value: data.text?.writingPreference },
    { label: 'Layout', value: data.text?.layout },
    { label: 'Rating', value: data.text?.rating },
    { label: 'Specific Words', value: formatArrayValue(data.text?.specificWords) },
    { label: 'Comedian Style', value: data.text?.comedianStyle || 'None' },
    { label: 'Visual Style', value: data.visuals?.style },
    { label: 'Visual Option', value: data.visuals?.option },
    { label: 'Dimension', value: data.visuals?.dimension },
    { label: 'Custom Visuals', value: formatArrayValue(data.visuals?.customVisuals) },
    { label: 'Visual Description', value: data.visuals?.customVisualDescription || 'None' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Your Generated Image
        </h2>
        <p className="text-sm text-muted-foreground">
          Generated from your choices and prompts
        </p>
      </div>

      {/* Generated Image Section */}
      <Card className="p-4">
        {isLoadingImage ? (
          <div className="space-y-3">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <div className="text-center text-sm text-muted-foreground">
              Generating your image...
            </div>
          </div>
        ) : imageError ? (
          <div className="text-center space-y-3">
            <div className="text-sm text-destructive">
              {imageError}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRegenerateImage}
              className="flex items-center gap-2"
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
            {isLoadingPrompts ? 'Preparing to generate image...' : 'No image generated'}
          </div>
        )}
      </Card>

      <Separator />

      {/* Summary Section */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Summary & Prompts
        </h3>
        <p className="text-sm text-muted-foreground">
          Review all your choices and the technical prompts
        </p>
      </div>

      {/* Values Table */}
      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-4 text-foreground">Your Choices</h3>
        <div className="space-y-1">
          {summaryData.map((item, index) => (
            <div key={index} className="flex justify-between items-start gap-4 text-sm">
              <span className="font-medium text-muted-foreground min-w-0 flex-shrink-0">
                {item.label}:
              </span>
              <span className="text-foreground text-right break-words">
                {item.value || 'Not set'}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Separator />

      {/* Generated Prompts */}
      <div className="space-y-4">
        <h3 className="font-semibold text-foreground">Generated Prompts</h3>
        
        {isLoadingPrompts ? (
          <Card className="p-4">
            <div className="text-center text-muted-foreground">
              Generating prompts...
            </div>
          </Card>
        ) : (
          <>
            {/* Positive Prompt */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="default" className="bg-green-100 text-green-800">
                  Positive Prompt
                </Badge>
              </div>
              <p className="text-sm text-foreground leading-relaxed">
                {prompts?.positive || 'No positive prompt generated'}
              </p>
            </Card>

            {/* Negative Prompt */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="destructive" className="bg-red-100 text-red-800">
                  Negative Prompt
                </Badge>
              </div>
              <p className="text-sm text-foreground leading-relaxed">
                {prompts?.negative || 'No negative prompt generated'}
              </p>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}