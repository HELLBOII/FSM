import React from 'react';
import { cn } from "@/lib/utils";
import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ size = 'md', className, text }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <Loader2 className={cn(sizeClasses[size], 'animate-spin text-primary')} />
      {text && <p className="text-sm text-primary/70">{text}</p>}
    </div>
  );
}