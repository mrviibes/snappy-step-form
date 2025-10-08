import { useState, KeyboardEvent, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Loader2, AlertCircle } from 'lucide-react';
import negativeSpaceImage from "@/assets/open-space-layout.jpg";
import memeTextImage from "@/assets/meme-layout.jpg";
import lowerBannerImage from "@/assets/lower-banner-snailed-it-peace.jpg";
import sideBarImage from "@/assets/text-layout-hang-in-there.jpg";
import badgeCalloutImage from "@/assets/badge-callout-birthday.jpg";
import subtleCaptionImage from "@/assets/subtle-caption-layout.jpg";
import textLayoutExample from "@/assets/text-layout-example.jpg";
import { generateTextOptions, type TextOptionsResponse } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
// Validation imports removed
import DebugPanel from '@/components/DebugPanel';
import { fitnessGoals } from '@/data/CategoryList';
import { STYLES_BY_TONE, type ComedyStyleId } from '@/lib/comedyStyles';

interface TextStepProps {
  data: any;
  updateData: (data: any) => void;
  onNext: () => void;
}
// Tone options
const tones = [
  { id: "Humorous", label: "Humorous", description: "Funny, witty, makes me smile" },
  { id: "Savage", label: "Savage", description: "Harsh, brutal, cutting" },
  { id: "Sentimental", label: "Sentimental", description: "Sweet, warm, heartfelt" },
  { id: "Inspirational", label: "Inspirational", description: "Motivating, uplifting" }
];
const writingPreferences = [{
  id: 'ai-assist',
  label: 'AI Assist'
}, {
  id: 'write-myself',
  label: 'Write Myself'
}, {
  id: 'no-text',
  label: 'I Don\'t Want Text'
}];
const ratingOptions = [
  { id: "G", label: "G", name: "G", description: "Clean jokes for everyone" },
  { id: "PG", label: "PG", name: "PG", description: "Light sarcasm, still safe" },
  { id: "PG-13", label: "PG-13", name: "PG-13", description: "Slightly edgy, modern humor" },
  { id: "R", label: "R", name: "R", description: "Adult, bold, unfiltered wit" }
];
export default function TextStep({
  data,
  updateData,
  onNext
}: TextStepProps) {
  const [showGeneration, setShowGeneration] = useState(false);
  const [showTextOptions, setShowTextOptions] = useState(false);
  const [selectedTextOption, setSelectedTextOption] = useState<number | null>(null);
  const [textOptions, setTextOptions] = useState<Array<{
    line: string;
  }>>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showLayoutOptions, setShowLayoutOptions] = useState(false);
  const [customText, setCustomText] = useState('');
  const [isCustomTextSaved, setIsCustomTextSaved] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [debugExpanded, setDebugExpanded] = useState(false);
  
  const { toast } = useToast();

  // Pick default comedy style based on tone
  const pickDefaultStyle = (tone?: string): ComedyStyleId => {
    const toneKey = tone || "Humorous";
    const stylesForTone = STYLES_BY_TONE[toneKey];
    return stylesForTone?.[0] || "punchline-first";
  };


  const handleGenerate = async () => {
    const tags = data.tags || [];
    if (tags.length === 0 || !data.text?.tone || !data.text?.rating) return;

    setIsGenerating(true);
    setGenerationError(null);
    setDebugExpanded(false);
    setTextOptions([]); // Clear old options
    setSelectedTextOption(null); // Reset selection
    
    try {
      // Parse tags into names (capitalized tokens) vs theme phrases
      const tags = data.tags || [];
      const nameTokens: string[] = [];
      const themePhrase: string[] = [];

      if (tags.length > 0) {
        tags.forEach(t => {
          const parts = String(t).trim().split(/\s+/);
          parts.every(p => /^[A-Z][a-z]+$/.test(p))
            ? nameTokens.push(...parts)
            : themePhrase.push(t);
        });
      }

      // Extract topics directly from tags (up to 3)
      const topics = (data.tags || []).filter(Boolean).slice(0, 3);

      // Create debug info
      const requestPayload = {
        topics,
        tone: data.text.tone,
        rating: data.text.rating,
        styleId: pickDefaultStyle(data.text.tone),
        userId: 'anonymous'
      };
      
      setDebugInfo({
        model: 'server-selected',
        endpoint: 'generate-text',
        requestPayload,
        timestamp: new Date().toISOString(),
        status: 'sending...'
      });
      
      const response = await generateTextOptions(requestPayload);
      
      // Handle response format and extract model information
      const options = response.options || [];
      const usedModel = response.model || 'unknown';
      const source = response.source || 'unknown';
      const req_id = response.req_id || 'unknown';
      
      if (options && options.length > 0) {
        // Update debug info with success and actual model
        setDebugInfo(prev => ({
          ...prev,
          model: usedModel,
          source: source,
          req_id: req_id,
          status: 'success',
          responseLength: options.length,
          rawResponse: response
        }));
        
        // Format options without validation
        const formattedOptions = options.map((option: { line: string }) => ({
          line: option.line
        }));
        
        // Client-side filter: ensure all lines are 60-120 characters
        const finalOptions = formattedOptions.filter(o => {
          const len = (o.line || "").length;
          return len >= 60 && len <= 120;
        }).slice(0, 4);
        
        setTextOptions(finalOptions);
        setShowTextOptions(true);
      } else {
        throw new Error('No content generated');
      }
      
    } catch (error) {
      console.error('Text generation error:', error);
      setDebugInfo(prev => ({
        ...prev,
        status: 'error',
        error: error.message,
        errorDetails: error
      }));
      setGenerationError('Could not generate text options. Please try again.');
      setDebugExpanded(true); // Auto-expand debug panel on error
    } finally {
      setIsGenerating(false);
    }
  };
  const handleToneSelect = (toneId: string) => {
    updateData({
      text: {
        ...data.text,
        tone: toneId
      }
    });
    // Compatibility check now handled by useEffect
  };
  const handleEditTone = () => {
    updateData({
      text: {
        ...data.text,
        tone: ""
      }
    });
  };
  const handleWritingPreferenceSelect = (preferenceId: string) => {
    updateData({
      text: {
        ...data.text,
        writingPreference: preferenceId
      }
    });

    // If "write-myself" is selected, skip to custom text input
    if (preferenceId === 'write-myself') {
      setShowGeneration(false);
      setShowTextOptions(false);
    }
    // If "no-text" is selected, mark as complete - no further input needed
    else if (preferenceId === 'no-text') {
      updateData({
        text: {
          ...data.text,
          writingPreference: preferenceId,
          generatedText: 'No text selected',
          isComplete: true
        }
      });
    }
    // If "AI Assist" is selected, go directly to generation
    else if (preferenceId === 'ai-assist') {
      setShowGeneration(true);
    }
  };
  const handleEditWritingPreference = () => {
    updateData({
      text: {
        ...data.text,
        writingPreference: ""
      }
    });
    setShowGeneration(false);
  };
  const handleRatingSelect = (ratingId: string) => {
    updateData({
      text: {
        ...data.text,
        rating: ratingId
      }
    });
  };
  
  const handleEditRating = () => {
    updateData({
      text: {
        ...data.text,
        rating: ""
      }
    });
  };
  const handleTextOptionSelect = (optionIndex: number) => {
    setSelectedTextOption(optionIndex);
    // Don't automatically show layout options, keep them visible in the flow
    updateData({
      text: {
        ...data.text,
        selectedOption: optionIndex,
        generatedText: textOptions[optionIndex]?.line || ''
      }
    });
  };
  const handleCustomTextChange = (value: string) => {
    if (value.length <= 120) {
      setCustomText(value);
      setIsCustomTextSaved(false); // Reset saved status when editing
    }
  };
  const handleSaveCustomText = () => {
    if (customText.trim()) {
      updateData({
        text: {
          ...data.text,
          customText: customText.trim(),
          generatedText: customText.trim()
        }
      });
      setIsCustomTextSaved(true);
    }
  };
  const handleCustomTextKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && customText.trim()) {
      handleSaveCustomText();
    }
  };
  const handleLayoutSelect = (layoutId: string) => {
    updateData({
      text: {
        ...data.text,
        layout: layoutId,
        isComplete: true // Mark as complete when layout is selected
      }
    });
  };

  // Layout options
  const layoutOptions = [{
    id: "meme-text",
    title: "Meme Text",
    description: "Text at top and bottom"
  }, {
    id: "badge-callout",
    title: "Badge Text",
    description: "Text in colorful badge"
  }, {
    id: "negative-space",
    title: "Open Space",
    description: "Text in empty areas"
  }, {
    id: "integrated-in-scene",
    title: "In Scene",
    description: "Text naturally in image"
  }];
  const selectedTone = tones.find(tone => tone.id === data.text?.tone);
  const selectedWritingPreference = writingPreferences.find(pref => pref.id === data.text?.writingPreference);

  // Helper function to render tags breadcrumb
  const renderBreadcrumb = () => {
    const tags = data.tags || [];
    if (tags.length === 0) return null;
    
    return (
      <div className="text-left mb-1">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold">Your topics:</span> {tags.join(' > ')}
        </div>
      </div>
    );
  };

  // Show tone selection if no tone is selected
  if (!data.text?.tone) {
    return <div className="space-y-6">
      {/* Category Breadcrumb - Left aligned */}
      {renderBreadcrumb()}

        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            Choose Your Tone
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {tones.map(tone => <button key={tone.id} onClick={() => handleToneSelect(tone.id)} className="h-20 rounded-lg border-2 p-4 text-center transition-all duration-300 ease-smooth border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-accent/50">
              <div className="flex h-full flex-col items-center justify-center space-y-1">
                <div className="font-semibold text-sm">{tone.label}</div>
                <div className="text-xs text-muted-foreground">{tone.description}</div>
              </div>
            </button>)}
        </div>
      </div>;
  }

  // Show rating selection if tone is selected but no rating is selected
  if (data.text?.tone && !data.text?.rating) {
    return <div className="space-y-6">
      {/* Category Breadcrumb - Left aligned */}
      {renderBreadcrumb()}

        {/* Selected Tone Display with Edit Option */}
        <div className="rounded-lg border-2 border-cyan-400 bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-foreground">
              <span className="font-semibold">Tone</span> - {selectedTone?.label}
            </div>
            <button onClick={handleEditTone} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">
              Edit
            </button>
          </div>
        </div>


        {/* Rating Selection */}
        <div className="space-y-3 pt-4">
          <div className="text-center">
            <h2 className="mb-2 text-xl font-semibold text-foreground">
              Choose Your Rating
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {ratingOptions.map(rating => (
              <button 
                key={rating.id} 
                onClick={() => handleRatingSelect(rating.id)} 
                className={cn(
                  "h-20 rounded-lg border-2 p-4 text-center transition-all duration-300 ease-smooth",
                  data.text?.rating === rating.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-accent/50"
                )}
              >
                <div className="flex h-full flex-col items-center justify-center space-y-1">
                  <div className="font-semibold text-sm">{rating.name}</div>
                  <div className="text-xs text-muted-foreground">{rating.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>;
  }

  // Show writing preference selection if no preference is selected
  if (!data.text?.writingPreference) {
    return <div className="space-y-6">
      {/* Category Breadcrumb - Left aligned */}
      {renderBreadcrumb()}

        {/* Selected Tone and Rating Display with Edit Options */}
        <div className="rounded-lg border-2 border-cyan-400 bg-card overflow-hidden">
          {/* Selected Tone */}
          <div className="flex items-center justify-between p-4">
            <div className="text-sm text-foreground">
              <span className="font-semibold">Tone</span> - {selectedTone?.label}
            </div>
            <button onClick={handleEditTone} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">
              Edit
            </button>
          </div>

          {/* Selected Rating */}
          <div className="flex items-center justify-between p-4 border-t border-border">
            <div className="text-sm text-foreground">
              <span className="font-semibold">Rating</span> - {ratingOptions.find(r => r.id === data.text?.rating)?.name}
            </div>
            <button onClick={handleEditRating} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">
              Edit
            </button>
          </div>
        </div>

        {/* Writing Preference Selection */}
        <div className="text-center pt-4">
          <h2 className="mb-4 text-xl font-semibold text-foreground">
            Choose Your Writing Process
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {writingPreferences.map(preference => <button key={preference.id} onClick={() => handleWritingPreferenceSelect(preference.id)} className="rounded-lg border-2 p-4 text-center transition-all duration-300 ease-smooth border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-accent/50">
              <div className="font-semibold text-sm">{preference.label}</div>
            </button>)}
        </div>
      </div>;
  }

  // Special case: If "no-text" is selected, show simple confirmation
  if (data.text?.writingPreference === 'no-text') {
    return <div className="space-y-6">
      {/* Category Breadcrumb - Left aligned */}
      {renderBreadcrumb()}

        {/* Selected Tone and Process in stacked format */}
        <div className="rounded-lg border-2 border-cyan-400 bg-card overflow-hidden">
          {/* Selected Tone */}
          <div className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <div className="text-sm text-foreground">
                <span className="font-semibold">Tone</span> - {selectedTone?.label}
              </div>
            </div>
            <button onClick={handleEditTone} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">
              Edit
            </button>
          </div>

          {/* Selected Writing Preference */}
          <div className="flex items-center justify-between p-4 border-t border-border">
            <div className="space-y-1">
              <div className="text-sm text-foreground">
                <span className="font-semibold">Process</span> - {selectedWritingPreference?.label}
              </div>
            </div>
            <button onClick={handleEditWritingPreference} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">
              Edit
            </button>
          </div>
        </div>

        {/* Confirmation Message */}
        <div className="text-center p-8">
          <div className="text-lg font-medium text-foreground mb-2">
            Perfect! No text will be added to your design.
          </div>
          <div className="text-sm text-muted-foreground">
            You can proceed to choose your visual style.
          </div>
        </div>
      </div>;
  }

  // Show selected preferences and specific words input
  return <div className="space-y-6">
      {/* Category Breadcrumb - Left aligned */}
      {renderBreadcrumb()}

      {/* Selected Tone and Process in stacked format */}
      <div className="rounded-lg border-2 border-cyan-400 bg-card overflow-hidden">
        {/* Selected Tone */}
        <div className="flex items-center justify-between p-4">
          <div className="space-y-1">
            <div className="text-sm text-foreground"><span className="font-semibold">Tone</span> - {selectedTone?.label}</div>
          </div>
          <button onClick={handleEditTone} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">
            Edit
          </button>
        </div>

        {/* Selected Writing Preference */}
        <div className="flex items-center justify-between p-4 border-t border-border">
          <div className="space-y-1">
            <div className="text-sm text-foreground"><span className="font-semibold">Process</span> - {selectedWritingPreference?.label}</div>
          </div>
          <button onClick={handleEditWritingPreference} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">
            Edit
          </button>
        </div>

        {/* Selected Rating */}
        <div className="flex items-center justify-between p-4 border-t border-border">
          <div className="text-sm text-foreground">
            <span className="font-semibold">Rating</span> - {ratingOptions.find(r => r.id === data.text?.rating)?.name}
          </div>
          <button onClick={handleEditRating} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">
            Edit
          </button>
        </div>

        {/* Text Layout - Always show */}
        <div className="flex items-center justify-between p-4 border-t border-border">
          <div className="text-sm text-foreground">
            <span className="font-semibold">Text Layout</span> - {data.text?.layout ? layoutOptions.find(l => l.id === data.text?.layout)?.title : 'Not selected'}
          </div>
          <button 
            onClick={() => {
              updateData({
                text: {
                  ...data.text,
                  layout: ''
                }
              });
            }} 
            className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors"
          >
            Edit
          </button>
        </div>
      </div>

      
      {/* Custom Text Input for Write Myself option */}
      {data.text?.writingPreference === 'write-myself' && !isCustomTextSaved && <div className="space-y-4 pt-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground">Write Your Own Text</h2>
          </div>
          
          <div className="space-y-3">
            <Input value={customText} onChange={e => handleCustomTextChange(e.target.value)} onKeyDown={handleCustomTextKeyDown} placeholder="Enter your text here (up to 120 characters)" maxLength={120} className="w-full" />
            <div className="text-right text-sm text-muted-foreground">
              {customText.length}/120 characters
            </div>
            
            {/* Save Button - only show when there's text to save */}
            {customText.trim() && <div className="flex justify-center">
                <Button onClick={handleSaveCustomText} className="bg-cyan-400 hover:bg-cyan-500 text-white px-6 py-2 rounded-md font-medium">
                  Save Text
                </Button>
              </div>}
          </div>
        </div>}
        
        {/* Generation Section */}
        {showGeneration && !showTextOptions && <div className="space-y-4 pt-4">
            <div className="space-y-4">
              {/* Generate Button - Full width on mobile */}
              <div className="w-full space-y-3 pt-5">
                <Button onClick={handleGenerate} disabled={isGenerating} className="w-full bg-cyan-400 hover:bg-cyan-500 disabled:bg-gray-400 text-white py-3 rounded-md font-medium min-h-[48px] text-base shadow-lg hover:shadow-xl transition-all duration-200">
                  {isGenerating ? <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </> : 'Generate Text'}
                </Button>
                
                
              </div>

              {/* Error Display */}
              {generationError && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm">{generationError}</p>
                  </div>
                </div>}
              
            </div>
          </div>}
              
              {/* Text Options - Show after generation but only if no text selected yet */}
              {showTextOptions && selectedTextOption === null && <div className="space-y-3 p-4">
                  <h3 className="text-lg font-semibold text-foreground text-center">Choose your text:</h3>
                  
                  {/* Generate Again Button */}
                  <div className="flex justify-center">
                    <button onClick={handleGenerate} disabled={isGenerating} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-50">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {isGenerating ? 'Generating...' : 'Generate Again'}
                    </button>
                  </div>
                  
                   <div className="space-y-3">
                     {textOptions.map((textOption, index) => <div key={index} onClick={() => handleTextOptionSelect(index)} className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${selectedTextOption === index ? 'border-primary bg-accent text-foreground' : 'border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-accent/50'}`}>
                         <p className="text-sm leading-relaxed mb-2">{textOption.line}</p>
                       </div>)}
                   </div>
                 </div>}

               {/* Layout Options - Show after text selection or saved custom text */}
               {(selectedTextOption !== null && !data.text?.layout || data.text?.writingPreference === 'write-myself' && isCustomTextSaved && !data.text?.layout) && <div className="space-y-3 p-4">
                   <h3 className="text-lg font-semibold text-foreground text-center">Choose Your Text Layout:</h3>
                   <div className="grid grid-cols-2 gap-3">
                     {layoutOptions.map(layout => <Card key={layout.id} className={cn("cursor-pointer text-center transition-all duration-300 hover:scale-105", "border-2 bg-card hover:bg-accent hover:border-primary", {
          "border-primary shadow-primary bg-accent": data.text?.layout === layout.id,
          "border-border": data.text?.layout !== layout.id
        })} onClick={() => handleLayoutSelect(layout.id)}>
                         <div className="p-6 flex flex-col items-center justify-center h-28">
                           <h3 className="text-base font-semibold text-foreground mb-2">
                             {layout.title}
                           </h3>
                           <p className="text-sm text-muted-foreground">
                             {layout.description}
                           </p>
                         </div>
                       </Card>)}
                   </div>
                   </div>}
                   
      {/* Enhanced Debug Panel - Auto-expands on errors */}
      {debugInfo && (
        <div className="mt-6 space-y-2">
          <DebugPanel
            title="Text Generation Debug"
            model={debugInfo.model}
            status={debugInfo.status}
            endpoint={debugInfo.endpoint}
            timestamp={debugInfo.timestamp}
            requestPayload={debugInfo.requestPayload}
            responseData={debugInfo.rawResponse}
            error={debugInfo.error}
            className={cn(
              "transition-all duration-300",
              debugExpanded && debugInfo.status === 'error' ? "ring-2 ring-red-200 border-red-200" : ""
            )}
          />
        </div>
      )}
      
     </div>;
}