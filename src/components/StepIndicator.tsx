import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: number;
  title: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  isStepCompleted: (step: number) => boolean;
}

export default function StepIndicator({
  steps,
  currentStep,
  isStepCompleted,
}: StepIndicatorProps) {
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
                    "border-step-completed bg-step-completed text-white":
                      isPast && isCompleted,
                    "border-step-inactive bg-background text-step-inactive":
                      !isActive && !isPast,
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