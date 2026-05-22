import React, { useMemo, useState, useEffect } from 'react';
import { serviceRequestService, technicianService, clientService, emailService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Calendar, Clock3, AlertTriangle, Pencil, UserRoundCog, ChevronLeft, ChevronRight, X, Search as SearchIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ServiceRequestForm from '@/components/forms/ServiceRequestForm';
import { format, isBefore, startOfToday } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { mergeServiceRequestUpdateAudit, canCancelServiceRequestRow } from '@/utils/serviceRequestAudit';
import { Tooltip } from '@/components/ui/tooltip';
import { formatRequestStatusLabel } from '@/utils/serviceRequestSeason';
import { cn } from '@/lib/utils';
import {
  SEASON_FILTER_OPTIONS,
  SERVICE_TYPE_FILTER_OPTIONS,
  isRequestAssignedTechnician,
  requestMatchesSeasonFilter,
  requestMatchesServiceTypeFilter,
} from '@/utils/serviceRequestListFilters';

const CLOSED_STATUSES = ['completed', 'approved', 'closed'];
const ACTIVE_STATUSES = ['scheduled', 'assigned', 'in_progress'];

const JOB_TABLE_PAGE_SIZE_OPTIONS = [10, 20, 50];

/** Match Scheduling.jsx table action icon buttons. */
const ICON_ACTION_PRIMARY_CLASS =
  'h-8 w-8 shrink-0 rounded-md bg-primary p-0 text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground';

/** Same column geometry on every technician table (`table-fixed` + shared `colgroup`). */
const JOBS_TABLE_CLASS =
  'table-fixed w-full min-w-[980px] border-collapse text-xs sm:text-sm';

const JOBS_TABLE_COLGROUP = (
  <colgroup>
    <col className="w-[13%]" />
    <col className="w-[24%]" />
    <col className="w-[12%]" />
    <col className="w-[10%]" />
    <col className="w-[13%]" />
    <col className="w-[13%]" />
    <col className="w-[15%]" />
  </colgroup>
);

function formatClientFullAddress(client) {
  if (!client) return '—';
  const parts = [client.address, client.city, client.state, client.zipcode]
    .map((p) => (p != null && String(p).trim() !== '' ? String(p).trim() : null))
    .filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

function formatIssueCategoryDisplay(job) {
  const raw = job?.issue_category;
  if (raw == null || String(raw).trim() === '') return '—';
  return String(raw).replace(/_/g, ' ');
}

function technicianJobAddressLine(job, clients) {
  const client = clients.find((c) => String(c.id) === String(job.client_id));
  if (client) {
    const full = formatClientFullAddress(client);
    if (full !== '—') return full;
  }
  return job.address || job.client_address || job.location_address || '—';
}

function matchesTechnicianJobSearch(job, clients, raw) {
  const q = String(raw ?? '').trim().toLowerCase();
  if (!q) return true;
  const addressLine = technicianJobAddressLine(job, clients);
  const hay = [
    job?.client_name,
    job?.request_number,
    job?.assigned_technician_name,
    job?.status,
    formatIssueCategoryDisplay(job),
    job?.season,
    addressLine,
  ]
    .filter((v) => v != null && String(v).trim() !== '' && String(v) !== '—')
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

/**
 * Admin view: same as TechnicianJobs but for admin role (all jobs, reassign to any technician).
 * Used when admin clicks "Technician Jobs" in the sidebar.
 */
export default function AdminTechnicianJobs() {
  const [reassignJob, setReassignJob] = useState(null);
  const [reassignSelectedTechnician, setReassignSelectedTechnician] = useState(null);
  const [editRequest, setEditRequest] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [jobTablePageSize, setJobTablePageSize] = useState(10);
  const [jobTablePageByTech, setJobTablePageByTech] = useState({});
  /** Per-technician section: filter rows in that table */
  const [jobTableSearchByTech, setJobTableSearchByTech] = useState({});
  const [cancelConfirmJob, setCancelConfirmJob] = useState(null);
  /** Per-technician table: service type filter (key = String(technician id)). */
  const [jobTableServiceTypeByTech, setJobTableServiceTypeByTech] = useState({});
  const [jobTableSeasonByTech, setJobTableSeasonByTech] = useState({});

  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: myJobs = [], isLoading: isLoadingJobs } = useQuery({
    queryKey: ['technicianJobs', 'all'],
    queryFn: () => serviceRequestService.list('created_at', 'desc', 500)
  });

  const { data: allTechnicians = [], isLoading: isLoadingTechnicians } = useQuery({
    queryKey: ['technicians', 'forSelection'],
    queryFn: () => technicianService.listForSelection(),
    enabled: !!reassignJob
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientService.list()
  });

  const reassignMutation = useMutation({
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
          // Do not block successful reassignment on email failure.
        }
      }
      if (technician?.email) {
        try {
          await emailService.sendTechnicianNotification(submitData, technician, true);
        } catch {
          // Do not block successful reassignment on email failure.
        }
      }

      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
      queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
      setReassignJob(null);
      setReassignSelectedTechnician(null);
      toast.success('Job reassigned successfully');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to reassign job');
    }
  });

  const updateRequestMutation = useMutation({
    mutationFn: ({ id, data }) => serviceRequestService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
      queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
      setShowEditForm(false);
      setEditRequest(null);
      toast.success('Request updated successfully');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update request');
    }
  });

  const cancelJobMutation = useMutation({
    mutationFn: async ({ request }) => {
      let data = { is_cancelled: 'T' };
      data = mergeServiceRequestUpdateAudit(request, data, user?.id ?? null, {
        alwaysSetModified: true,
      });
      return serviceRequestService.update(request.id, data);
    },
    onSuccess: (_data, { request }) => {
      queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
      queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
      setCancelConfirmJob(null);
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

  const openEditForm = (job) => {
    setEditRequest(job);
    setShowEditForm(true);
  };

  const handleSubmitEdit = async (data) => {
    if (!editRequest) return;
    await updateRequestMutation.mutateAsync({ id: editRequest.id, data });
  };

  const parseJobDate = (job) => {
    const raw = job.scheduled_start_time || job.scheduled_date;
    const dt = raw ? new Date(raw) : null;
    return dt && !Number.isNaN(dt.getTime()) ? dt : null;
  };

  const isOverdueJob = (job) => {
    if (CLOSED_STATUSES.includes(job.status)) return false;
    if (job.is_sla_breached) return true;
    const date = parseJobDate(job);
    if (!date) return false;
    return isBefore(date, startOfToday());
  };

  const formatDateTime = (job) => {
    const date = parseJobDate(job);
    if (!date) return 'Unscheduled';
    return format(date, 'MMM d • h:mm a');
  };

  const getClientAddress = (job) => technicianJobAddressLine(job, clients);

  const jobsInView = useMemo(
    () => myJobs.filter((j) => isRequestAssignedTechnician(j)),
    [myJobs]
  );

  const metrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const clientIdsWithScheduledOrCompleted = new Set(
      myJobs
        .filter((j) => ['scheduled', 'completed'].includes(j.status) && j.client_id != null)
        .map((j) => String(j.client_id))
    );

    const completed = jobsInView.filter((j) => CLOSED_STATUSES.includes(j.status)).length;
    const scheduled = jobsInView.filter((j) => {
      if (j.status !== 'scheduled') return false;
      if (!j.scheduled_end_time) return true;
      const endDate = new Date(j.scheduled_end_time);
      if (Number.isNaN(endDate.getTime())) return true;
      endDate.setHours(0, 0, 0, 0);
      return endDate >= today;
    }).length;
    const unscheduled = clients
      .filter((c) => {
        const lat = c.location?.lat ?? c.latitude;
        const lng = c.location?.lng ?? c.longitude;
        return lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));
      })
      .filter((c) => !clientIdsWithScheduledOrCompleted.has(String(c.id))).length;

    const overdue = jobsInView.filter((j) => {
      if (j.status !== 'scheduled') return false;
      if (!j.scheduled_end_time) return false;
      const endDate = new Date(j.scheduled_end_time);
      if (Number.isNaN(endDate.getTime())) return false;
      endDate.setHours(0, 0, 0, 0);
      return endDate < today;
    }).length;
    return { completed, scheduled, unscheduled, overdue };
  }, [jobsInView, myJobs, clients]);

  const groupedTechnicians = useMemo(() => {
    const groups = new Map();
    jobsInView.forEach((job) => {
      const id = job.assigned_technician_id || 'unassigned';
      const name = job.assigned_technician_name || 'Unassigned Jobs';
      if (!groups.has(id)) {
        groups.set(id, { id, name, jobs: [] });
      }
      groups.get(id).jobs.push(job);
    });

    const withMeta = [...groups.values()].map((group) => {
      const sortedJobs = [...group.jobs].sort((a, b) => {
        const da = parseJobDate(a);
        const db = parseJobDate(b);
        if (da && db) return da - db;
        if (da && !db) return -1;
        if (!da && db) return 1;
        return String(a.client_name || '').localeCompare(String(b.client_name || ''));
      });

      const activeCount = sortedJobs.filter((j) => ACTIVE_STATUSES.includes(j.status)).length;
      const todayCount = sortedJobs.filter((j) => {
        const d = parseJobDate(j);
        if (!d) return false;
        return format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
      }).length;
      const overdueCount = sortedJobs.filter((j) => isOverdueJob(j)).length;

      return { ...group, jobs: sortedJobs, activeCount, todayCount, overdueCount };
    });

    return withMeta.sort((a, b) => b.activeCount - a.activeCount);
  }, [jobsInView]);

  useEffect(() => {
    setJobTablePageByTech({});
    setJobTableSearchByTech({});
  }, [jobTablePageSize]);

  useEffect(() => {
    setJobTablePageByTech((prev) => {
      const next = { ...prev };
      let changed = false;
      groupedTechnicians.forEach((g) => {
        const id = String(g.id);
        const st = jobTableServiceTypeByTech[id] ?? 'all';
        const sn = jobTableSeasonByTech[id] ?? 'all';
        const q = (jobTableSearchByTech[id] ?? '').trim();
        let list = g.jobs
          .filter((job) => requestMatchesServiceTypeFilter(job, st))
          .filter((job) => requestMatchesSeasonFilter(job, sn));
        if (q) list = list.filter((job) => matchesTechnicianJobSearch(job, clients, q));
        const totalPages = Math.max(1, Math.ceil(list.length / jobTablePageSize) || 1);
        const p = prev[id] ?? 1;
        if (p > totalPages) {
          next[id] = totalPages;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [
    groupedTechnicians,
    jobTablePageSize,
    jobTableSearchByTech,
    jobTableServiceTypeByTech,
    jobTableSeasonByTech,
    clients,
  ]);

  const getInitials = (name) =>
    name
      ?.split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'NA';

  const statusTone = (job, overdue) => {
    const status = job.status;
    const closed = CLOSED_STATUSES.includes(status);
    if (overdue) return 'bg-[#FCEBEB] text-[#A32D2D]';
    if (status === 'pending') return 'bg-[#FCEBEB] text-[#A32D2D]';
    if (closed) return 'bg-[#EAF3DE] text-[#3B6D11]';
    if (status === 'scheduled' || status === 'assigned') return 'bg-[#EEEDFE] text-[#534AB7]';
    if (status === 'in_progress') return 'bg-[#E6F1FB] text-[#185FA5]';
    return 'bg-[#FAEEDA] text-[#BA7517]';
  };

  const statusLabel = (job, overdue) => {
    if (overdue) return 'Overdue';
    if (job.status === 'pending') return 'Pending';
    return formatRequestStatusLabel(job.status);
  };

  const dateTimeTone = (job, overdue) => {
    const status = job.status;
    const closed = CLOSED_STATUSES.includes(status);
    if (overdue || status === 'pending') return 'text-[#A32D2D]';
    if (closed) return 'text-[#3B6D11]';
    if (status === 'scheduled' || status === 'assigned') return 'text-[#534AB7]';
    if (status === 'in_progress') return 'text-[#185FA5]';
    return 'text-[#BA7517]';
  };

  const technicianSubLabel = (group) => {
    if (group.overdueCount > 0) {
      return `${group.jobs.length} jobs this week · ${group.overdueCount} overdue`;
    }
    return `${group.jobs.length} jobs this week · ${group.todayCount} today`;
  };

  if (isLoadingJobs) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" text="Loading jobs..." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Technician Jobs</h1>
          <p className="mt-1 text-gray-500">Monitor technician assignments and upcoming jobs</p>
        </div>
        <div className="text-xs text-[#888780]">Schedule date · earliest first · filters are per technician</div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-black/10 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#888780]">
            <span>Completed</span>
            <CheckCircle className="h-3.5 w-3.5 text-[#1D9E75]" />
          </div>
          <div className="text-[22px] font-medium text-[#0F6E56]">{metrics.completed}</div>
        </div>
        <div className="rounded-md border border-black/10 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#888780]">
            <span>Scheduled</span>
            <Calendar className="h-3.5 w-3.5 text-[#534AB7]" />
          </div>
          <div className="text-[22px] font-medium text-[#534AB7]">{metrics.scheduled}</div>
        </div>
        <div className="rounded-md border border-black/10 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#888780]">
            <span>Unscheduled</span>
            <Clock3 className="h-3.5 w-3.5 text-[#BA7517]" />
          </div>
          <div className="text-[22px] font-medium text-[#BA7517]">{metrics.unscheduled}</div>
        </div>
        <div className="rounded-md border border-black/10 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#888780]">
            <span>Overdue</span>
            <AlertTriangle className="h-3.5 w-3.5 text-[#A32D2D]" />
          </div>
          <div className="text-[22px] font-medium text-[#A32D2D]">{metrics.overdue}</div>
        </div>
      </div>

      {groupedTechnicians.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center text-sm text-gray-500">
          {myJobs.length > 0 ? (
            <>
              <p>No jobs with an assigned technician.</p>
              <p className="mt-2 text-xs text-[#888780]">
                Unassigned work appears on the Unassigned page; assign technicians from Service Requests or Scheduling.
              </p>
            </>
          ) : (
            'No jobs found.'
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {groupedTechnicians.map((group) => {
            const techKey = String(group.id);
            const tablePage = jobTablePageByTech[techKey] ?? 1;
            const rowSearch = jobTableSearchByTech[techKey] ?? '';
            const qFilter = rowSearch.trim();
            const secType = jobTableServiceTypeByTech[techKey] ?? 'all';
            const secSeason = jobTableSeasonByTech[techKey] ?? 'all';
            let filteredJobs = group.jobs
              .filter((job) => requestMatchesServiceTypeFilter(job, secType))
              .filter((job) => requestMatchesSeasonFilter(job, secSeason));
            if (qFilter) {
              filteredJobs = filteredJobs.filter((job) => matchesTechnicianJobSearch(job, clients, qFilter));
            }
            const totalJobs = filteredJobs.length;
            const tableTotalPages = Math.max(1, Math.ceil(totalJobs / jobTablePageSize) || 1);
            const fromIdx = (tablePage - 1) * jobTablePageSize;
            const pageJobs = filteredJobs.slice(fromIdx, fromIdx + jobTablePageSize);
            const rangeStart = totalJobs === 0 ? 0 : fromIdx + 1;
            const rangeEnd = Math.min(tablePage * jobTablePageSize, totalJobs);

            return (
            <div
              key={group.id}
              className="overflow-hidden rounded-xl border border-black/[0.08] bg-white"
            >
              <div className="flex flex-col gap-2 border-b border-black/10 bg-[#f5f5f3] px-2.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {getInitials(group.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900">{group.name}</div>
                    <div className="text-xs text-[#888780]">{technicianSubLabel(group)}</div>
                  </div>
                </div>
                <div className="flex w-full flex-col gap-2 sm:max-w-none sm:flex-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                  <Select
                    value={secType}
                    onValueChange={(v) => {
                      setJobTableServiceTypeByTech((prev) => ({ ...prev, [techKey]: v }));
                      setJobTablePageByTech((prev) => ({ ...prev, [techKey]: 1 }));
                    }}
                  >
                    <SelectTrigger
                      className="h-9 w-full border-primary/30 text-sm sm:w-[180px]"
                      aria-label={`${group.name}: filter by service type`}
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
                  <Select
                    value={secSeason}
                    onValueChange={(v) => {
                      setJobTableSeasonByTech((prev) => ({ ...prev, [techKey]: v }));
                      setJobTablePageByTech((prev) => ({ ...prev, [techKey]: 1 }));
                    }}
                  >
                    <SelectTrigger
                      className="h-9 w-full border-primary/30 text-sm sm:w-[150px]"
                      aria-label={`${group.name}: filter by season`}
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
                  <div className="relative w-full shrink-0 sm:max-w-xs">
                    <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      value={rowSearch}
                      onChange={(e) => {
                        const v = e.target.value;
                        setJobTableSearchByTech((prev) => ({ ...prev, [techKey]: v }));
                        setJobTablePageByTech((prev) => ({ ...prev, [techKey]: 1 }));
                      }}
                      placeholder="Search"
                      className="h-9 border-primary/30 pl-8"
                      aria-label={`Filter jobs for ${group.name}`}
                    />
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto w-full">
                <table className={JOBS_TABLE_CLASS}>
                  {JOBS_TABLE_COLGROUP}
                  <thead>
                    <tr className="bg-[#f8f8f7]">
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Client</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Address</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Service type</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Season</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Date & Time</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Status</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totalJobs === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3.5 py-8 text-center text-xs text-muted-foreground">
                          No jobs match this table&apos;s filters. Clear service type, season, or search.
                        </td>
                      </tr>
                    ) : null}
                    {pageJobs.map((job) => {
                      const overdue = isOverdueJob(job);
                      const canReassign = ACTIVE_STATUSES.includes(job.status);
                      const canEdit = !CLOSED_STATUSES.includes(job.status);
                      const canCancelRow = canCancelServiceRequestRow(job);
                      return (
                        <tr
                          key={job.id}
                          className={overdue ? 'border-b border-black/10 bg-[#FFF8F8] last:border-b-0' : 'border-b border-black/10 last:border-b-0'}
                        >
                          <td className="px-2 py-2.5 font-medium text-gray-900 sm:px-3.5">
                            {job.client_name || `#${job.request_number}`}
                          </td>
                          <td className="px-2 py-2.5 text-[#6f6f68] sm:px-3.5">
                            <span className="break-words">{getClientAddress(job)}</span>
                          </td>
                          <td className="px-2 py-2.5 text-gray-800 sm:px-3.5">
                            {formatIssueCategoryDisplay(job)}
                          </td>
                          <td className="px-2 py-2.5 text-gray-800 sm:px-3.5">{job?.season}</td>
                          <td className={`px-2 py-2.5 font-medium sm:px-3.5 ${dateTimeTone(job, overdue)}`}>
                            {formatDateTime(job)}
                          </td>
                          <td className="px-2 py-2.5 sm:px-3.5">
                            <span className={`inline-block rounded-[10px] px-2 py-0.5 text-xs font-medium ${statusTone(job, overdue)}`}>
                              {statusLabel(job, overdue)}
                            </span>
                            {job.priority === 'urgent' && (
                              <span className="ml-1.5 align-middle">
                                <StatusBadge status="urgent" size="xs" />
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2.5 sm:px-3.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {canEdit ? (
                                <Tooltip.Root>
                                  <Tooltip.Trigger asChild>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="default"
                                      className={ICON_ACTION_PRIMARY_CLASS}
                                      aria-label="Edit request"
                                      onClick={() => openEditForm(job)}
                                    >
                                      <Pencil className="h-3.5 w-3.5 shrink-0" />
                                    </Button>
                                  </Tooltip.Trigger>
                                  <Tooltip.Portal>
                                    <Tooltip.Content side="top" sideOffset={4}>
                                      Edit request
                                      <Tooltip.Arrow />
                                    </Tooltip.Content>
                                  </Tooltip.Portal>
                                </Tooltip.Root>
                              ) : null}
                              {canReassign ? (
                                <Tooltip.Root>
                                  <Tooltip.Trigger asChild>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="default"
                                      className={ICON_ACTION_PRIMARY_CLASS}
                                      aria-label="Reassign technician"
                                      onClick={() => setReassignJob(job)}
                                    >
                                      <UserRoundCog className="h-3.5 w-3.5 shrink-0" />
                                    </Button>
                                  </Tooltip.Trigger>
                                  <Tooltip.Portal>
                                    <Tooltip.Content side="top" sideOffset={4}>
                                      Reassign technician
                                      <Tooltip.Arrow />
                                    </Tooltip.Content>
                                  </Tooltip.Portal>
                                </Tooltip.Root>
                              ) : null}
                              {canCancelRow ? (
                                <Tooltip.Root>
                                  <Tooltip.Trigger asChild>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="default"
                                      className={ICON_ACTION_PRIMARY_CLASS}
                                      aria-label="Cancel request"
                                      disabled={cancelJobMutation.isPending}
                                      onClick={() => setCancelConfirmJob(job)}
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
                              {!canEdit && !canReassign && !canCancelRow ? (
                                <span className="text-xs text-[#888780]">—</span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalJobs > 0 && (
                <div className="flex flex-col gap-2 border-t border-black/10 bg-[#fafaf9] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-gray-600">
                    Showing{' '}
                    <span className="font-medium text-gray-900">
                      {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()}
                    </span>{' '}
                    of <span className="font-medium text-gray-900">{totalJobs.toLocaleString()}</span>
                  </p>
                  <div className="flex flex-wrap items-center justify-end gap-2 sm:shrink-0">
                    <Select
                      value={String(jobTablePageSize)}
                      onValueChange={(v) => setJobTablePageSize(Number(v))}
                    >
                      <SelectTrigger
                        className="h-9 w-[130px] border-primary/30 text-sm"
                        aria-label="Rows per page"
                      >
                        <SelectValue placeholder="Per page" />
                      </SelectTrigger>
                      <SelectContent>
                        {JOB_TABLE_PAGE_SIZE_OPTIONS.map((n) => (
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
                        disabled={tablePage <= 1}
                        onClick={() =>
                          setJobTablePageByTech((prev) => ({
                            ...prev,
                            [techKey]: Math.max(1, (prev[techKey] ?? 1) - 1),
                          }))
                        }
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="min-w-[7rem] px-2 text-center text-sm text-gray-700 tabular-nums">
                        Page {tablePage} / {tableTotalPages}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 border-primary/30"
                        disabled={tablePage >= tableTotalPages}
                        onClick={() =>
                          setJobTablePageByTech((prev) => ({
                            ...prev,
                            [techKey]: Math.min(tableTotalPages, (prev[techKey] ?? 1) + 1),
                          }))
                        }
                        aria-label="Next page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!reassignJob}
        onOpenChange={(open) => {
          if (!open) {
            setReassignJob(null);
            setReassignSelectedTechnician(null);
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Reassign job</DialogTitle>
            <DialogDescription>
              {reassignJob && (
                <>
                  Choose a technician for #{reassignJob.request_number || reassignJob.id} —{' '}
                  {reassignJob.client_name || 'Client'}, then click Save.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-2">
            {isLoadingTechnicians ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="md" text="Loading technicians..." />
              </div>
            ) : allTechnicians.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No technicians available to assign.</p>
            ) : (
              allTechnicians.map((tech) => {
                const isSelected =
                  reassignSelectedTechnician &&
                  String(reassignSelectedTechnician.id) === String(tech.id);
                return (
                  <button
                    key={tech.id}
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/50',
                      isSelected && 'border-primary bg-primary/5 ring-1 ring-primary/30'
                    )}
                    onClick={() => setReassignSelectedTechnician(tech)}
                    disabled={reassignMutation.isPending}
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
              disabled={reassignMutation.isPending}
              onClick={() => {
                setReassignJob(null);
                setReassignSelectedTechnician(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                !reassignJob || !reassignSelectedTechnician || reassignMutation.isPending
              }
              onClick={() => {
                if (!reassignJob || !reassignSelectedTechnician) return;
                reassignMutation.mutate({
                  request: reassignJob,
                  technician: reassignSelectedTechnician,
                });
              }}
            >
              {reassignMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
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
        open={!!cancelConfirmJob}
        onOpenChange={(open) => {
          if (!open) setCancelConfirmJob(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this request?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelConfirmJob
                ? `Request #${cancelConfirmJob.request_number || cancelConfirmJob.id} for ${cancelConfirmJob.client_name || 'client'} will be marked cancelled.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelJobMutation.isPending}>No</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="destructive"
                disabled={cancelJobMutation.isPending || !cancelConfirmJob}
                onClick={() => {
                  if (!cancelConfirmJob) return;
                  cancelJobMutation.mutate({ request: cancelConfirmJob });
                }}
              >
                {cancelJobMutation.isPending ? 'Cancelling…' : 'Yes, cancel request'}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
