import React from 'react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function PageHeader({
  title,
  subtitle,
  backTo,
  backLabel,
  action,
  actionLabel,
  actionIcon: ActionIcon,
  secondaryAction,
  secondaryLabel,
  className
}) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6', className)}>
      <div>
        {backTo && (
          <Link 
            to={createPageUrl(backTo)} 
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {backLabel || 'Back'}
          </Link>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {secondaryAction && secondaryLabel && (
          <Button variant="outline" onClick={secondaryAction}>
            {secondaryLabel}
          </Button>
        )}
        {action && actionLabel && (
          <Button onClick={action} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {ActionIcon && <ActionIcon className="w-4 h-4 mr-2" />}
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}