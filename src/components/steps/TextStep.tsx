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
export default function TextStep({
  data,
  updateData
}: TextStepProps) {
  const handleToneSelect = (toneId: string) => {
    updateData({
      text: {
        tone: toneId
      }
    });
  };
  return <div className="space-y-6">
      <div className="text-center">
        <h2 className="mb-2 text-xl font-semibold text-foreground">
          Choose Your Tone
        </h2>
        
      </div>

      <div className="grid grid-cols-2 gap-3">
        {tones.map(tone => <button key={tone.id} onClick={() => handleToneSelect(tone.id)} className={`
              aspect-square rounded-lg border-2 p-4 text-center transition-all duration-300 ease-smooth
              ${data.text?.tone === tone.id ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-accent/50'}
            `}>
            <div className="flex h-full flex-col items-center justify-center space-y-1">
              <div className="font-semibold text-sm">{tone.label}</div>
              <div className="text-xs text-muted-foreground">{tone.description}</div>
            </div>
          </button>)}
      </div>
    </div>;
}