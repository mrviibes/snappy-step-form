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
  text: {
    name: string;
    goal: string;
  };
  visuals: {
    style: string;
    colors: string[];
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
    text: {
      name: "",
      goal: ""
    },
    visuals: {
      style: "",
      colors: []
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
        return !!formData.category;
      case 2:
        return !!formData.text.name && !!formData.text.goal;
      case 3:
        return !!formData.visuals.style && formData.visuals.colors.length > 0;
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
          <h1 className="mb-2 text-2xl font-bold text-foreground">Choose Your Category</h1>
          
        </div>

        {/* Step Indicator */}
        <StepIndicator steps={steps} currentStep={currentStep} isStepCompleted={isStepCompleted} />

        {/* Main Content */}
        <Card className="mb-6 bg-gradient-card shadow-card transition-all duration-300 ease-smooth">
          <div className="p-6">
            <CurrentStepComponent data={formData} updateData={updateFormData} onNext={nextStep} />
          </div>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between gap-4">
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
    </div>;
}