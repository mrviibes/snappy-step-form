import { useState, KeyboardEvent, useEffect } from 'react';
}} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">Edit</button>
</div>
)}
</div>


{data.text?.writingPreference === 'ai-assist' && !showTextOptions && (
<div className="space-y-6 pt-4">
<div className="space-y-3">
<div className="flex items-center justify-between">
<h3 className="text-lg font-semibold text-foreground">Optional - Any specific words you want</h3>
<span className="text-sm text-muted-foreground">{data.text?.insertWords?.length || 0}/2 words | {data.text?.insertWords?.join('').length || 0}/50 chars</span>
</div>
<Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleAddTag} placeholder="Enter single word (hyphens allowed)" className="w-full" disabled={(data.text?.insertWords?.length || 0) >= 2} />
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
<Button onClick={handleGenerate} disabled={isGenerating} className="w-full bg-cyan-400 hover:bg-cyan-500 disabled:bg-gray-400 text-white py-3 rounded-md font-medium min-h-[48px] text-base shadow-lg hover:shadow-xl transition-all duration-200">
{isGenerating ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>) : 'Generate Text'}
</Button>
</div>


{generationError && (
<div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
<AlertCircle className="w-4 h-4 flex-shrink-0" />
<div className="flex-1"><p className="text-sm">{generationError}</p></div>
</div>
)}
</div>
)}


{showInsertWordsInput && (
<div className="space-y-4 pt-4">
<div className="text-center min-h-[120px] flex flex-col justify-start">
<h2 className="text-xl font-semibold text-foreground">Do you have any specific words you want included?</h2>
<div className="mt-3"><p className="text-sm text-muted-foreground text-center">eg. Names, Happy Birthday, Congrats etc.</p></div>
</div>
<div className="space-y-3">
<Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleAddTag} placeholder="Enter words you want included into your final text" className="w-full py-6 min-h-[72px] text-center" />
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
<Button onClick={handleReadyToGenerate} className="bg-gradient-primary shadow-primary hover:shadow-card-hover px-6 py-2 rounded-md font-medium transition-all duration-300 ease-spring">Let's Generate the Final Text</Button>
</div>
)}
</div>
</div>
)}


{showGenderSelection && (
<div className="space-y-4 pt-4">
<div className="text-center">
<h2 className="text-xl font-semibold text-foreground mb-2">Choose Gender for Pronouns</h2>
<p className="text-sm text-muted-foreground">This helps us use the right pronouns (he/she/they)</p>
</div>
<div className="grid grid-cols-3 gap-3">
{['male','female','neutral'].map(g => (
<button key={g} onClick={() => setSelectedGender(g)} className={cn(
"h-24 rounded-lg border-2 p-4 text-center transition-all duration-300 ease-smooth",
selectedGender === g ? "border-primary bg-primary/10" : "border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-accent/50"
)}>
<div className="flex h-full flex-col items-center justify-center space-y-1">
<div className="font-semibold text-sm">{g[0].toUpperCase()+g.slice(1)}</div>
<div className="text-xs text-muted-foreground">{g === 'male' ? 'he/his/him' : g === 'female' ? 'she/her/hers' : 'no pronouns (use name)'}</div>
</div>
</button>
))}
</div>
</div>
)}


{showTextOptions && selectedTextOption === null && (
<div className="space-y-3 p-4">
<h3 className="text-lg font-semibold text-foreground text-center">Choose your text:</h3>
<div className="flex justify-center">
<button onClick={handleGenerate} disabled={isGenerating} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-50">
<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
{isGenerating ? 'Generating...' : 'Generate Again'}
</button>
</div>
<div className="space-y-3">
{textOptions.map((text, index) => (
<div key={index} onClick={() => handleTextOptionSelect(index)} className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${selectedTextOption === index ? 'border-primary bg-accent text-foreground' : 'border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-accent/50'}`}>
<p className="text-sm leading-relaxed mb-2">{text}</p>
</div>
))}
</div>
</div>
)}


{(selectedTextOption !== null && !data.text?.layout) && (
<div className="space-y-3 p-4">
<h3 className="text-lg font-semibold text-foreground text-center">Choose Your Text Layout:</h3>
<div className="grid grid-cols-2 gap-3">
{layoutOptions.map(layout => (
<Card key={layout.id} className={cn("cursor-pointer text-center transition-all duration-300 hover:scale-105", "border-2 bg-card hover:bg-accent hover:border-primary", { "border-primary shadow-primary bg-accent": data.text?.layout === layout.id, "border-border": data.text?.layout !== layout.id })} onClick={() => handleLayoutSelect(layout.id)}>
<div className="p-6 flex flex-col items-center justify-center h-28">
<h3 className="text-base font-semibold text-foreground mb-2">{layout.title}</h3>
<p className="text-sm text-muted-foreground">{layout.description}</p>
</div>
</Card>
))}
</div>
</div>
)}


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
className={cn("transition-all duration-300", debugExpanded && debugInfo.status === 'error' ? "ring-2 ring-red-200 border-red-200" : "")}
/>
</div>
)}
</div>
);
}