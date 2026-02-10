import React from 'react';
import { cn } from "@/lib/utils";

const statusConfig = {
  // Service Request Status
  new: { label: 'New', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  scheduled: { label: 'Scheduled', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  assigned: { label: 'Assigned', bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  in_progress: { label: 'In Progress', bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
  completed: { label: 'Completed', bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  approved: { label: 'Approved', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  closed: { label: 'Closed', bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' },
  rework: { label: 'Rework', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },

  // Priority
  low: { label: 'Low', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
  medium: { label: 'Medium', bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
  high: { label: 'High', bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
  urgent: { label: 'Urgent', bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200' },

  // Technician Status
  available: { label: 'Available', bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  on_job: { label: 'On Job', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  break: { label: 'On Break', bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
  offline: { label: 'Offline', bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },

  // Report Status
  draft: { label: 'Draft', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
  submitted: { label: 'Submitted', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  rejected: { label: 'Rejected', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },

  // General
  active: { label: 'Active', bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  inactive: { label: 'Inactive', bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' }
};

export default function StatusBadge({ status, size = 'sm', className }) {
  const config = statusConfig[status] || {
    label: status?.replace(/_/g, ' ') || 'Unknown',
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-200'
  };

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px]',
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  };

  return (
    <span data-source-location="components/ui/StatusBadge:53:4" data-dynamic-content="true" className={cn(
      'inline-flex items-center font-medium rounded-full border capitalize',
      config.bg,
      config.text,
      config.border,
      sizeClasses[size],
      className
    )}>
      {config.label}
    </span>);

}