// src/components/step-indicator.tsx

import React from 'react';

interface StepIndicatorProps {
    steps: string[];
    currentStep: number;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ steps, currentStep }) => {
    return (
        <div className="flex justify-center mb-6">
            {steps.map((step, index) => (
                <div key={index} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${index <= currentStep ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-700'}`}>
                        {index + 1}
                    </div>
                    {index < steps.length - 1 && <div className={`h-1 flex-grow ${index < currentStep ? 'bg-blue-500' : 'bg-gray-300'}`} />}
                </div>
            ))}
        </div>
    );
};