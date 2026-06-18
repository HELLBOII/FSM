import React, { useState, useRef, useEffect } from 'react';
import { serviceRequestService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import MonthView from '@/components/calendar/MonthView';
import WeekView from '@/components/calendar/WeekView';
import DayView from '@/components/calendar/DayView';
import ServiceRequestForm from '@/components/forms/ServiceRequestForm';
import { format, addMonths, addWeeks, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { toast } from 'sonner';

const VIEWS = { month: 'month', week: 'week', day: 'day' };

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState(VIEWS.month);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [formMode, setFormMode] = useState('edit');
  const [isOpeningForm, setIsOpeningForm] = useState(false);
  const [isViewActionDelayActive, setIsViewActionDelayActive] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const openingTimerRef = useRef(null);
  const viewDelayTimerRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    return () => {
      if (openingTimerRef.current) clearTimeout(openingTimerRef.current);
      if (viewDelayTimerRef.current) clearTimeout(viewDelayTimerRef.current);
    };
  }, []);

  const resetFormDialogState = () => {
    if (openingTimerRef.current) clearTimeout(openingTimerRef.current);
    if (viewDelayTimerRef.current) clearTimeout(viewDelayTimerRef.current);
    setSelectedRequest(null);
    setSelectedDate(null);
    setFormMode('edit');
    setIsOpeningForm(false);
    setIsViewActionDelayActive(false);
  };

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['scheduledAppointments'],
    queryFn: () => serviceRequestService.list('scheduled_start_time', 'desc', 500)
      .then(requests => requests.filter(r => r.scheduled_start_time && r.scheduled_end_time))
  });

  const createMutation = useMutation({
    mutationFn: (data) => serviceRequestService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledAppointments'] });
      queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
      setShowFormDialog(false);
      resetFormDialogState();
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
      queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
      setShowFormDialog(false);
      resetFormDialogState();
      toast.success('Request updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update request: ' + error.message);
    }
  });

  const handleAppointmentClick = (request) => {
    if (openingTimerRef.current) clearTimeout(openingTimerRef.current);
    if (viewDelayTimerRef.current) clearTimeout(viewDelayTimerRef.current);
    const statusKey = String(request?.status || '').toLowerCase();
    const isCancelled = statusKey === 'cancelled' || String(request?.is_cancelled || '').toUpperCase() === 'T';
    const isViewOnly = statusKey === 'completed' || isCancelled;
    setSelectedDate(null);
    setFormMode(isViewOnly ? 'view' : 'edit');
    setIsOpeningForm(true);
    setIsViewActionDelayActive(isViewOnly);
    setSelectedRequest(request);
    setShowFormDialog(true);
    openingTimerRef.current = setTimeout(() => setIsOpeningForm(false), 450);
    if (isViewOnly) {
      viewDelayTimerRef.current = setTimeout(() => setIsViewActionDelayActive(false), 3000);
    }
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
    if (openingTimerRef.current) clearTimeout(openingTimerRef.current);
    if (viewDelayTimerRef.current) clearTimeout(viewDelayTimerRef.current);
    setSelectedRequest(null);
    setFormMode('edit');
    setIsOpeningForm(false);
    setIsViewActionDelayActive(false);
    setSelectedDate(dateToUse);
    setShowFormDialog(true);
  };

  const handleFormSubmit = async (data) => {
    if (selectedRequest) {
      await updateMutation.mutateAsync({ id: selectedRequest.id, data });
      return;
    }

    // If a date was selected from calendar slot, set both start and end from it (form may already have them pre-filled)
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

    await createMutation.mutateAsync(data);
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

      {/* Service Request Form Dialog */}
      <Dialog open={showFormDialog} onOpenChange={(open) => {
        setShowFormDialog(open);
        if (!open) resetFormDialogState();
      }}>
        <DialogContent className="max-w-6xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0">
          <DialogHeader>
            <DialogTitle>
              {selectedRequest
                ? (formMode === 'view' ? 'View Service Request' : 'Edit Service Request')
                : 'New Service Request'}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest
                ? (formMode === 'view'
                  ? ''
                  : 'Update the service request details below')
                : (selectedDate
                  ? `Create a new service request for ${format(selectedDate, 'MMMM d, yyyy')}${selectedDate.getHours() !== 0 || selectedDate.getMinutes() !== 0 ? ` at ${format(selectedDate, 'h:mm a')}` : ''}`
                  : 'Fill in the details for the new service request')}
            </DialogDescription>
          </DialogHeader>
          {isOpeningForm ? (
            <div className="flex min-h-[240px] items-center justify-center">
              <LoadingSpinner
                size="md"
                text={formMode === 'view' ? 'Opening view mode...' : 'Opening edit mode...'}
              />
            </div>
          ) : (
            <ServiceRequestForm
              key={`${selectedRequest ? String(selectedRequest.id) : 'new'}-${formMode}`}
              request={selectedRequest}
              readOnly={formMode === 'view'}
              showEditInReadOnly={formMode === 'view'}
              onEditRequest={() => setFormMode('edit')}
              actionsDisabled={isViewActionDelayActive}
              initialStartTime={!selectedRequest ? (selectedDate ?? undefined) : undefined}
              initialEndTime={!selectedRequest && selectedDate != null ? (() => {
                const start = new Date(selectedDate);
                const hasTime = start.getHours() !== 0 || start.getMinutes() !== 0;
                const end = new Date(start);
                if (!hasTime) end.setHours(10, 0, 0, 0);
                else end.setHours(end.getHours() + 1, end.getMinutes(), 0, 0);
                return end;
              })() : undefined}
              onSubmit={handleFormSubmit}
              onCancel={() => {
                setShowFormDialog(false);
                resetFormDialogState();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-md border border-black/10 bg-white px-2.5 py-1">
          <span className="h-2.5 w-2.5 rounded-full bg-[#534AB7]" />
          <span className="text-[11px] text-[#6f6f68]">Scheduled</span>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-black/10 bg-white px-2.5 py-1">
          <span className="h-2.5 w-2.5 rounded-full bg-[#185FA5]" />
          <span className="text-[11px] text-[#6f6f68]">In Progress</span>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-black/10 bg-white px-2.5 py-1">
          <span className="h-2.5 w-2.5 rounded-full bg-[#1D9E75]" />
          <span className="text-[11px] text-[#6f6f68]">Completed</span>
        </div>
      </div>
    </div>);

}