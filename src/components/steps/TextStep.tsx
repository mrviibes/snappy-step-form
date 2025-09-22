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

export default function TextStep({
  data,
  updateData
}: TextStepProps) {
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

  const selectedTone = tones.find(tone => tone.id === data.text?.tone);

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

  // Show selected tone and writing preference selection
  return <div className="space-y-6">
      {/* Selected Tone Display with Edit Option */}
      <div className="rounded-lg border-2 border-primary bg-card p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="font-semibold text-foreground text-lg">{selectedTone?.label}</div>
            <button 
              onClick={handleEditTone}
              className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
            >
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* Writing Preference Selection */}
      <div className="text-center">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          Choose Your Writing Preference
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {writingPreferences.map(preference => <button key={preference.id} onClick={() => handleWritingPreferenceSelect(preference.id)} className={`
              rounded-lg border-2 p-4 text-center transition-all duration-300 ease-smooth
              ${data.text?.writingPreference === preference.id ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-accent/50'}
            `}>
            <div className="font-semibold text-sm">{preference.label}</div>
          </button>)}
      </div>
    </div>;
}