import React from 'react';
import { cn } from "@/lib/utils";
import { MapPin, Clock, AlertCircle } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import { parseISO } from 'date-fns';

export default function AppointmentCard({ appointment, isDragging, compact = false }) {
  const getCardColor = () => {
    const end = appointment?.scheduled_end_time ? parseISO(appointment.scheduled_end_time) : null;
    const isClosed = ['completed', 'approved', 'closed'].includes(appointment?.status);
    const isOverdue = (() => {
      if (appointment?.status === 'overdue' || appointment?.is_sla_breached) return true;
      if (isClosed || !end || Number.isNaN(end.getTime())) return false;
      const due = new Date(end);
      due.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return due < today;
    })();
    const status = (appointment?.status || '').toLowerCase();

    if (isOverdue || appointment.priority === 'urgent') return 'bg-red-100 border-red-200';
    if (status === 'completed') return 'bg-green-100 border-green-200';
    if (status === 'approved') return 'bg-emerald-100 border-emerald-200';
    if (status === 'closed') return 'bg-gray-100 border-gray-200';
    if (status === 'new') return 'bg-blue-100 border-blue-200';
    if (status === 'scheduled' || status === 'assigned' || status === 'in_progress') {
      return 'bg-[#EEEDFE] border-[#D8D4FB]';
    }
    return 'bg-gray-100 border-gray-200';
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