import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import TextStep from "./steps/TextStep";
import VisualsStep from "./steps/VisualsStep";
import SummaryStep from "./steps/SummaryStep";

interface Step {
  id: number;
  title: string;
  component: any;
}

interface FormData {
  text: {
    tone: string;
    writingPreference: string;
    layout?: string;
    customText?: string;
    generatedText?: string;
    insertWords?: string[];
    selectedOption?: number;
    style?: string;
    rating?: string;
    isComplete?: boolean;
  };
  visuals: {
    style: string;
    option: string;
    customVisuals?: string;
    dimension?: string;
    completed_visual_description?: string;
    isComplete?: boolean;
    insertedVisuals?: string[];
    compositionMode?: string;
    selectedVisualRecommendation?: {
      design: string;
      subject: string;
      subject_photo?: string;
      setting: string;
      setting_photo?: string;
    };
    selectedVisualOption?: number;
    writingProcess?: 'ai' | 'manual' | 'random';
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
  title: "Text",
  component: TextStep
}, {
  id: 2,
  title: "Visuals",
  component: VisualsStep
}, {
  id: 3,
  title: "Summary",
  component: SummaryStep
}];

// Inline StepIndicator component
function StepIndicator({ 
  steps, 
  currentStep, 
  isStepCompleted 
}: { 
  steps: Step[]; 
  currentStep: number; 
  isStepCompleted: (step: number) => boolean;
}) {
  return (
    <div className="mb-8">
      <div className="relative flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isCompleted = isStepCompleted(step.id);
          const isPast = step.id < currentStep;

          return (
            <div key={step.id} className="flex flex-col items-center flex-1 relative">
              {/* Step Circle */}
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ease-smooth relative z-10 bg-background",
                  {
                    "border-step-active bg-step-active text-white": isActive,
                    "border-step-completed bg-step-completed text-white": isPast && isCompleted,
                    "border-step-inactive bg-background text-step-inactive": !isActive && !isPast,
                  }
                )}
              >
                <span className="text-sm font-semibold">{step.id}</span>
              </div>

              {/* Step Title */}
              <div className="mt-2 text-center">
                <span
                  className={cn(
                    "text-xs font-medium transition-colors duration-300",
                    {
                      "text-step-active": isActive,
                      "text-step-completed": isPast && isCompleted,
                      "text-step-inactive": !isActive && !isPast,
                    }
                  )}
                >
                  {step.title}
                </span>
              </div>

              {/* Connection Line */}
              {index < steps.length - 1 && (
                <div
                  className="absolute top-5 h-0.5 bg-step-inactive transition-colors duration-300 z-0"
                  style={{
                    left: "calc(50% + 25px)",
                    width: "calc(100% - 50px)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default function MultiStepForm() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    text: {
      tone: "",
      writingPreference: ""
    },
    visuals: {
      style: "",
      option: ""
    }
  });

  // Clear all stored data on app initialization
  useEffect(() => {
    // Clear localStorage except essential browser data
    const keysToKeep = ['theme', 'sb-qxfnvtnchuigjivcalqe-auth-token'];
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(key => {
      if (!keysToKeep.some(keepKey => key.includes(keepKey))) {
        localStorage.removeItem(key);
      }
    });
    
    // Clear sessionStorage completely
    sessionStorage.clear();
    
    // Reset form to initial state
    setCurrentStep(1);
    setFormData({
      text: {
        tone: "",
        writingPreference: ""
      },
      visuals: {
        style: "",
        option: ""
      }
    });
  }, []); // Run only on mount
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
      case 2:
        // Check if visuals step is marked as complete
        return !!formData.visuals?.isComplete;
      case 3:
        // Step 3 is summary - always complete once reached
        return true;
      default:
        return false;
    }
  };
  const CurrentStepComponent = steps[currentStep - 1].component;
  return <div className="min-h-screen bg-background pt-2 px-4 pb-4">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <div className="mb-3 text-center">
          <h1 className="mb-2 text-2xl font-bold text-foreground">Viibe Generator</h1>
          
        </div>

        {/* Step Indicator */}
        <StepIndicator steps={steps} currentStep={currentStep} isStepCompleted={isStepCompleted} />


        {/* Main Content */}
        <div className="mb-16">
          <div className="p-4">
            <CurrentStepComponent data={formData} updateData={updateFormData} onNext={nextStep} />
          </div>
        </div>

        {/* Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
          <div className="mx-auto max-w-md flex justify-between gap-4">
            {/* Back Button */}
            {currentStep > 1 && <Button variant="outline" onClick={prevStep} className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>}

            {/* Next Button - hide on final step */}
            {currentStep < steps.length && <Button onClick={nextStep} disabled={!isStepCompleted(currentStep)} className="bg-gradient-primary shadow-primary transition-all duration-300 ease-spring hover:shadow-card-hover ml-auto">
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>}
          </div>
        </div>
      </div>
    </div>;
}