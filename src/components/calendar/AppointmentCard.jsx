import React from 'react';
import { cn } from "@/lib/utils";
import { MapPin, Clock, AlertCircle } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';

export default function AppointmentCard({ appointment, isDragging, compact = false }) {
  const getCardColor = () => {
    if (appointment.priority === 'urgent') return 'bg-red-50 border-red-200';
    if (appointment.status === 'in_progress') return 'bg-yellow-50 border-yellow-200';
    if (appointment.status === 'completed') return 'bg-green-50 border-green-200';
    return 'bg-blue-50 border-blue-200';
  };

  if (compact) {
    return (
      <div className={cn(
        "p-2 rounded-lg border cursor-grab transition-all",
        getCardColor(),
        isDragging && "shadow-lg rotate-2 opacity-90"
      )}>
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="font-semibold text-xs text-gray-900 truncate">
            {appointment.client_name}
          </p>
          {appointment.priority === 'urgent' && (
            <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
          )}
        </div>
        <p className="text-xs text-gray-600 truncate">
          {appointment.issue_category?.replace(/_/g, ' ')}
        </p>
      </div>
    );
  }

  return (
    <div className={cn(
      "p-3 rounded-lg border cursor-grab transition-all",
      getCardColor(),
      isDragging && "shadow-lg rotate-2 opacity-90"
    )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-semibold text-gray-900">
            SR #{appointment.request_number}
          </p>
          <p className="text-sm text-gray-600">{appointment.client_name}</p>
        </div>
        <StatusBadge status={appointment.status} size="xs" />
      </div>

      <div className="space-y-1 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          <span className="truncate">{appointment.farm_name}</span>
        </div>
        {appointment.assigned_technician_name && (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{appointment.assigned_technician_name}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <span className="capitalize">{appointment.issue_category?.replace(/_/g, ' ')}</span>
        </div>
      </div>

      {appointment.priority === 'urgent' && (
        <div className="mt-2 flex items-center gap-1 text-xs text-red-600 font-medium">
          <AlertCircle className="w-3 h-3" />
          Urgent
        </div>
      )}
    </div>
  );
}