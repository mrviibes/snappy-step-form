import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import StepIndicator from "./StepIndicator";
import CategoryStep from "./steps/CategoryStep";
import TextStep from "./steps/TextStep";
import VisualsStep from "./steps/VisualsStep";
import GenerationStep from "./steps/GenerationStep";
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
    customVisualDescription?: string;
  };
  generation?: {
    prompts?: any;
    images?: any[];
    selectedImage?: string;
    isComplete?: boolean;
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
  title: "Generate",
  component: GenerationStep
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
        // Different completion requirements based on visual option
        const basicRequirements = !!formData.visuals.style && !!formData.visuals.option && !!formData.visuals.dimension;
        
        if (!basicRequirements) return false;
        
        // Additional requirements based on option type
        if (formData.visuals.option === 'design-myself') {
          return !!formData.visuals.customVisualDescription;
        }
        // For ai-assist and no-visuals, basic requirements are enough
        return true;
      case 4:
        // Step 4 is generation - it auto-completes when images are generated
        return !!formData.generation?.isComplete;
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


        {/* Main Content */}
        <div className="mb-20">
          <div className="p-6">
            <CurrentStepComponent data={formData} updateData={updateFormData} onNext={nextStep} />
          </div>
        </div>

        {/* Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
          <div className="mx-auto max-w-md flex justify-center">
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