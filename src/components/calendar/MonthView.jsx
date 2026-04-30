import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay, isSameMonth, parseISO } from 'date-fns';
import { cn } from "@/lib/utils";

export default function MonthView({ date, appointments, onReschedule, onAppointmentClick, onDateClick }) {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const rows = [];
  let days = [];
  let day = startDate;

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      days.push(day);
      day = addDays(day, 1);
    }
    rows.push(days);
    days = [];
  }

  const getAppointmentsForDay = (day) => {
    return appointments.filter(apt => {
      if (!apt.scheduled_start_time) return false;
      const startDate = parseISO(apt.scheduled_start_time);
      return isSameDay(startDate, day);
    });
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const { draggableId, source, destination } = result;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    const dayIndex = parseInt(destination.droppableId.split('_')[1], 10);
    const newDate = rows.flat()[dayIndex];
    // Keep the same time, just change the date (like WeekView/DayView preserve duration via Calendar)
    const appointment = appointments.find(a => String(a.id) === String(draggableId));
    if (appointment?.scheduled_start_time) {
      const originalStart = parseISO(appointment.scheduled_start_time);
      const timeSlot = format(originalStart, 'hh:mm a');
      onReschedule(draggableId, newDate, timeSlot);
    } else {
      onReschedule(draggableId, newDate, '09:00 AM');
    }
  };

  const getStatusColor = (appointment) => {
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

    if (isOverdue || appointment?.priority === 'urgent') return 'bg-red-100 border-red-200 text-red-700';
    if (status === 'completed') return 'bg-green-100 border-green-200 text-green-700';
    if (status === 'approved') return 'bg-emerald-100 border-emerald-200 text-emerald-700';
    if (status === 'closed') return 'bg-gray-100 border-gray-200 text-gray-700';
    if (status === 'new') return 'bg-blue-100 border-blue-200 text-blue-700';
    if (status === 'scheduled' || status === 'assigned' || status === 'in_progress') {
      return 'bg-[#EEEDFE] border-[#D8D4FB] text-[#534AB7]';
    }
    return 'bg-gray-100 border-gray-200 text-gray-600';
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="p-4">
        {/* Week Day Headers */}
        <div className="grid grid-cols-7 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="space-y-2">
          {rows.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 gap-2">
              {week.map((day, dayIdx) => {
                const dayAppointments = getAppointmentsForDay(day);
                const isToday = isSameDay(day, new Date());
                const isCurrentMonth = isSameMonth(day, date);
                const globalDayIdx = weekIdx * 7 + dayIdx;
                
                return (
                  <Droppable key={globalDayIdx} droppableId={`day_${globalDayIdx}`}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        onClick={(e) => {
                          // Only open form for current-month empty day cells.
                          if (
                            isCurrentMonth &&
                            dayAppointments.length === 0 &&
                            (e.target === e.currentTarget || e.target.closest('.day-number'))
                          ) {
                            onDateClick?.(day);
                          }
                        }}
                        className={cn(
                          "border rounded-lg p-2 min-h-[120px] transition-colors",
                          isCurrentMonth ? "bg-white" : "bg-gray-100",
                          isCurrentMonth && snapshot.isDraggingOver && "bg-emerald-50 border-emerald-300",
                          isCurrentMonth && isToday && "border-2 border-emerald-600",
                          isCurrentMonth && dayAppointments.length === 0 && "cursor-pointer hover:bg-gray-50",
                          !isCurrentMonth && "border-gray-200"
                        )}
                      >
                        <div 
                          className={cn(
                            "text-sm font-medium mb-2 day-number",
                            isToday && isCurrentMonth && "inline-flex items-center justify-center w-7 h-7 rounded-full border-emerald-600 bg-emerald-700 text-white",
                            !isToday && isCurrentMonth && "text-gray-900",
                            !isCurrentMonth && "invisible"
                          )}
                        >
                          {isCurrentMonth ? format(day, 'd') : ''}
                        </div>
                        
                        <div className={cn("space-y-1", !isCurrentMonth && "hidden")}>
                          {dayAppointments.slice(0, 3).map((apt, index) => (
                            <Draggable 
                              key={apt.id} 
                              draggableId={String(apt.id)} 
                              index={index}
                            >
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
                                    "text-xs p-1.5 rounded border cursor-pointer truncate",
                                    getStatusColor(apt),
                                    snapshot.isDragging && "shadow-lg rotate-2",
                                    !snapshot.isDragging && "hover:opacity-80"
                                  )}
                                  title={`${apt.request_number} - ${apt.client_name}`}
                                >
                                  <div className="font-medium truncate">
                                    {apt.scheduled_start_time ? format(parseISO(apt.scheduled_start_time), 'hh:mm a') : ''} {apt.client_name}
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {dayAppointments.length > 3 && (
                            <div className="text-xs text-gray-500 px-1.5">
                              +{dayAppointments.length - 3} more
                            </div>
                          )}
                          {provided.placeholder}
                        </div>
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </DragDropContext>
  );
}