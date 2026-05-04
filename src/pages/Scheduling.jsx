import React, { useEffect, useState } from 'react';
import { serviceRequestService, technicianService, clientService, emailService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ServiceRequestForm from '@/components/forms/ServiceRequestForm';
import { CalendarClock, ChevronLeft, ChevronRight, Pencil, UserRoundCog, X, Search as SearchIcon } from 'lucide-react';
import { toast } from 'sonner';
import { differenceInCalendarDays, format, isBefore, parseISO, startOfToday } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';
import { mergeServiceRequestUpdateAudit, canCancelServiceRequestRow } from '@/utils/serviceRequestAudit';
import { Tooltip } from '@/components/ui/tooltip';
import { formatRequestStatusLabel, formatSeasonFromDb } from '@/utils/serviceRequestSeason';

const CLOSED_STATUSES = ['completed', 'approved', 'closed'];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const ICON_ACTION_PRIMARY_CLASS =
  'h-8 w-8 shrink-0 rounded-md bg-primary p-0 text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground';

function formatIssueCategoryDisplay(request) {
  const raw = request?.issue_category;
  if (raw == null || String(raw).trim() === '') return '—';
  return String(raw).replace(/_/g, ' ');
}

export default function Scheduling() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [editRequest, setEditRequest] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [assignRequest, setAssignRequest] = useState(null);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [rescheduleRequest, setRescheduleRequest] = useState(null);
  const [rescheduleDateTime, setRescheduleDateTime] = useState(null);
  const [rescheduleTechnicianId, setRescheduleTechnicianId] = useState('');
  const [overduePage, setOverduePage] = useState(1);
  const [overduePageSize, setOverduePageSize] = useState(10);
  const [schedulingTableSearch, setSchedulingTableSearch] = useState('');
  const [cancelConfirmRequest, setCancelConfirmRequest] = useState(null);

  const { data: schedulingPage, isLoading: requestsLoading } = useQuery({
    queryKey: ['serviceRequests', 'schedulingOverdue', overduePage, overduePageSize, schedulingTableSearch],
    queryFn: () =>
      serviceRequestService.listOverduePendingPaged({
        page: overduePage,
        pageSize: overduePageSize,
        search: schedulingTableSearch.trim(),
      }),
  });
  const overdueRows = schedulingPage?.data ?? [];
  const schedulingTotal = schedulingPage?.total ?? 0;
  const { data: techniciansForAssign = [], isLoading: isLoadingTechniciansForAssign } = useQuery({
    queryKey: ['technicians', 'forAssignDialog'],
    queryFn: () => technicianService.list(),
    enabled: !!assignRequest,
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientService.list()
  });
  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians', 'active'],
    queryFn: () => technicianService.filter({ status: 'active' }),
  });

  const assignTechnicianMutation = useMutation({
    mutationFn: async ({ request, technician }) => {
      let updatePayload = {
        assigned_technician_id: technician.id,
        assigned_technician_name: technician.name || null,
      };
      updatePayload = mergeServiceRequestUpdateAudit(request, updatePayload, user?.id ?? null, {
        alwaysSetModified: true,
      });
      const updated = await serviceRequestService.update(request.id, updatePayload);

      const submitData = {
        ...request,
        ...updatePayload,
        request_number: request.request_number || `SR-${request.id}`,
        technician_mobile: technician.phone || '',
        location: request.location || { address: request.address || '' },
      };
      const client = clients.find((c) => String(c.id) === String(request.client_id));

      if (client?.email) {
        try {
          await emailService.sendClientNotification(submitData, client, true);
        } catch {
          // Do not block successful assignment on email failure.
        }
      }
      if (technician?.email) {
        try {
          await emailService.sendTechnicianNotification(submitData, technician, true);
        } catch {
          // Do not block successful assignment on email failure.
        }
      }

      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
      queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
      setAssignRequest(null);
      toast.success('Technician assigned successfully');
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to assign technician');
    },
  });

  const updateRequestMutation = useMutation({
    mutationFn: ({ id, data }) => serviceRequestService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
      queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
      setShowEditForm(false);
      setEditRequest(null);
      toast.success('Request updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update request: ' + (error?.message || 'Unknown error'));
    }
  });

  const cancelRequestMutation = useMutation({
    mutationFn: async ({ request }) => {
      let data = { is_cancelled: 'T' };
      data = mergeServiceRequestUpdateAudit(request, data, user?.id ?? null, {
        alwaysSetModified: true,
      });
      return serviceRequestService.update(request.id, data);
    },
    onSuccess: (_data, { request }) => {
      queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
      queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
      setCancelConfirmRequest(null);
      toast.success('Request cancelled');
      if (editRequest && String(editRequest.id) === String(request.id)) {
        setShowEditForm(false);
        setEditRequest(null);
      }
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to cancel request');
    },
  });

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
      let updatePayload = {
        scheduled_start_time: nextStart.toISOString(),
        scheduled_end_time: nextEnd.toISOString(),
        scheduled_date: format(nextEnd, 'yyyy-MM-dd'),
        assigned_technician_id: technicianId || null,
        assigned_technician_name: selectedTechnician?.name || null,
      };
      updatePayload = mergeServiceRequestUpdateAudit(request, updatePayload, user?.id ?? null, {
        alwaysSetModified: true,
      });
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
    },
  });

  const overdueTotalPages = Math.max(1, Math.ceil(schedulingTotal / overduePageSize) || 1);

  useEffect(() => {
    if (overduePage > overdueTotalPages) setOverduePage(overdueTotalPages);
  }, [overduePage, overdueTotalPages]);

  useEffect(() => {
    setOverduePage(1);
  }, [overduePageSize]);

  useEffect(() => {
    setOverduePage(1);
  }, [schedulingTableSearch]);

  const overdueRangeStart = schedulingTotal === 0 ? 0 : (overduePage - 1) * overduePageSize + 1;
  const overdueRangeEnd = Math.min(overduePage * overduePageSize, schedulingTotal);

  const getStatusTone = (request) => {
    const closed = ['completed', 'approved', 'closed'].includes(request.status);
    const dueRef = request.scheduled_end_time || request.scheduled_date || request.scheduled_start_time;
    const overdue = dueRef ? isBefore(new Date(dueRef), startOfToday()) : false;
    if (overdue || request.status === 'pending') return 'bg-[#FCEBEB] text-[#A32D2D]';
    if (closed) return 'bg-[#EAF3DE] text-[#3B6D11]';
    if (request.status === 'scheduled' || request.status === 'assigned') return 'bg-[#EEEDFE] text-[#534AB7]';
    if (request.status === 'in_progress') return 'bg-[#E6F1FB] text-[#185FA5]';
    return 'bg-[#FAEEDA] text-[#BA7517]';
  };

  const getStatusLabel = (request) => {
    const dueRef = request.scheduled_end_time || request.scheduled_date || request.scheduled_start_time;
    const overdue = dueRef ? isBefore(new Date(dueRef), startOfToday()) : false;
    if (overdue) return 'Overdue';
    if (request.status === 'pending') return 'Pending';
    return formatRequestStatusLabel(request.status);
  };

  const canShowAssignTechnician = (request) =>
    !CLOSED_STATUSES.includes(request.status) && !request.assigned_technician_id;

  const getDateTimeTone = (request) => {
    const closed = ['completed', 'approved', 'closed'].includes(request.status);
    const dueRef = request.scheduled_end_time || request.scheduled_date || request.scheduled_start_time;
    const overdue = dueRef ? isBefore(new Date(dueRef), startOfToday()) : false;
    if (overdue || request.status === 'pending') return 'text-[#A32D2D]';
    if (closed) return 'text-[#3B6D11]';
    if (request.status === 'scheduled' || request.status === 'assigned') return 'text-[#534AB7]';
    if (request.status === 'in_progress') return 'text-[#185FA5]';
    return 'text-[#BA7517]';
  };

  const openEditForm = (request) => {
    setEditRequest(request);
    setShowEditForm(true);
  };

  const handleSubmitEdit = async (data) => {
    if (!editRequest) return;
    await updateRequestMutation.mutateAsync({ id: editRequest.id, data });
  };

  if (requestsLoading) {
    return (
      <div data-source-location="pages/Scheduling:144:6" data-dynamic-content="false" className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner data-source-location="pages/Scheduling:145:8" data-dynamic-content="false" size="lg" text="Loading schedule..." />
      </div>);

  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Overdue / Pending</h1>
          <p className="mt-1 text-gray-500">Prioritize overdue and pending work; edit, reschedule, or assign technicians</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-[#F7C1C1] bg-white">
        <div className="flex flex-col gap-2 border-b border-[#F7C1C1] bg-[#FFFBFB] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-end">
          <div className="relative w-full sm:max-w-xs sm:shrink-0">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={schedulingTableSearch}
              onChange={(e) => setSchedulingTableSearch(e.target.value)}
              placeholder="Search"
              className="h-9 border-primary/30 pl-8"
              aria-label="Filter overdue and pending requests"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse text-xs sm:min-w-[920px] sm:text-sm">
            <thead>
              <tr className="bg-[#FFF8F8]">
                <th className="border-b border-[#F7C1C1] px-2 py-2 text-left text-xs font-medium text-[#A32D2D] sm:px-3.5 sm:text-sm">Client</th>
                <th className="border-b border-[#F7C1C1] px-2 py-2 text-left text-xs font-medium text-[#A32D2D] sm:px-3.5 sm:text-sm">Service type</th>
                <th className="border-b border-[#F7C1C1] px-2 py-2 text-left text-xs font-medium text-[#A32D2D] sm:px-3.5 sm:text-sm">Season</th>
                <th className="border-b border-[#F7C1C1] px-2 py-2 text-left text-xs font-medium text-[#A32D2D] sm:px-3.5 sm:text-sm">Due date</th>
                <th className="border-b border-[#F7C1C1] px-2 py-2 text-left text-xs font-medium text-[#A32D2D] sm:px-3.5 sm:text-sm">Days overdue</th>
                <th className="border-b border-[#F7C1C1] px-2 py-2 text-left text-xs font-medium text-[#A32D2D] sm:px-3.5 sm:text-sm">Technician</th>
                <th className="border-b border-[#F7C1C1] px-2 py-2 text-left text-xs font-medium text-[#A32D2D] sm:px-3.5 sm:text-sm">Action</th>
              </tr>
            </thead>
            <tbody>
              {schedulingTotal === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3.5 py-8 text-center text-xs text-[#888780]">
                    No overdue or pending requests.
                  </td>
                </tr>
              ) : (
                overdueRows.map((request) => {
                  const dueRef = request.scheduled_end_time || request.scheduled_date || request.scheduled_start_time;
                  const dueDate = dueRef ? parseISO(dueRef) : null;
                  const daysOverdue = dueDate ? Math.max(1, differenceInCalendarDays(startOfToday(), dueDate)) : null;
                  const showCancelRow = canCancelServiceRequestRow(request);
                  return (
                    <tr key={request.id} className="border-b border-[#F7C1C1] last:border-b-0">
                      <td className="px-2 py-2 font-medium text-gray-900 sm:px-3.5">{request.client_name || '-'}</td>
                      <td className="px-2 py-2 text-black sm:px-3.5">{formatIssueCategoryDisplay(request)}</td>
                      <td className="px-2 py-2 text-gray-800 sm:px-3.5">{request?.season}</td>
                      <td className={`px-2 py-2 font-medium sm:px-3.5 ${getDateTimeTone(request)}`}>
                        {dueDate ? format(dueDate, 'MMM d, h:mm a') : 'Unscheduled'}
                      </td>
                      <td className="px-2 py-2 font-medium text-[#A32D2D] sm:px-3.5">
                        {daysOverdue ? `+${daysOverdue} day${daysOverdue > 1 ? 's' : ''}` : '—'}
                      </td>
                      <td className="px-2 py-2 text-gray-800 sm:px-3.5">{request.assigned_technician_name || 'Unassigned'}</td>
                      <td className="px-2 py-2 sm:px-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                              <Button
                                type="button"
                                size="icon"
                                variant="default"
                                className={ICON_ACTION_PRIMARY_CLASS}
                                aria-label="Edit request"
                                onClick={() => openEditForm(request)}
                              >
                                <Pencil className="h-3.5 w-3.5 shrink-0" />
                              </Button>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                              <Tooltip.Content side="top" sideOffset={4}>
                                Edit request
                                <Tooltip.Arrow className="fill-popover" />
                              </Tooltip.Content>
                            </Tooltip.Portal>
                          </Tooltip.Root>
                          <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                              <Button
                                type="button"
                                size="icon"
                                variant="default"
                                className={ICON_ACTION_PRIMARY_CLASS}
                                aria-label="Reschedule"
                                onClick={() => handleReschedule(request)}
                              >
                                <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                              </Button>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                              <Tooltip.Content side="top" sideOffset={4}>
                                Reschedule
                                <Tooltip.Arrow className="fill-popover" />
                              </Tooltip.Content>
                            </Tooltip.Portal>
                          </Tooltip.Root>
                          {canShowAssignTechnician(request) ? (
                            <Tooltip.Root>
                              <Tooltip.Trigger asChild>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="default"
                                  className={ICON_ACTION_PRIMARY_CLASS}
                                  aria-label="Assign technician"
                                  onClick={() => setAssignRequest(request)}
                                >
                                  <UserRoundCog className="h-3.5 w-3.5 shrink-0" />
                                </Button>
                              </Tooltip.Trigger>
                              <Tooltip.Portal>
                                <Tooltip.Content side="top" sideOffset={4}>
                                  Assign technician
                                  <Tooltip.Arrow className="fill-popover" />
                                </Tooltip.Content>
                              </Tooltip.Portal>
                            </Tooltip.Root>
                          ) : null}
                          {showCancelRow ? (
                            <Tooltip.Root>
                              <Tooltip.Trigger asChild>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="default"
                                  className={ICON_ACTION_PRIMARY_CLASS}
                                  aria-label="Cancel request"
                                  disabled={cancelRequestMutation.isPending}
                                  onClick={() => setCancelConfirmRequest(request)}
                                >
                                  <X className="h-3.5 w-3.5 shrink-0" />
                                </Button>
                              </Tooltip.Trigger>
                              <Tooltip.Portal>
                                <Tooltip.Content side="top" sideOffset={4}>
                                  Cancel request
                                  <Tooltip.Arrow className="fill-popover" />
                                </Tooltip.Content>
                              </Tooltip.Portal>
                            </Tooltip.Root>
                          ) : null}
                        </div>
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
        {schedulingTotal > 0 && (
          <div className="flex flex-col gap-2 border-t border-[#F7C1C1] bg-[#FFFBFB] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              Showing{' '}
              <span className="font-medium text-gray-900">
                {overdueRangeStart.toLocaleString()}–{overdueRangeEnd.toLocaleString()}
              </span>{' '}
              of <span className="font-medium text-gray-900">{schedulingTotal.toLocaleString()}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <Select
                value={String(overduePageSize)}
                onValueChange={(v) => setOverduePageSize(Number(v))}
              >
                <SelectTrigger className="h-9 w-[130px] border-primary/30 text-sm">
                  <SelectValue placeholder="Per page" />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} per page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 border-primary/30"
                  disabled={overduePage <= 1}
                  onClick={() => setOverduePage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[7rem] px-2 text-center text-sm text-gray-700 tabular-nums">
                  Page {overduePage} / {overdueTotalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 border-primary/30"
                  disabled={overduePage >= overdueTotalPages}
                  onClick={() => setOverduePage((p) => Math.min(overdueTotalPages, p + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!assignRequest} onOpenChange={(open) => !open && setAssignRequest(null)}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Assign technician</DialogTitle>
            <DialogDescription>
              {assignRequest && (
                <>
                  Select a technician to assign to #{assignRequest.request_number || assignRequest.id} —{' '}
                  {assignRequest.client_name || 'Client'}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-2">
            {isLoadingTechniciansForAssign ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="md" text="Loading technicians..." />
              </div>
            ) : techniciansForAssign.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No technicians available to assign.</p>
            ) : (
              techniciansForAssign.map((tech) => (
                <button
                  key={tech.id}
                  type="button"
                  className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 text-left transition-colors"
                  onClick={() => {
                    assignTechnicianMutation.mutate({
                      request: assignRequest,
                      technician: tech,
                    });
                  }}
                  disabled={assignTechnicianMutation.isPending}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {(tech.name || '?')
                      .split(/\s+/)
                      .filter(Boolean)
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{tech.name}</p>
                    <p className="text-xs text-gray-500 truncate">{tech.employee_id || tech.email}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showRescheduleDialog}
        onOpenChange={(open) => {
          setShowRescheduleDialog(open);
          if (!open) {
            setRescheduleRequest(null);
            setRescheduleDateTime(null);
            setRescheduleTechnicianId('');
          }
        }}
      >
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
                    <SelectItem value="__no-techs" disabled>
                      No technicians available
                    </SelectItem>
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
                disabled={
                  !rescheduleRequest ||
                  !rescheduleDateTime ||
                  !rescheduleTechnicianId ||
                  rescheduleMutation.isPending
                }
                onClick={() => {
                  if (!rescheduleRequest || !rescheduleDateTime || !rescheduleTechnicianId) return;
                  rescheduleMutation.mutate({
                    request: rescheduleRequest,
                    nextDate: rescheduleDateTime,
                    technicianId: rescheduleTechnicianId,
                  });
                }}
              >
                {rescheduleMutation.isPending ? 'Saving...' : 'Save schedule'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showEditForm}
        onOpenChange={(open) => {
          setShowEditForm(open);
          if (!open) setEditRequest(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Service Request</DialogTitle>
            <DialogDescription>Update the service request details below</DialogDescription>
          </DialogHeader>
          {editRequest && (
            <ServiceRequestForm
              request={editRequest}
              onSubmit={handleSubmitEdit}
              onCancel={() => {
                setShowEditForm(false);
                setEditRequest(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!cancelConfirmRequest}
        onOpenChange={(open) => {
          if (!open) setCancelConfirmRequest(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this request?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelConfirmRequest
                ? `Request #${cancelConfirmRequest.request_number || cancelConfirmRequest.id} for ${cancelConfirmRequest.client_name || 'client'} will be marked cancelled.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelRequestMutation.isPending}>No</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="destructive"
                disabled={cancelRequestMutation.isPending || !cancelConfirmRequest}
                onClick={() => {
                  if (!cancelConfirmRequest) return;
                  cancelRequestMutation.mutate({ request: cancelConfirmRequest });
                }}
              >
                {cancelRequestMutation.isPending ? 'Cancelling…' : 'Yes, cancel request'}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}