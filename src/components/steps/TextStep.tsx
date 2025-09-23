import { useState, KeyboardEvent, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getTones, getStyles, getRatings, getComedianStyles } from '@/config/aiRules';
import { Loader2, AlertCircle } from 'lucide-react';
import negativeSpaceImage from "@/assets/open-space-layout.jpg";
import memeTextImage from "@/assets/meme-layout.jpg";
import lowerBannerImage from "@/assets/lower-banner-snailed-it-peace.jpg";
import sideBarImage from "@/assets/text-layout-hang-in-there.jpg";
import badgeCalloutImage from "@/assets/badge-callout-birthday.jpg";
import subtleCaptionImage from "@/assets/subtle-caption-layout.jpg";
import textLayoutExample from "@/assets/text-layout-example.jpg";
import { generateTextOptions } from '@/lib/api';
interface TextStepProps {
  data: any;
  updateData: (data: any) => void;
  onNext: () => void;
}
// Get configuration from AI rules
const tones = getTones().map(tone => ({
  id: tone.id,
  label: tone.name,
  description: tone.summary
}));
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
const styleOptions = getStyles().map(style => ({
  id: style.id,
  label: `${style.name} (${style.tag})`
}));
const ratingOptions = getRatings().map(rating => ({
  id: rating.id,
  label: `${rating.name} (${rating.tag})`
}));
const comedianOptions = getComedianStyles().map(comedian => ({
  id: comedian.id,
  label: comedian.name,
  description: comedian.notes
}));
export default function TextStep({
  data,
  updateData,
  onNext
}: TextStepProps) {
  const [tagInput, setTagInput] = useState('');
  const [showGeneration, setShowGeneration] = useState(false);
  const [showTextOptions, setShowTextOptions] = useState(false);
  const [selectedTextOption, setSelectedTextOption] = useState<number | null>(null);
  const [textOptions, setTextOptions] = useState<Array<{line: string, comedian: string}>>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showLayoutOptions, setShowLayoutOptions] = useState(false);
  const [customText, setCustomText] = useState('');
  const [isCustomTextSaved, setIsCustomTextSaved] = useState(false);
  const [showComedianStyle, setShowComedianStyle] = useState(false);
  const [showSpecificWordsChoice, setShowSpecificWordsChoice] = useState(false);
  const [showSpecificWordsInput, setShowSpecificWordsInput] = useState(false);
  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const options = await generateTextOptions({
        category: data.category || 'celebrations',
        subcategory: data.subcategory,
        tone: data.text?.tone,
        style: data.text?.style || 'Generic',
        rating: data.text?.rating || 'PG',
        insertWords: Array.isArray(data.text?.specificWords)
          ? data.text?.specificWords
          : data.text?.specificWords
          ? [data.text?.specificWords]
          : [],
        comedianStyle: data.text?.comedianStyle ? { 
          name: data.text.comedianStyle, 
          flavor: '' 
        } : null,
        userId: 'anonymous'
      });

      // Client-side guard: ensure 50–120 chars
      const safe = options.filter(o => o?.line && o?.comedian && o.line.length >= 50 && o.line.length <= 120);
      if (safe.length < 4) {
        // Pad with existing safe options or show what we have
        const finalOptions = safe.length > 0 ? safe : options.slice(0, 4);
        setTextOptions(finalOptions);
      } else {
        setTextOptions(safe.slice(0, 4));
      }

      setShowTextOptions(true);
    } catch (error) {
      console.error('Text generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Generation failed';
      
      let userFriendlyMessage = 'Failed to generate text options. ';
      if (errorMessage.includes('timeout') || errorMessage.includes('Request timeout')) {
        userFriendlyMessage += 'The request took too long - please try again or simplify your requirements.';
      } else if (errorMessage.includes('validation')) {
        userFriendlyMessage += 'Generated content didn\'t meet quality standards - please try different settings.';
      } else {
        userFriendlyMessage += errorMessage || 'Please try again.';
      }
      
      setGenerationError(userFriendlyMessage);
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
    // If "AI Assist" is selected, show specific words choice
    else if (preferenceId === 'ai-assist') {
      setShowSpecificWordsChoice(true);
    }
  };
  const handleEditWritingPreference = () => {
    updateData({
      text: {
        ...data.text,
        writingPreference: ""
      }
    });
    setShowSpecificWordsChoice(false);
  };
  const handleSpecificWordsChoice = (hasWords: boolean) => {
    if (hasWords) {
      setShowSpecificWordsInput(true);
      // Keep showing the choice section but now with input
    } else {
      setShowSpecificWordsChoice(false);
      setShowGeneration(true); // Skip to generation step
    }
  };
  const handleAddTag = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      const input = tagInput.trim();

      // Check if it's advanced format (contains colons, brackets, or braces)
      if (/[\[\]{}:]/.test(input)) {
        // Store as a single structured string for the backend to parse
        updateData({
          text: {
            ...data.text,
            specificWords: [input] // Store as single item to preserve structure
          }
        });
      } else {
        // Handle simple comma-separated words
        const currentWords = data.text?.specificWords || [];
        const wordsToAdd = input.split(',').map(w => w.trim()).filter(Boolean);
        const newWords = wordsToAdd.filter(word => !currentWords.includes(word));
        if (newWords.length > 0) {
          updateData({
            text: {
              ...data.text,
              specificWords: [...currentWords.filter(w => !/[\[\]{}:]/.test(w)), ...newWords]
            }
          });
        }
      }
      setTagInput('');
    }
  };
  const handleRemoveTag = (wordToRemove: string) => {
    const currentWords = data.text?.specificWords || [];
    updateData({
      text: {
        ...data.text,
        specificWords: currentWords.filter(word => word !== wordToRemove)
      }
    });
  };
  const handleReadyToGenerate = () => {
    setShowGeneration(true);
    setShowSpecificWordsChoice(false);
    setShowSpecificWordsInput(false);
  };
  const handleStyleSelect = (styleId: string) => {
    updateData({
      text: {
        ...data.text,
        style: styleId
      }
    });
  };
  const handleRatingSelect = (ratingId: string) => {
    updateData({
      text: {
        ...data.text,
        rating: ratingId
      }
    });
  };
  const handleComedianStyleSelect = (comedianId: string) => {
    updateData({
      text: {
        ...data.text,
        comedianStyle: comedianId
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
    if (value.length <= 100) {
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
        isComplete: true  // Mark as complete when layout is selected
      }
    });
  };

  // Layout options
  const layoutOptions = [{
    id: "negative-space",
    title: "Open Space",
    image: negativeSpaceImage
  }, {
    id: "meme-text",
    title: "Meme Text",
    image: memeTextImage
  }, {
    id: "lower-banner",
    title: "Lower Banner",
    image: lowerBannerImage
  }, {
    id: "side-bar",
    title: "Side Bar",
    image: sideBarImage
  }, {
    id: "badge-callout",
    title: "Badge Callout",
    image: badgeCalloutImage
  }, {
    id: "subtle-caption",
    title: "Caption",
    image: subtleCaptionImage
  }];
  const selectedTone = tones.find(tone => tone.id === data.text?.tone);
  const selectedWritingPreference = writingPreferences.find(pref => pref.id === data.text?.writingPreference);

  // Show tone selection if no tone is selected
  if (!data.text?.tone) {
    return <div className="space-y-6">
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

  // Show writing preference selection if no preference is selected
  if (!data.text?.writingPreference) {
    return <div className="space-y-6">
        {/* Selected Tone Display with Edit Option */}
        <div className="rounded-lg border-2 border-primary bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-foreground">
              <span className="font-semibold">Tone</span> - {selectedTone?.label}
            </div>
            <button onClick={handleEditTone} className="text-primary hover:text-primary/80 text-sm font-medium transition-colors">
              Edit
            </button>
          </div>
        </div>

        {/* Writing Preference Selection */}
        <div className="text-center pt-4">
          <h2 className="mb-4 text-xl font-semibold text-foreground">
            Choose Your Writing Preference
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
    return (
      <div className="space-y-6">
        {/* Selected Tone and Process in stacked format */}
        <div className="rounded-lg border-2 border-cyan-400 bg-card overflow-hidden">
          {/* Selected Tone */}
          <div className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <div className="text-sm text-foreground">
                <span className="font-semibold">Tone</span> - {selectedTone?.label}
              </div>
            </div>
            <button 
              onClick={handleEditTone} 
              className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors"
            >
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
            <button 
              onClick={handleEditWritingPreference} 
              className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors"
            >
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
      </div>
    );
  }

  // Show selected preferences and specific words input
  return <div className="space-y-6">
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
        
        {/* Inserted Words Section - show after choosing yes for AI assist */}
        {data.text?.writingPreference === 'ai-assist' && !showSpecificWordsChoice && <div className="flex items-center justify-between p-4 border-t border-border">
            <div className="text-sm text-foreground">
              <span className="font-semibold">Inserted Words</span> - {data.text?.specificWords && data.text.specificWords.length > 0 ? data.text.specificWords.map(word => `${word}`).join(', ') : 'chosen'}
            </div>
            <button onClick={() => {
          setShowGeneration(false);
          setShowSpecificWordsChoice(true);
          setShowSpecificWordsInput(false);
        }} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">
              Edit
            </button>
          </div>}

        {/* Style and Rating Summary - only show after text generation */}
        {showTextOptions && <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="text-sm text-foreground">
              <span className="font-semibold">Style</span> - {styleOptions.find(s => s.id === data.text?.style)?.label.split(' (')[0] || 'Generic'} | <span className="font-semibold">Rating</span> - {ratingOptions.find(r => r.id === data.text?.rating)?.label.split(' (')[0] || 'G'}
            </div>
            <button onClick={() => {
          setShowTextOptions(false);
          setSelectedTextOption(null);
        }} className="text-primary hover:text-primary/80 text-sm font-medium transition-colors">
              Edit
            </button>
          </div>}

        {/* Selected Text Summary - only show after text selection or saved custom text */}
        {(selectedTextOption !== null || data.text?.writingPreference === 'write-myself' && isCustomTextSaved) && <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="text-sm text-foreground">
              <span className="font-semibold">Text</span> - {data.text?.writingPreference === 'write-myself' ? data.text.customText ? data.text.customText.substring(0, 20) + (data.text.customText.length > 20 ? '...' : '') : '' : textOptions[selectedTextOption]?.line?.substring(0, 20) + '...'}
            </div>
            <button onClick={() => {
          if (data.text?.writingPreference === 'write-myself') {
            setCustomText('');
            setIsCustomTextSaved(false);
            updateData({
              text: {
                ...data.text,
                customText: '',
                generatedText: ''
              }
            });
          } else {
            setSelectedTextOption(null);
            setShowLayoutOptions(false);
          }
        }} className="text-primary hover:text-primary/80 text-sm font-medium transition-colors">
              Edit
            </button>
          </div>}

        {/* Selected Layout Summary - only show after layout selection */}
        {data.text?.layout && <div className="flex items-center justify-between p-4">
            <div className="text-sm text-foreground">
              <span className="font-semibold">Layout</span> - {layoutOptions.find(l => l.id === data.text?.layout)?.title}
            </div>
            <button onClick={() => updateData({
          text: {
            ...data.text,
            layout: ''
          }
        })} className="text-primary hover:text-primary/80 text-sm font-medium transition-colors">
              Edit
            </button>
          </div>}
      </div>

      {/* Add Specific Words Choice Section - only show for AI Assist */}
      {showSpecificWordsChoice && data.text?.writingPreference === 'ai-assist' && <div className="space-y-4 pt-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground">Do you have any specific words you want included?</h2>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground text-center">eg. Names, Happy Birthday, Congrats etc.</p>
            </div>
          </div>

          {!showSpecificWordsInput ? (
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => handleSpecificWordsChoice(true)} className="rounded-lg border-2 p-6 text-center transition-all duration-300 ease-smooth border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-accent/50">
                <div className="font-semibold text-lg">Yes</div>
              </button>
              <button onClick={() => handleSpecificWordsChoice(false)} className="rounded-lg border-2 p-6 text-center transition-all duration-300 ease-smooth border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-accent/50">
                <div className="font-semibold text-lg">No</div>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <Input 
                value={tagInput} 
                onChange={e => setTagInput(e.target.value)} 
                onKeyDown={handleAddTag} 
                placeholder="Enter words you want included into your final text" 
                className="w-full py-6 min-h-[72px] text-center" 
              />
              
              {/* Display tags right under input box */}
              {data.text?.specificWords && data.text.specificWords.length > 0 && <div className="flex flex-wrap gap-2">
                  {data.text.specificWords.map((word: string, index: number) => <div key={index} className="flex items-center gap-2 bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm">
                      <span>{word}</span>
                      <button onClick={() => handleRemoveTag(word)} className="text-muted-foreground hover:text-foreground transition-colors">
                        ×
                      </button>
                    </div>)}
                </div>}

              {/* Done button - only show when there's at least one word */}
              {data.text?.specificWords && data.text.specificWords.length > 0 && <div className="flex justify-center pt-4">
                  <Button onClick={handleReadyToGenerate} className="bg-gradient-primary shadow-primary hover:shadow-card-hover px-6 py-2 rounded-md font-medium transition-all duration-300 ease-spring">
                    I'm Done With Putting Text
                  </Button>
                </div>}
            </div>
          )}
        </div>}

      {/* Add Specific Words Section - only show before generation and NOT for write-myself and NOT when showing choice */}
      {!showGeneration && data.text?.writingPreference !== 'write-myself' && !showSpecificWordsChoice && <div className="space-y-4 pt-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">Inserted Words (optional)</h2>
          <div className="mt-3">
            <p className="text-sm text-muted-foreground text-center">eg. Names, Happy Birthday, Congrats etc.</p>
          </div>
          
          {/* Text Layout Example */}
          
        </div>

        <div className="space-y-3">
          <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleAddTag} placeholder="Enter words you want included into your final text" className="w-full py-6 min-h-[72px] text-center" />
          
          {/* Display tags right under input box */}
          {data.text?.specificWords && data.text.specificWords.length > 0 && <div className="flex flex-wrap gap-2">
              {data.text.specificWords.map((word: string, index: number) => <div key={index} className="flex items-center gap-2 bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm">
                  <span>{word}</span>
                  <button onClick={() => handleRemoveTag(word)} className="text-muted-foreground hover:text-foreground transition-colors">
                    ×
                  </button>
                </div>)}
            </div>}

          {/* Done button - only show when there's at least one word */}
          {data.text?.specificWords && data.text.specificWords.length > 0 && <div className="flex justify-center pt-4">
              <Button onClick={handleReadyToGenerate} className="bg-gradient-primary shadow-primary hover:shadow-card-hover px-6 py-2 rounded-md font-medium transition-all duration-300 ease-spring">
                I'm Done With Putting Text
              </Button>
            </div>}

        </div>
      </div>}
      
      {/* Custom Text Input for Write Myself option */}
      {data.text?.writingPreference === 'write-myself' && !isCustomTextSaved && <div className="space-y-4 pt-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground">Write Your Own Text</h2>
          </div>
          
          <div className="space-y-3">
            <Input value={customText} onChange={e => handleCustomTextChange(e.target.value)} onKeyDown={handleCustomTextKeyDown} placeholder="Enter your text here (up to 100 characters)" maxLength={100} className="w-full" />
            <div className="text-right text-sm text-muted-foreground">
              {customText.length}/100 characters
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
              {/* Style and Rating - Keep on same row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Style Dropdown */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Style</label>
                  <Select onValueChange={handleStyleSelect} value={data.text?.style || ""}>
                    <SelectTrigger className="w-full min-h-[44px]">
                      <SelectValue placeholder="Generic (plain)" />
                    </SelectTrigger>
                    <SelectContent>
                      {styleOptions.map(style => <SelectItem key={style.id} value={style.id}>
                          {style.label}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Rating Dropdown */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Rating</label>
                  <Select onValueChange={handleRatingSelect} value={data.text?.rating || ""}>
                    <SelectTrigger className="w-full min-h-[44px]">
                      <SelectValue placeholder="G (clean)" />
                    </SelectTrigger>
                    <SelectContent>
                      {ratingOptions.map(rating => <SelectItem key={rating.id} value={rating.id}>
                          {rating.label}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Generate Button - Full width on mobile */}
              <div className="w-full space-y-3">
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
                     {textOptions.map((textOption, index) => (
                       <div key={index} onClick={() => handleTextOptionSelect(index)} 
                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${selectedTextOption === index ? 'border-primary bg-accent text-foreground' : 'border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-accent/50'}`}>
                         <p className="text-sm leading-relaxed mb-2">{textOption.line}</p>
                         <p className="text-xs text-muted-foreground font-medium">— {textOption.comedian}</p>
                       </div>
                     ))}
                   </div>
                 </div>}

               {/* Layout Options - Show after text selection or saved custom text */}
               {(selectedTextOption !== null && !data.text?.layout || data.text?.writingPreference === 'write-myself' && isCustomTextSaved && !data.text?.layout) && <div className="space-y-3 p-4">
                   <h3 className="text-lg font-semibold text-foreground text-center">Choose Your Text Layout:</h3>
                   <div className="grid grid-cols-2 gap-3">
                     {layoutOptions.map(layout => <Card key={layout.id} className={cn("cursor-pointer overflow-hidden text-center transition-all duration-300 hover:scale-105", "border-2 bg-card hover:bg-accent hover:border-primary", {
          "border-primary shadow-primary bg-accent": data.text?.layout === layout.id,
          "border-border": data.text?.layout !== layout.id
        })} onClick={() => handleLayoutSelect(layout.id)}>
                         <div className="w-full h-24 overflow-hidden">
                           <img src={layout.image} alt={layout.title} className="w-full h-full object-cover" />
                         </div>
                         <div className="p-3 pt-2">
                           <h3 className="text-sm font-medium text-foreground">
                             {layout.title}
                           </h3>
                         </div>
                       </Card>)}
                  </div>
                  </div>}
     </div>;
}