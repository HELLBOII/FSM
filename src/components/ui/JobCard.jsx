import React from 'react';
import { cn } from "@/lib/utils";
import { motion } from 'framer-motion';
import { MapPin, Clock, Droplets, User, ChevronRight, AlertTriangle } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { format } from 'date-fns';

const irrigationIcons = {
  drip: '💧',
  sprinkler: '🌊',
  center_pivot: '🔄',
  flood: '🌊',
  micro_sprinkler: '💦',
  subsurface: '🌱'
};

export default function JobCard({
  job,
  onClick,
  variant = 'default',
  showTechnician = false,
  className
}) {
  const isUrgent = job.priority === 'urgent' || job.priority === 'high';
  const isSLABreached = job.is_sla_breached;

  return (
    <motion.div data-source-location="components/ui/JobCard:28:4" data-dynamic-content="true"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ scale: 1.01 }}
    whileTap={{ scale: 0.99 }}
    onClick={onClick}
    className={cn(
      'relative bg-white rounded-xl border p-4 cursor-pointer transition-all duration-200',
      'hover:shadow-lg hover:border-emerald-200',
      isSLABreached && 'border-red-300 bg-red-50/30',
      isUrgent && !isSLABreached && 'border-orange-200',
      variant === 'compact' && 'p-3',
      className
    )}>

      {/* SLA Alert */}
      {isSLABreached &&
      <div data-source-location="components/ui/JobCard:45:8" data-dynamic-content="false" className="absolute -top-2 -right-2">
          <span data-source-location="components/ui/JobCard:46:10" data-dynamic-content="false" className="flex h-5 w-5">
            <span data-source-location="components/ui/JobCard:47:12" data-dynamic-content="false" className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span data-source-location="components/ui/JobCard:48:12" data-dynamic-content="false" className="relative inline-flex rounded-full h-5 w-5 bg-red-500 items-center justify-center">
              <AlertTriangle data-source-location="components/ui/JobCard:49:14" data-dynamic-content="false" className="w-3 h-3 text-white" />
            </span>
          </span>
        </div>
      }

      <div data-source-location="components/ui/JobCard:55:6" data-dynamic-content="true" className="flex items-start justify-between gap-3">
        <div data-source-location="components/ui/JobCard:56:8" data-dynamic-content="true" className="flex-1 min-w-0">
          {/* Header */}
          <div data-source-location="components/ui/JobCard:58:10" data-dynamic-content="true" className="flex items-center gap-2 mb-2">
            <span data-source-location="components/ui/JobCard:59:12" data-dynamic-content="true" className="text-lg">{irrigationIcons[job.irrigation_type] || '💧'}</span>
            <span data-source-location="components/ui/JobCard:60:12" data-dynamic-content="true" className="text-sm font-semibold text-gray-900 truncate">
              #{job.request_number}
            </span>
            <StatusBadge data-source-location="components/ui/JobCard:63:12" data-dynamic-content="false" status={job.status} size="xs" />
            {/* <StatusBadge data-source-location="components/ui/JobCard:64:12" data-dynamic-content="false" status={job.priority} size="xs" /> */}
          </div>

          {/* Client & Farm */}
          <h3 data-source-location="components/ui/JobCard:68:10" data-dynamic-content="true" className="font-semibold text-gray-900 truncate mb-1">
            {job.client_name}
          </h3>
          <p data-source-location="components/ui/JobCard:71:10" data-dynamic-content="true" className="text-sm text-gray-500 truncate mb-2">
            {job.farm_name}
          </p>

          {/* Issue */}
          <p data-source-location="components/ui/JobCard:76:10" data-dynamic-content="true" className="text-sm text-gray-600 line-clamp-2 mb-3">
            {job.issue_category?.replace(/_/g, ' ')} - {job.description}
          </p>

          {/* Meta Info */}
          <div data-source-location="components/ui/JobCard:81:10" data-dynamic-content="true" className="flex flex-wrap gap-3 text-xs text-gray-500">
            {job.location?.address &&
            <div data-source-location="components/ui/JobCard:83:14" data-dynamic-content="true" className="flex items-center gap-1">
                <MapPin data-source-location="components/ui/JobCard:84:16" data-dynamic-content="false" className="w-3.5 h-3.5 text-emerald-500" />
                <span data-source-location="components/ui/JobCard:85:16" data-dynamic-content="true" className="truncate max-w-[120px]">{job.location.address}</span>
              </div>
            }
            {job.scheduled_date &&
            <div data-source-location="components/ui/JobCard:89:14" data-dynamic-content="true" className="flex items-center gap-1">
                <Clock data-source-location="components/ui/JobCard:90:16" data-dynamic-content="false" className="w-3.5 h-3.5 text-blue-500" />
                <span data-source-location="components/ui/JobCard:91:16" data-dynamic-content="true">{format(new Date(job.scheduled_date), 'MMM d')} {job.scheduled_time_slot}</span>
              </div>
            }
            {showTechnician && job.assigned_technician_name &&
            <div data-source-location="components/ui/JobCard:95:14" data-dynamic-content="true" className="flex items-center gap-1">
                <User data-source-location="components/ui/JobCard:96:16" data-dynamic-content="false" className="w-3.5 h-3.5 text-purple-500" />
                <span data-source-location="components/ui/JobCard:97:16" data-dynamic-content="true">{job.assigned_technician_name}</span>
              </div>
            }
          </div>
        </div>

        <ChevronRight data-source-location="components/ui/JobCard:103:8" data-dynamic-content="false" className="w-5 h-5 text-gray-300 flex-shrink-0 mt-1" />
      </div>
    </motion.div>);

}