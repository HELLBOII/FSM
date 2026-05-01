import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { serviceRequestService, clientService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Expand, CheckCircle, Calendar, Clock3, AlertTriangle } from 'lucide-react';
import { Button } from "@/components/ui/button";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const CLOSED_STATUSES = ['completed', 'approved', 'closed'];

function isReactiveRequest(r) {
  return (
    r.priority === 'urgent' ||
    ['leak_repair', 'pump_issue', 'pipe_repair', 'valve_replacement'].includes(r.issue_category)
  );
}

function isRequestOverdue(r) {
  if (CLOSED_STATUSES.includes(r.status)) return false;
  if (r.is_sla_breached) return true;
  if (r.scheduled_date) {
    const d = new Date(r.scheduled_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    if (d < today && ['scheduled', 'assigned', 'new'].includes(r.status)) return true;
  }
  return false;
}

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

/** Wireframe-style map pin bucket from Supabase service_requests for a client. */
function deriveClientMapContext(sortedRequestsForClient) {
  const list = sortedRequestsForClient;
  if (!list.length) {
    return {
      mapStatus: 'unscheduled',
      mapStatusLabel: 'Unscheduled',
      pinColor: MAP_PIN_COLORS.unscheduled,
      nextApptText: '—',
      primaryRequest: null,
    };
  }
  const active = list.filter((r) => !CLOSED_STATUSES.includes(r.status));
  const pickPrimary = (pred) => active.find(pred) || list[0];

  if (active.some((r) => isRequestOverdue(r))) {
    const r = pickPrimary((x) => isRequestOverdue(x));
    return {
      mapStatus: 'overdue',
      mapStatusLabel: 'Overdue',
      pinColor: MAP_PIN_COLORS.overdue,
      nextApptText: formatRequestAppt(r),
      primaryRequest: r,
    };
  }
  if (active.some((r) => r.status === 'new' && !r.scheduled_date)) {
    const r = pickPrimary((x) => x.status === 'new' && !x.scheduled_date);
    return {
      mapStatus: 'unscheduled',
      mapStatusLabel: 'Unscheduled',
      pinColor: MAP_PIN_COLORS.unscheduled,
      nextApptText: '—',
      primaryRequest: r,
    };
  }
  if (active.some((r) => r.status === 'in_progress' && isReactiveRequest(r))) {
    const r = pickPrimary((x) => x.status === 'in_progress' && isReactiveRequest(x));
    return {
      mapStatus: 'reactive',
      mapStatusLabel: 'Reactive / Repair',
      pinColor: MAP_PIN_COLORS.reactive,
      nextApptText: formatRequestAppt(r),
      primaryRequest: r,
    };
  }
  if (active.some((r) => ['scheduled', 'assigned', 'in_progress'].includes(r.status))) {
    const r = pickPrimary((x) => ['scheduled', 'assigned', 'in_progress'].includes(x.status));
    return {
      mapStatus: 'scheduled',
      mapStatusLabel: 'Scheduled',
      pinColor: MAP_PIN_COLORS.scheduled,
      nextApptText: formatRequestAppt(r),
      primaryRequest: r,
    };
  }
  const lastDone = list.find((r) => r.status === 'completed') || list[0];
  return {
    mapStatus: 'completed',
    mapStatusLabel: 'Completed',
    pinColor: MAP_PIN_COLORS.completed,
    nextApptText: lastDone?.actual_end_time
      ? format(new Date(lastDone.actual_end_time), 'MMM d')
      : formatRequestAppt(lastDone),
    primaryRequest: lastDone,
  };
}

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [showServiceRequestDialog, setShowServiceRequestDialog] = useState(false);
  const [clientForServiceRequest, setClientForServiceRequest] = useState(null);
  const [mapFullScreen, setMapFullScreen] = useState(false);
  const [mapBaseLayer, setMapBaseLayer] = useState('streets');
  const [selectedMapJobId, setSelectedMapJobId] = useState(null);
  const [lassoSelectedIds, setLassoSelectedIds] = useState([]);
  const [mapDetailOpen, setMapDetailOpen] = useState(false);
  const [flyToTarget, setFlyToTarget] = useState(null);

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
      arr.sort((a, b) => {
        const tb = new Date(b.updated_at || b.created_at).getTime();
        const ta = new Date(a.updated_at || a.created_at).getTime();
        return tb - ta;
      });
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
    if (!lassoSelectedIds.length) return mapJobs;
    const selectedSet = new Set(lassoSelectedIds.map(String));
    return mapJobs.filter((job) => selectedSet.has(String(job.id)));
  }, [mapJobs, lassoSelectedIds]);

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
      if (r.status !== 'scheduled') return false;
      if (!r.scheduled_end_time) return false;
      const endDate = new Date(r.scheduled_end_time);
      if (Number.isNaN(endDate.getTime())) return false;
      endDate.setHours(0, 0, 0, 0);
      return endDate < today;
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
    return [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
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
                <div className="rounded-md bg-[#f5f5f3] px-2.5 py-1 text-[11px] text-[#888780]">
                  Spring Startup — Season Active
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setMapFullScreen(true)}
                  aria-label="Expand map"
                >
                  <Expand className="h-4 w-4" />
                </Button>
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
                  jobs={mapJobs}
                  variant="embedded"
                  className="absolute inset-0 h-full min-h-[320px]"
                  center={[39.5, -98.5]}
                  zoom={4}
                  autoCenterFromJobs={false}
                  baseLayer={mapBaseLayer === 'satellite' ? 'satellite' : 'streets'}
                  selectedJobId={selectedMapJobId}
                  onSelectJob={(job) => setSelectedMapJobId(job.id)}
                  onLassoSelectionChange={setLassoSelectedIds}
                  onOpenClientDetail={(job) => {
                    setSelectedMapJobId(job.id);
                    setMapDetailOpen(true);
                  }}
                  onCreateServiceRequest={handleCreateServiceRequestFromMap}
                  flyToTarget={flyToTarget}
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
                    { key: 'reactive', label: 'Reactive / As-needed', dot: 'bg-[#378ADD]' },
                  ].map((row) => (
                    <div key={row.key} className="mb-1 flex items-center gap-2 text-[11px] text-gray-600 last:mb-0">
                      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', row.dot)} />
                      {row.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden border-t border-black/10 bg-white lg:col-span-1 lg:border-l lg:border-t-0">
                <div className="flex shrink-0 items-center justify-between border-b border-black/10 px-3.5 py-3">
                  <span className="text-[13px] font-medium text-gray-900">Clients in view</span>
                  <span className="text-[11px] text-[#888780]">{filteredMapClients.length} shown</span>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain max-h-[min(50dvh,22rem)] lg:max-h-full">
                  {filteredMapClients.length === 0 ? (
                    <div className="px-3.5 py-8 text-center text-xs text-muted-foreground">
                      {lassoSelectedIds.length ?
                      'No clients found in lasso selection.' :
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
                          <div className="truncate text-[11px] text-[#888780]">{job.location?.address || '—'}</div>
                          <div className="mt-1">
                            <span
                              className={cn(
                                'inline-block rounded-[10px] px-2 py-0.5 text-[10px] font-medium',
                                statusPillClass[job.mapStatus] || statusPillClass.unscheduled
                              )}
                            >
                              {job.mapStatus === 'scheduled' && job.nextApptText && job.nextApptText !== '—'
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
                <SheetDescription className="text-left">
                  {selectedMapJob.location?.address || 'Address on file'}
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
                      <span className="text-muted-foreground">Address</span>
                      <span className="max-w-[70%] text-right">
                        {selectedMapJob.location?.address || selectedClientEntity.address || '—'}
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
                      <span className="text-muted-foreground">Map status</span>
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
                    {selectedClientRequests.slice(0, 5).map((r) => (
                      <Link
                        key={r.id}
                        to={createPageUrl('ServiceRequests') + `?id=${r.id}`}
                        className="block rounded-md border border-border bg-muted/40 px-2 py-2 text-[11px] transition-colors hover:bg-muted/60"
                      >
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <span>#{r.request_number}</span>
                          <span
                            className={cn(
                              'inline-block rounded-[10px] px-2 py-0.5 text-[10px] font-medium',
                              requestStatusPillClass[r.status] || requestStatusPillClass.new
                            )}
                          >
                            {(r.status || 'new').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          {r.issue_category?.replace(/_/g, ' ') || 'Request'}
                          {r.created_at && ` · ${format(new Date(r.created_at), 'MMM d, yyyy')}`}
                        </div>
                      </Link>
                    ))}
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
                jobs={mapJobs}
                variant="embedded"
                className="h-full min-h-[70vh] rounded-lg border border-border"
                center={[39.5, -98.5]}
                zoom={4}
                autoCenterFromJobs={false}
                baseLayer={mapBaseLayer === 'satellite' ? 'satellite' : 'streets'}
                selectedJobId={selectedMapJobId}
                onSelectJob={(job) => setSelectedMapJobId(job.id)}
                onLassoSelectionChange={setLassoSelectedIds}
                onOpenClientDetail={(job) => {
                  setSelectedMapJobId(job.id);
                  setMapFullScreen(false);
                  setMapDetailOpen(true);
                }}
                onCreateServiceRequest={(job) => {
                  setMapFullScreen(false);
                  handleCreateServiceRequestFromMap(job);
                }}
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
    </div>);

}
