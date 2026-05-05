import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { serviceRequestService, clientService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Expand, CheckCircle, Calendar, Clock3, AlertTriangle, Search, Pencil, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import DashboardMap, { MAP_PIN_COLORS } from '@/components/map/DashboardMap';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ServiceRequestForm from '@/components/forms/ServiceRequestForm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import { format, isBefore, startOfToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/AuthContext';
import { mergeServiceRequestUpdateAudit } from '@/utils/serviceRequestAudit';

const CLOSED_STATUSES = ['completed', 'approved', 'closed'];

function canEditOrCancelHistoryRequest(r) {
  const st = (r.status || '').toLowerCase();
  if (CLOSED_STATUSES.includes(st)) return false;
  if (String(r.is_cancelled || '').toUpperCase() === 'T') return false;
  return true;
}

function isRequestOverdue(r) {
  const st = (r.status || '').toLowerCase();
  if (CLOSED_STATUSES.includes(st)) return false;
  if (r.is_sla_breached) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (['scheduled', 'assigned', 'in_progress'].includes(st)) {
    const endRef = r.scheduled_end_time || r.scheduled_date;
    if (!endRef) return false;
    const endDate = new Date(endRef);
    if (Number.isNaN(endDate.getTime())) return false;
    endDate.setHours(0, 0, 0, 0);
    return endDate < today;
  }
  if (r.scheduled_date && st === 'new') {
    const d = new Date(r.scheduled_date);
    d.setHours(0, 0, 0, 0);
    return d < today;
  }
  return false;
}

function parseTimeMs(v) {
  if (v == null || v === '') return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Latest **service** row first (e.g. May 2 job before May 1), not "any active overdue first".
 * Uses actual end / scheduled end / start / date, then updated/created.
 */
function getRequestServiceSortTimeMs(r) {
  const st = (r.status || '').toLowerCase();
  const candidates = [];
  if (['completed', 'approved', 'closed'].includes(st) && r.actual_end_time) {
    candidates.push(parseTimeMs(r.actual_end_time));
  }
  candidates.push(
    parseTimeMs(r.scheduled_end_time),
    parseTimeMs(r.scheduled_start_time),
    parseTimeMs(r.scheduled_date)
  );
  const fromDates = candidates.filter((x) => x != null && x > 0);
  if (fromDates.length) return Math.max(...fromDates);
  return parseTimeMs(r.updated_at) ?? parseTimeMs(r.created_at) ?? 0;
}

function sortRequestsLatestServiceFirst(arr) {
  return [...arr].sort((a, b) => getRequestServiceSortTimeMs(b) - getRequestServiceSortTimeMs(a));
}

/** Map + list + history pills: Unscheduled, Scheduled, Overdue, or Completed. */
function getClientCardHistoryBucket(r) {
  const st = (r.status || '').toLowerCase();
  if (['completed', 'approved', 'closed'].includes(st)) {
    return { bucket: 'completed', label: 'Completed' };
  }
  if (st === 'pending') {
    return { bucket: 'overdue', label: 'Overdue' };
  }
  if (st === 'new' && !r.scheduled_date) {
    return { bucket: 'unscheduled', label: 'Unscheduled' };
  }
  if (['scheduled', 'in_progress', 'assigned'].includes(st)) {
    const endRef = r.scheduled_end_time || r.scheduled_date;
    if (endRef && isBefore(new Date(endRef), startOfToday())) {
      return { bucket: 'overdue', label: 'Overdue' };
    }
    return { bucket: 'scheduled', label: 'Scheduled' };
  }
  if (st === 'new' && r.scheduled_date) {
    if (isBefore(new Date(r.scheduled_date), startOfToday())) {
      return { bucket: 'overdue', label: 'Overdue' };
    }
    return { bucket: 'scheduled', label: 'Scheduled' };
  }
  return { bucket: 'unscheduled', label: 'Unscheduled' };
}

const CLIENT_CARD_BUCKET_PILL_CLASS = {
  unscheduled: 'bg-[#FAEEDA] text-[#BA7517]',
  scheduled: 'bg-[#EEEDFE] text-[#534AB7]',
  overdue: 'bg-[#FCEBEB] text-[#A32D2D]',
  completed: 'bg-[#EAF3DE] text-[#3B6D11]',
};

function formatRequestAppt(r) {
  if (r?.scheduled_start_time) {
    try {
      return format(new Date(r.scheduled_start_time), 'MMM d • h:mm a');
    } catch {
      // fallback below
    }
  }
  if (!r?.scheduled_date) return '—';
  try {
    const d = format(new Date(r.scheduled_date), 'MMM d');
    return r.scheduled_time_slot ? `${d}, ${r.scheduled_time_slot}` : d;
  } catch {
    return r.scheduled_date;
  }
}

/** Single line: `address, city, state, zipcode` (empty parts omitted). */
function concatClientAddress(client) {
  if (!client) return '—';
  const parts = [
    String(client.address ?? '').trim(),
    String(client.city ?? '').trim(),
    String(client.state ?? '').trim(),
    client.zipcode != null && String(client.zipcode).trim() !== '' ? String(client.zipcode).trim() : '',
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

/**
 * Map / clients list / client card: status from the **latest service** request (by service dates),
 * or **Unscheduled** when the client has no requests / latest row is unscheduled work.
 */
function deriveClientMapContext(requestsForClient) {
  const list = sortRequestsLatestServiceFirst(requestsForClient);
  if (!list.length) {
    return {
      mapStatus: 'unscheduled',
      mapStatusLabel: 'Unscheduled',
      pinColor: MAP_PIN_COLORS.unscheduled,
      nextApptText: '—',
      primaryRequest: null,
    };
  }
  const r = list[0];
  const { bucket, label } = getClientCardHistoryBucket(r);
  let nextApptText = bucket === 'unscheduled' ? '—' : formatRequestAppt(r);
  if (bucket === 'completed' && r?.actual_end_time) {
    try {
      nextApptText = format(new Date(r.actual_end_time), 'MMM d');
    } catch {
      // keep formatRequestAppt
    }
  }
  const pinColor = MAP_PIN_COLORS[bucket] || MAP_PIN_COLORS.unscheduled;
  return {
    mapStatus: bucket,
    mapStatusLabel: label,
    pinColor,
    nextApptText,
    primaryRequest: r,
  };
}

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showServiceRequestDialog, setShowServiceRequestDialog] = useState(false);
  const [clientForServiceRequest, setClientForServiceRequest] = useState(null);
  const [mapFullScreen, setMapFullScreen] = useState(false);
  const [mapBaseLayer, setMapBaseLayer] = useState('streets');
  const [selectedMapJobId, setSelectedMapJobId] = useState(null);
  const [mapDetailOpen, setMapDetailOpen] = useState(false);
  const [flyToTarget, setFlyToTarget] = useState(null);
  /** Bumped on "Clients in view" row click so the map opens that marker's Leaflet popup. */
  const [listSelectionPopupNonce, setListSelectionPopupNonce] = useState(0);
  const [clientListSearch, setClientListSearch] = useState('');
  const [historyEditRequest, setHistoryEditRequest] = useState(null);
  const [historyCancelRequest, setHistoryCancelRequest] = useState(null);

  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['serviceRequests'],
    queryFn: () => serviceRequestService.list('created_at', 'desc', 100)
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientService.list()
  });

  const createRequestMutation = useMutation({
    mutationFn: (data) => serviceRequestService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
      toast.success('Service request created');
      setShowServiceRequestDialog(false);
      setClientForServiceRequest(null);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create service request');
    },
  });

  const updateRequestMutation = useMutation({
    mutationFn: ({ id, data }) => serviceRequestService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
      queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
      toast.success('Request updated successfully');
      setHistoryEditRequest(null);
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to update request');
    },
  });

  const cancelHistoryMutation = useMutation({
    mutationFn: async ({ request }) => {
      let data = { is_cancelled: 'T' };
      data = mergeServiceRequestUpdateAudit(request, data, user?.id ?? null, {
        alwaysSetModified: true,
      });
      return serviceRequestService.update(request.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
      queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
      toast.success('Request cancelled');
      setHistoryCancelRequest(null);
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to cancel request');
    },
  });

  const historyActionsBusy = updateRequestMutation.isPending || cancelHistoryMutation.isPending;

  const handleCreateServiceRequestFromMap = (job) => {
    const client = clients.find((c) => c.id === job.id);
    if (client) {
      setClientForServiceRequest(client);
      setShowServiceRequestDialog(true);
    }
  };

  const requestsByClientId = useMemo(() => {
    const m = new Map();
    for (const r of requests) {
      if (!r.client_id) continue;
      if (!m.has(r.client_id)) m.set(r.client_id, []);
      m.get(r.client_id).push(r);
    }
    for (const arr of m.values()) {
      const sorted = sortRequestsLatestServiceFirst(arr);
      arr.length = 0;
      arr.push(...sorted);
    }
    return m;
  }, [requests]);

  const mapJobs = useMemo(
    () =>
      clients
        .filter((client) => {
          const lat = client.location?.lat ?? client.latitude;
          const lng = client.location?.lng ?? client.longitude;
          return lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));
        })
        .map((client) => {
          const lat = parseFloat(client.location?.lat ?? client.latitude);
          const lng = parseFloat(client.location?.lng ?? client.longitude);
          const reqs = requestsByClientId.get(client.id) || [];
          const ctx = deriveClientMapContext(reqs);
          return {
            id: client.id,
            client_name: client.name,
            farm_name: client.farm_name,
            fullAddress: concatClientAddress(client),
            location: {
              lat,
              lng,
              address: client.address || '',
            },
            mapStatus: ctx.mapStatus,
            mapStatusLabel: ctx.mapStatusLabel,
            pinColor: ctx.pinColor,
            nextApptText: ctx.nextApptText,
            primaryRequest: ctx.primaryRequest,
          };
        }),
    [clients, requestsByClientId]
  );

  const filteredMapClients = useMemo(() => {
    let list = mapJobs;

    const q = clientListSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((job) => {
        const name = (job.client_name || '').toLowerCase();
        const farm = (job.farm_name || '').toLowerCase();
        const addressLine = (job.fullAddress || '').toLowerCase();
        const hay = [name, farm, addressLine].filter(Boolean).join(' ');
        return hay.includes(q);
      });
    }
    return list;
  }, [mapJobs, clientListSearch]);

  const mapMetrics = useMemo(() => {
    const year = new Date().getFullYear();
    const completed = requests.filter((r) => r.status === 'completed').length;
    const scheduled = requests.filter((r) => r.status === 'scheduled').length;
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

    const overdue = requests.filter((r) => {
      if (!['scheduled', 'assigned', 'in_progress'].includes(r.status)) return false;
      return isRequestOverdue(r);
    }).length;
    return { completed, scheduled, unscheduled, overdue, year };
  }, [requests, clients]);

  const selectedMapJob = useMemo(
    () => mapJobs.find((j) => String(j.id) === String(selectedMapJobId)),
    [mapJobs, selectedMapJobId]
  );
  const selectedClientEntity = useMemo(
    () => clients.find((c) => String(c.id) === String(selectedMapJobId)),
    [clients, selectedMapJobId]
  );
  const selectedClientRequests = useMemo(() => {
    if (!selectedMapJobId) return [];
    const list = requestsByClientId.get(selectedMapJobId) || [];
    return sortRequestsLatestServiceFirst(list);
  }, [selectedMapJobId, requestsByClientId]);
  const selectedClientNotesHistory = useMemo(() => {
    const raw = selectedClientEntity?.notes_history;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [raw];
      } catch {
        return [raw];
      }
    }
    return [raw];
  }, [selectedClientEntity]);

  const statusPillClass = {
    scheduled: 'bg-[#EEEDFE] text-[#534AB7]',
    unscheduled: 'bg-[#FAEEDA] text-[#BA7517]',
    overdue: 'bg-[#FCEBEB] text-[#A32D2D]',
    completed: 'bg-[#EAF3DE] text-[#3B6D11]',
    reactive: 'bg-[#E6F1FB] text-[#185FA5]',
  };
  const requestStatusPillClass = {
    new: 'bg-[#FAEEDA] text-[#BA7517]',
    scheduled: 'bg-[#EEEDFE] text-[#534AB7]',
    assigned: 'bg-[#EEEDFE] text-[#534AB7]',
    in_progress: 'bg-[#E6F1FB] text-[#185FA5]',
    pending: 'bg-[#FCEBEB] text-[#A32D2D]',
    overdue: 'bg-[#FCEBEB] text-[#A32D2D]',
    completed: 'bg-[#EAF3DE] text-[#3B6D11]',
    approved: 'bg-[#EAF3DE] text-[#3B6D11]',
    closed: 'bg-[#EAF3DE] text-[#3B6D11]',
  };

  if (requestsLoading) {
    return (
      <div data-source-location="pages/AdminDashboard:125:6" data-dynamic-content="false" className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner data-source-location="pages/AdminDashboard:126:8" data-dynamic-content="false" size="lg" text="Loading dashboard..." />
      </div>);

  }

  return (
    <div
      data-source-location="pages/AdminDashboard:132:4"
      data-dynamic-content="true"
      className="h-[calc(100dvh-6.5rem)] overflow-hidden lg:h-[calc(100dvh-2.5rem)]"
    >
      <div className="h-full">
          <div className="flex h-full flex-col overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-2 border-b border-black/10 bg-white px-4 py-2.5">
              <div className="mr-auto">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Dashboard — Map View</h1>
                <p className="mt-1 text-gray-500">Track clients, map coverage, and service progress</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="flex overflow-hidden rounded-md border border-black/10">
                  <button
                    type="button"
                    onClick={() => setMapBaseLayer('streets')}
                    className={cn(
                      'px-3 py-1 text-xs text-gray-600 transition-colors',
                      mapBaseLayer === 'streets' && 'bg-emerald-50 font-medium text-emerald-800'
                    )}
                  >
                    Map
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapBaseLayer('satellite')}
                    className={cn(
                      'border-l border-black/10 px-3 py-1 text-xs text-gray-600 transition-colors',
                      mapBaseLayer === 'satellite' && 'bg-emerald-50 font-medium text-emerald-800'
                    )}
                  >
                    Satellite
                  </button>
                </div>
                {/* <div className="rounded-md bg-[#f5f5f3] px-2.5 py-1 text-[11px] text-[#888780]">
                  Spring Startup — Season Active
                </div> */}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 border-b border-black/10 bg-[#f5f5f3] px-4 py-3 lg:grid-cols-4">
              <div className="rounded-md border border-black/10 bg-white px-3 py-2.5">
                <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#888780]">
                  <span>Completed jobs</span>
                  <CheckCircle className="h-3.5 w-3.5 text-[#1D9E75]" />
                </div>
                <div className="text-[22px] font-medium text-[#0F6E56]">{mapMetrics.completed}</div>
                <div className="mt-0.5 text-[10px] text-[#888780]">Spring {mapMetrics.year}</div>
              </div>
              <div className="rounded-md border border-black/10 bg-white px-3 py-2.5">
                <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#888780]">
                  <span>Scheduled</span>
                  <Calendar className="h-3.5 w-3.5 text-[#534AB7]" />
                </div>
                <div className="text-[22px] font-medium text-[#534AB7]">{mapMetrics.scheduled}</div>
                <div className="mt-0.5 text-[10px] text-[#888780]">appointments set</div>
              </div>
              <div className="rounded-md border border-black/10 bg-white px-3 py-2.5">
                <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#888780]">
                  <span>Unscheduled</span>
                  <Clock3 className="h-3.5 w-3.5 text-[#BA7517]" />
                </div>
                <div className="text-[22px] font-medium text-[#BA7517]">{mapMetrics.unscheduled}</div>
                <div className="mt-0.5 text-[10px] text-[#888780]">need booking</div>
              </div>
              <div className="rounded-md border border-black/10 bg-white px-3 py-2.5">
                <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#888780]">
                  <span>Overdue</span>
                  <AlertTriangle className="h-3.5 w-3.5 text-[#A32D2D]" />
                </div>
                <div className="text-[22px] font-medium text-[#A32D2D]">{mapMetrics.overdue}</div>
                <div className="mt-0.5 text-[10px] text-[#888780]">past due date</div>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-4">
              <div className="relative min-h-[320px] lg:col-span-3 lg:min-h-0">
                <DashboardMap
                  jobs={filteredMapClients}
                  variant="embedded"
                  className="absolute inset-0 h-full min-h-[320px]"
                  center={[39.5, -98.5]}
                  zoom={4}
                  autoCenterFromJobs={false}
                  baseLayer={mapBaseLayer === 'satellite' ? 'satellite' : 'streets'}
                  selectedJobId={selectedMapJobId}
                  onSelectJob={(job) => setSelectedMapJobId(job.id)}
                  onOpenClientDetail={(job) => {
                    setSelectedMapJobId(job.id);
                    setMapDetailOpen(true);
                  }}
                  onCreateServiceRequest={handleCreateServiceRequestFromMap}
                  flyToTarget={flyToTarget}
                  listSelectionPopupNonce={listSelectionPopupNonce}
                  toolbarEnd={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 border border-black/10 bg-white text-muted-foreground shadow-sm hover:bg-gray-50 hover:text-foreground"
                      onClick={() => setMapFullScreen(true)}
                      aria-label="Expand map"
                    >
                      <Expand className="h-4 w-4" />
                    </Button>
                  }
                />
                <div className="pointer-events-none absolute bottom-3 left-3 z-20 max-w-[200px] select-none rounded-md border border-black/10 bg-white p-2.5 shadow-sm">
                  <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-[#888780]">
                    Spring startup status
                  </div>
                  {[
                    { key: 'unscheduled', label: 'Unscheduled', dot: 'bg-[#EF9F27]' },
                    { key: 'scheduled', label: 'Scheduled', dot: 'bg-[#534AB7]' },
                    { key: 'overdue', label: 'Overdue', dot: 'bg-[#E24B4A]' },
                    { key: 'completed', label: 'Completed', dot: 'bg-[#1D9E75]' },
                  ].map((row) => (
                    <div key={row.key} className="mb-1 flex items-center gap-2 text-[11px] text-gray-600 last:mb-0">
                      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', row.dot)} />
                      {row.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden border-t border-black/10 bg-white lg:col-span-1 lg:border-l lg:border-t-0">
                <div className="shrink-0 space-y-2 border-b border-black/10 px-3.5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-gray-900">Clients in view</span>
                    <span className="shrink-0 text-[11px] text-[#888780]">{filteredMapClients.length} shown</span>
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search name, address, city, state, zip…"
                      value={clientListSearch}
                      onChange={(e) => setClientListSearch(e.target.value)}
                      className="h-9 border-black/10 pl-8 text-xs"
                      aria-label="Search clients by name or full address"
                    />
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain max-h-[min(50dvh,22rem)] lg:max-h-full">
                  {filteredMapClients.length === 0 ? (
                    <div className="px-3.5 py-8 text-center text-xs text-muted-foreground">
                      {clientListSearch.trim() ?
                      'No clients match your search.' :
                      'No clients with map coordinates available.'}
                    </div>
                  ) : (
                    filteredMapClients.map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => {
                          setSelectedMapJobId(job.id);
                          setFlyToTarget({ lat: job.location.lat, lng: job.location.lng });
                          window.setTimeout(() => setFlyToTarget(null), 2000);
                          setListSelectionPopupNonce((n) => n + 1);
                        }}
                        className={cn(
                          'flex w-full cursor-pointer gap-2.5 border-b border-black/10 px-3.5 py-2.5 text-left transition-colors hover:bg-[#f5f5f3]',
                          String(selectedMapJobId) === String(job.id) && 'bg-emerald-50'
                        )}
                      >
                        <span
                          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: job.pinColor }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium text-gray-900">{job.client_name}</div>
                          <div className="whitespace-normal break-words text-left text-[11px] leading-snug text-[#888780]">
                            {job.fullAddress || '—'}
                          </div>
                          <div className="mt-1">
                            <span
                              className={cn(
                                'inline-block rounded-[10px] px-2 py-0.5 text-[10px] font-medium',
                                statusPillClass[job.mapStatus] || statusPillClass.unscheduled
                              )}
                            >
                              {['scheduled', 'overdue'].includes(job.mapStatus) &&
                              job.nextApptText &&
                              job.nextApptText !== '—'
                                ? `${job.mapStatusLabel} — ${job.nextApptText}`
                                : job.mapStatusLabel}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

      </div>

      <Sheet open={mapDetailOpen} onOpenChange={setMapDetailOpen}>
        <SheetContent
          side="right"
          overlayClassName="bg-black/40"
          className="w-full overflow-y-auto sm:max-w-md"
        >
          {selectedClientEntity && selectedMapJob ? (
            <>
              <SheetHeader>
                <SheetTitle className="pr-8 text-left">Client card</SheetTitle>
                <SheetDescription className="text-left break-words text-muted-foreground">
                  {concatClientAddress(selectedClientEntity)}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-medium text-emerald-800">
                    {(selectedClientEntity.name || '?')
                      .split(/\s+/)
                      .filter(Boolean)
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{selectedClientEntity.name}</p>
                    {selectedClientEntity.farm_name && (
                      <p className="text-xs text-muted-foreground">{selectedClientEntity.farm_name}</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Contact details
                  </p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Phone</span>
                      <span>{selectedClientEntity.phone || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="shrink-0 text-muted-foreground">Address</span>
                      <span className="max-w-[70%] text-right break-words">
                        {concatClientAddress(selectedClientEntity)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Email</span>
                      <span className="truncate text-right text-[11px] text-blue-700">
                        {selectedClientEntity.email || '—'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-black/10" />
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Current season
                  </p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Last service request</span>
                      <span
                        className={cn(
                          'rounded-[10px] px-2 py-0.5 text-[10px] font-medium',
                          statusPillClass[selectedMapJob.mapStatus] || statusPillClass.unscheduled
                        )}
                      >
                        {selectedMapJob.mapStatusLabel}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Next appt</span>
                      <span>{selectedMapJob.nextApptText || '—'}</span>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-black/10" />
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Service history
                  </p>
                  <div className="space-y-2">
                    {selectedClientRequests.slice(0, 5).map((r) => {
                      const hist = getClientCardHistoryBucket(r);
                      const showActions = canEditOrCancelHistoryRequest(r);
                      return (
                        <div
                          key={r.id}
                          className="rounded-md border border-border bg-muted/40 px-2 py-2 text-[11px]"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              to={createPageUrl('ServiceRequests') + `?id=${r.id}`}
                              className="min-w-0 flex-1 text-left transition-colors hover:opacity-90"
                            >
                              <div className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
                                <span>#{r.request_number || r.id}</span>
                                <span
                                  className={cn(
                                    'inline-block rounded-[10px] px-2 py-0.5 text-[10px] font-medium',
                                    CLIENT_CARD_BUCKET_PILL_CLASS[hist.bucket] ||
                                    CLIENT_CARD_BUCKET_PILL_CLASS.unscheduled
                                  )}
                                >
                                  {hist.label}
                                </span>
                              </div>
                              <div className="mt-0.5 text-[10px] text-muted-foreground">
                                {r.issue_category?.replace(/_/g, ' ') || 'Request'}
                                {r.created_at &&
                                  ` · ${format(new Date(r.created_at), 'MMM d, yyyy')}`}
                              </div>
                            </Link>
                            {showActions ? (
                              <div className="flex shrink-0 items-center gap-1">
                                <Tooltip.Root>
                                  <Tooltip.Trigger asChild>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="h-7 w-7 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                                      disabled={historyActionsBusy}
                                      aria-label="Edit request"
                                      onClick={() => setHistoryEditRequest(r)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
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
                                      variant="outline"
                                      size="icon"
                                      className="h-7 w-7 border-muted-foreground/30 text-muted-foreground hover:border-red-500/50 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-500"
                                      disabled={historyActionsBusy}
                                      aria-label="Cancel request"
                                      onClick={() => setHistoryCancelRequest(r)}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  </Tooltip.Trigger>
                                  <Tooltip.Portal>
                                    <Tooltip.Content side="top" sideOffset={4}>
                                      Cancel request
                                      <Tooltip.Arrow className="fill-popover" />
                                    </Tooltip.Content>
                                  </Tooltip.Portal>
                                </Tooltip.Root>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                    {selectedClientRequests.length === 0 && (
                      <p className="text-xs text-muted-foreground">No service requests for this client yet.</p>
                    )}
                  </div>
                  <div className="mt-3 border-t border-black/10" />
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Notes history
                  </p>
                  <div className="space-y-2">
                    {selectedClientNotesHistory
                      .slice(0, 5)
                      .map((entry, idx) => {
                        const text =
                          typeof entry === 'string'
                            ? entry
                            : entry?.note || entry?.text || entry?.message || JSON.stringify(entry);
                        const whenRaw = entry?.created_at || entry?.date || entry?.timestamp;
                        const when = whenRaw ? format(new Date(whenRaw), 'MMM d, yyyy') : null;
                        return (
                        <div
                          key={`note-${idx}`}
                          className="rounded-md border border-border bg-muted/30 px-2 py-2 text-[11px]"
                        >
                          {when && <div className="mb-1 text-[10px] text-muted-foreground">{when}</div>}
                          <div className="line-clamp-3 text-foreground/90">
                            {text}
                          </div>
                        </div>
                      )})}
                    {selectedClientNotesHistory.length === 0 && (
                      <p className="text-xs text-muted-foreground">No notes history available.</p>
                    )}
                  </div>
                </div>

                <div className="pt-1">
                  <Button
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => {
                      setMapDetailOpen(false);
                      setClientForServiceRequest(selectedClientEntity);
                      setShowServiceRequestDialog(true);
                    }}
                  >
                    + Schedule service / new job
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <SheetHeader>
              <SheetTitle>Client</SheetTitle>
              <SheetDescription>No client selected.</SheetDescription>
            </SheetHeader>
          )}
        </SheetContent>
      </Sheet>

      {/* Full-screen map modal */}
      <Dialog open={mapFullScreen} onOpenChange={(open) => !open && setMapFullScreen(false)}>
        <DialogContent className="max-w-none w-[95vw] h-[90vh] sm:w-[98vw] sm:h-[95vh] rounded-lg p-0 gap-0 overflow-hidden border-0">
          <div className="flex h-full flex-col">
            <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b bg-background px-4 py-2 pr-12">
              <DialogTitle className="m-0 text-lg font-semibold">Dashboard — Map View</DialogTitle>
              <div className="ml-auto flex items-center gap-2">
                <div className="flex overflow-hidden rounded-md border text-xs">
                  <button
                    type="button"
                    onClick={() => setMapBaseLayer('streets')}
                    className={cn(
                      'px-2.5 py-1',
                      mapBaseLayer === 'streets' && 'bg-emerald-50 font-medium text-emerald-800'
                    )}
                  >
                    Map
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapBaseLayer('satellite')}
                    className={cn(
                      'border-l px-2.5 py-1',
                      mapBaseLayer === 'satellite' && 'bg-emerald-50 font-medium text-emerald-800'
                    )}
                  >
                    Satellite
                  </button>
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 p-2">
              <DashboardMap
                jobs={filteredMapClients}
                variant="embedded"
                className="h-full min-h-[70vh] rounded-lg border border-border"
                center={[39.5, -98.5]}
                zoom={4}
                autoCenterFromJobs={false}
                baseLayer={mapBaseLayer === 'satellite' ? 'satellite' : 'streets'}
                selectedJobId={selectedMapJobId}
                onSelectJob={(job) => setSelectedMapJobId(job.id)}
                onOpenClientDetail={(job) => {
                  setSelectedMapJobId(job.id);
                  setMapFullScreen(false);
                  setMapDetailOpen(true);
                }}
                onCreateServiceRequest={(job) => {
                  setMapFullScreen(false);
                  handleCreateServiceRequestFromMap(job);
                }}
                listSelectionPopupNonce={listSelectionPopupNonce}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Service Request dialog (from map client tooltip) */}
      <Dialog open={showServiceRequestDialog} onOpenChange={(open) => {
        setShowServiceRequestDialog(open);
        if (!open) setClientForServiceRequest(null);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Service Request</DialogTitle>
            <DialogDescription>
              {clientForServiceRequest ? `Create a service request for ${clientForServiceRequest.name}` : 'Fill in the details for the new service request'}
            </DialogDescription>
          </DialogHeader>
          <ServiceRequestForm
            request={null}
            initialClientId={clientForServiceRequest?.id}
            onSubmit={async (data) => {
              await createRequestMutation.mutateAsync(data);
            }}
            onCancel={() => {
              setShowServiceRequestDialog(false);
              setClientForServiceRequest(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!historyEditRequest}
        onOpenChange={(open) => {
          if (!open) setHistoryEditRequest(null);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Service Request</DialogTitle>
            <DialogDescription>
              {historyEditRequest
                ? `Update request #${historyEditRequest.request_number || historyEditRequest.id}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {historyEditRequest ? (
            <ServiceRequestForm
              request={historyEditRequest}
              initialClientId={historyEditRequest.client_id}
              onSubmit={async (data) => {
                await updateRequestMutation.mutateAsync({ id: historyEditRequest.id, data });
              }}
              onCancel={() => setHistoryEditRequest(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!historyCancelRequest}
        onOpenChange={(open) => {
          if (!open) setHistoryCancelRequest(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this request?</AlertDialogTitle>
            <AlertDialogDescription>
              {historyCancelRequest
                ? `Request #${historyCancelRequest.request_number || historyCancelRequest.id} will be marked cancelled.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelHistoryMutation.isPending}>Keep request</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelHistoryMutation.isPending}
              onClick={() => {
                if (historyCancelRequest) {
                  cancelHistoryMutation.mutate({ request: historyCancelRequest });
                }
              }}
            >
              {cancelHistoryMutation.isPending ? 'Cancelling…' : 'Cancel request'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);

}
