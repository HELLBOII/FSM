import React, { useMemo, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import AppointmentCard from './AppointmentCard';

// Hourly slots only (24 rows) for smooth dragging — was 288 with 5-min slots
const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const HOURLY_SLOTS = [];

// Shared grid: time column + 7 equal day columns so header and rows align
const WEEK_GRID_COLS = 'grid-cols-[5rem_1fr_1fr_1fr_1fr_1fr_1fr_1fr]';
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

const WeekSlotCell = React.memo(function WeekSlotCell({
  day,
  dayIdx,
  timeSlot,
  slotAppointments,
  onAppointmentClick,
  onDateClick,
}) {
  const droppableId = `${dayIdx}_${timeSlot}`;
  const isToday = isSameDay(day, new Date());
  const handleCellClick = useCallback(() => onDateClick?.(day, timeSlot), [day, timeSlot, onDateClick]);

  return (
    <Droppable droppableId={droppableId}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          onClick={handleCellClick}
          className={cn(
            'p-1 border-r border-gray-200 last:border-r-0 transition-colors min-h-[56px] min-w-0',
            snapshot.isDraggingOver && 'bg-primary/10',
            isToday ? 'bg-primary/5' : 'bg-white',
            onDateClick && 'cursor-pointer hover:bg-gray-100'
          )}
        >
          <div className="space-y-0.5 min-h-[48px]">
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
                    <AppointmentCard appointment={apt} isDragging={snapshot.isDragging} compact />
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

export default function WeekView({ date, appointments, onReschedule, onAppointmentClick, onDateClick }) {
  const weekStart = startOfWeek(date);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const getAppointmentsForDayAndSlot = useCallback(
    (day, timeSlot) => {
      return appointments.filter((apt) => {
        if (!apt.scheduled_start_time) return false;
        const startDate = parseISO(apt.scheduled_start_time);
        if (isNaN(startDate.getTime())) return false;
        return isSameDay(startDate, day) && appointmentMatchesHour(apt.scheduled_start_time, timeSlot);
      });
    },
    [appointments]
  );

  const handleDragEnd = useCallback(
    (result) => {
      if (!result.destination) return;
      const { draggableId, source, destination } = result;
      if (source.droppableId === destination.droppableId && source.index === destination.index) return;
      const idx = destination.droppableId.indexOf('_');
      const dayIndexStr = destination.droppableId.slice(0, idx);
      const timeSlot = destination.droppableId.slice(idx + 1);
      const newDate = weekDays[parseInt(dayIndexStr, 10)];
      const appointment = appointments.find((a) => String(a.id) === String(draggableId));
      const slotToUse =
        timeSlot ||
        (appointment?.scheduled_start_time
          ? format(parseISO(appointment.scheduled_start_time), 'hh:mm a')
          : '09:00 AM');
      onReschedule(draggableId, newDate, slotToUse);
    },
    [weekDays, appointments, onReschedule]
  );

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="overflow-hidden">
        <div className="w-full border border-gray-200 rounded-b-lg">
          <div className={cn('grid border-b-2 border-gray-300 bg-gray-50 sticky top-0 z-10', WEEK_GRID_COLS)}>
            <div className="p-2 text-xs font-medium text-gray-600 border-r border-gray-200 min-w-0">Time</div>
            {weekDays.map((day, idx) => (
              <div key={idx} className="p-2 text-center border-r border-gray-200 last:border-r-0 min-w-0">
                <div className="text-xs font-semibold text-gray-900">{format(day, 'EEE')}</div>
                <div
                  className={cn(
                    'text-base font-bold mt-0.5',
                    isSameDay(day, new Date()) ? 'text-primary' : 'text-gray-600'
                  )}
                >
                  {format(day, 'd')}
                </div>
              </div>
            ))}
          </div>
          <div className="overflow-y-auto max-h-[calc(100vh-350px)]">
            {HOURLY_SLOTS.map((timeSlot) => (
              <div key={timeSlot} className={cn('grid min-h-[56px] border-b border-gray-200', WEEK_GRID_COLS)}>
                <div className="py-1.5 px-2 text-xs font-medium text-gray-600 border-r border-gray-200 flex items-center bg-gray-50/50 min-w-0">
                  {timeSlot}
                </div>
                {weekDays.map((day, dayIdx) => (
                  <WeekSlotCell
                    key={`${dayIdx}-${timeSlot}`}
                    day={day}
                    dayIdx={dayIdx}
                    timeSlot={timeSlot}
                    slotAppointments={getAppointmentsForDayAndSlot(day, timeSlot)}
                    onAppointmentClick={onAppointmentClick}
                    onDateClick={onDateClick}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </DragDropContext>
  );
}
