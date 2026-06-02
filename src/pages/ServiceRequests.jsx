import React, { useState, useEffect, useMemo, useRef } from 'react';
import { serviceRequestService, clientService, technicianService, emailService, workReportService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, FileText, AlertTriangle, CheckCircle, Clock3, Pencil, Ban, UserRoundCog, CalendarClock, ChevronLeft, ChevronRight, X, Eye, Image, Check, Droplets } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle } from
"@/components/ui/dialog";
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
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ServiceRequestForm from '@/components/forms/ServiceRequestForm';
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';
import { endOfDay, format, isBefore, startOfDay } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';
import { mergeServiceRequestUpdateAudit, canCancelServiceRequestRow } from '@/utils/serviceRequestAudit';
import {
  SEASON_FILTER_OPTIONS,
  SERVICE_TYPE_FILTER_OPTIONS,
  isRequestAssignedTechnician,
  requestMatchesSeasonFilter,
  requestMatchesServiceTypeFilter,
  sortRequestsByDateAsc,
} from '@/utils/serviceRequestListFilters';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/tooltip';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

/** Service type column: `issue_category` formatted for display. */
function formatIssueCategoryDisplay(request) {
  const raw = request?.issue_category;
  if (raw == null || String(raw).trim() === '') return '—';
  return String(raw).replace(/_/g, ' ');
}

function toInitCapWords(value) {
  const text = String(value ?? '').trim();
  if (!text) return '—';
  return text
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

const TABLE_DATE_DISPLAY_FORMAT = 'd MMM yyyy • h:mm a';

const CLOSED_STATUSES = ['completed', 'approved', 'closed'];

function isRequestStateOverdue(request) {
  return String(request?.state || '').trim().toLowerCase() === 'overdue';
}

/** Same reference logic as the scheduled column; used only for schedule date range filtering. */
function getScheduledInstantForDateRangeFilter(request) {
  const ref = request.scheduled_start_time || request.scheduled_end_time || request.scheduled_date || null;
  if (!ref) return null;
  const d = new Date(ref);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getRequestStatusFilterBucket(request) {
  const status = String(request?.status || '').toLowerCase();
  if (String(request?.is_cancelled || '').toUpperCase() === 'T' || status === 'cancelled') {
    return 'cancelled';
  }
  if (status === 'completed' || status === 'approved' || status === 'closed') {
    return 'completed';
  }
  if (status === 'in_progress') {
    return 'in_progress';
  }
  return 'scheduled';
}

function getRequestStatusBadgeMeta(request) {
  const status = String(request?.status || '').toLowerCase();
  const label = toInitCapWords(status);

  if (isRequestStateOverdue(request)) {
    return { label, className: 'bg-rose-100 text-rose-700 border-rose-300' };
  }
  if (status === 'cancelled' || String(request?.is_cancelled || '').toUpperCase() === 'T') {
    return { label, className: 'bg-stone-100 text-stone-700 border-stone-300' };
  }
  if (status === 'completed' || status === 'approved' || status === 'closed') {
    return { label, className: 'bg-emerald-100 text-emerald-700 border-emerald-300' };
  }
  if (status === 'scheduled' || status === 'assigned') {
    return { label, className: 'bg-violet-100 text-violet-700 border-violet-300' };
  }
  if (status === 'in_progress') {
    return { label, className: 'bg-blue-100 text-blue-700 border-blue-300' };
  }
  return { label, className: 'bg-amber-100 text-amber-700 border-amber-300' };
}

const REQUEST_TABLE_COLGROUP = (
  <colgroup>
    <col className="w-[15%]" />
    <col className="w-[14%]" />
    <col className="w-[9%]" />
    <col className="w-[14%]" />
    <col className="w-[12%]" />
    <col className="w-[11%]" />
    <col className="w-[10%]" />
    <col className="w-[15%]" />
  </colgroup>
);

function formatStateLabel(request) {
  const raw = request?.state;
  if (raw == null || String(raw).trim() === '') return '—';
  return String(raw).replace(/_/g, ' ');
}

function getStateBadgeClass(request) {
  if (isRequestStateOverdue(request)) return 'bg-rose-100 text-rose-700 border-rose-300';
  return 'bg-slate-100 text-slate-700 border-slate-300';
}

function getScheduledSortTimeMs(request) {
  const ref =
    request?.scheduled_start_time ||
    request?.scheduled_end_time ||
    request?.scheduled_date ||
    request?.created_at;
  if (!ref) return 0;
  const ms = new Date(ref).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

const ICON_ACTION_PRIMARY_CLASS =
  'h-8 w-8 shrink-0 rounded-md bg-primary p-0 text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground';

function DateOnlyPicker({ date, onDateChange, placeholder, ariaLabel }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={ariaLabel}
          className={cn(
            "h-9 w-full justify-start border-primary/30 text-left text-sm font-normal",
            !date && "text-muted-foreground"
          )}
        >
          {date ? format(date, 'MM/dd/yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date ?? undefined}
          onSelect={(next) => onDateChange(next ?? null)}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

function ServiceRequestRowActions({
  request,
  showReschedule,
  onEdit,
  onAssign,
  onReschedule,
  canAssign,
  onOpenCancelConfirm,
  cancelBusy,
}) {
  const statusKey = String(request?.status || '').toLowerCase();
  const isCancelled = statusKey === 'cancelled' || String(request?.is_cancelled || '').toUpperCase() === 'T';
  const isViewOnly = statusKey === 'completed' || isCancelled;
  const showCancel = canCancelServiceRequestRow(request);
  return (
    <div className="flex flex-wrap items-center justify-start gap-1.5">
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <Button
            type="button"
            variant="default"
            size="icon"
            className={ICON_ACTION_PRIMARY_CLASS}
            aria-label={isViewOnly ? 'View request' : 'Edit request'}
            onClick={() => onEdit(request)}
          >
            {isViewOnly ? (
              <Eye className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Pencil className="h-3.5 w-3.5 shrink-0" />
            )}
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content side="top" sideOffset={4}>
            {isViewOnly ? 'View request' : 'Edit request'}
            <Tooltip.Arrow />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
      {!isViewOnly && canAssign ? (
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <Button
              type="button"
              variant="default"
              size="icon"
              className={ICON_ACTION_PRIMARY_CLASS}
              aria-label="Assign technician"
              onClick={() => onAssign(request)}
            >
              <UserRoundCog className="h-3.5 w-3.5 shrink-0" />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content side="top" sideOffset={4}>
              Assign technician
              <Tooltip.Arrow />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      ) : null}
      {!isViewOnly && showReschedule ? (
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <Button
              type="button"
              variant="default"
              size="icon"
              className={ICON_ACTION_PRIMARY_CLASS}
              aria-label="Reschedule"
              onClick={() => onReschedule(request)}
            >
              <CalendarClock className="h-3.5 w-3.5 shrink-0" />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content side="top" sideOffset={4}>
              Reschedule
              <Tooltip.Arrow />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      ) : null}
      {!isViewOnly && showCancel && onOpenCancelConfirm ? (
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <Button
              type="button"
              variant="default"
              size="icon"
              className={ICON_ACTION_PRIMARY_CLASS}
              aria-label="Cancel request"
              disabled={cancelBusy}
              onClick={() => onOpenCancelConfirm(request)}
            >
              <X className="h-3.5 w-3.5 shrink-0" />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content side="top" sideOffset={4}>
              Cancel request
              <Tooltip.Arrow />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      ) : null}
    </div>
  );
}

export default function ServiceRequests() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [formMode, setFormMode] = useState('edit');
  const [isOpeningForm, setIsOpeningForm] = useState(false);
  const [isViewActionDelayActive, setIsViewActionDelayActive] = useState(false);
  const openingTimerRef = useRef(null);
  const viewDelayTimerRef = useRef(null);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [rescheduleRequest, setRescheduleRequest] = useState(null);
  const [rescheduleDateTime, setRescheduleDateTime] = useState(null);
  const [rescheduleTechnicianId, setRescheduleTechnicianId] = useState('');
  const [unifiedPage, setUnifiedPage] = useState(1);
  const [unifiedPageSize, setUnifiedPageSize] = useState(10);
  const [assignRequest, setAssignRequest] = useState(null);
  const [assignSelectedTechnician, setAssignSelectedTechnician] = useState(null);
  const [cancelConfirmRequest, setCancelConfirmRequest] = useState(null);
  const [filterServiceTypes, setFilterServiceTypes] = useState([]);
  const [filterSeasons, setFilterSeasons] = useState([]);
  const [filterScheduledStartDate, setFilterScheduledStartDate] = useState(null);
  const [filterScheduledEndDate, setFilterScheduledEndDate] = useState(null);
  const [filterTechnicianIds, setFilterTechnicianIds] = useState([]);
  const [filterClientIds, setFilterClientIds] = useState([]);
  const [filterStatuses, setFilterStatuses] = useState([]);
  const [workReportRequest, setWorkReportRequest] = useState(null);

  // Check URL params for actions
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'new') {
      setFormMode('edit');
      setIsOpeningForm(false);
      setIsViewActionDelayActive(false);
      setShowForm(true);
    }
    if (params.get('id')) {

      // TODO: Load and show specific request
    }}, []);

  useEffect(() => {
    return () => {
      if (openingTimerRef.current) clearTimeout(openingTimerRef.current);
      if (viewDelayTimerRef.current) clearTimeout(viewDelayTimerRef.current);
    };
  }, []);

  /** Requests + cancelled count load together; tables do not wait on full client list. */
  const {
    data: requestsBundle,
    isPending: isPendingRequestsPage,
  } = useQuery({
    queryKey: ['serviceRequests', 'listForRequestsPage', 500],
    queryFn: () => serviceRequestService.listActiveWithCancelledCount(500),
  });
  const requests = requestsBundle?.requests ?? [];
  const cancelledCount = requestsBundle?.cancelledCount ?? 0;
  /** Total completed in DB (not limited to the 500-row active snapshot used for main tables). */
  const completedCountTotal = requestsBundle?.completedCount ?? 0;

  /** Narrow client fetch for metrics + notification emails only (full list loads in the form). */
  const {
    data: clientsData,
    isPending: isPendingClients,
  } = useQuery({
    queryKey: ['clients', 'serviceRequestsPage'],
    queryFn: () => clientService.listMinimalForServiceRequestsPage(),
  });
  const clients = clientsData ?? [];

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians', 'active', 'forSelection'],
    queryFn: () => technicianService.listActiveForSelection()
  });
  /** Match AdminDashboard metric inputs to keep "Unscheduled" count consistent across pages. */
  const { data: metricRequests = [] } = useQuery({
    queryKey: ['serviceRequests', 'metricsList100'],
    queryFn: () => serviceRequestService.list('created_at', 'desc', 100),
  });
  const { data: metricClients = [] } = useQuery({
    queryKey: ['clients', 'metricsFullList'],
    queryFn: () => clientService.list(),
  });
  const { data: techniciansForAssign = [], isLoading: isLoadingTechniciansForAssign } = useQuery({
    queryKey: ['technicians', 'forAssignDialog', 'forSelection'],
    queryFn: () => technicianService.listForSelection(),
    enabled: !!assignRequest,
  });

  const overdueListBase = useMemo(
    () =>
      [...requests]
        .filter((r) => isRequestStateOverdue(r))
        .sort(sortRequestsByDateAsc),
    [requests]
  );

  const openListBase = useMemo(
    () =>
      [...requests]
        .filter((r) => !CLOSED_STATUSES.includes(r.status) && !isRequestStateOverdue(r))
        .sort(sortRequestsByDateAsc),
    [requests]
  );

  const {
    data: cancelledRowsFull = [],
  } = useQuery({
    queryKey: ['serviceRequests', 'cancelledRows', 500],
    queryFn: () => serviceRequestService.listCancelled(500),
    enabled: true,
  });

  const allActiveCombinedList = useMemo(
    () => {
      const byId = new Map();
      [...requests, ...cancelledRowsFull].forEach((r) => {
        if (!r?.id) return;
        byId.set(String(r.id), r);
      });
      return [...byId.values()].sort(sortRequestsByDateAsc);
    },
    [requests, cancelledRowsFull]
  );

  const unifiedFilteredList = useMemo(
    () =>
      allActiveCombinedList
        .filter((r) => {
          if (filterServiceTypes.length === 0) return true;
          return filterServiceTypes.some((value) => requestMatchesServiceTypeFilter(r, value));
        })
        .filter((r) => {
          if (filterSeasons.length === 0) return true;
          return filterSeasons.some((value) => requestMatchesSeasonFilter(r, value));
        })
        .filter((r) => {
          if (filterTechnicianIds.length === 0) return true;
          if (!r.assigned_technician_id) return filterTechnicianIds.includes('unassigned');
          return filterTechnicianIds.includes(String(r.assigned_technician_id));
        })
        .filter((r) => {
          if (filterClientIds.length === 0) return true;
          return filterClientIds.includes(String(r.client_id));
        })
        .filter((r) => {
          if (filterStatuses.length === 0) return true;
          return filterStatuses.includes(getRequestStatusFilterBucket(r));
        })
        .filter((r) => {
          if (!filterScheduledStartDate && !filterScheduledEndDate) return true;
          const d = getScheduledInstantForDateRangeFilter(r);
          if (!d) return false;
          if (filterScheduledStartDate && filterScheduledEndDate) {
            const sd = startOfDay(filterScheduledStartDate);
            const ed = startOfDay(filterScheduledEndDate);
            const from = isBefore(ed, sd) ? startOfDay(filterScheduledEndDate) : startOfDay(filterScheduledStartDate);
            const to = isBefore(ed, sd) ? endOfDay(filterScheduledStartDate) : endOfDay(filterScheduledEndDate);
            return d >= from && d <= to;
          }
          if (filterScheduledStartDate) return d >= startOfDay(filterScheduledStartDate);
          return d <= endOfDay(filterScheduledEndDate);
        })
        .sort((a, b) => getScheduledSortTimeMs(b) - getScheduledSortTimeMs(a)),
    [
      allActiveCombinedList,
      filterClientIds,
      filterSeasons,
      filterScheduledEndDate,
      filterScheduledStartDate,
      filterServiceTypes,
      filterStatuses,
      filterTechnicianIds,
    ]
  );

  const unifiedTotal = unifiedFilteredList.length;
  const unifiedTotalPages = Math.max(1, Math.ceil(unifiedTotal / unifiedPageSize) || 1);

  const unifiedRequests = useMemo(() => {
    const from = (unifiedPage - 1) * unifiedPageSize;
    return unifiedFilteredList.slice(from, from + unifiedPageSize);
  }, [unifiedFilteredList, unifiedPage, unifiedPageSize]);

  useEffect(() => {
    if (unifiedPage > unifiedTotalPages) setUnifiedPage(unifiedTotalPages);
  }, [unifiedPage, unifiedTotalPages]);

  useEffect(() => {
    setUnifiedPage(1);
  }, [unifiedPageSize]);

  useEffect(() => {
    setUnifiedPage(1);
  }, [filterServiceTypes, filterSeasons, filterScheduledStartDate, filterScheduledEndDate, filterTechnicianIds, filterClientIds, filterStatuses]);

  const toggleTechnicianInFilter = (setIds, techId) => {
    setIds((prev) => (prev.includes(techId) ? prev.filter((id) => id !== techId) : [...prev, techId]));
  };

  const toggleValueInFilter = (setValues, value) => {
    setValues((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const clientFilterOptions = useMemo(() => {
    const map = new Map();
    allActiveCombinedList.forEach((r) => {
      const id = r?.client_id;
      if (!id) return;
      const key = String(id);
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          label: r?.client_name?.trim() || `Client ${key}`,
        });
      }
    });
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [allActiveCombinedList]);

  const { data: workReportsForRequest = [], isLoading: isLoadingWorkReportsForRequest } = useQuery({
    queryKey: ['workReports', 'byServiceRequest', workReportRequest?.id ?? null],
    queryFn: () => workReportService.getByServiceRequestId(workReportRequest.id),
    enabled: !!workReportRequest?.id,
  });
  const selectedWorkReport = workReportsForRequest[0] ?? null;

  const unifiedRangeStart = unifiedTotal === 0 ? 0 : (unifiedPage - 1) * unifiedPageSize + 1;
  const unifiedRangeEnd = Math.min(unifiedPage * unifiedPageSize, unifiedTotal);

  const pageBlockingLoad = isPendingRequestsPage;

  const createMutation = useMutation({
    mutationFn: (data) => serviceRequestService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
      queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
      if (openingTimerRef.current) clearTimeout(openingTimerRef.current);
      if (viewDelayTimerRef.current) clearTimeout(viewDelayTimerRef.current);
      setShowForm(false);
      setSelectedRequest(null);
      setFormMode('edit');
      setIsOpeningForm(false);
      setIsViewActionDelayActive(false);
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
      if (openingTimerRef.current) clearTimeout(openingTimerRef.current);
      if (viewDelayTimerRef.current) clearTimeout(viewDelayTimerRef.current);
      setShowForm(false);
      setSelectedRequest(null);
      setFormMode('edit');
      setIsOpeningForm(false);
      setIsViewActionDelayActive(false);
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
    if (openingTimerRef.current) clearTimeout(openingTimerRef.current);
    if (viewDelayTimerRef.current) clearTimeout(viewDelayTimerRef.current);
    const statusKey = String(request?.status || '').toLowerCase();
    if (statusKey === 'completed') {
      setWorkReportRequest(request);
      return;
    }
    const isCancelled = statusKey === 'cancelled' || String(request?.is_cancelled || '').toUpperCase() === 'T';
    const isViewOnly = statusKey === 'completed' || isCancelled;
    setFormMode(isViewOnly ? 'view' : 'edit');
    setIsOpeningForm(true);
    setIsViewActionDelayActive(isViewOnly);
    setSelectedRequest(request);
    setShowForm(true);
    openingTimerRef.current = setTimeout(() => setIsOpeningForm(false), 450);
    if (isViewOnly) {
      viewDelayTimerRef.current = setTimeout(() => setIsViewActionDelayActive(false), 3000);
    }
  };

  const handleReschedule = (request) => {
    setRescheduleRequest(request);
    const initial = request.scheduled_end_time || request.scheduled_start_time || request.scheduled_date;
    setRescheduleDateTime(initial ? new Date(initial) : new Date());
    setRescheduleTechnicianId(request.assigned_technician_id ? String(request.assigned_technician_id) : '');
    setShowRescheduleDialog(true);
  };

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
      setAssignSelectedTechnician(null);
      toast.success('Technician assigned successfully');
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to assign technician');
    },
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
      void queryClient.invalidateQueries({ queryKey: ['serviceRequests', 'cancelledRows'] });
      setCancelConfirmRequest(null);
      toast.success('Request cancelled');
      if (selectedRequest && String(selectedRequest.id) === String(request.id)) {
        if (openingTimerRef.current) clearTimeout(openingTimerRef.current);
        if (viewDelayTimerRef.current) clearTimeout(viewDelayTimerRef.current);
        setShowForm(false);
        setSelectedRequest(null);
        setFormMode('edit');
        setIsOpeningForm(false);
        setIsViewActionDelayActive(false);
      }
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to cancel request');
    },
  });

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
    }
  });

  const getScheduledDateRef = (request) =>
    request.scheduled_start_time || request.scheduled_end_time || request.scheduled_date || null;

  const canShowAssignTechnician = (request) =>
    !CLOSED_STATUSES.includes(request.status) && !request.assigned_technician_id;

  const getDateTimeTone = (request) => {
    const closed = ['completed', 'approved', 'closed'].includes(request.status);
    if (isRequestStateOverdue(request)) return 'text-[#A32D2D]';
    if (closed) return 'text-[#3B6D11]';
    if (request.status === 'scheduled' || request.status === 'assigned') return 'text-[#534AB7]';
    if (request.status === 'in_progress') return 'text-[#185FA5]';
    return 'text-[#BA7517]';
  };

  /** Due date column: always show date + time (date-only values display as midnight local). */
  const formatDueDateTime = (dateRef) => {
    if (!dateRef) return '—';
    const dt = new Date(dateRef);
    if (Number.isNaN(dt.getTime())) return '—';
    return format(dt, TABLE_DATE_DISPLAY_FORMAT);
  };

  const formatScheduledStartDateTime = (dateRef) => {
    if (!dateRef) return '—';
    return format(new Date(dateRef), TABLE_DATE_DISPLAY_FORMAT);
  };

  const metrics = useMemo(() => {
    const clientIdsWithScheduledOrCompleted = new Set(
      metricRequests
        .filter((r) => ['scheduled', 'completed'].includes(r.status) && r.client_id != null)
        .map((r) => String(r.client_id))
    );

    const unscheduled = metricClients
      .filter((c) => {
        const lat = c.location?.lat ?? c.latitude;
        const lng = c.location?.lng ?? c.longitude;
        return lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));
      })
      .filter((c) => !clientIdsWithScheduledOrCompleted.has(String(c.id))).length;

    return {
      open: openListBase.length,
      overduePending: overdueListBase.length,
      unscheduled,
    };
  }, [metricRequests, metricClients, openListBase, overdueListBase]);

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col gap-4 overflow-hidden">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Service Requests</h1>
          <p className="mt-1 text-gray-500">
            Review, reschedule, and manage active service requests. Overdue and open tables include unassigned requests, earliest date first; use each section&apos;s filters independently.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
              void queryClient.invalidateQueries({ queryKey: ['clients', 'serviceRequestsPage'] });
            }}
            className="h-9 w-9 border-primary/30 text-primary hover:bg-primary/10"
            aria-label="Refresh requests"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => {
              setFormMode('edit');
              setIsOpeningForm(false);
              setIsViewActionDelayActive(false);
              setShowForm(true);
            }}
            className="h-9"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New Request
          </Button>
        </div>
      </div>

      {pageBlockingLoad ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <LoadingSpinner size="lg" text="Loading requests..." />
        </div>
      ) : (
        <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_210px] lg:items-stretch">
          <div className="flex min-h-0 flex-col gap-4">
            <div className="shrink-0 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
              <div className="flex flex-col rounded-md border border-black/10 bg-white px-2.5 py-1.5">
              <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#888780]">
                <span>Open requests</span>
                <FileText className="h-3 w-3 text-[#534AB7]" />
              </div>
              <div className="text-[19px] font-medium text-[#534AB7]">{metrics.open}</div>
            </div>
            <div className="flex flex-col rounded-md border border-black/10 bg-white px-2.5 py-1.5">
              <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#888780]">
                <span>Overdue / pending</span>
                <AlertTriangle className="h-3 w-3 text-[#A32D2D]" />
              </div>
              <div className="text-[19px] font-medium text-[#A32D2D]">{metrics.overduePending}</div>
            </div>
            <div className="flex flex-col rounded-md border border-black/10 bg-white px-2.5 py-1.5">
              <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#888780]">
                <span>Completed</span>
                <CheckCircle className="h-3 w-3 text-[#1D9E75]" />
              </div>
              <div className="text-[19px] font-medium text-[#0F6E56]">{completedCountTotal}</div>
            </div>
            <div className="flex flex-col rounded-md border border-black/10 bg-white px-2.5 py-1.5">
              <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#888780]">
                <span>Unscheduled</span>
                <Clock3 className="h-3 w-3 text-[#BA7517]" />
              </div>
              <div className="text-[19px] font-medium text-[#BA7517]">
                {isPendingClients ? '—' : metrics.unscheduled}
              </div>
            </div>
            <div className="flex flex-col rounded-md border border-black/10 bg-white px-2.5 py-1.5">
              <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#888780]">
                <span>Cancelled requests</span>
                <Ban className="h-3 w-3 text-[#78716C]" />
              </div>
              <div className="text-[19px] font-medium text-[#57534E]">{cancelledCount}</div>
            </div>
          </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-black/10 bg-white">
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                  <table className="w-full table-fixed border-collapse text-xs sm:text-sm">
                  {REQUEST_TABLE_COLGROUP}
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#f8f8f7]">
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Client</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Service type</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Season</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Scheduled date</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Technician</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Status</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">State</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unifiedTotal === 0 ? (
                      <tr>
                        <td colSpan={8} className="h-[320px] px-3.5 py-6 align-middle text-center text-xs text-[#888780]">No matching requests.</td>
                      </tr>
                    ) : unifiedRequests.map((request) => (
                      <tr key={request.id} className="border-b border-black/10 last:border-b-0">
                        <td className="px-2 py-2 font-medium text-gray-900 sm:px-3.5">{request.client_name || '-'}</td>
                        <td className="px-2 py-2 text-black sm:px-3.5">{request.issue_category}</td>
                        <td className="px-2 py-2 text-gray-800 sm:px-3.5">{request.season}</td>
                        <td className={`px-2 py-2 font-medium sm:px-3.5 ${getDateTimeTone(request)}`}>
                          {formatScheduledStartDateTime(getScheduledDateRef(request))}
                        </td>
                        <td className="px-2 py-2 text-gray-800 sm:px-3.5">{request.assigned_technician_name || 'Unassigned'}</td>
                        <td className="px-2 py-2 sm:px-3.5">
                          {(() => {
                            const statusMeta = getRequestStatusBadgeMeta(request);
                            return (
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                                  statusMeta.className
                                )}
                              >
                                {statusMeta.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-2 py-2 sm:px-3.5">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                              getStateBadgeClass(request)
                            )}
                          >
                            {formatStateLabel(request)}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-left sm:px-3.5">
                          <ServiceRequestRowActions
                            request={request}
                            showReschedule
                            onEdit={handleEdit}
                            onAssign={setAssignRequest}
                            onReschedule={handleReschedule}
                            canAssign={canShowAssignTechnician(request)}
                            onOpenCancelConfirm={setCancelConfirmRequest}
                            cancelBusy={cancelRequestMutation.isPending}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
                <div className="mt-auto flex flex-col gap-2 border-t border-black/10 bg-[#fafaf9] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-gray-600">
                    Showing{' '}
                    <span className="font-medium text-gray-900">
                      {unifiedRangeStart.toLocaleString()}–{unifiedRangeEnd.toLocaleString()}
                    </span>{' '}
                    of <span className="font-medium text-gray-900">{unifiedTotal.toLocaleString()}</span>
                  </p>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Select
                      value={String(unifiedPageSize)}
                      onValueChange={(v) => setUnifiedPageSize(Number(v))}
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
                        disabled={unifiedTotal === 0 || unifiedPage <= 1}
                        onClick={() => setUnifiedPage((p) => Math.max(1, p - 1))}
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="min-w-[7rem] px-2 text-center text-sm text-gray-700 tabular-nums">
                        Page {unifiedPage} / {unifiedTotalPages}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 border-primary/30"
                        disabled={unifiedTotal === 0 || unifiedPage >= unifiedTotalPages}
                        onClick={() => setUnifiedPage((p) => Math.min(unifiedTotalPages, p + 1))}
                        aria-label="Next page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="lg:sticky lg:top-0 lg:h-full">
            <div className="h-full rounded-lg border border-black/10 bg-white p-2.5 sm:p-3">
              <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.06em] text-[#888780]">Filters</div>
              <div className="grid grid-cols-1 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-[#888780]">Service Type</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" className="h-8 w-full justify-between border-primary/30 text-sm">
                        <span className="truncate">{filterServiceTypes.length > 0 ? `${filterServiceTypes.length} selected` : 'All service types'}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuLabel>Select service types</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {SERVICE_TYPE_FILTER_OPTIONS.filter((o) => o.value !== 'all').map((o) => (
                        <DropdownMenuCheckboxItem
                          key={o.value}
                          checked={filterServiceTypes.includes(o.value)}
                          onCheckedChange={() => toggleValueInFilter(setFilterServiceTypes, o.value)}
                          onSelect={(e) => e.preventDefault()}
                        >
                          {o.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-[#888780]">Season</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" className="h-8 w-full justify-between border-primary/30 text-sm">
                        <span className="truncate">{filterSeasons.length > 0 ? `${filterSeasons.length} selected` : 'All seasons'}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Select seasons</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {SEASON_FILTER_OPTIONS.filter((o) => o.value !== 'all').map((o) => (
                        <DropdownMenuCheckboxItem
                          key={o.value}
                          checked={filterSeasons.includes(o.value)}
                          onCheckedChange={() => toggleValueInFilter(setFilterSeasons, o.value)}
                          onSelect={(e) => e.preventDefault()}
                        >
                          {o.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-[#888780]">Schedule Start Date</Label>
                  <DateOnlyPicker
                    date={filterScheduledStartDate}
                    onDateChange={setFilterScheduledStartDate}
                    placeholder="Schedule Start Date"
                    ariaLabel="Filter by schedule start date"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-[#888780]">Schedule End Date</Label>
                  <DateOnlyPicker
                    date={filterScheduledEndDate}
                    onDateChange={setFilterScheduledEndDate}
                    placeholder="Schedule End Date"
                    ariaLabel="Filter by schedule end date"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-[#888780]">Client</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" className="h-8 w-full justify-between border-primary/30 text-sm">
                        <span className="truncate">{filterClientIds.length > 0 ? `${filterClientIds.length} selected` : 'All clients'}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuLabel>Filter clients</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {clientFilterOptions.length === 0 ? (
                        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">No clients</DropdownMenuLabel>
                      ) : (
                        clientFilterOptions.map((client) => (
                          <DropdownMenuCheckboxItem
                            key={client.id}
                            checked={filterClientIds.includes(client.id)}
                            onCheckedChange={() => toggleValueInFilter(setFilterClientIds, client.id)}
                            onSelect={(e) => e.preventDefault()}
                          >
                            {client.label}
                          </DropdownMenuCheckboxItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-[#888780]">Technician</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" className="h-8 w-full justify-between border-primary/30 text-sm">
                        <span className="truncate">{filterTechnicianIds.length > 0 ? `${filterTechnicianIds.length} selected` : 'All technicians'}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Filter technicians</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={filterTechnicianIds.includes('unassigned')}
                        onCheckedChange={() => toggleTechnicianInFilter(setFilterTechnicianIds, 'unassigned')}
                        onSelect={(e) => e.preventDefault()}
                      >
                        Unassigned
                      </DropdownMenuCheckboxItem>
                      {technicians.length > 0 ? <DropdownMenuSeparator /> : null}
                      {technicians.length === 0 ? (
                        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">No active technicians</DropdownMenuLabel>
                      ) : (
                        technicians.map((tech) => {
                          const techId = String(tech.id);
                          return (
                            <DropdownMenuCheckboxItem
                              key={techId}
                              checked={filterTechnicianIds.includes(techId)}
                              onCheckedChange={() => toggleTechnicianInFilter(setFilterTechnicianIds, techId)}
                              onSelect={(e) => e.preventDefault()}
                            >
                              {tech.name}
                            </DropdownMenuCheckboxItem>
                          );
                        })
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-[#888780]">Status</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" className="h-8 w-full justify-between border-primary/30 text-sm">
                        <span className="truncate">{filterStatuses.length > 0 ? `${filterStatuses.length} selected` : 'All status'}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Select status</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={filterStatuses.includes('scheduled')}
                        onCheckedChange={() => toggleValueInFilter(setFilterStatuses, 'scheduled')}
                        onSelect={(e) => e.preventDefault()}
                      >
                        Scheduled
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={filterStatuses.includes('in_progress')}
                        onCheckedChange={() => toggleValueInFilter(setFilterStatuses, 'in_progress')}
                        onSelect={(e) => e.preventDefault()}
                      >
                        In Progress
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={filterStatuses.includes('completed')}
                        onCheckedChange={() => toggleValueInFilter(setFilterStatuses, 'completed')}
                        onSelect={(e) => e.preventDefault()}
                      >
                        Completed
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={filterStatuses.includes('cancelled')}
                        onCheckedChange={() => toggleValueInFilter(setFilterStatuses, 'cancelled')}
                        onSelect={(e) => e.preventDefault()}
                      >
                        Cancelled
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form Dialog */}
      <Dialog data-source-location="pages/ServiceRequests:454:6" data-dynamic-content="true" open={showForm} onOpenChange={(open) => {
        setShowForm(open);
        if (!open) {
          if (openingTimerRef.current) clearTimeout(openingTimerRef.current);
          if (viewDelayTimerRef.current) clearTimeout(viewDelayTimerRef.current);
          setSelectedRequest(null);
          setFormMode('edit');
          setIsOpeningForm(false);
          setIsViewActionDelayActive(false);
        }
      }}>
        <DialogContent
          data-source-location="pages/ServiceRequests:458:8"
          data-dynamic-content="true"
          className="max-w-6xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <DialogHeader data-source-location="pages/ServiceRequests:459:10" data-dynamic-content="true">
            <DialogTitle data-source-location="pages/ServiceRequests:460:12" data-dynamic-content="true">
              {selectedRequest ? (formMode === 'view' ? 'View Service Request' : 'Edit Service Request') : 'New Service Request'}
            </DialogTitle>
            <DialogDescription data-source-location="pages/ServiceRequests:463:12" data-dynamic-content="true">
              {selectedRequest
                ? (formMode === 'view'
                  ? ''
                  : 'Update the service request details below')
                : 'Fill in the details for the new service request'}
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
              data-source-location="pages/ServiceRequests:467:10"
              data-dynamic-content="false"
              key={`${selectedRequest ? String(selectedRequest.id) : 'new'}-${formMode}`}
              request={selectedRequest}
              readOnly={formMode === 'view'}
              showEditInReadOnly={formMode === 'view'}
              onEditRequest={() => setFormMode('edit')}
              actionsDisabled={isViewActionDelayActive}
              onSubmit={handleSubmit}
              onCancel={() => {
                if (openingTimerRef.current) clearTimeout(openingTimerRef.current);
                if (viewDelayTimerRef.current) clearTimeout(viewDelayTimerRef.current);
                setShowForm(false);
                setSelectedRequest(null);
                setFormMode('edit');
                setIsOpeningForm(false);
                setIsViewActionDelayActive(false);
              }}
            />
          )}

        </DialogContent>
      </Dialog>

      <Dialog
        open={!!assignRequest}
        onOpenChange={(open) => {
          if (!open) {
            setAssignRequest(null);
            setAssignSelectedTechnician(null);
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Assign technician</DialogTitle>
            <DialogDescription>
              {assignRequest && (
                <>
                  Choose a technician for #{assignRequest.request_number || assignRequest.id} —{' '}
                  {assignRequest.client_name || 'Client'}, then click Save.
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
              techniciansForAssign.map((tech) => {
                const isSelected =
                  assignSelectedTechnician &&
                  String(assignSelectedTechnician.id) === String(tech.id);
                return (
                  <button
                    key={tech.id}
                    type="button"
                    className={cn(
                      'w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                      'bg-card hover:bg-muted/50',
                      isSelected && 'border-primary bg-primary/5 ring-1 ring-primary/30'
                    )}
                    onClick={() => setAssignSelectedTechnician(tech)}
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
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900">{tech.name}</p>
                      <p className="truncate text-xs text-gray-500">{tech.employee_id || tech.email}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <div className="mt-3 flex shrink-0 flex-wrap justify-end gap-2 border-t border-black/10 pt-3">
            <Button
              type="button"
              variant="outline"
              disabled={assignTechnicianMutation.isPending}
              onClick={() => {
                setAssignRequest(null);
                setAssignSelectedTechnician(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                !assignRequest || !assignSelectedTechnician || assignTechnicianMutation.isPending
              }
              onClick={() => {
                if (!assignRequest || !assignSelectedTechnician) return;
                assignTechnicianMutation.mutate({
                  request: assignRequest,
                  technician: assignSelectedTechnician,
                });
              }}
            >
              {assignTechnicianMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
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
        <DialogContent className="max-w-md outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0">
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
              <Select modal={false} value={rescheduleTechnicianId} onValueChange={setRescheduleTechnicianId}>
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

      <Dialog
        open={!!workReportRequest}
        onOpenChange={(open) => {
          if (!open) setWorkReportRequest(null);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {isLoadingWorkReportsForRequest ? (
            <div className="py-8">
              <LoadingSpinner size="md" text="Loading work reports..." />
            </div>
          ) : !selectedWorkReport ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  Work Report #{workReportRequest?.request_number || workReportRequest?.id}
                </DialogTitle>
                <DialogDescription>
                  {workReportRequest?.client_name || 'Client'} • No report available
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-md border border-black/10 bg-[#fafaf9] p-4 text-sm text-[#6f6f68]">
                No work reports found for this completed request.
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">
                  Work Report #{selectedWorkReport.request_number || workReportRequest?.request_number || workReportRequest?.id}
                </DialogTitle>
                <DialogDescription>
                  {selectedWorkReport.client_name || workReportRequest?.client_name || 'Client'} • {selectedWorkReport.farm_name || '—'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4 text-sm">
                      <p className="text-gray-500">Check-in</p>
                      <p className="font-medium">
                        {selectedWorkReport.check_in_time
                          ? format(new Date(selectedWorkReport.check_in_time), 'd MMM yyyy • h:mm a')
                          : '-'}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-sm">
                      <p className="text-gray-500">Check-out</p>
                      <p className="font-medium">
                        {selectedWorkReport.check_out_time
                          ? format(new Date(selectedWorkReport.check_out_time), 'd MMM yyyy • h:mm a')
                          : '-'}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 font-medium text-gray-900">
                      <Image className="h-4 w-4" />
                      Before Photos
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedWorkReport.before_photos?.length > 0 ? (
                        selectedWorkReport.before_photos.map((photo, idx) => (
                          <img
                            key={idx}
                            src={photo}
                            alt={`Before ${idx + 1}`}
                            className="h-32 w-full rounded-lg border object-cover"
                          />
                        ))
                      ) : (
                        <p className="col-span-2 text-sm text-gray-500">No before photos</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-2 flex items-center gap-2 font-medium text-gray-900">
                      <Image className="h-4 w-4" />
                      After Photos
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedWorkReport.after_photos?.length > 0 ? (
                        selectedWorkReport.after_photos.map((photo, idx) => (
                          <img
                            key={idx}
                            src={photo}
                            alt={`After ${idx + 1}`}
                            className="h-32 w-full rounded-lg border object-cover"
                          />
                        ))
                      ) : (
                        <p className="col-span-2 text-sm text-gray-500">No after photos</p>
                      )}
                    </div>
                  </div>
                </div>

                {selectedWorkReport.tasks_completed?.length > 0 ? (
                  <div>
                    <h4 className="mb-2 font-medium text-gray-900">Tasks Completed</h4>
                    <div className="space-y-2">
                      {selectedWorkReport.tasks_completed.map((task, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-3 rounded-lg p-3 ${
                            task.completed ? 'bg-green-50' : 'bg-gray-50'
                          }`}
                        >
                          <div
                            className={`flex h-5 w-5 items-center justify-center rounded-full ${
                              task.completed ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                          >
                            {task.completed ? <Check className="h-3 w-3 text-white" /> : null}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{task.task}</p>
                            {task.notes ? <p className="text-sm text-gray-500">{task.notes}</p> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedWorkReport.equipment_used?.length > 0 ? (
                  <div>
                    <h4 className="mb-2 font-medium text-gray-900">Equipment & Materials Used</h4>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                      {selectedWorkReport.equipment_used.map((item, idx) => (
                        <div key={idx} className="rounded-lg bg-gray-50 p-3">
                          <p className="font-medium text-gray-900">{item.name}</p>
                          <p className="text-sm text-gray-500">{item.quantity} {item.unit}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {selectedWorkReport.water_flow_reading ? (
                    <Card>
                      <CardContent className="flex items-center gap-3 p-4">
                        <Droplets className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="text-sm text-gray-500">Water Flow</p>
                          <p className="text-xl font-bold text-gray-900">{selectedWorkReport.water_flow_reading} GPM</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}
                  {selectedWorkReport.pressure_reading ? (
                    <Card>
                      <CardContent className="flex items-center gap-3 p-4">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100">
                          <span className="text-sm font-bold text-orange-600">PSI</span>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Pressure</p>
                          <p className="text-xl font-bold text-gray-900">{selectedWorkReport.pressure_reading} PSI</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}
                </div>

                {selectedWorkReport.work_notes ? (
                  <div>
                    <h4 className="mb-2 font-medium text-gray-900">Work Notes</h4>
                    <p className="rounded-lg bg-gray-50 p-3 text-gray-600">{selectedWorkReport.work_notes}</p>
                  </div>
                ) : null}

                {selectedWorkReport.farmer_signature_url ? (
                  <div>
                    <h4 className="mb-2 font-medium text-gray-900">Farmer Signature</h4>
                    <img
                      src={selectedWorkReport.farmer_signature_url}
                      alt="Signature"
                      className="h-20 rounded-lg border bg-white p-2"
                    />
                  </div>
                ) : null}

                {selectedWorkReport.status === 'rejected' && selectedWorkReport.rejection_reason ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <h4 className="mb-1 font-medium text-red-800">Rejection Reason</h4>
                    <p className="text-red-700">{selectedWorkReport.rejection_reason}</p>
                  </div>
                ) : null}
              </div>
            </>
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
    </div>);

}
