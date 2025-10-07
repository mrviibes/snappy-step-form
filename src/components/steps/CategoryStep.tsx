import { useState, KeyboardEvent, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
interface CategoryStepProps {
  data: any;
  updateData: (data: any) => void;
  onNext: () => void;
}
export default function CategoryStep({
  data,
  updateData
}: CategoryStepProps) {
  const [tagInput, setTagInput] = useState('');
  const {
    toast
  } = useToast();

  // Sync local state with incoming data
  useEffect(() => {
    if (!data.tags) {
      updateData({
        tags: []
      });
    }
  }, []);
  const handleAddTag = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      const input = tagInput.trim();
      const currentTags = data.tags || [];

      // Validate: Max 3 tags
      if (currentTags.length >= 3) {
        toast({
          title: "Tag limit reached",
          description: "You can only add 3 tags maximum",
          variant: "destructive"
        });
        return;
      }

      // Validate: Length (2-50 characters)
      if (input.length < 2) {
        toast({
          title: "Tag too short",
          description: "Each tag must be at least 2 characters",
          variant: "destructive"
        });
        return;
      }
      if (input.length > 50) {
        toast({
          title: "Tag too long",
          description: "Each tag must be 50 characters or less",
          variant: "destructive"
        });
        return;
      }

      // Validate: No duplicates (case-insensitive)
      if (currentTags.some((tag: string) => tag.toLowerCase() === input.toLowerCase())) {
        toast({
          title: "Duplicate tag",
          description: "This tag has already been added",
          variant: "destructive"
        });
        return;
      }

      // All validations passed - add the tag
      updateData({
        tags: [...currentTags, input]
      });
      setTagInput('');
    }
  };
  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = data.tags || [];
    updateData({
      tags: currentTags.filter((tag: string) => tag !== tagToRemove)
    });
  };
  const currentTags = data.tags || [];
  return <div className="space-y-8 max-w-2xl mx-auto">
      <div className="text-center space-y-3">
        <h2 className="text-2xl font-semibold text-foreground">
          What's Your Topic?
        </h2>
        
      </div>

      {/* Tag Input */}
      <div className="space-y-4">
        <Input placeholder="Add topic(s) by pressing comma or enter" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleAddTag} className="text-base h-14 text-center placeholder:text-muted-foreground/60" disabled={currentTags.length >= 3} />
        
        {/* Tag Count */}
        <div className="text-sm text-muted-foreground text-center">
          {currentTags.length}/3 topics added
        </div>

        {/* Current Tags */}
        {currentTags.length > 0 && <div className="flex flex-wrap gap-2">
            {currentTags.map((tag: string) => <Badge key={tag} variant="secondary" className="text-sm py-1.5 px-3 flex items-center gap-2">
                {tag}
                <button onClick={() => handleRemoveTag(tag)} className="hover:text-destructive transition-colors" type="button">
                  <X className="h-3 w-3" />
                </button>
              </Badge>)}
          </div>}
      </div>

      {/* Examples */}
      <div className="rounded-lg border border-border bg-muted/30 p-5">
        <p className="text-sm font-semibold text-foreground mb-3">Example topics:</p>
        <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">
          <p>• "advertisement for a pet store"</p>
          <p>• "Mike" and "can't golf"</p>
          <p>• "birthday party gone wrong"</p>
          <p>• "Emma burning dinner again"</p>
          <p>• "Monday morning coffee struggle"</p>
        </div>
      </div>
    </div>;
}