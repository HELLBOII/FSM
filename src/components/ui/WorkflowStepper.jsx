import React from 'react';
import { cn } from "@/lib/utils";
import { Check, Circle } from 'lucide-react';
import { motion } from 'framer-motion';

const defaultSteps = [
{ key: 'new', label: 'New' },
{ key: 'scheduled', label: 'Scheduled' },
{ key: 'assigned', label: 'Assigned' },
{ key: 'in_progress', label: 'In Progress' },
{ key: 'completed', label: 'Completed' },
{ key: 'approved', label: 'Approved' },
{ key: 'closed', label: 'Closed' }];


export default function WorkflowStepper({
  currentStatus,
  steps = defaultSteps,
  orientation = 'horizontal',
  size = 'md',
  className
}) {
  const currentIndex = steps.findIndex((s) => s.key === currentStatus);
  const isRework = currentStatus === 'rework';

  const sizeClasses = {
    sm: { circle: 'w-6 h-6', icon: 'w-3 h-3', text: 'text-xs' },
    md: { circle: 'w-8 h-8', icon: 'w-4 h-4', text: 'text-sm' },
    lg: { circle: 'w-10 h-10', icon: 'w-5 h-5', text: 'text-base' }
  };

  const sizes = sizeClasses[size];

  if (orientation === 'vertical') {
    return (
      <div data-source-location="components/ui/WorkflowStepper:36:6" data-dynamic-content="true" className={cn('flex flex-col gap-0', className)}>
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div data-source-location="components/ui/WorkflowStepper:42:12" data-dynamic-content="true" key={step.key} className="flex gap-3">
              <div data-source-location="components/ui/WorkflowStepper:43:14" data-dynamic-content="true" className="flex flex-col items-center">
                <motion.div data-source-location="components/ui/WorkflowStepper:44:16" data-dynamic-content="true"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  sizes.circle,
                  'rounded-full flex items-center justify-center border-2 transition-all',
                  isCompleted && 'bg-primary border-primary',
                  isCurrent && !isRework && 'bg-primary border-primary',
                  isCurrent && isRework && 'bg-red-500 border-red-500',
                  !isCompleted && !isCurrent && 'bg-gray-100 border-gray-200'
                )}>

                  {isCompleted ?
                  <Check data-source-location="components/ui/WorkflowStepper:58:20" data-dynamic-content="false" className={cn(sizes.icon, 'text-white')} /> :
                  isCurrent ?
                  <Circle data-source-location="components/ui/WorkflowStepper:60:20" data-dynamic-content="false" className={cn(sizes.icon, 'text-white fill-white')} /> :

                  <span data-source-location="components/ui/WorkflowStepper:62:20" data-dynamic-content="true" className={cn(sizes.text, 'text-gray-400 font-medium')}>{index + 1}</span>
                  }
                </motion.div>
                {index < steps.length - 1 &&
                <div data-source-location="components/ui/WorkflowStepper:66:18" data-dynamic-content="false" className={cn(
                  'w-0.5 h-8 transition-colors',
                  isCompleted ? 'bg-primary' : 'bg-gray-200'
                )} />
                }
              </div>
              <div data-source-location="components/ui/WorkflowStepper:72:14" data-dynamic-content="true" className="pb-8">
                <p data-source-location="components/ui/WorkflowStepper:73:16" data-dynamic-content="true" className={cn(
                  sizes.text,
                  'font-medium',
                  isCurrent ? 'text-gray-900' : 'text-gray-500'
                )}>
                  {step.label}
                </p>
                {step.description &&
                <p data-source-location="components/ui/WorkflowStepper:81:18" data-dynamic-content="true" className="text-xs text-gray-400 mt-0.5">{step.description}</p>
                }
              </div>
            </div>);

        })}
      </div>);

  }

  return (
    <div data-source-location="components/ui/WorkflowStepper:92:4" data-dynamic-content="true" className={cn('flex items-center justify-between', className)}>
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <React.Fragment data-source-location="components/ui/WorkflowStepper:98:10" data-dynamic-content="true" key={step.key}>
            <div data-source-location="components/ui/WorkflowStepper:99:12" data-dynamic-content="true" className="flex flex-col items-center gap-2">
              <motion.div data-source-location="components/ui/WorkflowStepper:100:14" data-dynamic-content="true"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                sizes.circle,
                'rounded-full flex items-center justify-center border-2 transition-all',
                isCompleted && 'bg-primary border-primary',
                isCurrent && !isRework && 'bg-primary border-primary',
                isCurrent && isRework && 'bg-red-500 border-red-500',
                !isCompleted && !isCurrent && 'bg-gray-100 border-gray-200'
              )}>

                {isCompleted ?
                <Check data-source-location="components/ui/WorkflowStepper:114:18" data-dynamic-content="false" className={cn(sizes.icon, 'text-white')} /> :
                isCurrent ?
                <Circle data-source-location="components/ui/WorkflowStepper:116:18" data-dynamic-content="false" className={cn(sizes.icon, 'text-white fill-white')} /> :

                <span data-source-location="components/ui/WorkflowStepper:118:18" data-dynamic-content="true" className={cn(sizes.text, 'text-gray-400 font-medium')}>{index + 1}</span>
                }
              </motion.div>
              <span data-source-location="components/ui/WorkflowStepper:121:14" data-dynamic-content="true" className={cn(
                sizes.text,
                'font-medium text-center whitespace-nowrap',
                isCurrent ? 'text-gray-900' : 'text-gray-500'
              )}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 &&
            <div data-source-location="components/ui/WorkflowStepper:130:14" data-dynamic-content="false" className={cn(
              'flex-1 h-0.5 mx-2 transition-colors',
              isCompleted ? 'bg-primary' : 'bg-gray-200'
            )} />
            }
          </React.Fragment>);

      })}
    </div>);

}