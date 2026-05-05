import React, { useState, useEffect, useMemo } from 'react';
import { serviceRequestService, clientService, technicianService, emailService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, FileText, AlertTriangle, CheckCircle, Clock3, Pencil, Ban, UserRoundCog, CalendarClock, ChevronLeft, ChevronRight, X, Eye } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { endOfDay, format, isBefore, startOfDay, startOfToday } from 'date-fns';
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

const TABLE_COLS_CLASS =
  'table-fixed w-full min-w-[820px] border-collapse text-xs sm:min-w-[880px] sm:text-sm';

/** Service type column: `issue_category` formatted for display. */
function formatIssueCategoryDisplay(request) {
  const raw = request?.issue_category;
  if (raw == null || String(raw).trim() === '') return '—';
  return String(raw).replace(/_/g, ' ');
}

const INITIAL_TABLE_COL_SEARCH = {
  client: '',
  serviceType: '',
  season: '',
  date: '',
  technician: '',
};

const TABLE_DATE_DISPLAY_FORMAT = 'MMM d • h:mm a';
const TABLE_DATE_SEARCH_FORMAT = 'MMMM d • h:mm a';

function getDueDateRefForColumnSearch(request) {
  return request?.scheduled_end_time || request?.scheduled_date || request?.scheduled_start_time || null;
}

function dueDateColumnSearchHaystack(request) {
  const ref = getDueDateRefForColumnSearch(request);
  const parts = [];
  if (ref) {
    const dt = new Date(ref);
    if (!Number.isNaN(dt.getTime())) {
      parts.push(format(dt, TABLE_DATE_DISPLAY_FORMAT));
      parts.push(format(dt, TABLE_DATE_SEARCH_FORMAT));
      parts.push(String(ref));
    }
  }
  if (request?.scheduled_date) parts.push(String(request.scheduled_date));
  return parts;
}

function scheduledStartColumnSearchHaystack(request) {
  const ref = request?.scheduled_start_time || null;
  if (!ref) return [];
  const dt = new Date(ref);
  if (Number.isNaN(dt.getTime())) return [String(ref)];
  return [format(dt, TABLE_DATE_DISPLAY_FORMAT), format(dt, TABLE_DATE_SEARCH_FORMAT), String(ref)];
}

function columnQueryMatchesHaystack(parts, rawQuery) {
  const q = String(rawQuery ?? '').trim().toLowerCase();
  if (!q) return true;
  const hay = parts
    .filter((v) => v != null && String(v).trim() !== '')
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

/** @param {'due'|'scheduled'} dateMode */
function matchesTableColumnSearch(request, s, dateMode) {
  if (!columnQueryMatchesHaystack([request?.client_name || '-'], s.client)) return false;
  if (!columnQueryMatchesHaystack([formatIssueCategoryDisplay(request)], s.serviceType)) return false;
  if (!columnQueryMatchesHaystack([request?.season], s.season)) return false;
  const dateParts = dateMode === 'due' ? dueDateColumnSearchHaystack(request) : scheduledStartColumnSearchHaystack(request);
  if (!columnQueryMatchesHaystack(dateParts, s.date)) return false;
  if (!columnQueryMatchesHaystack([request?.assigned_technician_name || 'Unassigned'], s.technician)) return false;
  return true;
}

/** Column filter field: placeholder mirrors the table header label and typography. */
function TableColSearchInput({ value, onValueChange, ariaLabel, placeholder, variant = 'default', className }) {
  const variantClass =
    variant === 'overdue'
      ? 'border-[#F7C1C1]/60 text-[#292524] placeholder:text-[#A32D2D] placeholder:opacity-90 focus-visible:border-[#A32D2D] focus-visible:ring-[#F7C1C1]'
      : 'border-black/15 text-[#292524] placeholder:text-[#888780]';
  return (
    <Input
      type="search"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={cn(
        'h-8 w-full min-w-0 px-2 py-1 text-xs font-medium shadow-none sm:text-sm',
        variantClass,
        className
      )}
    />
  );
}

const CLOSED_STATUSES = ['completed', 'approved', 'closed'];

/** Same due rule as table styling; mirrors AdminTechnicianJobs-style client filtering. */
function isRequestOverdue(request) {
  if (CLOSED_STATUSES.includes(request.status)) return false;
  const dateRef = request.scheduled_end_time || request.scheduled_date;
  if (!dateRef) return false;
  const d = new Date(dateRef);
  return isBefore(d, startOfToday());
}

const REQUEST_TABLE_COLGROUP = (
  <colgroup>
    <col className="w-[17%]" />
    <col className="w-[15%]" />
    <col className="w-[10%]" />
    <col className="w-[18%]" />
    <col className="w-[15%]" />
    <col className="w-[13%]" />
  </colgroup>
);

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
            "h-9 w-full justify-start border-primary/30 text-left text-sm font-normal sm:w-[180px]",
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
            aria-label="Edit request"
            onClick={() => onEdit(request)}
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
      {canAssign ? (
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
              <Tooltip.Arrow className="fill-popover" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      ) : null}
      {showReschedule ? (
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
              <Tooltip.Arrow className="fill-popover" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      ) : null}
      {showCancel && onOpenCancelConfirm ? (
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
              <Tooltip.Arrow className="fill-popover" />
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
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [rescheduleRequest, setRescheduleRequest] = useState(null);
  const [rescheduleDateTime, setRescheduleDateTime] = useState(null);
  const [rescheduleTechnicianId, setRescheduleTechnicianId] = useState('');
  const [overduePage, setOverduePage] = useState(1);
  const [overduePageSize, setOverduePageSize] = useState(10);
  const [openPage, setOpenPage] = useState(1);
  const [openPageSize, setOpenPageSize] = useState(10);
  const [assignRequest, setAssignRequest] = useState(null);
  const [assignSelectedTechnician, setAssignSelectedTechnician] = useState(null);
  const [cancelConfirmRequest, setCancelConfirmRequest] = useState(null);
  /** Metrics drill-down: table like "All open requests" for completed or cancelled. */
  const [historyPanel, setHistoryPanel] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  /** Read-only detail dialog from completed / cancelled drill-down rows. */
  const [historyViewRequest, setHistoryViewRequest] = useState(null);
  const [overdueColSearch, setOverdueColSearch] = useState(() => ({ ...INITIAL_TABLE_COL_SEARCH }));
  const [openColSearch, setOpenColSearch] = useState(() => ({ ...INITIAL_TABLE_COL_SEARCH }));
  const [historyColSearch, setHistoryColSearch] = useState(() => ({ ...INITIAL_TABLE_COL_SEARCH }));
  const [overdueFilterServiceType, setOverdueFilterServiceType] = useState('all');
  const [overdueFilterSeason, setOverdueFilterSeason] = useState('all');
  const [overdueFilterDateFrom, setOverdueFilterDateFrom] = useState(null);
  const [overdueFilterDateTo, setOverdueFilterDateTo] = useState(null);
  const [overdueFilterTechnicianIds, setOverdueFilterTechnicianIds] = useState([]);
  const [openFilterServiceType, setOpenFilterServiceType] = useState('all');
  const [openFilterSeason, setOpenFilterSeason] = useState('all');
  const [openFilterDateFrom, setOpenFilterDateFrom] = useState(null);
  const [openFilterDateTo, setOpenFilterDateTo] = useState(null);
  const [openFilterTechnicianIds, setOpenFilterTechnicianIds] = useState([]);
  const [historyFilterServiceType, setHistoryFilterServiceType] = useState('all');
  const [historyFilterSeason, setHistoryFilterSeason] = useState('all');

  // Check URL params for actions
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'new') {
      setShowForm(true);
    }
    if (params.get('id')) {

      // TODO: Load and show specific request
    }}, []);

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
    queryKey: ['technicians', 'active'],
    queryFn: () => technicianService.filter({ status: 'active' })
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
    queryKey: ['technicians', 'forAssignDialog'],
    queryFn: () => technicianService.list(),
    enabled: !!assignRequest,
  });

  const overdueListBase = useMemo(
    () =>
      [...requests]
        .filter((r) => isRequestOverdue(r) || r.status === 'pending')
        .sort(sortRequestsByDateAsc),
    [requests]
  );

  const overdueListFull = useMemo(
    () =>
      overdueListBase
        .filter((r) => requestMatchesServiceTypeFilter(r, overdueFilterServiceType))
        .filter((r) => requestMatchesSeasonFilter(r, overdueFilterSeason))
        .filter((r) => {
          if (overdueFilterTechnicianIds.length === 0) return true;
          return overdueFilterTechnicianIds.includes(String(r.assigned_technician_id ?? ''));
        })
        .filter((r) => {
          if (!overdueFilterDateFrom && !overdueFilterDateTo) return true;
          const dateRef = r.scheduled_end_time;
          if (!dateRef) return false;
          const d = new Date(dateRef);
          if (Number.isNaN(d.getTime())) return false;
          if (overdueFilterDateFrom) {
            const from = startOfDay(overdueFilterDateFrom);
            if (d < from) return false;
          }
          if (overdueFilterDateTo) {
            const to = endOfDay(overdueFilterDateTo);
            if (d > to) return false;
          }
          return true;
        }),
    [overdueListBase, overdueFilterServiceType, overdueFilterSeason, overdueFilterDateFrom, overdueFilterDateTo, overdueFilterTechnicianIds]
  );

  const openListBase = useMemo(
    () =>
      [...requests]
        .filter((r) => !CLOSED_STATUSES.includes(r.status) && !isRequestOverdue(r))
        .sort(sortRequestsByDateAsc),
    [requests]
  );

  const openListFull = useMemo(
    () =>
      openListBase
        .filter((r) => requestMatchesServiceTypeFilter(r, openFilterServiceType))
        .filter((r) => requestMatchesSeasonFilter(r, openFilterSeason))
        .filter((r) => {
          if (openFilterTechnicianIds.length === 0) return true;
          return openFilterTechnicianIds.includes(String(r.assigned_technician_id ?? ''));
        })
        .filter((r) => {
          if (!openFilterDateFrom && !openFilterDateTo) return true;
          const dateRef = r.scheduled_start_time;
          if (!dateRef) return false;
          const d = new Date(dateRef);
          if (Number.isNaN(d.getTime())) return false;
          if (openFilterDateFrom) {
            const from = startOfDay(openFilterDateFrom);
            if (d < from) return false;
          }
          if (openFilterDateTo) {
            const to = endOfDay(openFilterDateTo);
            if (d > to) return false;
          }
          return true;
        }),
    [openListBase, openFilterServiceType, openFilterSeason, openFilterDateFrom, openFilterDateTo, openFilterTechnicianIds]
  );

  const {
    data: completedRowsFull = [],
    isFetching: isFetchingCompletedRows,
  } = useQuery({
    queryKey: ['serviceRequests', 'completedRows', 500],
    queryFn: () => serviceRequestService.listCompleted(500),
    enabled: historyPanel === 'completed',
  });

  const {
    data: cancelledRowsFull = [],
    isFetching: isFetchingCancelledRows,
  } = useQuery({
    queryKey: ['serviceRequests', 'cancelledRows', 500],
    queryFn: () => serviceRequestService.listCancelled(500),
    enabled: historyPanel === 'cancelled',
  });

  const historySourceList = useMemo(() => {
    if (historyPanel === 'completed') return completedRowsFull;
    if (historyPanel === 'cancelled') return cancelledRowsFull;
    return [];
  }, [historyPanel, completedRowsFull, cancelledRowsFull]);

  const historyFilteredList = useMemo(() => {
    return historySourceList
      .filter((r) => requestMatchesServiceTypeFilter(r, historyFilterServiceType))
      .filter((r) => requestMatchesSeasonFilter(r, historyFilterSeason))
      .filter((r) => matchesTableColumnSearch(r, historyColSearch, 'scheduled'))
      .sort(sortRequestsByDateAsc);
  }, [historySourceList, historyFilterServiceType, historyFilterSeason, historyColSearch]);

  const historyTotal = historyFilteredList.length;
  const historyTotalPages = Math.max(1, Math.ceil(historyTotal / historyPageSize) || 1);

  const historyPagedList = useMemo(() => {
    const from = (historyPage - 1) * historyPageSize;
    return historyFilteredList.slice(from, from + historyPageSize);
  }, [historyFilteredList, historyPage, historyPageSize]);

  const historyRangeStart = historyTotal === 0 ? 0 : (historyPage - 1) * historyPageSize + 1;
  const historyRangeEnd = Math.min(historyPage * historyPageSize, historyTotal);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyPanel, historyPageSize, historyColSearch, historyFilterServiceType, historyFilterSeason]);

  useEffect(() => {
    setHistoryFilterServiceType('all');
    setHistoryFilterSeason('all');
  }, [historyPanel]);

  useEffect(() => {
    setHistoryColSearch({ ...INITIAL_TABLE_COL_SEARCH });
  }, [historyPanel]);

  useEffect(() => {
    if (historyPage > historyTotalPages) setHistoryPage(historyTotalPages);
  }, [historyPage, historyTotalPages]);

  const overdueListFiltered = useMemo(
    () => overdueListFull.filter((r) => matchesTableColumnSearch(r, overdueColSearch, 'due')),
    [overdueListFull, overdueColSearch]
  );
  const openListFiltered = useMemo(
    () => openListFull.filter((r) => matchesTableColumnSearch(r, openColSearch, 'scheduled')),
    [openListFull, openColSearch]
  );

  const overdueTotal = overdueListFiltered.length;
  const openTotal = openListFiltered.length;

  const overdueRequests = useMemo(() => {
    const from = (overduePage - 1) * overduePageSize;
    return overdueListFiltered.slice(from, from + overduePageSize);
  }, [overdueListFiltered, overduePage, overduePageSize]);

  const openRequests = useMemo(() => {
    const from = (openPage - 1) * openPageSize;
    return openListFiltered.slice(from, from + openPageSize);
  }, [openListFiltered, openPage, openPageSize]);

  const overdueTotalPages = Math.max(1, Math.ceil(overdueTotal / overduePageSize) || 1);
  const openTotalPages = Math.max(1, Math.ceil(openTotal / openPageSize) || 1);

  useEffect(() => {
    if (overduePage > overdueTotalPages) setOverduePage(overdueTotalPages);
  }, [overduePage, overdueTotalPages]);

  useEffect(() => {
    setOverduePage(1);
  }, [overduePageSize]);

  useEffect(() => {
    if (openPage > openTotalPages) setOpenPage(openTotalPages);
  }, [openPage, openTotalPages]);

  useEffect(() => {
    setOpenPage(1);
  }, [openPageSize]);

  useEffect(() => {
    setOverduePage(1);
  }, [overdueFilterServiceType, overdueFilterSeason, overdueFilterDateFrom, overdueFilterDateTo, overdueFilterTechnicianIds, overdueColSearch]);

  useEffect(() => {
    setOpenPage(1);
  }, [openFilterServiceType, openFilterSeason, openFilterDateFrom, openFilterDateTo, openFilterTechnicianIds, openColSearch]);

  const toggleTechnicianInFilter = (setIds, techId) => {
    setIds((prev) => (prev.includes(techId) ? prev.filter((id) => id !== techId) : [...prev, techId]));
  };

  const overdueRangeStart = overdueTotal === 0 ? 0 : (overduePage - 1) * overduePageSize + 1;
  const overdueRangeEnd = Math.min(overduePage * overduePageSize, overdueTotal);
  const openRangeStart = openTotal === 0 ? 0 : (openPage - 1) * openPageSize + 1;
  const openRangeEnd = Math.min(openPage * openPageSize, openTotal);

  const pageBlockingLoad = isPendingRequestsPage;

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
        setShowForm(false);
        setSelectedRequest(null);
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

  const isOverdue = (request) => isRequestOverdue(request);

  const getDueDateRef = (request) =>
    request.scheduled_end_time || request.scheduled_date || request.scheduled_start_time || null;

  const getScheduledDateRef = (request) =>
    request.scheduled_start_time || null;

  const canShowAssignTechnician = (request) =>
    !CLOSED_STATUSES.includes(request.status) && !request.assigned_technician_id;

  const getDateTimeTone = (request) => {
    const closed = ['completed', 'approved', 'closed'].includes(request.status);
    if (isOverdue(request) || request.status === 'pending') return 'text-[#A32D2D]';
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
    <div className="space-y-4">
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
          <Button onClick={() => setShowForm(true)} className="h-9">
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
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
                <span>Completed</span>
                <CheckCircle className="h-3.5 w-3.5 text-[#1D9E75]" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[22px] font-medium text-[#0F6E56]">{completedCountTotal}</div>
                <Button
                  type="button"
                  variant={historyPanel === 'completed' ? 'outline' : 'default'}
                  size="sm"
                  className={
                    historyPanel === 'completed'
                      ? 'h-7 shrink-0 border-primary/30 px-2 text-[11px] font-medium text-primary hover:bg-primary/10'
                      : 'h-7 shrink-0 bg-primary px-2 text-[11px] font-medium text-primary-foreground hover:bg-primary/90'
                  }
                  disabled={completedCountTotal === 0}
                  onClick={() => {
                    setHistoryPanel((p) => (p === 'completed' ? null : 'completed'));
                    setHistoryPage(1);
                  }}
                >
                  {historyPanel === 'completed' ? 'Hide details' : 'View details'}
                </Button>
              </div>
            </div>
            <div className="rounded-md border border-black/10 bg-white px-3 py-2.5">
              <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#888780]">
                <span>Unscheduled</span>
                <Clock3 className="h-3.5 w-3.5 text-[#BA7517]" />
              </div>
              <div className="text-[22px] font-medium text-[#BA7517]">
                {isPendingClients ? '—' : metrics.unscheduled}
              </div>
            </div>
            <div className="rounded-md border border-black/10 bg-white px-3 py-2.5">
              <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#888780]">
                <span>Cancelled requests</span>
                <Ban className="h-3.5 w-3.5 text-[#78716C]" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[22px] font-medium text-[#57534E]">{cancelledCount}</div>
                <Button
                  type="button"
                  variant={historyPanel === 'cancelled' ? 'outline' : 'default'}
                  size="sm"
                  className={
                    historyPanel === 'cancelled'
                      ? 'h-7 shrink-0 border-primary/30 px-2 text-[11px] font-medium text-primary hover:bg-primary/10'
                      : 'h-7 shrink-0 bg-primary px-2 text-[11px] font-medium text-primary-foreground hover:bg-primary/90'
                  }
                  disabled={cancelledCount === 0}
                  onClick={() => {
                    setHistoryPanel((p) => (p === 'cancelled' ? null : 'cancelled'));
                    setHistoryPage(1);
                  }}
                >
                  {historyPanel === 'cancelled' ? 'Hide details' : 'View details'}
                </Button>
              </div>
            </div>
          </div>

          {historyPanel ? (
            <div className="overflow-hidden rounded-lg border border-black/10 bg-white">
              <div className="flex flex-col gap-2 border-b border-black/10 bg-[#fafaf9] px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-[12px] font-medium uppercase tracking-[0.06em] text-[#888780]">
                    {historyPanel === 'completed' ? 'Completed requests' : 'Cancelled requests'}
                  </div>
                  {historyPanel === 'cancelled' && cancelledCount !== cancelledRowsFull.length ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Showing {cancelledRowsFull.length.toLocaleString()} loaded row
                      {cancelledRowsFull.length === 1 ? '' : 's'}; total cancelled: {cancelledCount.toLocaleString()}.
                    </p>
                  ) : null}
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                  {/* <Select value={historyFilterServiceType} onValueChange={setHistoryFilterServiceType}>
                    <SelectTrigger
                      className="h-9 w-full shrink-0 border-primary/30 text-sm sm:w-[200px]"
                      aria-label="Filter history by service type"
                    >
                      <SelectValue placeholder="Service type" />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_TYPE_FILTER_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={historyFilterSeason} onValueChange={setHistoryFilterSeason}>
                    <SelectTrigger
                      className="h-9 w-full shrink-0 border-primary/30 text-sm sm:w-[160px]"
                      aria-label="Filter history by season"
                    >
                      <SelectValue placeholder="Season" />
                    </SelectTrigger>
                    <SelectContent>
                      {SEASON_FILTER_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select> */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => setHistoryPanel(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
              {historyPanel === 'completed' && isFetchingCompletedRows && completedRowsFull.length === 0 ? (
                <div className="flex min-h-[120px] items-center justify-center py-6">
                  <LoadingSpinner size="md" text="Loading completed requests…" />
                </div>
              ) : historyPanel === 'cancelled' && isFetchingCancelledRows && cancelledRowsFull.length === 0 ? (
                <div className="flex min-h-[120px] items-center justify-center py-6">
                  <LoadingSpinner size="md" text="Loading cancelled requests…" />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className={TABLE_COLS_CLASS}>
                      {REQUEST_TABLE_COLGROUP}
                      <thead>
                        <tr className="bg-[#f8f8f7]">
                          <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Client</th>
                          <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Service type</th>
                          <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Season</th>
                          <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Scheduled date</th>
                          <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Technician</th>
                          <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Actions</th>
                        </tr>
                        <tr className="bg-[#f4f4f3]">
                          <th className="border-b border-black/10 px-1.5 py-1.5 sm:px-2">
                            <TableColSearchInput
                              value={historyColSearch.client}
                              onValueChange={(v) => setHistoryColSearch((p) => ({ ...p, client: v }))}
                              placeholder="Search"
                              ariaLabel="Search history table by client"
                            />
                          </th>
                          <th className="border-b border-black/10 px-1.5 py-1.5 sm:px-2">
                            <TableColSearchInput
                              value={historyColSearch.serviceType}
                              onValueChange={(v) => setHistoryColSearch((p) => ({ ...p, serviceType: v }))}
                              placeholder="Search"
                              ariaLabel="Search history table by service type"
                            />
                          </th>
                          <th className="border-b border-black/10 px-1.5 py-1.5 sm:px-2">
                            <TableColSearchInput
                              value={historyColSearch.season}
                              onValueChange={(v) => setHistoryColSearch((p) => ({ ...p, season: v }))}
                              placeholder="Search"
                              ariaLabel="Search history table by season"
                            />
                          </th>
                          <th className="border-b border-black/10 px-1.5 py-1.5 sm:px-2">
                            <TableColSearchInput
                              value={historyColSearch.date}
                              onValueChange={(v) => setHistoryColSearch((p) => ({ ...p, date: v }))}
                              placeholder="Search"
                              ariaLabel="Search history table by scheduled date"
                            />
                          </th>
                          <th className="border-b border-black/10 px-1.5 py-1.5 sm:px-2">
                            <TableColSearchInput
                              value={historyColSearch.technician}
                              onValueChange={(v) => setHistoryColSearch((p) => ({ ...p, technician: v }))}
                              placeholder="Search"
                              ariaLabel="Search history table by technician"
                            />
                          </th>
                          <th className="border-b border-black/10 px-1.5 py-1.5 sm:px-2" aria-hidden />
                        </tr>
                      </thead>
                      <tbody>
                        {historyTotal === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-3.5 py-6 text-center text-xs text-[#888780]">
                              {historyPanel === 'completed'
                                ? 'No completed requests in the current list.'
                                : 'No cancelled requests found.'}
                            </td>
                          </tr>
                        ) : (
                          historyPagedList.map((request) => (
                            <tr key={request.id} className="border-b border-black/10 last:border-b-0">
                              <td className="px-2 py-2 font-medium text-gray-900 sm:px-3.5">{request.client_name || '-'}</td>
                              <td className="px-2 py-2 text-black sm:px-3.5">{formatIssueCategoryDisplay(request)}</td>
                              <td className="px-2 py-2 text-gray-800 sm:px-3.5">{request.season}</td>
                              <td className={`px-2 py-2 font-medium sm:px-3.5 ${getDateTimeTone(request)}`}>
                                {formatScheduledStartDateTime(getScheduledDateRef(request))}
                              </td>
                              <td className="px-2 py-2 text-gray-800 sm:px-3.5">{request.assigned_technician_name || 'Unassigned'}</td>
                              <td className="px-2 py-2 text-left sm:px-3.5">
                                <Tooltip.Root>
                                  <Tooltip.Trigger asChild>
                                    <Button
                                      type="button"
                                      variant="default"
                                      size="icon"
                                      className={ICON_ACTION_PRIMARY_CLASS}
                                      aria-label="View request"
                                      onClick={() => setHistoryViewRequest(request)}
                                    >
                                      <Eye className="h-3.5 w-3.5 shrink-0" />
                                    </Button>
                                  </Tooltip.Trigger>
                                  <Tooltip.Portal>
                                    <Tooltip.Content side="top" sideOffset={4}>
                                      View request
                                      <Tooltip.Arrow className="fill-popover" />
                                    </Tooltip.Content>
                                  </Tooltip.Portal>
                                </Tooltip.Root>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {historyTotal > 0 && (
                    <div className="flex flex-col gap-2 border-t border-black/10 bg-[#fafaf9] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-gray-600">
                        Showing{' '}
                        <span className="font-medium text-gray-900">
                          {historyRangeStart.toLocaleString()}–{historyRangeEnd.toLocaleString()}
                        </span>{' '}
                        of <span className="font-medium text-gray-900">{historyTotal.toLocaleString()}</span>
                      </p>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Select
                          value={String(historyPageSize)}
                          onValueChange={(v) => setHistoryPageSize(Number(v))}
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
                            disabled={historyPage <= 1}
                            onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                            aria-label="Previous page"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="min-w-[7rem] px-2 text-center text-sm text-gray-700 tabular-nums">
                            Page {historyPage} / {historyTotalPages}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 border-primary/30"
                            disabled={historyPage >= historyTotalPages}
                            onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                            aria-label="Next page"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : null}

          <div>
            <div className="mb-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[12px] font-medium uppercase tracking-[0.06em] text-[#888780]">All overdue requests</div>
              {/* <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <Select value={overdueFilterServiceType} onValueChange={setOverdueFilterServiceType}>
                  <SelectTrigger
                    className="h-9 w-full shrink-0 border-primary/30 text-sm sm:w-[200px]"
                    aria-label="Overdue table: filter by service type"
                  >
                    <SelectValue placeholder="Service type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPE_FILTER_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={overdueFilterSeason} onValueChange={setOverdueFilterSeason}>
                  <SelectTrigger
                    className="h-9 w-full shrink-0 border-primary/30 text-sm sm:w-[160px]"
                    aria-label="Overdue table: filter by season"
                  >
                    <SelectValue placeholder="Season" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEASON_FILTER_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DateOnlyPicker
                  date={overdueFilterDateFrom}
                  onDateChange={setOverdueFilterDateFrom}
                  placeholder="From date"
                  ariaLabel="Overdue table: date from (scheduled end)"
                />
                <DateOnlyPicker
                  date={overdueFilterDateTo}
                  onDateChange={setOverdueFilterDateTo}
                  placeholder="To date"
                  ariaLabel="Overdue table: date to (scheduled end)"
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 w-full justify-between border-primary/30 text-sm sm:w-[220px]"
                    >
                      <span className="truncate">
                        {overdueFilterTechnicianIds.length > 0 ? `${overdueFilterTechnicianIds.length} technician(s)` : 'Technician'}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Filter technicians</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {technicians.length === 0 ? (
                      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">No active technicians</DropdownMenuLabel>
                    ) : (
                      technicians.map((tech) => {
                        const techId = String(tech.id);
                        return (
                          <DropdownMenuCheckboxItem
                            key={techId}
                            checked={overdueFilterTechnicianIds.includes(techId)}
                            onCheckedChange={() => toggleTechnicianInFilter(setOverdueFilterTechnicianIds, techId)}
                            onSelect={(e) => e.preventDefault()}
                          >
                            {tech.name}
                          </DropdownMenuCheckboxItem>
                        );
                      })
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div> */}
            </div>
            <div className="overflow-hidden rounded-lg border border-[#F7C1C1] bg-white">
              <div className="overflow-x-auto">
                <table className={TABLE_COLS_CLASS}>
                  {REQUEST_TABLE_COLGROUP}
                  <thead>
                    <tr className="bg-[#FFF8F8]">
                      <th className="border-b border-[#F7C1C1] px-2 py-2 text-left text-xs font-medium text-[#A32D2D] sm:px-3.5 sm:text-sm">Client</th>
                      <th className="border-b border-[#F7C1C1] px-2 py-2 text-left text-xs font-medium text-[#A32D2D] sm:px-3.5 sm:text-sm">Service type</th>
                      <th className="border-b border-[#F7C1C1] px-2 py-2 text-left text-xs font-medium text-[#A32D2D] sm:px-3.5 sm:text-sm">Season</th>
                      <th className="border-b border-[#F7C1C1] px-2 py-2 text-left text-xs font-medium text-[#A32D2D] sm:px-3.5 sm:text-sm">Due date</th>
                      <th className="border-b border-[#F7C1C1] px-2 py-2 text-left text-xs font-medium text-[#A32D2D] sm:px-3.5 sm:text-sm">Technician</th>
                      <th className="border-b border-[#F7C1C1] px-2 py-2 text-left text-xs font-medium text-[#A32D2D] sm:px-3.5 sm:text-sm">Action</th>
                    </tr>
                    <tr className="bg-[#FFF5F5]">
                      <th className="border-b border-[#F7C1C1] px-1.5 py-1.5 sm:px-2">
                        <TableColSearchInput
                          value={overdueColSearch.client}
                          onValueChange={(v) => setOverdueColSearch((p) => ({ ...p, client: v }))}
                          placeholder="Client"
                          variant="overdue"
                          ariaLabel="Search overdue table by client"
                        />
                      </th>
                      <th className="border-b border-[#F7C1C1] px-1.5 py-1.5 sm:px-2">
                        <TableColSearchInput
                          value={overdueColSearch.serviceType}
                          onValueChange={(v) => setOverdueColSearch((p) => ({ ...p, serviceType: v }))}
                          placeholder="Search"
                          variant="overdue"
                          ariaLabel="Search overdue table by service type"
                        />
                      </th>
                      <th className="border-b border-[#F7C1C1] px-1.5 py-1.5 sm:px-2">
                        <TableColSearchInput
                          value={overdueColSearch.season}
                          onValueChange={(v) => setOverdueColSearch((p) => ({ ...p, season: v }))}
                          placeholder="Search"
                          variant="overdue"
                          ariaLabel="Search overdue table by season"
                        />
                      </th>
                      <th className="border-b border-[#F7C1C1] px-1.5 py-1.5 sm:px-2">
                        <TableColSearchInput
                          value={overdueColSearch.date}
                          onValueChange={(v) => setOverdueColSearch((p) => ({ ...p, date: v }))}
                          placeholder="Search"
                          variant="overdue"
                          ariaLabel="Search overdue table by due date"
                        />
                      </th>
                      <th className="border-b border-[#F7C1C1] px-1.5 py-1.5 sm:px-2">
                        <TableColSearchInput
                          value={overdueColSearch.technician}
                          onValueChange={(v) => setOverdueColSearch((p) => ({ ...p, technician: v }))}
                          placeholder="Search"
                          variant="overdue"
                          ariaLabel="Search overdue table by technician"
                        />
                      </th>
                      <th className="border-b border-[#F7C1C1] px-1.5 py-1.5 sm:px-2" aria-hidden />
                    </tr>
                  </thead>
                  <tbody>
                    {overdueTotal === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3.5 py-6 text-center text-xs text-[#888780]">No overdue or pending requests.</td>
                      </tr>
                    ) : overdueRequests.map((request) => (
                      <tr key={request.id} className="border-b border-[#F7C1C1] last:border-b-0">
                        <td className="px-2 py-2 font-medium text-gray-900 sm:px-3.5">{request.client_name || '-'}</td>
                        <td className="px-2 py-2 text-black sm:px-3.5">{formatIssueCategoryDisplay(request)}</td>
                          <td className="px-2 py-2 text-gray-800 sm:px-3.5">{request.season}</td>
                        <td className={`px-2 py-2 font-medium sm:px-3.5 ${getDateTimeTone(request)}`}>{formatDueDateTime(getDueDateRef(request))}</td>
                        <td className="px-2 py-2 text-gray-800 sm:px-3.5">{request.assigned_technician_name || 'Unassigned'}</td>
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
              {overdueTotal > 0 && (
                <div className="flex flex-col gap-2 border-t border-[#F7C1C1] bg-[#FFFBFB] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-gray-600">
                    Showing{' '}
                    <span className="font-medium text-gray-900">
                      {overdueRangeStart.toLocaleString()}–{overdueRangeEnd.toLocaleString()}
                    </span>{' '}
                    of <span className="font-medium text-gray-900">{overdueTotal.toLocaleString()}</span>
                  </p>
                  <div className="flex flex-wrap items-center justify-end gap-2">
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
          </div>
          <div>
            <div className="mb-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[12px] font-medium uppercase tracking-[0.06em] text-[#888780]">All open requests</div>
              {/* <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <Select value={openFilterServiceType} onValueChange={setOpenFilterServiceType}>
                  <SelectTrigger
                    className="h-9 w-full shrink-0 border-primary/30 text-sm sm:w-[200px]"
                    aria-label="Open requests table: filter by service type"
                  >
                    <SelectValue placeholder="Service type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPE_FILTER_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={openFilterSeason} onValueChange={setOpenFilterSeason}>
                  <SelectTrigger
                    className="h-9 w-full shrink-0 border-primary/30 text-sm sm:w-[160px]"
                    aria-label="Open requests table: filter by season"
                  >
                    <SelectValue placeholder="Season" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEASON_FILTER_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DateOnlyPicker
                  date={openFilterDateFrom}
                  onDateChange={setOpenFilterDateFrom}
                  placeholder="From date"
                  ariaLabel="Open table: date from (scheduled start)"
                />
                <DateOnlyPicker
                  date={openFilterDateTo}
                  onDateChange={setOpenFilterDateTo}
                  placeholder="To date"
                  ariaLabel="Open table: date to (scheduled start)"
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 w-full justify-between border-primary/30 text-sm sm:w-[220px]"
                    >
                      <span className="truncate">
                        {openFilterTechnicianIds.length > 0 ? `${openFilterTechnicianIds.length} technician(s)` : 'Technician'}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Filter technicians</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {technicians.length === 0 ? (
                      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">No active technicians</DropdownMenuLabel>
                    ) : (
                      technicians.map((tech) => {
                        const techId = String(tech.id);
                        return (
                          <DropdownMenuCheckboxItem
                            key={techId}
                            checked={openFilterTechnicianIds.includes(techId)}
                            onCheckedChange={() => toggleTechnicianInFilter(setOpenFilterTechnicianIds, techId)}
                            onSelect={(e) => e.preventDefault()}
                          >
                            {tech.name}
                          </DropdownMenuCheckboxItem>
                        );
                      })
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div> */}
            </div>
            <div className="overflow-hidden rounded-lg border border-black/10 bg-white">
              <div className="overflow-x-auto">
                <table className={TABLE_COLS_CLASS}>
                  {REQUEST_TABLE_COLGROUP}
                  <thead>
                    <tr className="bg-[#f8f8f7]">
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Client</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Service type</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Season</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Scheduled date</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Technician</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Action</th>
                    </tr>
                    <tr className="bg-[#f4f4f3]">
                      <th className="border-b border-black/10 px-1.5 py-1.5 sm:px-2">
                        <TableColSearchInput
                          value={openColSearch.client}
                          onValueChange={(v) => setOpenColSearch((p) => ({ ...p, client: v }))}
                          placeholder="Search"
                          ariaLabel="Search open requests table by client"
                        />
                      </th>
                      <th className="border-b border-black/10 px-1.5 py-1.5 sm:px-2">
                        <TableColSearchInput
                          value={openColSearch.serviceType}
                          onValueChange={(v) => setOpenColSearch((p) => ({ ...p, serviceType: v }))}
                          placeholder="Search"
                          ariaLabel="Search open requests table by service type"
                        />
                      </th>
                      <th className="border-b border-black/10 px-1.5 py-1.5 sm:px-2">
                        <TableColSearchInput
                          value={openColSearch.season}
                          onValueChange={(v) => setOpenColSearch((p) => ({ ...p, season: v }))}
                          placeholder="Search"
                          ariaLabel="Search open requests table by season"
                        />
                      </th>
                      <th className="border-b border-black/10 px-1.5 py-1.5 sm:px-2">
                        <TableColSearchInput
                          value={openColSearch.date}
                          onValueChange={(v) => setOpenColSearch((p) => ({ ...p, date: v }))}
                          placeholder="Search"
                          ariaLabel="Search open requests table by scheduled date"
                        />
                      </th>
                      <th className="border-b border-black/10 px-1.5 py-1.5 sm:px-2">
                        <TableColSearchInput
                          value={openColSearch.technician}
                          onValueChange={(v) => setOpenColSearch((p) => ({ ...p, technician: v }))}
                          placeholder="Search"
                          ariaLabel="Search open requests table by technician"
                        />
                      </th>
                      <th className="border-b border-black/10 px-1.5 py-1.5 sm:px-2" aria-hidden />
                    </tr>
                  </thead>
                  <tbody>
                    {openTotal === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3.5 py-6 text-center text-xs text-[#888780]">No open requests.</td>
                      </tr>
                    ) : openRequests.map((request) => (
                      <tr key={request.id} className="border-b border-black/10 last:border-b-0">
                        <td className="px-2 py-2 font-medium text-gray-900 sm:px-3.5">{request.client_name || '-'}</td>
                        <td className="px-2 py-2 text-black sm:px-3.5">{formatIssueCategoryDisplay(request)}</td>
                        <td className="px-2 py-2 text-gray-800 sm:px-3.5">{request.season}</td>
                        <td className={`px-2 py-2 font-medium sm:px-3.5 ${getDateTimeTone(request)}`}>
                          {formatScheduledStartDateTime(getScheduledDateRef(request))}
                        </td>
                        <td className="px-2 py-2 text-gray-800 sm:px-3.5">{request.assigned_technician_name || 'Unassigned'}</td>
                        <td className="px-2 py-2 text-left sm:px-3.5">
                          <ServiceRequestRowActions
                            request={request}
                            showReschedule={false}
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
              {openTotal > 0 && (
                <div className="flex flex-col gap-2 border-t border-black/10 bg-[#fafaf9] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-gray-600">
                    Showing{' '}
                    <span className="font-medium text-gray-900">
                      {openRangeStart.toLocaleString()}–{openRangeEnd.toLocaleString()}
                    </span>{' '}
                    of <span className="font-medium text-gray-900">{openTotal.toLocaleString()}</span>
                  </p>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Select
                      value={String(openPageSize)}
                      onValueChange={(v) => setOpenPageSize(Number(v))}
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
                        disabled={openPage <= 1}
                        onClick={() => setOpenPage((p) => Math.max(1, p - 1))}
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="min-w-[7rem] px-2 text-center text-sm text-gray-700 tabular-nums">
                        Page {openPage} / {openTotalPages}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 border-primary/30"
                        disabled={openPage >= openTotalPages}
                        onClick={() => setOpenPage((p) => Math.min(openTotalPages, p + 1))}
                        aria-label="Next page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Form Dialog */}
      <Dialog data-source-location="pages/ServiceRequests:454:6" data-dynamic-content="true" open={showForm} onOpenChange={(open) => {
        setShowForm(open);
        if (!open) setSelectedRequest(null);
      }}>
        <DialogContent data-source-location="pages/ServiceRequests:458:8" data-dynamic-content="true" className="max-w-6xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader data-source-location="pages/ServiceRequests:459:10" data-dynamic-content="true">
            <DialogTitle data-source-location="pages/ServiceRequests:460:12" data-dynamic-content="true">
              {selectedRequest ? 'Edit Service Request' : 'New Service Request'}
            </DialogTitle>
            <DialogDescription data-source-location="pages/ServiceRequests:463:12" data-dynamic-content="true">
              {selectedRequest ? 'Update the service request details below' : 'Fill in the details for the new service request'}
            </DialogDescription>
          </DialogHeader>
          <ServiceRequestForm
            data-source-location="pages/ServiceRequests:467:10"
            data-dynamic-content="false"
            key={selectedRequest ? String(selectedRequest.id) : 'new'}
            request={selectedRequest}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setSelectedRequest(null);
            }}
          />

        </DialogContent>
      </Dialog>

      <Dialog
        open={!!historyViewRequest}
        onOpenChange={(open) => {
          if (!open) setHistoryViewRequest(null);
        }}
      >
        <DialogContent
          overlayClassName="z-[10016]"
          className="z-[10017] max-w-6xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>Service request</DialogTitle>
            <DialogDescription>
              {historyViewRequest
                ? `Request #${historyViewRequest.request_number || historyViewRequest.id} — view details; use Close when finished.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {historyViewRequest ? (
            <ServiceRequestForm
              key={historyViewRequest.id}
              request={historyViewRequest}
              readOnly
              onSubmit={async () => {}}
              onCancel={() => setHistoryViewRequest(null)}
            />
          ) : null}
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
