import React, { useState } from 'react';
import { serviceRequestService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, MapPin, Clock, User, Phone, Mail } from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import MonthView from '@/components/calendar/MonthView';
import WeekView from '@/components/calendar/WeekView';
import DayView from '@/components/calendar/DayView';
import ServiceRequestForm from '@/components/forms/ServiceRequestForm';
import StatusBadge from '@/components/ui/StatusBadge';
import { format, addMonths, addWeeks, addDays, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { toast } from 'sonner';

const VIEWS = { month: 'month', week: 'week', day: 'day' };

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState(VIEWS.month);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const queryClient = useQueryClient();

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['scheduledAppointments'],
    queryFn: () => serviceRequestService.list('scheduled_start_time', 'desc', 500)
      .then(requests => requests.filter(r => r.scheduled_start_time && r.scheduled_end_time))
  });

  const createMutation = useMutation({
    mutationFn: (data) => serviceRequestService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledAppointments'] });
      setShowFormDialog(false);
      setSelectedDate(null);
      toast.success('Service request created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create request: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => serviceRequestService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledAppointments'] });
      setShowFormDialog(false);
      setSelectedDate(null);
      toast.success('Request updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update request: ' + error.message);
    }
  });

  const handleAppointmentClick = (appointment) => {
    setSelectedAppointment(appointment);
    setShowDetailsDialog(true);
  };

  const handleDateClick = (date, timeSlot) => {
    const dateToUse = new Date(date);
    if (timeSlot && typeof timeSlot === 'string') {
      const parts = timeSlot.trim().split(/\s+/);
      const [time, period] = parts.length >= 2 ? [parts[0], parts[1]] : [timeSlot, ''];
      const [h, m] = (time || '').split(':').map(Number);
      let hour24 = isNaN(h) ? 9 : h;
      const p = (period || '').toUpperCase();
      if (p === 'PM' && hour24 !== 12) hour24 += 12;
      if (p === 'AM' && hour24 === 12) hour24 = 0;
      dateToUse.setHours(hour24, isNaN(m) ? 0 : m, 0, 0);
    } else {
      dateToUse.setHours(9, 0, 0, 0);
    }
    setSelectedDate(dateToUse);
    setShowFormDialog(true);
  };

  const handleFormSubmit = async (data) => {
    // If a date was selected, set the scheduled times (preserve time if set from week/day slot)
    if (selectedDate) {
      const startDate = new Date(selectedDate);
      const hasTime = startDate.getHours() !== 0 || startDate.getMinutes() !== 0;
      if (!hasTime) {
        startDate.setHours(9, 0, 0, 0);
      }
      const endDate = new Date(startDate);
      if (!hasTime) {
        endDate.setHours(10, 0, 0, 0);
      } else {
        endDate.setHours(endDate.getHours() + 1, endDate.getMinutes(), 0, 0);
      }
      data.scheduled_start_time = startDate.toISOString();
      data.scheduled_end_time = endDate.toISOString();
    }

    if (data.id) {
      await updateMutation.mutateAsync({ id: data.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const updateAppointmentMutation = useMutation({
    mutationFn: ({ id, data }) => serviceRequestService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledAppointments'] });
      toast.success('Appointment rescheduled successfully');
    },
    onError: () => {
      toast.error('Failed to reschedule appointment');
    }
  });

  const handleReschedule = (appointmentId, newDate, newTimeSlot) => {
    // Parse the time slot (e.g., "09:00 AM") and create datetime
    const parts = (newTimeSlot || '').trim().split(/\s+/);
    const [time, period] = parts.length >= 2 ? [parts[0], parts[1]] : [newTimeSlot, ''];
    const [h, m] = (time || '').split(':').map(Number);
    let hour24 = isNaN(h) ? 9 : h;
    const p = (period || '').toUpperCase();
    if (p === 'PM' && hour24 !== 12) hour24 += 12;
    if (p === 'AM' && hour24 === 12) hour24 = 0;
    const mins = isNaN(m) ? 0 : m;

    const startDateTime = new Date(newDate);
    startDateTime.setHours(hour24, mins, 0, 0);

    // Calculate end time (preserve duration like MonthView)
    const appointment = appointments.find(a => String(a.id) === String(appointmentId));
    let endDateTime = new Date(startDateTime);
    if (appointment?.scheduled_start_time && appointment?.scheduled_end_time) {
      const duration = new Date(appointment.scheduled_end_time) - new Date(appointment.scheduled_start_time);
      endDateTime = new Date(startDateTime.getTime() + duration);
    } else {
      endDateTime.setHours(hour24 + 1, mins, 0, 0);
    }

    updateAppointmentMutation.mutate({
      id: appointment?.id ?? appointmentId,
      data: {
        scheduled_start_time: startDateTime.toISOString(),
        scheduled_end_time: endDateTime.toISOString()
      }
    });
  };

  const navigateDate = (direction) => {
    const delta = direction === 'next' ? 1 : -1;
    setCurrentDate((prev) => {
      if (view === VIEWS.month) return addMonths(prev, delta);
      if (view === VIEWS.week) return addWeeks(prev, delta);
      return addDays(prev, delta);
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getDateRange = () => {
    if (view === VIEWS.month) return format(currentDate, 'MMMM yyyy');
    if (view === VIEWS.week) {
      const weekStart = startOfWeek(currentDate);
      const weekEnd = endOfWeek(currentDate);
      return `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`;
    }
    return format(currentDate, 'EEEE, MMMM d, yyyy');
  };

  if (isLoading) {
    return (
      <div data-source-location="pages/Calendar:74:6" data-dynamic-content="false" className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner data-source-location="pages/Calendar:75:8" data-dynamic-content="false" size="lg" text="Loading calendar..." />
      </div>);

  }

  return (
    <div data-source-location="pages/Calendar:81:4" data-dynamic-content="true" className="space-y-6">
      <PageHeader data-source-location="pages/Calendar:82:6" data-dynamic-content="false"
      title="Calendar"
      subtitle="Schedule and manage appointments"
      icon={CalendarIcon} />


      {/* View Tabs + Calendar Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Tabs value={view} onValueChange={setView} className="w-full sm:w-auto">
          <TabsList className="grid w-full grid-cols-3 sm:w-[200px]">
            <TabsTrigger value={VIEWS.month} className="text-xs sm:text-sm">Month</TabsTrigger>
            <TabsTrigger value={VIEWS.week} className="text-xs sm:text-sm">Week</TabsTrigger>
            <TabsTrigger value={VIEWS.day} className="text-xs sm:text-sm">Day</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-center sm:justify-start">
            <Button variant="ghost" size="icon" onClick={() => navigateDate('prev')}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-semibold text-gray-900 min-w-[180px] sm:min-w-[220px] text-center text-sm">
              {getDateRange()}
            </span>
            <Button variant="ghost" size="icon" onClick={() => navigateDate('next')}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {view === VIEWS.month && (
          <MonthView
            date={currentDate}
            appointments={appointments}
            onReschedule={handleReschedule}
            onAppointmentClick={handleAppointmentClick}
            onDateClick={handleDateClick}
          />
        )}
        {view === VIEWS.week && (
          <WeekView
            date={currentDate}
            appointments={appointments}
            onReschedule={handleReschedule}
            onAppointmentClick={handleAppointmentClick}
            onDateClick={handleDateClick}
          />
        )}
        {view === VIEWS.day && (
          <DayView
            date={currentDate}
            appointments={appointments}
            onReschedule={handleReschedule}
            onAppointmentClick={handleAppointmentClick}
            onDateClick={handleDateClick}
          />
        )}
      </div>

      {/* Appointment Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedAppointment && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-xl">
                      Service Request #{selectedAppointment.request_number}
                    </DialogTitle>
                    <DialogDescription>
                      {selectedAppointment.client_name} • {selectedAppointment.farm_name}
                    </DialogDescription>
                  </div>
                  <StatusBadge status={selectedAppointment.status} size="md" />
                </div>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Client Information */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">Client Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-start gap-2">
                      <User className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-600">Client Name</p>
                        <p className="font-medium">{selectedAppointment.client_name}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-600">Farm Name</p>
                        <p className="font-medium">{selectedAppointment.farm_name}</p>
                      </div>
                    </div>
                    {selectedAppointment.contact_phone && (
                      <div className="flex items-start gap-2">
                        <Phone className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-600">Phone</p>
                          <p className="font-medium">{selectedAppointment.contact_phone}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Service Details */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">Service Details</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Irrigation Type</p>
                      <p className="font-medium capitalize">{selectedAppointment.irrigation_type?.replace(/_/g, ' ')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Issue Category</p>
                      <p className="font-medium capitalize">{selectedAppointment.issue_category?.replace(/_/g, ' ')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Assigned Technician</p>
                      <p className="font-medium">{selectedAppointment.assigned_technician_name || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Schedule Information */}
                {selectedAppointment.scheduled_start_time && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-gray-900">Schedule</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-start gap-2">
                        <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-600">Start Time</p>
                          <p className="font-medium">
                            {format(parseISO(selectedAppointment.scheduled_start_time), 'PPpp')}
                          </p>
                        </div>
                      </div>
                      {selectedAppointment.scheduled_end_time && (
                        <div className="flex items-start gap-2">
                          <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-600">End Time</p>
                            <p className="font-medium">
                              {format(parseISO(selectedAppointment.scheduled_end_time), 'PPpp')}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selectedAppointment.notes && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-gray-900">Notes</h3>
                    <p className="text-sm text-gray-600">{selectedAppointment.notes}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Service Request Form Dialog */}
      <Dialog open={showFormDialog} onOpenChange={(open) => {
        setShowFormDialog(open);
        if (!open) setSelectedDate(null);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Service Request</DialogTitle>
            <DialogDescription>
              {selectedDate ? `Create a new service request for ${format(selectedDate, 'MMMM d, yyyy')}${selectedDate.getHours() !== 0 || selectedDate.getMinutes() !== 0 ? ` at ${format(selectedDate, 'h:mm a')}` : ''}` : 'Fill in the details for the new service request'}
            </DialogDescription>
          </DialogHeader>
          <ServiceRequestForm
            request={null}
            onSubmit={handleFormSubmit}
            onCancel={() => {
              setShowFormDialog(false);
              setSelectedDate(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Legend */}
      <div data-source-location="pages/Calendar:142:6" data-dynamic-content="false" className="flex flex-wrap gap-4 text-sm">
        <div data-source-location="pages/Calendar:143:8" data-dynamic-content="false" className="flex items-center gap-2">
          <div data-source-location="pages/Calendar:144:10" data-dynamic-content="false" className="w-4 h-4 rounded bg-blue-100 border border-blue-300" />
          <span data-source-location="pages/Calendar:145:10" data-dynamic-content="false" className="text-gray-600">New/Scheduled</span>
        </div>
        <div data-source-location="pages/Calendar:147:8" data-dynamic-content="false" className="flex items-center gap-2">
          <div data-source-location="pages/Calendar:148:10" data-dynamic-content="false" className="w-4 h-4 rounded bg-yellow-100 border border-yellow-300" />
          <span data-source-location="pages/Calendar:149:10" data-dynamic-content="false" className="text-gray-600">In Progress</span>
        </div>
        <div data-source-location="pages/Calendar:151:8" data-dynamic-content="false" className="flex items-center gap-2">
          <div data-source-location="pages/Calendar:152:10" data-dynamic-content="false" className="w-4 h-4 rounded bg-green-100 border border-green-300" />
          <span data-source-location="pages/Calendar:153:10" data-dynamic-content="false" className="text-gray-600">Completed</span>
        </div>
        <div data-source-location="pages/Calendar:155:8" data-dynamic-content="false" className="flex items-center gap-2">
          <div data-source-location="pages/Calendar:156:10" data-dynamic-content="false" className="w-4 h-4 rounded bg-red-100 border border-red-300" />
          <span data-source-location="pages/Calendar:157:10" data-dynamic-content="false" className="text-gray-600">Urgent</span>
        </div>
      </div>
    </div>);

}