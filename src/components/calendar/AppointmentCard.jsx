import React from 'react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { getServiceRequestStatusCardClass } from '@/utils/serviceRequestStatusDisplay';

export default function AppointmentCard({ appointment, isDragging }) {
  return (
    <div
      className={cn(
        'text-xs p-1.5 rounded border cursor-grab truncate transition-all',
        getServiceRequestStatusCardClass(appointment, { withText: true }),
        isDragging && 'shadow-lg rotate-2',
        !isDragging && 'hover:opacity-80'
      )}
      title={`${appointment.request_number} - ${appointment.client_name}`}
    >
      <div className="font-medium truncate">
        {appointment.scheduled_start_time
          ? format(parseISO(appointment.scheduled_start_time), 'hh:mm a')
          : ''}{' '}
        {appointment.client_name}
      </div>
    </div>
  );
}
