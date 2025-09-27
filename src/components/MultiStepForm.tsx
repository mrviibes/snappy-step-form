import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import StepIndicator from "./StepIndicator";
import CategoryStep from "./steps/CategoryStep";
import TextStep from "./steps/TextStep";
import VisualsStep from "./steps/VisualsStep";
import SummaryStep from "./steps/SummaryStep";
interface FormData {
  category: string;
  subcategory: string;
  theme?: string;
  specificItem?: string;
  text: {
    tone: string;
    writingPreference: string;
    layout?: string;
    customText?: string;
    generatedText?: string;
    specificWords?: string[];
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
  title: "Summary",
  component: SummaryStep
}];
export default function MultiStepForm() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    category: "",
    subcategory: "",
    theme: "",
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
      category: "",
      subcategory: "",
      theme: "",
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
        // For Pop Culture category, specificItem is optional but category and subcategory are required
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
        // Check if visuals step is marked as complete
        return !!formData.visuals?.isComplete;
      case 4:
        // Step 4 is summary - always complete once reached
        return true;
      default:
        return false;
    }
  };
  const CurrentStepComponent = steps[currentStep - 1].component;
  return <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-2xl font-bold text-foreground">Viibe Generator</h1>
          
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