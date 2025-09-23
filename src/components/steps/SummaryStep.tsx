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

  // Generate templates on mount
  useEffect(() => {
    const generateTemplates = async () => {
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
          visualStyle: data.visuals?.style || 'general',
          layout: data.text?.layout || 'lower-banner',
          dimension: data.visuals?.dimension || 'square',
          insertedVisuals: Array.isArray(data.visuals?.customVisuals) ? data.visuals.customVisuals : 
                            (data.visuals?.customVisuals ? data.visuals.customVisuals.split(',').map(s => s.trim()) : [])
        };

        console.log('Generating templates with params:', params);
        const response = await generateFinalPrompt(params);
        
        if (response.templates && response.templates.length > 0) {
          setTemplates(response.templates);
          // Auto-select first template
          setSelectedTemplate(response.templates[0]);
        } else {
          throw new Error('No templates returned from API');
        }
      } catch (error) {
        console.error('Error generating templates:', error);
        setImageError(`Template generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    generateTemplates();
  }, [data]);

  const generateImageFromTemplate = async (template: PromptTemplate) => {
    setIsLoadingImage(true);
    setImageError(null);
    setGeneratedImage(null);
    
    try {
      console.log('Generating image with template:', template.name);
      const imageData = await generateImage({
        prompt: template.positive,
        negativePrompt: template.negative,
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
          selectedTemplate: template,
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

  const handleTemplateSelect = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    generateImageFromTemplate(template);
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
    { label: 'Category', value: data.category },
    { label: 'Subcategory', value: data.subcategory },
    { label: 'Final Text', value: data.text?.generatedText || data.text?.customText || 'No text' },
    { label: 'Tone', value: data.text?.tone },
    { label: 'Text Style', value: data.text?.style },
    { label: 'Layout', value: data.text?.layout },
    { label: 'Rating', value: data.text?.rating },
    { label: 'Specific Words', value: formatArrayValue(data.text?.specificWords) },
    { label: 'Visual Style', value: data.visuals?.style },
    { label: 'Dimension', value: data.visuals?.dimension },
    { label: 'Custom Visuals', value: formatArrayValue(data.visuals?.customVisuals) },
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
            <Skeleton className="aspect-square w-full rounded-lg" />
            <div className="text-center text-sm text-muted-foreground">
              Generating your image with Ideogram V3...
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
            {isLoadingTemplates ? 'Loading templates...' : 'Select a template below to generate your image'}
          </div>
        )}
      </Card>

      <Separator />

      {/* Template Selection */}
      <div className="space-y-4">
        <h3 className="font-semibold text-foreground">Choose Your Style Template</h3>
        
        {isLoadingTemplates ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-3 w-full mb-2" />
                <Skeleton className="h-3 w-3/4" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((template, index) => (
              <Card 
                key={index} 
                className={`p-4 cursor-pointer border-2 transition-all ${
                  selectedTemplate?.name === template.name 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => handleTemplateSelect(template)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={selectedTemplate?.name === template.name ? "default" : "secondary"}>
                    {template.name}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {template.description}
                </p>
                <div className="text-xs text-muted-foreground">
                  Click to generate with this style
                </div>
              </Card>
            ))}
          </div>
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