import { useState, KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
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
    // TODO: Implement text generation logic
    console.log('Generate text with:', {
      tone: data.text?.tone,
      writingPreference: data.text?.writingPreference,
      specificWords: data.text?.specificWords,
      style: data.text?.style,
      rating: data.text?.rating
    });
  };
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
          <div className="font-medium text-foreground">
            Tone - "{selectedTone?.label}"
          </div>
          <button onClick={handleEditTone} className="text-primary hover:text-primary/80 text-sm font-medium transition-colors">
            Edit
          </button>
        </div>

        {/* Selected Writing Preference */}
        <div className="flex items-center justify-between p-4 {showGeneration ? 'border-b border-border' : ''}">
          <div className="font-medium text-foreground">
            Process - "{selectedWritingPreference?.label}"
          </div>
          <button onClick={handleEditWritingPreference} className="text-primary hover:text-primary/80 text-sm font-medium transition-colors">
            Edit
          </button>
        </div>
        
        {/* Specific Text Section - only show after generation step */}
        {showGeneration && <div className="p-4">
          <div className="font-medium text-foreground">
            Specific Text - {data.text?.specificWords && data.text.specificWords.length > 0 ? data.text.specificWords.map(word => `"${word}"`).join(', ') : 'none chosen'}
          </div>
        </div>}
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
        
        {/* Generation Section */}
        {showGeneration && <div className="space-y-4">
            <div className="space-y-4">
              {/* Style and Rating - Stack vertically on mobile, side by side on larger screens */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
    </div>;
}