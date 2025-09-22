import { useState, KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import negativeSpaceImage from "@/assets/negative-space-layout.jpg";
import memeTextImage from "@/assets/meme-text-layout.jpg";
import lowerBannerImage from "@/assets/lower-banner-layout.jpg";
import sideBarImage from "@/assets/side-bar-layout.jpg";
import badgeCalloutImage from "@/assets/badge-callout-layout.jpg";
import subtleCaptionImage from "@/assets/subtle-caption-layout.jpg";
interface TextStepProps {
  data: any;
  updateData: (data: any) => void;
  onNext: () => void;
}
const tones = [{
  id: 'humorous',
  label: 'Humorous',
  description: 'Funny, witty, light'
}, {
  id: 'savage',
  label: 'Savage',
  description: 'Harsh, blunt, cutting'
}, {
  id: 'sentimental',
  label: 'Sentimental',
  description: 'Warm, heartfelt, tender'
}, {
  id: 'nostalgic',
  label: 'Nostalgic',
  description: 'Reflective, old-times, wistful'
}, {
  id: 'romantic',
  label: 'Romantic',
  description: 'Loving, passionate, sweet'
}, {
  id: 'inspirational',
  label: 'Inspirational',
  description: 'Motivating, uplifting, bold'
}, {
  id: 'playful',
  label: 'Playful',
  description: 'Silly, cheeky, fun'
}, {
  id: 'serious',
  label: 'Serious',
  description: 'Formal, direct, weighty'
}];
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
const styleOptions = [{
  id: 'generic',
  label: 'Generic (plain)'
}, {
  id: 'sarcastic',
  label: 'Sarcastic (ironic)'
}, {
  id: 'wholesome',
  label: 'Wholesome (kind)'
}, {
  id: 'weird',
  label: 'Weird (absurd)'
}];
const ratingOptions = [{
  id: 'g',
  label: 'G (clean)'
}, {
  id: 'pg',
  label: 'PG (mild)'
}, {
  id: 'pg-13',
  label: 'PG-13 (edgy)'
}, {
  id: 'r',
  label: 'R (explicit)'
}];
export default function TextStep({
  data,
  updateData
}: TextStepProps) {
  const [tagInput, setTagInput] = useState('');
  const [showGeneration, setShowGeneration] = useState(false);
  const [showTextOptions, setShowTextOptions] = useState(false);
  const [selectedTextOption, setSelectedTextOption] = useState<number | null>(null);
  const [showLayoutOptions, setShowLayoutOptions] = useState(false);
  const [customText, setCustomText] = useState('');
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
  };
  const handleEditWritingPreference = () => {
    updateData({
      text: {
        ...data.text,
        writingPreference: ""
      }
    });
  };
  const handleAddTag = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      const currentWords = data.text?.specificWords || [];
      if (!currentWords.includes(tagInput.trim())) {
        updateData({
          text: {
            ...data.text,
            specificWords: [...currentWords, tagInput.trim()]
          }
        });
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
  const handleGenerate = () => {
    // Show text options when generate is clicked
    setShowTextOptions(true);
    console.log('Generate text with:', {
      tone: data.text?.tone,
      writingPreference: data.text?.writingPreference,
      specificWords: data.text?.specificWords,
      style: data.text?.style,
      rating: data.text?.rating
    });
  };

  const handleTextOptionSelect = (optionIndex: number) => {
    setSelectedTextOption(optionIndex);
    // Don't automatically show layout options, keep them visible in the flow
    updateData({
      text: {
        ...data.text,
        selectedOption: optionIndex,
        generatedText: textOptions[optionIndex]
      }
    });
  };

  const handleCustomTextChange = (value: string) => {
    if (value.length <= 100) {
      setCustomText(value);
      updateData({
        text: {
          ...data.text,
          customText: value,
          generatedText: value
        }
      });
    }
  };

  const handleLayoutSelect = (layoutId: string) => {
    updateData({
      text: {
        ...data.text,
        layout: layoutId
      }
    });
  };

  // Sample text options (Lorem Ipsum style, up to 100 characters each)
  const textOptions = [
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.",
    "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo.",
    "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariat.",
    "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id."
  ];

  // Layout options
  const layoutOptions = [
    {
      id: "negative-space",
      title: "Open Space",
      image: negativeSpaceImage
    },
    {
      id: "meme-text",
      title: "Meme Text",
      image: memeTextImage
    },
    {
      id: "lower-banner",
      title: "Lower Banner",
      image: lowerBannerImage
    },
    {
      id: "side-bar",
      title: "Side Bar",
      image: sideBarImage
    },
    {
      id: "badge-callout",
      title: "Badge Callout",
      image: badgeCalloutImage
    },
    {
      id: "subtle-caption",
      title: "Caption",
      image: subtleCaptionImage
    }
  ];
  
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
          {tones.map(tone => <button key={tone.id} onClick={() => handleToneSelect(tone.id)} className="aspect-square rounded-lg border-2 p-4 text-center transition-all duration-300 ease-smooth border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-accent/50">
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
            <div className="font-semibold text-foreground text-lg">
              TONE - "{selectedTone?.label}"
            </div>
            <button onClick={handleEditTone} className="text-primary hover:text-primary/80 text-sm font-medium transition-colors">
              Edit
            </button>
          </div>
        </div>

        {/* Writing Preference Selection */}
        <div className="text-center">
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

  // Show selected preferences and specific words input
  return <div className="space-y-6">
      {/* Selected Tone and Process in stacked format */}
      <div className="bg-white rounded-lg border border-primary overflow-hidden">
        {/* Selected Tone */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="text-base text-foreground">
            <span className="font-semibold">Tone</span> - {selectedTone?.label}
          </div>
          <button onClick={handleEditTone} className="text-primary hover:text-primary/80 text-sm font-medium transition-colors">
            Edit
          </button>
        </div>

        {/* Selected Writing Preference */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="text-base text-foreground">
            <span className="font-semibold">Process</span> - {selectedWritingPreference?.label}
          </div>
          <button onClick={handleEditWritingPreference} className="text-primary hover:text-primary/80 text-sm font-medium transition-colors">
            Edit
          </button>
        </div>
        
        {/* Specific Text Section - only show after generation step */}
        {showGeneration && <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="text-base text-foreground">
            <span className="font-semibold">Specific Text</span> - {data.text?.specificWords && data.text.specificWords.length > 0 ? data.text.specificWords.map(word => `${word}`).join(', ') : 'none chosen'}
          </div>
          <button onClick={() => setShowGeneration(false)} className="text-primary hover:text-primary/80 text-sm font-medium transition-colors">
            Edit
          </button>
        </div>}

        {/* Style and Rating Summary - only show after text generation */}
        {showTextOptions && (
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="text-base text-foreground">
              <span className="font-semibold">Style</span> - {styleOptions.find(s => s.id === data.text?.style)?.label.split(' (')[0] || 'Generic'} | <span className="font-semibold">Rating</span> - {ratingOptions.find(r => r.id === data.text?.rating)?.label.split(' (')[0] || 'G'}
            </div>
            <button onClick={() => {setShowTextOptions(false); setSelectedTextOption(null);}} className="text-primary hover:text-primary/80 text-sm font-medium transition-colors">
              Edit
            </button>
          </div>
        )}

        {/* Selected Text Summary - only show after text selection or custom text */}
        {(selectedTextOption !== null || (data.text?.writingPreference === 'write-myself' && customText)) && (
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="text-base text-foreground">
              <span className="font-semibold">Text</span> - {data.text?.writingPreference === 'write-myself' ? 
                customText.substring(0, 20) + (customText.length > 20 ? '...' : '') :
                textOptions[selectedTextOption].substring(0, 20) + '...'}
            </div>
            <button onClick={() => {
              if (data.text?.writingPreference === 'write-myself') {
                setCustomText('');
                updateData({ text: { ...data.text, customText: '', generatedText: '' } });
              } else {
                setSelectedTextOption(null);
                setShowLayoutOptions(false);
              }
            }} className="text-primary hover:text-primary/80 text-sm font-medium transition-colors">
              Edit
            </button>
          </div>
        )}

        {/* Selected Layout Summary - only show after layout selection */}
        {data.text?.layout && (
          <div className="flex items-center justify-between p-4">
            <div className="text-base text-foreground">
              <span className="font-semibold">Layout</span> - {layoutOptions.find(l => l.id === data.text?.layout)?.title}
            </div>
            <button onClick={() => updateData({ text: { ...data.text, layout: '' } })} className="text-primary hover:text-primary/80 text-sm font-medium transition-colors">
              Edit
            </button>
          </div>
        )}
      </div>

      {/* Add Specific Words Section - only show before generation */}
      {!showGeneration && <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">Any Specific Text (optional)</h2>
        </div>

        <div className="space-y-3">
          <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleAddTag} placeholder="enter words here and hit return" className="w-full" />
          
        {/* Display tags right under input box */}
        {data.text?.specificWords && data.text.specificWords.length > 0 && <div className="flex flex-wrap gap-2">
            {data.text.specificWords.map((word: string, index: number) => <div key={index} className="flex items-center gap-2 bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm">
                <span>{word}</span>
                <button onClick={() => handleRemoveTag(word)} className="text-muted-foreground hover:text-foreground transition-colors">
                  ×
                </button>
              </div>)}
          </div>}

        <div className="text-center">
          <button onClick={handleReadyToGenerate} className="text-primary hover:text-primary/80 text-sm font-medium transition-colors">
            {data.text?.specificWords && data.text.specificWords.length > 0 ? "I'm ready to generate my text now" : "I don't want any specific words"}
          </button>
        </div>
      </div>
    </div>}
      
      {/* Custom Text Input for Write Myself option */}
      {data.text?.writingPreference === 'write-myself' && (
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground">Write Your Own Text</h2>
          </div>
          
          <div className="space-y-2">
            <Input 
              value={customText}
              onChange={(e) => handleCustomTextChange(e.target.value)}
              placeholder="Enter your text here (up to 100 characters)"
              maxLength={100}
              className="w-full"
            />
            <div className="text-right text-sm text-muted-foreground">
              {customText.length}/100 characters
            </div>
          </div>
        </div>
      )}
        
        {/* Generation Section */}
        {showGeneration && !showTextOptions && <div className="space-y-4">
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
              <div className="w-full">
                <Button 
                  onClick={handleGenerate} 
                  className="w-full bg-cyan-400 hover:bg-cyan-500 text-white py-3 rounded-md font-medium min-h-[48px] text-base shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  Generate Text
                </Button>
              </div>
            </div>
          </div>}
              
              {/* Text Options - Show after generation but only if no text selected yet */}
              {showTextOptions && selectedTextOption === null && (
                <div className="space-y-3 p-4">
                  <h3 className="text-lg font-semibold text-foreground text-center">Choose your text:</h3>
                  <div className="space-y-3">
                    {textOptions.map((text, index) => (
                      <div
                        key={index}
                        onClick={() => handleTextOptionSelect(index)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                          selectedTextOption === index
                            ? 'border-primary bg-accent text-foreground'
                            : 'border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-accent/50'
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{text}</p>
                      </div>
                     ))}
                   </div>
                 </div>
               )}

               {/* Layout Options - Show after text selection or custom text entry */}
               {((selectedTextOption !== null && !data.text?.layout) || (data.text?.writingPreference === 'write-myself' && customText && !data.text?.layout)) && (
                 <div className="space-y-3 p-4">
                   <h3 className="text-lg font-semibold text-foreground text-center">Choose Your Layout:</h3>
                   <div className="grid grid-cols-2 gap-3">
                     {layoutOptions.map(layout => 
                       <Card key={layout.id} className={cn(
                         "cursor-pointer overflow-hidden text-center transition-all duration-300 hover:scale-105",
                         "border-2 bg-card hover:bg-accent hover:border-primary",
                         {
                           "border-primary shadow-primary bg-accent": data.text?.layout === layout.id,
                           "border-border": data.text?.layout !== layout.id
                         }
                       )} onClick={() => handleLayoutSelect(layout.id)}>
                         <div className="w-full h-24 overflow-hidden">
                           <img src={layout.image} alt={layout.title} className="w-full h-full object-cover" />
                         </div>
                         <div className="p-3 pt-2">
                           <h3 className="text-sm font-medium text-foreground">
                             {layout.title}
                           </h3>
                         </div>
                       </Card>
                     )}
                   </div>
                 </div>
               )}
    </div>;
}