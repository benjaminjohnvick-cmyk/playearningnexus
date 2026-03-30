import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function StepIndicator({ steps, currentStep }) {
  const progress = ((currentStep - 1) / (steps.length - 1)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const done = currentStep > s.id;
          const active = currentStep === s.id;
          return (
            <React.Fragment key={s.id}>
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all shadow-sm
                  ${done ? 'bg-green-500 border-green-500' : active ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-200'}`}>
                  {done
                    ? <CheckCircle2 className="w-5 h-5 text-white" />
                    : <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-gray-400'}`} />}
                </div>
                <p className={`text-xs font-medium hidden sm:block text-center max-w-16 leading-tight
                  ${active ? 'text-indigo-700' : done ? 'text-green-600' : 'text-gray-400'}`}>
                  {s.label}
                </p>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 rounded transition-all ${currentStep > s.id ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
      <Progress value={progress} className="h-1.5" />
    </div>
  );
}