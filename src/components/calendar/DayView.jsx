import React, { useMemo, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { format, isSameDay, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import AppointmentCard from './AppointmentCard';

// Hourly slots only (24 rows) for smooth dragging — was 288 with 5-min slots
const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const HOURLY_SLOTS = [];
['AM', 'PM'].forEach((period) => {
  HOURS_12.forEach((h) => {
    HOURLY_SLOTS.push(`${String(h).padStart(2, '0')}:00 ${period}`);
  });
});

/** Parse "09:00 AM" to 24h hour. */
function parseSlotToHour24(timeSlotStr) {
  if (!timeSlotStr || typeof timeSlotStr !== 'string') return null;
  const parts = timeSlotStr.trim().split(/\s+/);
  const [time, period] = parts.length >= 2 ? [parts[0], parts[1]] : [timeSlotStr, ''];
  const h = parseInt((time || '').split(':')[0], 10);
  if (isNaN(h)) return null;
  let hour24 = h;
  const p = (period || '').toUpperCase();
  if (p === 'PM' && hour24 !== 12) hour24 += 12;
  if (p === 'AM' && hour24 === 12) hour24 = 0;
  return hour24;
}

/** True if appointment start time hour matches this slot (hour only for performance). */
function appointmentMatchesHour(isoDateStr, timeSlotStr) {
  if (!isoDateStr || !timeSlotStr) return false;
  const d = parseISO(isoDateStr);
  if (isNaN(d.getTime())) return false;
  const slotHour = parseSlotToHour24(timeSlotStr);
  if (slotHour === null) return false;
  return d.getHours() === slotHour;
}

const DaySlotRow = React.memo(function DaySlotRow({
  timeSlot,
  slotAppointments,
  date,
  onAppointmentClick,
  onDateClick,
}) {
  const handleSlotClick = useCallback(() => onDateClick?.(date, timeSlot), [date, timeSlot, onDateClick]);

  return (
    <Droppable droppableId={timeSlot}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={cn(
            'grid grid-cols-[5rem_1fr] min-h-[56px] border-b border-gray-200 transition-colors',
            snapshot.isDraggingOver && 'bg-primary/10',
            'hover:bg-gray-50/50',
            onDateClick && 'cursor-pointer'
          )}
        >
          <div className="py-1.5 px-2 text-xs font-medium text-gray-600 border-r border-gray-200 bg-gray-50/50 shrink-0 flex items-center">
            {timeSlot}
          </div>
          <div className="py-1.5 px-3 space-y-2 min-h-[56px]" onClick={handleSlotClick}>
            {slotAppointments.map((apt, index) => (
              <Draggable key={apt.id} draggableId={String(apt.id)} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAppointmentClick?.(apt);
                    }}
                    className={cn(
                      onAppointmentClick && 'cursor-pointer',
                      'cursor-grab active:cursor-grabbing',
                      snapshot.isDragging && 'shadow-lg opacity-90'
                    )}
                  >
                    <AppointmentCard appointment={apt} isDragging={snapshot.isDragging} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        </div>
      )}
    </Droppable>
  );
});

export default function DayView({ date, appointments, onReschedule, onAppointmentClick, onDateClick }) {
  const dayAppointments = useMemo(
    () =>
      appointments.filter((apt) => {
        if (!apt.scheduled_start_time) return false;
        const startDate = parseISO(apt.scheduled_start_time);
        return !isNaN(startDate.getTime()) && isSameDay(startDate, date);
      }),
    [appointments, date]
  );

  const getAppointmentsForSlot = useCallback(
    (timeSlot) =>
      dayAppointments.filter((apt) => appointmentMatchesHour(apt.scheduled_start_time, timeSlot)),
    [dayAppointments]
  );

  const handleDragEnd = useCallback(
    (result) => {
      if (!result.destination) return;
      const { draggableId, source, destination } = result;
      if (source.droppableId === destination.droppableId && source.index === destination.index) return;
      const newTimeSlot = destination.droppableId;
      const appointment = appointments.find((a) => String(a.id) === String(draggableId));
      const slotToUse =
        newTimeSlot ||
        (appointment?.scheduled_start_time
          ? format(parseISO(appointment.scheduled_start_time), 'hh:mm a')
          : '09:00 AM');
      onReschedule(draggableId, date, slotToUse);
    },
    [date, appointments, onReschedule]
  );

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="overflow-hidden border border-gray-200 rounded-lg">
        <div className="text-center py-4 border-b-2 border-gray-300 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">{format(date, 'EEEE, MMMM d')}</h3>
        </div>
        <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
          {HOURLY_SLOTS.map((timeSlot) => (
            <DaySlotRow
              key={timeSlot}
              timeSlot={timeSlot}
              slotAppointments={getAppointmentsForSlot(timeSlot)}
              date={date}
              onAppointmentClick={onAppointmentClick}
              onDateClick={onDateClick}
            />
          ))}
        </div>
      </div>
    </DragDropContext>
  );
}
