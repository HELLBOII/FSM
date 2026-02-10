import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import AppointmentCard from './AppointmentCard';

const timeSlots = [
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', 
  '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', 
  '04:00 PM', '05:00 PM'
];

export default function WeekView({ date, appointments, onReschedule }) {
  const weekStart = startOfWeek(date);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getAppointmentsForDayAndSlot = (day, timeSlot) => {
    return appointments.filter(apt => {
      if (!apt.scheduled_start_time) return false;
      const startDate = parseISO(apt.scheduled_start_time);
      const aptTimeSlot = format(startDate, 'hh:mm a').toUpperCase();
      return isSameDay(startDate, day) && aptTimeSlot === timeSlot.toUpperCase();
    });
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const [dayIndex, timeSlot] = destination.droppableId.split('_');
    const newDate = weekDays[parseInt(dayIndex)];
    
    onReschedule(draggableId, newDate, timeSlot);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="overflow-hidden">
        <div className="w-full">
          {/* Week Days Header */}
          <div className="grid grid-cols-8 border-b bg-gray-50 sticky top-0 z-10">
            <div className="p-2 text-xs font-medium text-gray-600">Time</div>
            {weekDays.map((day, idx) => (
              <div key={idx} className="p-2 text-center border-l">
                <div className="text-xs font-semibold text-gray-900">
                  {format(day, 'EEE')}
                </div>
                <div className={`text-base font-bold mt-0.5 ${
                  isSameDay(day, new Date()) ? 'text-primary' : 'text-gray-600'
                }`}>
                  {format(day, 'd')}
                </div>
              </div>
            ))}
          </div>

          {/* Time Slots Grid */}
          <div className="divide-y overflow-y-auto max-h-[calc(100vh-350px)]">
            {timeSlots.map((timeSlot) => (
              <div key={timeSlot} className="grid grid-cols-8 min-h-[60px]">
                <div className="p-2 text-xs font-medium text-gray-600 border-r flex items-center">
                  {timeSlot}
                </div>
                {weekDays.map((day, dayIdx) => {
                  const slotAppointments = getAppointmentsForDayAndSlot(day, timeSlot);
                  const droppableId = `${dayIdx}_${timeSlot}`;
                  
                  return (
                    <Droppable key={droppableId} droppableId={droppableId}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`p-1.5 border-l transition-colors ${
                            snapshot.isDraggingOver ? 'bg-primary/10' : ''
                          } ${isSameDay(day, new Date()) ? 'bg-primary/5' : ''}`}
                        >
                          <div className="space-y-0.5">
                            {slotAppointments.map((apt, index) => (
                              <Draggable 
                                key={apt.id} 
                                draggableId={apt.id} 
                                index={index}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                  >
                                    <AppointmentCard 
                                      appointment={apt} 
                                      isDragging={snapshot.isDragging}
                                      compact
                                    />
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
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </DragDropContext>
  );
}