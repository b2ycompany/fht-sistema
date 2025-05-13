// components/ui/stepper.js
import { cn } from "@/lib/utils"; // Utility for classNames (from Shadcn/UI)

export function Stepper({ steps, currentStep, onStepChange }) {
  return (
    <div className="flex items-center justify-between mb-6">
      {steps.map((step, index) => (
        <div key={step.label} className="flex-1">
          <div className="flex items-center">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                currentStep >= index ? "bg-primary text-white" : "bg-gray-200 text-gray-600"
              )}
            >
              {index + 1}
            </div>
            <div className="ml-2">
              <p className="text-sm font-medium">{step.label}</p>
            </div>
          </div>
          {index < steps.length - 1 && (
            <div
              className={cn(
                "h-1 flex-1 mt-2",
                currentStep > index ? "bg-primary" : "bg-gray-200"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}