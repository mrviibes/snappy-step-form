import { useState, KeyboardEvent, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertCircle, Loader2 } from "lucide-react";
import { generateTextOptions } from "@/lib/api";
import DebugPanel from "@/components/DebugPanel";

interface TextStepProps {
  data: any;
  updateData: (data: any) => void;
  onNext: () => void;
}

const layoutOptions = [
  { id: 'meme', title: 'Meme Style', description: 'Classic top/bottom text' },
  { id: 'badge-callout', title: 'Badge Callout', description: 'Badge with text' },
  { id: 'lower-banner', title: 'Lower Banner', description: 'Text at bottom' },
  { id: 'side-bar', title: 'Side Bar', description: 'Text on side' },
  { id: 'open-space', title: 'Open Space', description: 'Flexible placement' },
  { id: 'subtle-caption', title: 'Subtle Caption', description: 'Small text overlay' },
  { id: 'negative-space', title: 'Negative Space', description: 'Text in empty areas' },
  { id: 'text-layout', title: 'Text Layout', description: 'Text-focused design' }
];

export default function TextStep({ data, updateData, onNext }: TextStepProps) {
  const [tagInput, setTagInput] = useState('');
  const [textOptions, setTextOptions] = useState<string[]>([]);
  const [selectedTextOption, setSelectedTextOption] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showTextOptions, setShowTextOptions] = useState(false);
  const [showInsertWordsInput, setShowInsertWordsInput] = useState(false);
  const [showGenderSelection, setShowGenderSelection] = useState(false);
  const [selectedGender, setSelectedGender] = useState<string>('neutral');
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [debugExpanded, setDebugExpanded] = useState(false);

  // Determine initial view based on data state
  useEffect(() => {
    if (data.text?.writingPreference === 'write-own') {
      // Show insert words input
      setShowInsertWordsInput(false);
    } else if (data.text?.writingPreference === 'ai-assist') {
      // AI-assist mode
      if (data.text?.selectedText && !data.text?.layout) {
        // If text is selected but no layout, show layout options
        setShowTextOptions(false);
        setSelectedTextOption(null);
      }
    }
  }, [data.text?.writingPreference, data.text?.selectedText, data.text?.layout]);

  const handleAddTag = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const currentWords = data.text?.insertWords || [];
      
      // Check limits
      if (currentWords.length >= 2) return;
      const totalChars = currentWords.join('').length + tagInput.trim().length;
      if (totalChars > 50) return;
      
      // Validate: only single words with hyphens allowed
      const word = tagInput.trim();
      if (!/^[a-zA-Z-]+$/.test(word)) {
        setGenerationError('Only letters and hyphens allowed');
        return;
      }
      
      if (!currentWords.includes(word)) {
        updateData({
          text: {
            ...data.text,
            insertWords: [...currentWords, word]
          }
        });
      }
      setTagInput('');
      setGenerationError(null);
    }
  };

  const handleRemoveTag = (word: string) => {
    const currentWords = data.text?.insertWords || [];
    updateData({
      text: {
        ...data.text,
        insertWords: currentWords.filter((w: string) => w !== word)
      }
    });
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationError(null);
    setDebugInfo(null);

    try {
      const timestamp = new Date().toISOString();
      const requestPayload = {
        category: data.category || 'celebrations',
        subcategory: data.subcategory,
        tone: data.text?.tone,
        rating: data.text?.rating || 'PG',
        insertWords: data.text?.insertWords || [],
        gender: selectedGender || 'neutral',
        userId: 'anonymous',
        rules_id: 'v4'
      };

      setDebugInfo({
        model: 'gemini-pro',
        status: 'sending',
        endpoint: 'generate-text',
        timestamp,
        requestPayload,
        rawResponse: null,
        error: null
      });

      const result = await generateTextOptions(requestPayload);
      
      const options = result.map((opt: any) => opt.line || opt);
      setTextOptions(options);
      setShowTextOptions(true);
      setSelectedTextOption(null);

      setDebugInfo({
        model: 'gemini-pro',
        status: 'success',
        endpoint: 'generate-text',
        timestamp,
        requestPayload,
        rawResponse: result,
        error: null
      });
    } catch (error: any) {
      console.error('Text generation error:', error);
      setGenerationError(error.message || 'Failed to generate text options');
      setDebugInfo({
        model: 'gemini-pro',
        status: 'error',
        endpoint: 'generate-text',
        timestamp: new Date().toISOString(),
        requestPayload: null,
        rawResponse: null,
        error: error.message
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTextOptionSelect = (index: number) => {
    setSelectedTextOption(index);
    updateData({
      text: {
        ...data.text,
        selectedText: textOptions[index]
      }
    });
  };

  const handleLayoutSelect = (layoutId: string) => {
    updateData({
      text: {
        ...data.text,
        layout: layoutId
      }
    });
  };

  const handleReadyToGenerate = () => {
    setShowInsertWordsInput(false);
    setShowGenderSelection(true);
  };

  useEffect(() => {
    if (selectedGender && selectedGender !== 'neutral') {
      updateData({
        text: {
          ...data.text,
          gender: selectedGender
        }
      });
      // Auto-trigger generation after gender selection
      setTimeout(() => {
        setShowGenderSelection(false);
        handleGenerate();
      }, 500);
    }
  }, [selectedGender]);

  // If write-own mode and text is entered
  if (data.text?.writingPreference === 'write-own' && data.text?.customText) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border-2 border-cyan-400 bg-card overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <div className="text-sm text-foreground">
              <span className="font-bold text-muted-foreground">Your Text</span> - <span className="font-normal">{data.text.customText}</span>
            </div>
            <button onClick={() => {
              updateData({
                text: {
                  ...data.text,
                  customText: ''
                }
              });
            }} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">Edit</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Writing preference selection */}
      {!data.text?.writingPreference && (
        <div className="space-y-4 pt-4">
          <div className="text-center min-h-[120px] flex flex-col justify-start">
            <h2 className="text-xl font-semibold text-foreground">How do you want to create your text?</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => {
                updateData({
                  text: { ...data.text, writingPreference: 'write-own' }
                });
              }}
              className="p-6 border-2 border-border bg-card hover:border-primary hover:bg-accent rounded-lg transition-all"
            >
              <div className="text-center">
                <div className="text-2xl mb-2">✍️</div>
                <h3 className="font-semibold text-foreground mb-1">Write My Own</h3>
                <p className="text-sm text-muted-foreground">Type your own text</p>
              </div>
            </button>
            <button
              onClick={() => {
                updateData({
                  text: { ...data.text, writingPreference: 'ai-assist' }
                });
                setShowInsertWordsInput(true);
              }}
              className="p-6 border-2 border-border bg-card hover:border-primary hover:bg-accent rounded-lg transition-all"
            >
              <div className="text-center">
                <div className="text-2xl mb-2">🤖</div>
                <h3 className="font-semibold text-foreground mb-1">AI Assist</h3>
                <p className="text-sm text-muted-foreground">Let AI help you</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Write own text input */}
      {data.text?.writingPreference === 'write-own' && !data.text?.customText && (
        <div className="space-y-4 pt-4">
          <div className="text-center min-h-[120px] flex flex-col justify-start">
            <h2 className="text-xl font-semibold text-foreground">Enter your text</h2>
          </div>
          <Input
            placeholder="Type your text here..."
            className="w-full py-6 min-h-[72px] text-center"
            onChange={(e) => {
              if (e.target.value) {
                updateData({
                  text: {
                    ...data.text,
                    customText: e.target.value
                  }
                });
              }
            }}
          />
        </div>
      )}

      {/* Compact view when text is selected */}
      {data.text?.selectedText && data.text?.layout && (
        <div className="rounded-xl border-2 border-cyan-400 bg-card overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <div className="text-sm text-foreground">
              <span className="font-bold text-muted-foreground">Text</span> - <span className="font-normal">{data.text.selectedText}</span>
            </div>
            <button onClick={() => {
              updateData({
                text: {
                  ...data.text,
                  selectedText: '',
                  layout: ''
                }
              });
              setShowTextOptions(true);
              setSelectedTextOption(null);
            }} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">Edit</button>
          </div>
        </div>
      )}

      {/* AI-assist mode */}
      {data.text?.writingPreference === 'ai-assist' && !showTextOptions && (
        <div className="space-y-6 pt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Optional - Any specific words you want</h3>
              <span className="text-sm text-muted-foreground">{data.text?.insertWords?.length || 0}/2 words | {data.text?.insertWords?.join('').length || 0}/50 chars</span>
            </div>
            <Input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Enter single word (hyphens allowed)"
              className="w-full"
              disabled={(data.text?.insertWords?.length || 0) >= 2}
            />
            <p className="text-xs text-muted-foreground">Tip: Use hyphens for compound words like 'left-handed'</p>
            {data.text?.insertWords && data.text.insertWords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {data.text.insertWords.map((word: string, index: number) => (
                  <div key={index} className="flex items-center gap-2 bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm">
                    <span>{word}</span>
                    <button onClick={() => handleRemoveTag(word)} className="text-muted-foreground hover:text-foreground transition-colors">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="w-full">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full bg-cyan-400 hover:bg-cyan-500 disabled:bg-gray-400 text-white py-3 rounded-md font-medium min-h-[48px] text-base shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Text'
              )}
            </Button>
          </div>

          {generationError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm">{generationError}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Insert words input screen */}
      {showInsertWordsInput && (
        <div className="space-y-4 pt-4">
          <div className="text-center min-h-[120px] flex flex-col justify-start">
            <h2 className="text-xl font-semibold text-foreground">Do you have any specific words you want included?</h2>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground text-center">eg. Names, Happy Birthday, Congrats etc.</p>
            </div>
          </div>
          <div className="space-y-3">
            <Input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Enter words you want included into your final text"
              className="w-full py-6 min-h-[72px] text-center"
            />
            {data.text?.insertWords && data.text.insertWords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {data.text.insertWords.map((word: string, index: number) => (
                  <div key={index} className="flex items-center gap-2 bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm">
                    <span>{word}</span>
                    <button onClick={() => handleRemoveTag(word)} className="text-muted-foreground hover:text-foreground transition-colors">×</button>
                  </div>
                ))}
              </div>
            )}
            {data.text?.insertWords && data.text.insertWords.length > 0 && (
              <div className="flex justify-center pt-4">
                <Button
                  onClick={handleReadyToGenerate}
                  className="bg-gradient-primary shadow-primary hover:shadow-card-hover px-6 py-2 rounded-md font-medium transition-all duration-300 ease-spring"
                >
                  Let's Generate the Final Text
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gender selection */}
      {showGenderSelection && (
        <div className="space-y-4 pt-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground mb-2">Choose Gender for Pronouns</h2>
            <p className="text-sm text-muted-foreground">This helps us use the right pronouns (he/she/they)</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {['male', 'female', 'neutral'].map(g => (
              <button
                key={g}
                onClick={() => setSelectedGender(g)}
                className={cn(
                  "h-24 rounded-lg border-2 p-4 text-center transition-all duration-300 ease-smooth",
                  selectedGender === g
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-accent/50"
                )}
              >
                <div className="flex h-full flex-col items-center justify-center space-y-1">
                  <div className="font-semibold text-sm">{g[0].toUpperCase() + g.slice(1)}</div>
                  <div className="text-xs text-muted-foreground">
                    {g === 'male' ? 'he/his/him' : g === 'female' ? 'she/her/hers' : 'no pronouns (use name)'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Text options selection */}
      {showTextOptions && selectedTextOption === null && (
        <div className="space-y-3 p-4">
          <h3 className="text-lg font-semibold text-foreground text-center">Choose your text:</h3>
          <div className="flex justify-center">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {isGenerating ? 'Generating...' : 'Generate Again'}
            </button>
          </div>
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
                <p className="text-sm leading-relaxed mb-2">{text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Layout selection */}
      {selectedTextOption !== null && !data.text?.layout && (
        <div className="space-y-3 p-4">
          <h3 className="text-lg font-semibold text-foreground text-center">Choose Your Text Layout:</h3>
          <div className="grid grid-cols-2 gap-3">
            {layoutOptions.map(layout => (
              <Card
                key={layout.id}
                className={cn(
                  "cursor-pointer text-center transition-all duration-300 hover:scale-105",
                  "border-2 bg-card hover:bg-accent hover:border-primary",
                  {
                    "border-primary shadow-primary bg-accent": data.text?.layout === layout.id,
                    "border-border": data.text?.layout !== layout.id
                  }
                )}
                onClick={() => handleLayoutSelect(layout.id)}
              >
                <div className="p-6 flex flex-col items-center justify-center h-28">
                  <h3 className="text-base font-semibold text-foreground mb-2">{layout.title}</h3>
                  <p className="text-sm text-muted-foreground">{layout.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Debug panel */}
      {debugInfo && (
        <div className="mt-6">
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
    </div>
  );
}
