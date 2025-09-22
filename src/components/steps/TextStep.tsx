import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface TextStepProps {
  data: any;
  updateData: (data: any) => void;
  onNext: () => void;
}

export default function TextStep({ data, updateData }: TextStepProps) {
  const handleNameChange = (name: string) => {
    updateData({
      text: {
        ...data.text,
        name,
      },
    });
  };

  const handleGoalChange = (goal: string) => {
    updateData({
      text: {
        ...data.text,
        goal,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="mb-2 text-xl font-semibold text-foreground">
          Tell us about yourself
        </h2>
        <p className="text-sm text-muted-foreground">
          Help us personalize your experience
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium text-foreground">
            What's your name?
          </Label>
          <Input
            id="name"
            type="text"
            placeholder="Enter your name"
            value={data.text?.name || ""}
            onChange={(e) => handleNameChange(e.target.value)}
            className="transition-all duration-300 ease-smooth focus:shadow-primary focus:ring-primary"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="goal" className="text-sm font-medium text-foreground">
            Describe your specific goal
          </Label>
          <Textarea
            id="goal"
            placeholder="e.g., I want to lose 10 pounds in 3 months..."
            value={data.text?.goal || ""}
            onChange={(e) => handleGoalChange(e.target.value)}
            className="min-h-[100px] resize-none transition-all duration-300 ease-smooth focus:shadow-primary focus:ring-primary"
          />
        </div>

        <div className="rounded-lg bg-accent/50 p-4">
          <p className="text-xs text-muted-foreground">
            💡 <strong>Tip:</strong> Be specific about your timeline and what success looks like to you.
          </p>
        </div>
      </div>
    </div>
  );
}