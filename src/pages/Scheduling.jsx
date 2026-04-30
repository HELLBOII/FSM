import React, { useMemo, useState } from 'react';
import { serviceRequestService, technicianService, clientService, emailService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { toast } from 'sonner';
import { differenceInCalendarDays, format, isBefore, parseISO, startOfToday } from 'date-fns';


export default function Scheduling() {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [rescheduleDateTime, setRescheduleDateTime] = useState(null);
  const [rescheduleTechnicianId, setRescheduleTechnicianId] = useState('');

  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['serviceRequests'],
    queryFn: () => serviceRequestService.list('created_at', 'desc', 200)
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => technicianService.filter({ status: 'active' })
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientService.list()
  });

  const updateMutation = useMutation({
    mutationFn: async ({ request, nextDate, technicianId }) => {
      const nextStart = new Date(nextDate);
      let durationMs = 60 * 60 * 1000;
      if (request?.scheduled_start_time && request?.scheduled_end_time) {
        const existing = new Date(request.scheduled_end_time).getTime() - new Date(request.scheduled_start_time).getTime();
        if (existing > 0) durationMs = existing;
      }
      const nextEnd = new Date(nextStart.getTime() + durationMs);
      const selectedTechnician = technicians.find((t) => String(t.id) === String(technicianId));
      const updatePayload = {
        scheduled_start_time: nextStart.toISOString(),
        scheduled_end_time: nextEnd.toISOString(),
        scheduled_date: format(nextEnd, 'yyyy-MM-dd'),
        assigned_technician_id: technicianId || null,
        assigned_technician_name: selectedTechnician?.name || null,
      };
      const updated = await serviceRequestService.update(request.id, updatePayload);

      const submitData = {
        ...request,
        ...updatePayload,
        request_number: request.request_number || `SR-${request.id}`,
        client_name: request.client_name || '',
        contact_phone: request.contact_phone || '',
        location: request.location || { address: request.address || '' },
        technician_mobile: selectedTechnician?.phone || '',
      };
      const client = clients.find((c) => String(c.id) === String(request.client_id));

      if (client?.email) {
        try {
          await emailService.sendClientNotification(submitData, client, true);
        } catch {
          // Do not block successful reschedule on email failure.
        }
      }
      if (selectedTechnician?.email) {
        try {
          await emailService.sendTechnicianNotification(submitData, selectedTechnician, true);
        } catch {
          // Do not block successful reschedule on email failure.
        }
      }

      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
      queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
      setShowScheduleDialog(false);
      setSelectedRequest(null);
      setRescheduleDateTime(null);
      setRescheduleTechnicianId('');
      toast.success('Job rescheduled successfully');
    }
  });

  const overduePendingRequests = useMemo(() => {
    const today = startOfToday();
    return requests
      .filter((r) => {
        if (['completed', 'approved', 'closed'].includes(r.status)) return false;
        if (r.status === 'pending') return true;
        const dueRef = r.scheduled_end_time || r.scheduled_date || r.scheduled_start_time;
        if (!dueRef) return false;
        const due = parseISO(dueRef);
        return isBefore(due, today);
      })
      .sort((a, b) => {
        const daRef = a.scheduled_end_time || a.scheduled_date || a.scheduled_start_time;
        const dbRef = b.scheduled_end_time || b.scheduled_date || b.scheduled_start_time;
        const da = daRef ? new Date(daRef).getTime() : Number.MAX_SAFE_INTEGER;
        const db = dbRef ? new Date(dbRef).getTime() : Number.MAX_SAFE_INTEGER;
        return da - db;
      });
  }, [requests]);

  const getSeasonFromRequest = (request) => {
    const dateRef = request.scheduled_start_time || null;
    const d = dateRef ? new Date(dateRef) : new Date();
    const month = d.getMonth() + 1;
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'winter';
    return 'off';
  };

  const isScheduledMaintenanceSeason = (request) =>
    ['spring', 'winter'].includes(getSeasonFromRequest(request));

  const getServiceTypeLabel = (request) => {
    const season = getSeasonFromRequest(request);
    if (season === 'spring') return 'Spring Startup';
    if (season === 'winter') return 'Winterization (Blowout)';
    if (season === 'summer') return 'Reactive Service';
    return 'Service request';
  };

  const getStatusTone = (request) => {
    const closed = ['completed', 'approved', 'closed'].includes(request.status);
    const dueRef = request.scheduled_end_time || request.scheduled_date || request.scheduled_start_time;
    const overdue = dueRef ? isBefore(new Date(dueRef), startOfToday()) : false;
    if (overdue || request.status === 'pending') return 'bg-[#FCEBEB] text-[#A32D2D]';
    if (closed) return 'bg-[#EAF3DE] text-[#3B6D11]';
    if (isScheduledMaintenanceSeason(request) && !dueRef) return 'bg-[#FAEEDA] text-[#BA7517]';
    if (isScheduledMaintenanceSeason(request) && ['scheduled', 'assigned'].includes(request.status)) return 'bg-[#EEEDFE] text-[#534AB7]';
    if (getSeasonFromRequest(request) === 'summer' && !closed) return 'bg-[#E6F1FB] text-[#185FA5]';
    if (request.status === 'scheduled') return 'bg-[#EEEDFE] text-[#534AB7]';
    return 'bg-[#FAEEDA] text-[#BA7517]';
  };

  const getStatusLabel = (request) => {
    const closed = ['completed', 'approved', 'closed'].includes(request.status);
    const dueRef = request.scheduled_end_time || request.scheduled_date || request.scheduled_start_time;
    const overdue = dueRef ? isBefore(new Date(dueRef), startOfToday()) : false;
    if (overdue) return 'Overdue';
    if (request.status === 'pending') return 'Pending';
    if (isScheduledMaintenanceSeason(request) && !dueRef) return 'Unscheduled';
    if (getSeasonFromRequest(request) === 'summer' && !closed) return 'Reactive';
    if (!request.status) return 'Unscheduled';
    return request.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getDateTimeTone = (request) => {
    const closed = ['completed', 'approved', 'closed'].includes(request.status);
    const dueRef = request.scheduled_end_time || request.scheduled_date || request.scheduled_start_time;
    const overdue = dueRef ? isBefore(new Date(dueRef), startOfToday()) : false;
    if (overdue || request.status === 'pending') return 'text-[#A32D2D]';
    if (closed) return 'text-[#3B6D11]';
    if (isScheduledMaintenanceSeason(request) && !dueRef) return 'text-[#BA7517]';
    if (isScheduledMaintenanceSeason(request) && ['scheduled', 'assigned'].includes(request.status)) return 'text-[#534AB7]';
    if (getSeasonFromRequest(request) === 'summer' && !closed) return 'text-[#185FA5]';
    if (request.status === 'scheduled') return 'text-[#534AB7]';
    return 'text-[#BA7517]';
  };

  const handleSchedule = () => {
    if (!selectedRequest || !rescheduleDateTime || !rescheduleTechnicianId) {
      toast.error('Please select schedule date and technician');
      return;
    }
    updateMutation.mutate({ request: selectedRequest, nextDate: rescheduleDateTime, technicianId: rescheduleTechnicianId });
  };

  const openScheduleDialog = (request) => {
    setSelectedRequest(request);
    const initial = request.scheduled_end_time || request.scheduled_start_time || request.scheduled_date;
    setRescheduleDateTime(initial ? new Date(initial) : new Date());
    setRescheduleTechnicianId(request.assigned_technician_id ? String(request.assigned_technician_id) : '');
    setShowScheduleDialog(true);
  };

  if (requestsLoading) {
    return (
      <div data-source-location="pages/Scheduling:144:6" data-dynamic-content="false" className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner data-source-location="pages/Scheduling:145:8" data-dynamic-content="false" size="lg" text="Loading schedule..." />
      </div>);

  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Overdue / Pending</h1>
          <p className="mt-1 text-gray-500">Prioritize overdue jobs and reschedule pending work</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-[#F7C1C1] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-xs">
            <thead>
              <tr className="bg-[#FFF8F8]">
                <th className="border-b border-[#F7C1C1] px-3.5 py-2 text-left text-[11px] font-medium text-[#A32D2D]">Client</th>
                <th className="border-b border-[#F7C1C1] px-2 py-2 text-left text-[11px] font-medium text-[#A32D2D]">Service type</th>
                <th className="border-b border-[#F7C1C1] px-2 py-2 text-left text-[11px] font-medium text-[#A32D2D]">Due date</th>
                <th className="border-b border-[#F7C1C1] px-2 py-2 text-left text-[11px] font-medium text-[#A32D2D]">Days overdue</th>
                <th className="border-b border-[#F7C1C1] px-2 py-2 text-left text-[11px] font-medium text-[#A32D2D]">Tech</th>
                <th className="border-b border-[#F7C1C1] px-2 py-2 text-left text-[11px] font-medium text-[#A32D2D]">Action</th>
              </tr>
            </thead>
            <tbody>
              {overduePendingRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3.5 py-8 text-center text-xs text-[#888780]">
                    No overdue or pending requests.
                  </td>
                </tr>
              ) : (
                overduePendingRequests.map((request) => {
                  const dueRef = request.scheduled_end_time || request.scheduled_date || request.scheduled_start_time;
                  const dueDate = dueRef ? parseISO(dueRef) : null;
                  const daysOverdue = dueDate ? Math.max(1, differenceInCalendarDays(startOfToday(), dueDate)) : null;
                  const actionLabel = request.assigned_technician_id ? 'Reschedule' : 'Assign & Schedule';
                  return (
                    <tr key={request.id} className="border-b border-[#F7C1C1] last:border-b-0">
                      <td className="px-3.5 py-2 font-medium text-gray-900">{request.client_name || '-'}</td>
                      <td className="px-2 py-2 text-black">{getServiceTypeLabel(request)}</td>
                      <td className={`px-2 py-2 font-medium ${getDateTimeTone(request)}`}>
                        {dueDate ? format(dueDate, 'MMM d, h:mm a') : 'Unscheduled'}
                      </td>
                      <td className="px-2 py-2 font-medium text-[#A32D2D]">
                        {daysOverdue ? `+${daysOverdue} day${daysOverdue > 1 ? 's' : ''}` : '—'}
                      </td>
                      <td className="px-2 py-2 text-gray-800">{request.assigned_technician_name || 'Unassigned'}</td>
                      <td className="px-2 py-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 rounded-[4px] border-[#F7C1C1] bg-[#FCEBEB] px-2.5 text-[10px] font-medium text-[#A32D2D] hover:border-[#9E3B3B] hover:bg-[#FBE1E1] hover:text-[#B81414]"
                          onClick={() => openScheduleDialog(request)}
                        >
                          {actionLabel}
                        </Button>
                        {getStatusLabel(request) !== 'Overdue' && (
                          <div className="mt-1">
                            <span className={`inline-block rounded-[10px] px-2 py-0.5 text-[10px] font-medium ${getStatusTone(request)}`}>
                              {getStatusLabel(request)}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={(open) => {
        setShowScheduleDialog(open);
        if (!open) {
          setSelectedRequest(null);
          setRescheduleDateTime(null);
          setRescheduleTechnicianId('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule Job</DialogTitle>
            <DialogDescription>
              {selectedRequest
                ? `Update schedule for #${selectedRequest.request_number || selectedRequest.id} — ${selectedRequest.client_name || 'Client'}`
                : 'Choose a new schedule date'}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
          <div className="space-y-3">
              <div>
                <label className="mb-2 block text-sm">Schedule date</label>
                <DateTimePicker
                  date={rescheduleDateTime}
                  onDateChange={setRescheduleDateTime}
                  placeholder="Select schedule date & time"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm">Technician</label>
                <Select
                  value={rescheduleTechnicianId}
                  onValueChange={setRescheduleTechnicianId}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select technician..." />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.length > 0 ? (
                      technicians.map((tech) => (
                        <SelectItem key={tech.id} value={String(tech.id)}>
                          {tech.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__no-techs" disabled>No technicians available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowScheduleDialog(false);
                    setSelectedRequest(null);
                    setRescheduleDateTime(null);
                    setRescheduleTechnicianId('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSchedule}
                  disabled={!selectedRequest || !rescheduleDateTime || !rescheduleTechnicianId || updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save schedule'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}