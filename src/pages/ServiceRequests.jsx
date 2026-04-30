import React, { useState, useEffect, useMemo } from 'react';
import { serviceRequestService, clientService, technicianService, emailService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, FileText, AlertTriangle, CheckCircle, Clock3 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle } from
"@/components/ui/dialog";
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ServiceRequestForm from '@/components/forms/ServiceRequestForm';
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { format, isBefore, startOfToday } from 'date-fns';

export default function ServiceRequests() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [activeTab] = useState('all');
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [rescheduleRequest, setRescheduleRequest] = useState(null);
  const [rescheduleDateTime, setRescheduleDateTime] = useState(null);
  const [rescheduleTechnicianId, setRescheduleTechnicianId] = useState('');
  const [debouncedSearch] = useState('');
  const [page] = useState(1);
  const [pageSize] = useState(200);

  // Check URL params for actions
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'new') {
      setShowForm(true);
    }
    if (params.get('id')) {

      // TODO: Load and show specific request
    }}, []);

  const {
    data: pageResult,
    isFetching,
    refetch
  } = useQuery({
    queryKey: [
      'serviceRequests',
      'paged',
      page,
      pageSize,
      debouncedSearch,
      activeTab
    ],
    queryFn: () =>
      serviceRequestService.listPaged({
        page,
        pageSize,
        search: debouncedSearch,
        status: 'all',
        priority: 'all',
        irrigation: 'all',
        activeTab
      }),
    placeholderData: (previousData) => previousData
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientService.list()
  });
  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians', 'active'],
    queryFn: () => technicianService.filter({ status: 'active' })
  });

  const requests = pageResult?.data ?? [];
  const total = useMemo(() => requests.length, [requests]);

  const createMutation = useMutation({
    mutationFn: (data) => serviceRequestService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
      queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
      setShowForm(false);
      setSelectedRequest(null);
      toast.success('Service request created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create request: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => serviceRequestService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
      queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
      setShowForm(false);
      setSelectedRequest(null);
      toast.success('Request updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update request: ' + error.message);
    }
  });

  const handleSubmit = async (data) => {
    if (selectedRequest) {
      await updateMutation.mutateAsync({ id: selectedRequest.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const handleEdit = (request) => {
    setSelectedRequest(request);
    setShowForm(true);
  };

  const handleReschedule = (request) => {
    setRescheduleRequest(request);
    const initial = request.scheduled_end_time || request.scheduled_start_time || request.scheduled_date;
    setRescheduleDateTime(initial ? new Date(initial) : new Date());
    setRescheduleTechnicianId(request.assigned_technician_id ? String(request.assigned_technician_id) : '');
    setShowRescheduleDialog(true);
  };

  const rescheduleMutation = useMutation({
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
      setShowRescheduleDialog(false);
      setRescheduleRequest(null);
      setRescheduleDateTime(null);
      setRescheduleTechnicianId('');
      toast.success('Job rescheduled successfully');
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to reschedule job');
    }
  });

  const isOverdue = (request) => {
    if (['completed', 'approved', 'closed'].includes(request.status)) return false;
    const dateRef = request.scheduled_end_time || request.scheduled_date;
    if (!dateRef) return false;
    const d = new Date(dateRef);
    return isBefore(d, startOfToday());
  };

  const getScheduleDateRef = (request) =>
    request.scheduled_end_time || request.scheduled_date || request.scheduled_start_time || null;

  const getDueDateRef = (request) =>
    request.scheduled_end_time || request.scheduled_date || request.scheduled_start_time || null;

  const getScheduledDateRef = (request) =>
    request.scheduled_start_time || null;

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
    return 'Service';
  };

  const getStatusTone = (request) => {
    const closed = ['completed', 'approved', 'closed'].includes(request.status);
    if (isOverdue(request) || request.status === 'pending') return 'bg-[#FCEBEB] text-[#A32D2D]';
    if (closed) return 'bg-[#EAF3DE] text-[#3B6D11]';
    if (isScheduledMaintenanceSeason(request) && !getScheduleDateRef(request)) return 'bg-[#FAEEDA] text-[#BA7517]';
    if (isScheduledMaintenanceSeason(request) && ['scheduled', 'assigned'].includes(request.status)) return 'bg-[#EEEDFE] text-[#534AB7]';
    if (getSeasonFromRequest(request) === 'summer' && !closed) return 'bg-[#E6F1FB] text-[#185FA5]';
    if (request.status === 'scheduled') return 'bg-[#EEEDFE] text-[#534AB7]';
    return 'bg-[#FAEEDA] text-[#BA7517]';
  };

  const getStatusLabel = (request) => {
    const closed = ['completed', 'approved', 'closed'].includes(request.status);
    if (isOverdue(request)) return 'Overdue';
    if (request.status === 'pending') return 'Pending';
    if (isScheduledMaintenanceSeason(request) && !getScheduleDateRef(request)) return 'Unscheduled';
    if (getSeasonFromRequest(request) === 'summer' && !closed) return 'Reactive';
    if (!request.status) return 'Unscheduled';
    return request.status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getDateTimeTone = (request) => {
    const closed = ['completed', 'approved', 'closed'].includes(request.status);
    if (isOverdue(request) || request.status === 'pending') return 'text-[#A32D2D]';
    if (closed) return 'text-[#3B6D11]';
    if (isScheduledMaintenanceSeason(request) && !getScheduleDateRef(request)) return 'text-[#BA7517]';
    if (isScheduledMaintenanceSeason(request) && ['scheduled', 'assigned'].includes(request.status)) return 'text-[#534AB7]';
    if (getSeasonFromRequest(request) === 'summer' && !closed) return 'text-[#185FA5]';
    if (request.status === 'scheduled') return 'text-[#534AB7]';
    return 'text-[#BA7517]';
  };

  const formatScheduleDateTime = (dateRef) => {
    if (!dateRef) return '—';
    const dt = new Date(dateRef);
    const hasTime = dt.getHours() !== 0 || dt.getMinutes() !== 0;
    return hasTime ? format(dt, 'MMM d • h:mm a') : format(dt, 'MMM d');
  };

  const formatScheduledStartDateTime = (dateRef) => {
    if (!dateRef) return '—';
    return format(new Date(dateRef), 'MMM d • h:mm a');
  };

  const overdueRequests = useMemo(
    () => requests.filter((r) => isOverdue(r) || r.status === 'pending').sort((a, b) => new Date(a.scheduled_date || 0) - new Date(b.scheduled_date || 0)),
    [requests]
  );

  const openRequests = useMemo(
    () => requests.filter((r) => !['completed', 'approved', 'closed'].includes(r.status) && !isOverdue(r)),
    [requests]
  );

  const metrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const clientIdsWithScheduledOrCompleted = new Set(
      requests
        .filter((r) => ['scheduled', 'completed'].includes(r.status) && r.client_id != null)
        .map((r) => String(r.client_id))
    );

    const unscheduled = clients
      .filter((c) => {
        const lat = c.location?.lat ?? c.latitude;
        const lng = c.location?.lng ?? c.longitude;
        return lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));
      })
      .filter((c) => !clientIdsWithScheduledOrCompleted.has(String(c.id))).length;

    const overduePending = requests.filter((r) => {
      if (r.status !== 'scheduled') return false;
      if (!r.scheduled_end_time) return false;
      const endDate = new Date(r.scheduled_end_time);
      if (Number.isNaN(endDate.getTime())) return false;
      endDate.setHours(0, 0, 0, 0);
      return endDate < today;
    }).length;

    return {
      open: requests.filter((r) => !['completed', 'approved', 'closed'].includes(r.status) && !isOverdue(r)).length,
      overduePending,
      completedSeason: requests.filter((r) => r.status === 'completed').length,
      unscheduled,
    };
  }, [requests, clients]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Service Requests</h1>
          <p className="mt-1 text-gray-500">Review, reschedule, and manage active service requests</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            className="h-9 w-9 border-primary/30 text-primary hover:bg-primary/10"
            aria-label="Refresh requests"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setShowForm(true)} className="h-9">
            <Plus className="mr-1.5 h-4 w-4" />
            New Request
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <div className="rounded-md border border-black/10 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#888780]">
            <span>Open requests</span>
            <FileText className="h-3.5 w-3.5 text-[#534AB7]" />
          </div>
          <div className="text-[22px] font-medium text-[#534AB7]">{metrics.open}</div>
        </div>
        <div className="rounded-md border border-black/10 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#888780]">
            <span>Overdue / pending</span>
            <AlertTriangle className="h-3.5 w-3.5 text-[#A32D2D]" />
          </div>
          <div className="text-[22px] font-medium text-[#A32D2D]">{metrics.overduePending}</div>
        </div>
        <div className="rounded-md border border-black/10 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#888780]">
            <span>Completed this season</span>
            <CheckCircle className="h-3.5 w-3.5 text-[#1D9E75]" />
          </div>
          <div className="text-[22px] font-medium text-[#0F6E56]">{metrics.completedSeason}</div>
        </div>
        <div className="rounded-md border border-black/10 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#888780]">
            <span>Unscheduled</span>
            <Clock3 className="h-3.5 w-3.5 text-[#BA7517]" />
          </div>
          <div className="text-[22px] font-medium text-[#BA7517]">{metrics.unscheduled}</div>
        </div>
      </div>

      {isFetching ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <LoadingSpinner size="lg" text="Loading requests..." />
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="mb-2.5 text-[12px] font-medium uppercase tracking-[0.06em] text-[#888780]">Overdue / Pending</div>
            <div className="overflow-hidden rounded-lg border border-[#F7C1C1] bg-white">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#FFF8F8]">
                      <th className="border-b border-[#F7C1C1] px-3.5 py-2 text-left text-[11px] font-medium text-[#A32D2D]">Client</th>
                      <th className="border-b border-[#F7C1C1] px-2 py-2 text-left text-[11px] font-medium text-[#A32D2D]">Service type</th>
                      <th className="border-b border-[#F7C1C1] px-2 py-2 text-left text-[11px] font-medium text-[#A32D2D]">Due date</th>
                      <th className="border-b border-[#F7C1C1] px-2 py-2 text-left text-[11px] font-medium text-[#A32D2D]">Technician</th>
                      <th className="border-b border-[#F7C1C1] px-2 py-2 text-left text-[11px] font-medium text-[#A32D2D]">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueRequests.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3.5 py-6 text-center text-xs text-[#888780]">No overdue or pending requests.</td>
                      </tr>
                    ) : overdueRequests.map((request) => (
                      <tr key={request.id} className="border-b border-[#F7C1C1] last:border-b-0">
                        <td className="px-3.5 py-2 font-medium text-gray-900">{request.client_name || '-'}</td>
                        <td className="px-2 py-2 text-black">{getServiceTypeLabel(request)}</td>
                        <td className={`px-2 py-2 font-medium ${getDateTimeTone(request)}`}>{formatScheduleDateTime(getDueDateRef(request))}</td>
                        <td className="px-2 py-2 text-gray-800">{request.assigned_technician_name || 'Unassigned'}</td>
                        <td className="px-2 py-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 rounded-[4px] border-[#F7C1C1] bg-[#FCEBEB] px-2.5 text-[10px] font-medium text-[#A32D2D] hover:border-[#9E3B3B] hover:bg-[#FBE1E1] hover:text-[#B81414]"
                            onClick={() => handleReschedule(request)}
                          >
                            Reschedule
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div>
            <div className="mb-2.5 text-[12px] font-medium uppercase tracking-[0.06em] text-[#888780]">All open requests</div>
            <div className="overflow-hidden rounded-lg border border-black/10 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#f8f8f7]">
                      <th className="border-b border-black/10 px-3.5 py-2 text-left text-[11px] font-medium text-[#888780]">Client</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-[11px] font-medium text-[#888780]">Service type</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-[11px] font-medium text-[#888780]">Scheduled</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-[11px] font-medium text-[#888780]">Tech</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-[11px] font-medium text-[#888780]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openRequests.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3.5 py-6 text-center text-xs text-[#888780]">No open requests.</td>
                      </tr>
                    ) : openRequests.map((request) => (
                      <tr key={request.id} className="border-b border-black/10 last:border-b-0">
                        <td className="px-3.5 py-2 font-medium text-gray-900">{request.client_name || '-'}</td>
                        <td className="px-2 py-2 text-black">{getServiceTypeLabel(request)}</td>
                        <td className={`px-2 py-2 font-medium ${getDateTimeTone(request)}`}>
                          {formatScheduledStartDateTime(getScheduledDateRef(request))}
                        </td>
                        <td className="px-2 py-2 text-gray-800">{request.assigned_technician_name || 'Unassigned'}</td>
                        <td className="px-2 py-2">
                          <span className={`inline-block rounded-[10px] px-2 py-0.5 text-[10px] font-medium ${getStatusTone(request)}`}>
                            {getStatusLabel(request)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form Dialog */}
      <Dialog data-source-location="pages/ServiceRequests:454:6" data-dynamic-content="true" open={showForm} onOpenChange={(open) => {
        setShowForm(open);
        if (!open) setSelectedRequest(null);
      }}>
        <DialogContent data-source-location="pages/ServiceRequests:458:8" data-dynamic-content="true" className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader data-source-location="pages/ServiceRequests:459:10" data-dynamic-content="true">
            <DialogTitle data-source-location="pages/ServiceRequests:460:12" data-dynamic-content="true">
              {selectedRequest ? 'Edit Service Request' : 'New Service Request'}
            </DialogTitle>
            <DialogDescription data-source-location="pages/ServiceRequests:463:12" data-dynamic-content="true">
              {selectedRequest ? 'Update the service request details below' : 'Fill in the details for the new service request'}
            </DialogDescription>
          </DialogHeader>
          <ServiceRequestForm data-source-location="pages/ServiceRequests:467:10" data-dynamic-content="false"
          request={selectedRequest}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setSelectedRequest(null);
          }} />

        </DialogContent>
      </Dialog>

      <Dialog open={showRescheduleDialog} onOpenChange={(open) => {
        setShowRescheduleDialog(open);
        if (!open) {
          setRescheduleRequest(null);
          setRescheduleDateTime(null);
          setRescheduleTechnicianId('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule Job</DialogTitle>
            <DialogDescription>
              {rescheduleRequest
                ? `Update schedule for #${rescheduleRequest.request_number || rescheduleRequest.id} — ${rescheduleRequest.client_name || 'Client'}`
                : 'Choose a new schedule date'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-2 block text-sm">Schedule date</Label>
              <DateTimePicker
                date={rescheduleDateTime}
                onDateChange={setRescheduleDateTime}
                placeholder="Select schedule date & time"
              />
            </div>
            <div>
              <Label className="mb-2 block text-sm">Technician</Label>
              <Select value={rescheduleTechnicianId} onValueChange={setRescheduleTechnicianId}>
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
                  setShowRescheduleDialog(false);
                  setRescheduleRequest(null);
                  setRescheduleDateTime(null);
                  setRescheduleTechnicianId('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!rescheduleRequest || !rescheduleDateTime || !rescheduleTechnicianId || rescheduleMutation.isPending}
                onClick={() => {
                  if (!rescheduleRequest || !rescheduleDateTime || !rescheduleTechnicianId) return;
                  rescheduleMutation.mutate({
                    request: rescheduleRequest,
                    nextDate: rescheduleDateTime,
                    technicianId: rescheduleTechnicianId
                  });
                }}
              >
                {rescheduleMutation.isPending ? 'Saving...' : 'Save schedule'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>);

}
