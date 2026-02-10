import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { format, isSameDay, parseISO } from 'date-fns';
import AppointmentCard from './AppointmentCard';

const timeSlots = [
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', 
  '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', 
  '04:00 PM', '05:00 PM', '06:00 PM'
];

export default function DayView({ date, appointments, onReschedule }) {
  const dayAppointments = appointments.filter(apt => {
    if (!apt.scheduled_start_time) return false;
    const startDate = parseISO(apt.scheduled_start_time);
    return isSameDay(startDate, date);
  });

  const getAppointmentsForSlot = (timeSlot) => {
    return dayAppointments.filter(apt => {
      if (!apt.scheduled_start_time) return false;
      const startDate = parseISO(apt.scheduled_start_time);
      const aptTimeSlot = format(startDate, 'hh:mm a').toUpperCase();
      return aptTimeSlot === timeSlot.toUpperCase();
    });
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const newTimeSlot = destination.droppableId;
    
    onReschedule(draggableId, date, newTimeSlot);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="p-4 overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Header */}
          <div className="text-center py-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">
              {format(date, 'EEEE, MMMM d')}
            </h3>
          </div>

          {/* Time Slots */}
          <div className="divide-y">
            {timeSlots.map((timeSlot) => {
              const slotAppointments = getAppointmentsForSlot(timeSlot);
              
              return (
                <Droppable key={timeSlot} droppableId={timeSlot}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex gap-4 p-4 min-h-[80px] transition-colors ${
                        snapshot.isDraggingOver ? 'bg-emerald-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="w-24 shrink-0 text-sm font-medium text-gray-600">
                        {timeSlot}
                      </div>
                      <div className="flex-1 space-y-2">
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
        </div>
      </div>
    </DragDropContext>
  );
}