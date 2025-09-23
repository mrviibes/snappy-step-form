import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import StepIndicator from "./StepIndicator";
import CategoryStep from "./steps/CategoryStep";
import TextStep from "./steps/TextStep";
import VisualsStep from "./steps/VisualsStep";
import VibeStep from "./steps/VibeStep";
interface FormData {
  category: string;
  subcategory: string;
  text: {
    tone: string;
    writingPreference: string;
    layout?: string;
    customText?: string;
    generatedText?: string;
    specificWords?: string[];
    selectedOption?: number;
    comedianStyle?: string;
    style?: string;
    rating?: string;
    isComplete?: boolean;
  };
  visuals: {
    style: string;
    option: string;
    customVisuals?: string;
    dimension?: string;
  };
  vibe: {
    intensity: string;
    personality: string;
  };
}
const steps = [{
  id: 1,
  title: "Category",
  component: CategoryStep
}, {
  id: 2,
  title: "Text",
  component: TextStep
}, {
  id: 3,
  title: "Visuals",
  component: VisualsStep
}, {
  id: 4,
  title: "Your Vibe",
  component: VibeStep
}];
export default function MultiStepForm() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    category: "",
    subcategory: "",
    text: {
      tone: "",
      writingPreference: ""
    },
    visuals: {
      style: "",
      option: ""
    },
    vibe: {
      intensity: "",
      personality: ""
    }
  });
  const updateFormData = (stepData: Partial<FormData>) => {
    setFormData(prev => ({
      ...prev,
      ...stepData
    }));
  };
  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };
  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };
  const isStepCompleted = (step: number) => {
    switch (step) {
      case 1:
        return !!formData.category && !!formData.subcategory;
      case 2:
        // Special case for "no-text" - only need tone and writing preference
        if (formData.text.writingPreference === 'no-text') {
          return !!formData.text.tone && !!formData.text.writingPreference;
        }
        // For "write-myself" - need tone, preference, custom text, and layout
        if (formData.text.writingPreference === 'write-myself') {
          return !!formData.text.tone && !!formData.text.writingPreference && !!formData.text.customText && !!formData.text.layout;
        }
        // For "ai-assist" - need tone, preference, generated text, and layout
        return !!formData.text.tone && !!formData.text.writingPreference && !!formData.text.generatedText && !!formData.text.layout;
      case 3:
        return !!formData.visuals.style && !!formData.visuals.option && !!formData.visuals.dimension;
      case 4:
        return !!formData.vibe.intensity && !!formData.vibe.personality;
      default:
        return false;
    }
  };
  const CurrentStepComponent = steps[currentStep - 1].component;
  const handleSubmit = () => {
    console.log("Form completed!", formData);
    // Handle form submission here
  };
  return <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-2xl font-bold text-foreground">Your Viibe</h1>
          
        </div>

        {/* Step Indicator */}
        <StepIndicator steps={steps} currentStep={currentStep} isStepCompleted={isStepCompleted} />

        {/* Category Breadcrumb - Show on step 2 when category and subcategory are selected */}
        {currentStep === 2 && formData.category && formData.subcategory && (
          <div className="text-center mb-4">
            <div className="text-sm text-muted-foreground">
              {formData.category} &gt; {formData.subcategory}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="mb-20">
          <div className="p-6">
            <CurrentStepComponent data={formData} updateData={updateFormData} onNext={nextStep} />
          </div>
        </div>

        {/* Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
          <div className="mx-auto max-w-md flex justify-between gap-4">
            <Button variant="outline" onClick={prevStep} disabled={currentStep === 1} className="flex-1 transition-all duration-300 ease-smooth">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            {currentStep === steps.length ? <Button onClick={handleSubmit} disabled={!isStepCompleted(currentStep)} className="flex-1 bg-gradient-primary shadow-primary transition-all duration-300 ease-spring hover:shadow-card-hover">
                <Check className="mr-2 h-4 w-4" />
                Complete
              </Button> : <Button onClick={nextStep} disabled={!isStepCompleted(currentStep)} className="flex-1 bg-gradient-primary shadow-primary transition-all duration-300 ease-spring hover:shadow-card-hover">
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>}
          </div>
        </div>
      </div>
    </div>;
}