import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { clientService, storageService, technicianService, emailService, serviceRequestService, irrigationSystemsService } from '@/services';
import { useAuth } from '@/lib/AuthContext';
import { buildAssignmentHistoryEntry, parseAssignmentHistory } from '@/utils/serviceRequestAudit';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, MapPin, Upload, X, Calendar, Eye, History, Plus } from 'lucide-react';
import ClientNotesHistoryDialog from '@/components/clients/ClientNotesHistoryDialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { addDays, format, isBefore, startOfToday } from 'date-fns';
import DashboardMap, { MAP_PIN_COLORS } from '@/components/map/DashboardMap';

/** Select options; values are persisted as chosen (same strings in DB). */
const issueCategories = [
  { value: 'Scheduled Maintenance', label: 'Scheduled Maintenance' },
  { value: 'Repair & Service', label: 'Repair & Service' },
  { value: 'Other', label: 'Other' },
];

const SEASON_OPTIONS = [
  { value: 'Spring', label: 'Spring' },
  { value: 'Summer', label: 'Summer' },
  { value: 'Fall', label: 'Fall' },
  { value: 'Winter', label: 'Winter' },
];

/** API may return 'T'/'F', boolean, or missing */
function normalizeIsCancelled(value) {
  if (value === true || value === 'T' || value === 't' || String(value).toLowerCase() === 'true') return 'T';
  return 'F';
}

/** API may return `irrigation_systems` as array, JSON string, or legacy `irrigation_type` text. */
function normalizeIrrigationSystemsFromRequest(request) {
  if (!request) return [];
  const parseFlexible = (raw) => {
    if (raw == null) return [];
    if (Array.isArray(raw)) {
      return raw.map((s) => String(s).trim()).filter(Boolean);
    }
    if (typeof raw === 'string') {
      const t = raw.trim();
      if (!t) return [];
      try {
        const p = JSON.parse(t);
        if (Array.isArray(p)) return p.map((s) => String(s).trim()).filter(Boolean);
        return [String(p).trim()].filter(Boolean);
      } catch {
        return t.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      }
    }
    return [];
  };

  let list = parseFlexible(request.irrigation_systems);
  if (!list.length) list = parseFlexible(request.irrigation_type);
  return list;
}

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

/** Aligns with AdminDashboard client card “service history” pills. */
function parseTimeMs(v) {
  if (v == null || v === '') return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
}

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

const MAP_CLIENT_CARD_STATUS_PILL = {
  scheduled: 'bg-[#EEEDFE] text-[#534AB7]',
  unscheduled: 'bg-[#FAEEDA] text-[#BA7517]',
  overdue: 'bg-[#FCEBEB] text-[#A32D2D]',
  completed: 'bg-[#EAF3DE] text-[#3B6D11]',
  reactive: 'bg-[#E6F1FB] text-[#185FA5]',
};

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

export default function ServiceRequestForm({
  request,
  onSubmit,
  onCancel,
  initialClientId,
  initialStartTime,
  initialEndTime,
  readOnly = false,
  showEditInReadOnly = false,
  onEditRequest,
  actionsDisabled = false,
}) {
  const isReadOnly = readOnly === true;
  /** Thinner focus ring / border once a value is chosen; slightly stronger when empty. */
  const SELECT_TRIGGER_READ_ONLY = 'cursor-default data-[disabled]:opacity-100';
  function selectTriggerChrome({ filled, flex }) {
    return cn(
      'h-10 min-h-10 text-sm sm:text-base border bg-transparent',
      flex && 'flex-1 min-w-0',
      filled
        ? 'border-primary/25 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/40'
        : 'border-primary/30 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/35'
    );
  }
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    client_id: '',
    client_name: '',
    farm_name: '',
    contact_phone: '',
    location: { lat: null, lng: null, address: '' },
    irrigation_systems: [],
    issue_category: '',
    season: '',
    priority: 'medium',
    description: '',
    acreage_affected: '1',
    photos: [],
    notes: '',
    status: 'scheduled',
    assigned_technician_id: '',
    assigned_technician_name: '',
    assigned_technician_phone: '',
    from_time: null,
    to_time: null,
    is_cancelled: 'F',
  });
  const [fromDateTime, setFromDateTime] = useState(null);
  const [toDateTime, setToDateTime] = useState(null);
  const [photoPaths, setPhotoPaths] = useState([]); // Store file paths for deletion
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [clientNotesHistoryOpen, setClientNotesHistoryOpen] = useState(false);
  const [showAddIrrigationDialog, setShowAddIrrigationDialog] = useState(false);
  const [newIrrigationSystem, setNewIrrigationSystem] = useState('');
  const [errors, setErrors] = useState({});
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [isCancelSaving, setIsCancelSaving] = useState(false);
  const lastInitialClientMapBumpRef = useRef(null);
  const [mapClientSheetOpen, setMapClientSheetOpen] = useState(false);
  const [mapSheetClientId, setMapSheetClientId] = useState(null);
  const [mapSheetFlyTo, setMapSheetFlyTo] = useState(null);
  const statusKey = String(formData?.status || request?.status || '').toLowerCase();
  const isCancelledStatus =
    statusKey === 'cancelled' || normalizeIsCancelled(formData?.is_cancelled ?? request?.is_cancelled) === 'T';
  const isCompletedStatus = statusKey === 'completed';
  const isCompletedOrCancelled = isCompletedStatus || isCancelledStatus;

  const { data: clients = [], isLoading: isLoadingClients } = useQuery({
    queryKey: ['clients', 'forSelection'],
    queryFn: () => clientService.listForSelection()
  });

  const { data: technicians = [], isLoading: isLoadingTechnicians } = useQuery({
    queryKey: ['technicians', 'active', 'forSelection'],
    queryFn: () => technicianService.listActiveForSelection()
  });

  const selectedClientId = formData.client_id ? String(formData.client_id) : '';
  const selectedTechnicianId = formData.assigned_technician_id
    ? String(formData.assigned_technician_id)
    : '';

  const needsLinkedClient =
    !!selectedClientId && !clients.some((c) => String(c.id) === selectedClientId);
  const { data: linkedClient } = useQuery({
    queryKey: ['clients', 'linked', selectedClientId],
    queryFn: () => clientService.getById(selectedClientId),
    enabled: needsLinkedClient
  });

  const needsLinkedTechnician =
    !!selectedTechnicianId &&
    !technicians.some((t) => String(t.id) === selectedTechnicianId);
  const { data: linkedTechnician } = useQuery({
    queryKey: ['technicians', 'linked', selectedTechnicianId],
    queryFn: () => technicianService.getById(selectedTechnicianId),
    enabled: needsLinkedTechnician
  });

  const clientsForSelect = useMemo(() => {
    if (linkedClient && !clients.some((c) => String(c.id) === String(linkedClient.id))) {
      return [linkedClient, ...clients];
    }
    return clients;
  }, [clients, linkedClient]);

  const techniciansForSelect = useMemo(() => {
    if (
      linkedTechnician &&
      !technicians.some((t) => String(t.id) === String(linkedTechnician.id))
    ) {
      return [linkedTechnician, ...technicians];
    }
    return technicians;
  }, [technicians, linkedTechnician]);
  const { data: requestsBundle } = useQuery({
    queryKey: ['serviceRequests', 'listForRequestsPage', 500],
    queryFn: () => serviceRequestService.listActiveWithCancelledCount(500),
  });
  const requests = requestsBundle?.requests ?? [];
  const { data: dbIrrigationSystems = [] } = useQuery({
    queryKey: ['irrigationSystems'],
    queryFn: () => irrigationSystemsService.list()
  });

  /** `irrigation_systems` table + labels already on clients (legacy / not yet in lookup table). */
  const availableIrrigationSystems = useMemo(() => {
    const fromDb = dbIrrigationSystems
      .map((row) => (row.irrigation_systems == null ? '' : String(row.irrigation_systems).trim()))
      .filter(Boolean);
    const fromClients = clients.flatMap((c) =>
      (c.irrigation_systems || []).map((s) => (s == null ? '' : String(s).trim())).filter(Boolean)
    );
    return [...new Set([...fromDb, ...fromClients])].sort((a, b) => a.localeCompare(b));
  }, [clients, dbIrrigationSystems]);

  const irrigationPickList = useMemo(
    () => availableIrrigationSystems.filter((sys) => !formData.irrigation_systems.includes(sys)),
    [availableIrrigationSystems, formData.irrigation_systems]
  );

  const createIrrigationSystemMutation = useMutation({
    mutationFn: (data) => irrigationSystemsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['irrigationSystems'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setNewIrrigationSystem('');
      setShowAddIrrigationDialog(false);
      toast.success('Irrigation system added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add irrigation system: ' + (error?.message || 'Unknown error'));
    }
  });

  const handleAddIrrigationSystem = async () => {
    const systemName = newIrrigationSystem.trim();
    if (!systemName) return;

    try {
      const existing = await irrigationSystemsService.getByName(systemName);
      if (existing) {
        toast.error('This irrigation system already exists');
        return;
      }
    } catch (error) {
      if (error.code !== 'PGRST116') throw error;
    }
    await createIrrigationSystemMutation.mutateAsync({ irrigation_systems: systemName });
    setFormData((prev) => ({
      ...prev,
      irrigation_systems: prev.irrigation_systems.includes(systemName)
        ? prev.irrigation_systems
        : [...prev.irrigation_systems, systemName],
    }));
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
          const lat = Number(client.location?.lat ?? client.latitude);
          const lng = Number(client.location?.lng ?? client.longitude);
          return Number.isFinite(lat) && Number.isFinite(lng);
        })
        .map((client) => {
          const lat = Number(client.location?.lat ?? client.latitude);
          const lng = Number(client.location?.lng ?? client.longitude);
          const reqs = requestsByClientId.get(client.id) || [];
          const ctx = deriveClientMapContext(reqs);
          return {
            id: client.id,
            client_name: client.name || 'Client',
            farm_name: client.farm_name || '',
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

  const formMapFlyTo = useMemo(() => {
    if (!formData.client_id) return null;
    const client = clients.find((c) => String(c.id) === String(formData.client_id));
    if (!client) return null;
    const lat = Number(client.location?.lat ?? client.latitude);
    const lng = Number(client.location?.lng ?? client.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, [clients, formData.client_id]);

  const mapUiSelectedJobId = useMemo(() => {
    if (mapClientSheetOpen && mapSheetClientId) return mapSheetClientId;
    return formData.client_id ? String(formData.client_id) : null;
  }, [mapClientSheetOpen, mapSheetClientId, formData.client_id]);

  const mapEffectiveFlyTo = useMemo(
    () => mapSheetFlyTo ?? formMapFlyTo,
    [mapSheetFlyTo, formMapFlyTo]
  );

  const sheetMapJob = useMemo(() => {
    if (!mapSheetClientId) return null;
    return mapJobs.find((j) => String(j.id) === String(mapSheetClientId)) ?? null;
  }, [mapJobs, mapSheetClientId]);

  const sheetClientEntity = useMemo(
    () => clients.find((c) => String(c.id) === String(mapSheetClientId)),
    [clients, mapSheetClientId]
  );

  const sheetClientRequests = useMemo(() => {
    if (!mapSheetClientId) return [];
    for (const [k, arr] of requestsByClientId.entries()) {
      if (String(k) === String(mapSheetClientId)) return sortRequestsLatestServiceFirst([...arr]);
    }
    return [];
  }, [mapSheetClientId, requestsByClientId]);

  const sheetClientNotesHistory = useMemo(() => {
    const raw = sheetClientEntity?.notes_history;
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
  }, [sheetClientEntity]);

  const openMapClientSheet = useCallback((job) => {
    if (!job?.id) return;
    setMapSheetClientId(String(job.id));
    setMapClientSheetOpen(true);
    if (job.location?.lat != null && job.location?.lng != null) {
      const la = Number(job.location.lat);
      const ln = Number(job.location.lng);
      if (Number.isFinite(la) && Number.isFinite(ln)) {
        setMapSheetFlyTo({ lat: la, lng: ln });
        window.setTimeout(() => setMapSheetFlyTo(null), 2000);
      }
    }
  }, []);

  // Reusable skeleton component for Select fields
  const SelectSkeleton = () => (
    <div className="flex h-10 min-h-10 w-full items-center rounded-md border border-input bg-muted px-3 animate-pulse">
      <div className="h-4 w-36 rounded bg-muted-foreground/20 sm:h-5" />
    </div>
  );

  useEffect(() => {
    if (request) {
      // Parse scheduled_start_time and scheduled_end_time if they exist
      let fromDateTimeValue = null;
      let toDateTimeValue = null;

      if (request.scheduled_start_time) {
        fromDateTimeValue = new Date(request.scheduled_start_time);
      }
      if (request.scheduled_end_time) {
        toDateTimeValue = new Date(request.scheduled_end_time);
      } else if (fromDateTimeValue) {
        toDateTimeValue = addDays(fromDateTimeValue, 1);
      }

      setFromDateTime(fromDateTimeValue);
      setToDateTime(toDateTimeValue);

      const irrigationSystemsFromRequest = normalizeIrrigationSystemsFromRequest(request);

      const {
        irrigation_type: _omitIrrigationType,
        irrigation_systems: _omitIrrigationSystems,
        issue_category: _omitIssueCat,
        assignment_history: _omitAssignmentHistory,
        created_by: _omitCreatedBy,
        created_on: _omitCreatedOn,
        modified_by: _omitModifiedBy,
        modified_on: _omitModifiedOn,
        ...requestRest
      } = request;

      setFormData({
        ...requestRest,
        acreage_affected: request.acreage_affected?.toString() || '1',
        from_time: fromDateTimeValue,
        to_time: toDateTimeValue,
        issue_category: request.issue_category != null ? String(request.issue_category).trim() : '',
        season: request.season != null ? String(request.season).trim() : '',
        irrigation_systems: irrigationSystemsFromRequest,
        is_cancelled: normalizeIsCancelled(request.is_cancelled),
      });
      // Extract paths from photo URLs if they exist
      if (request.photos && Array.isArray(request.photos)) {
        const paths = request.photos.map(url => {
          try {
            // Supabase URL format: https://[project].supabase.co/storage/v1/object/public/uploads/[filename]
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/').filter(part => part);
            const uploadsIndex = pathParts.findIndex(part => part === 'uploads');
            if (uploadsIndex !== -1 && pathParts[uploadsIndex + 1]) {
              return pathParts.slice(uploadsIndex + 1).join('/');
            }
          } catch (error) {
            console.error('Failed to extract path from URL:', error);
          }
          return null;
        }).filter(Boolean);
        setPhotoPaths(paths);
      } else {
        setPhotoPaths([]);
      }
    } else {
      setPhotoPaths([]);
      // Pre-fill start/end from calendar slot click (initialStartTime, initialEndTime)
      if (initialStartTime != null || initialEndTime != null) {
        const startVal = initialStartTime != null ? new Date(initialStartTime) : null;
        const endVal =
          initialEndTime != null
            ? new Date(initialEndTime)
            : startVal
              ? addDays(startVal, 1)
              : null;
        setFromDateTime(startVal);
        setToDateTime(endVal);
        setFormData(prev => ({
          ...prev,
          from_time: startVal,
          to_time: endVal
        }));
      }
    }
  }, [request, initialStartTime, initialEndTime]);

  // Prefill client when opening form from map (e.g. "Create service request" on client marker)
  useEffect(() => {
    if (!initialClientId) {
      lastInitialClientMapBumpRef.current = null;
    }
    if (!request && initialClientId && clients.length > 0) {
      const client = clients.find((c) => c.id === initialClientId);
      if (client) {
        const lat = client.location?.lat ?? client.latitude ?? null;
        const lng = client.location?.lng ?? client.longitude ?? null;
        setFormData((prev) => ({
          ...prev,
          client_id: client.id,
          client_name: client.name,
          farm_name: client.farm_name ?? '',
          contact_phone: client.phone ?? '',
          location: {
            lat,
            lng,
            address: client.address ?? '',
          },
          irrigation_systems: client.irrigation_systems?.length ? [...client.irrigation_systems] : prev.irrigation_systems,
        }));
        const bumpKey = String(initialClientId);
        if (lastInitialClientMapBumpRef.current !== bumpKey) {
          lastInitialClientMapBumpRef.current = bumpKey;
        }
      }
    }
  }, [request, initialClientId, clients]);

  const handleClientSelect = (clientId) => {
    if (isReadOnly) return;
    const client = clients.find((c) => String(c.id) === String(clientId));
    if (client) {
      // Extract location data from client
      const lat = client.location?.lat ?? client.latitude ?? null;
      const lng = client.location?.lng ?? client.longitude ?? null;
      const address = client.address || '';
      
      setFormData(prev => ({
        ...prev,
        client_id: client.id,
        client_name: client.name,
        farm_name: client.farm_name,
        contact_phone: client.phone,
        location: {
          lat: lat,
          lng: lng,
          address: address
        },
        irrigation_systems: client.irrigation_systems?.length ? [...client.irrigation_systems] : [],
      }));
      setErrors((prev) => ({ ...prev, client_id: '' }));
    }
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!formData.client_id) nextErrors.client_id = 'Client is required.';
    if (!formData.irrigation_systems?.length) nextErrors.irrigation_systems = 'Add at least one irrigation system.';
    if (!formData.issue_category) nextErrors.issue_category = 'Issue category is required.';
    if (!String(formData.season || '').trim()) {
      nextErrors.season = 'Season is required.';
    }
    if (!fromDateTime) nextErrors.from_time = 'Start time is required.';
    if (!toDateTime) nextErrors.to_time = 'End time is required.';
    if (fromDateTime && toDateTime && toDateTime <= fromDateTime) {
      nextErrors.to_time = 'End time must be after start time.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploadingPhoto(true);
    try {
      const { file_url, path } = await storageService.uploadFile(file);
      setFormData(prev => ({
        ...prev,
        photos: [...prev.photos, file_url]
      }));
      setPhotoPaths(prev => [...prev, path]);
    } catch (error) {
      toast.error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = async (index) => {
    const photoUrl = formData.photos[index];
    const photoPath = photoPaths[index];
    
    // Remove from UI immediately
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
    setPhotoPaths(prev => prev.filter((_, i) => i !== index));
    
    // Delete from storage if path exists
    if (photoPath) {
      try {
        await storageService.deleteFile(photoPath);
      } catch (error) {
        console.error('Failed to delete photo from storage:', error);
        toast.error('Failed to delete photo from storage');
        // Revert the removal if deletion fails
        setFormData(prev => ({
          ...prev,
          photos: [...prev.photos.slice(0, index), photoUrl, ...prev.photos.slice(index + 1)]
        }));
        setPhotoPaths(prev => [...prev.slice(0, index), photoPath, ...prev.slice(index + 1)]);
      }
    } else if (photoUrl) {
      // Try to extract path from Supabase storage URL
      try {
        // Supabase URL format: https://[project].supabase.co/storage/v1/object/public/uploads/[filename]
        const urlObj = new URL(photoUrl);
        const pathParts = urlObj.pathname.split('/').filter(part => part);
        
        // Find the index of 'uploads' bucket
        const uploadsIndex = pathParts.findIndex(part => part === 'uploads');
        if (uploadsIndex !== -1 && pathParts[uploadsIndex + 1]) {
          // Get everything after 'uploads' as the path
          const path = pathParts.slice(uploadsIndex + 1).join('/');
          await storageService.deleteFile(path);
        }
      } catch (error) {
        console.error('Failed to delete photo from storage:', error);
        // Don't show error for URL-based deletion failures to avoid disrupting UX
      }
    }
  };

  const handleConfirmCancelRequest = async () => {
    if (!request?.id) return;
    setIsCancelSaving(true);
    try {
      await onSubmit({
        is_cancelled: 'T',
        modified_by: user?.id ?? null,
        modified_on: new Date().toISOString(),
      });
      setFormData((prev) => ({ ...prev, is_cancelled: 'T' }));
      setCancelConfirmOpen(false);
    } catch (err) {
      toast.error(err?.message || 'Failed to cancel request');
    } finally {
      setIsCancelSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (normalizeIsCancelled(formData.is_cancelled) === 'T') {
      toast.error('This request is cancelled and cannot be saved.');
      return;
    }
    if (!validateForm()) {
      toast.error('Please fill all mandatory fields.');
      return;
    }
    setIsLoading(true);
    
    try {
      // Ensure location is a proper object structure
      const locationData = formData.location && typeof formData.location === 'object' 
        ? {
            lat: formData.location.lat ?? null,
            lng: formData.location.lng ?? null,
            address: formData.location.address || ''
          }
        : { lat: null, lng: null, address: '' };

      // Use display state for dates so submitted times match what the user selected (avoids stale state)
      const startTime = fromDateTime ?? formData.from_time
      const endTime = toDateTime ?? formData.to_time
      const {
        from_time: _ft,
        to_time: _tt,
        assignment_history: _omitHist,
        created_by: _omitCb,
        created_on: _omitCon,
        modified_by: _omitMb,
        modified_on: _omitMon,
        ...formFields
      } = formData;
      const submitData = {
        ...formFields,
        acreage_affected: formData.acreage_affected ? parseFloat(formData.acreage_affected) : null,
        request_number: request?.request_number || `SR-${Date.now().toString(36).toUpperCase()}`,
        scheduled_start_time: startTime ? startTime.toISOString() : null,
        scheduled_end_time: endTime ? endTime.toISOString() : null,
        contact_phone: formData.contact_phone || '',
        location: locationData,
        irrigation_systems: formData.irrigation_systems || [],
        assigned_technician_id: formData.assigned_technician_id || null,
        assigned_technician_name: formData.assigned_technician_id ? formData.assigned_technician_name : null,
        assigned_technician_phone: formData.assigned_technician_id ? (formData.assigned_technician_phone || '') : '',
        is_cancelled: 'F',
        season: String(formData.season || '').trim() || null,
      };

      const actorId = user?.id ?? null;
      const nowIso = new Date().toISOString();
      if (!request) {
        submitData.created_by = actorId;
        submitData.created_on = nowIso;
        submitData.modified_by = null;
        submitData.modified_on = null;
      } else {
        submitData.modified_by = actorId;
        submitData.modified_on = nowIso;
        const historyEntry = buildAssignmentHistoryEntry(request, submitData, actorId);
        if (historyEntry) {
          submitData.assignment_history = [
            ...parseAssignmentHistory(request.assignment_history),
            historyEntry,
          ];
        }
      }

      // Submit the form
      await onSubmit(submitData);
      
      // Send email notifications after successful submission
      // const isUpdate = !!request;
      
      // Get technician data if assigned (for including in client email)
      // let technician = null;
      // if (submitData.assigned_technician_id) {
      //   technician = technicians.find(t => t.id === submitData.assigned_technician_id);
      //   // Add technician phone to submitData for client email
      //   if (technician && technician.phone) {
      //     submitData.technician_mobile = technician.phone;
      //   }
      // }
      
      // Send email to client
      // if (submitData.client_id) {
      //   const client = clients.find(c => c.id === submitData.client_id);
      //   if (client && client.email) {
      //     try {
      //       await emailService.sendClientNotification(submitData, client, isUpdate);
      //     } catch (error) {
      //       console.error('Failed to send email to client:', error);
      //       // Don't show error to user, email sending failure shouldn't block form submission
      //     }
      //   }
      // }
      
      // Send email to technician if assigned
      // if (technician && technician.email) {
      //   try {
      //     await emailService.sendTechnicianNotification(submitData, technician, isUpdate);
      //   } catch (error) {
      //     console.error('Failed to send email to technician:', error);
      //     // Don't show error to user, email sending failure shouldn't block form submission
      //   }
      // }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle from date/time changes — default end to start + 1 day (user can edit end afterward)
  const handleFromDateTimeChange = (dateTime) => {
    setFromDateTime(dateTime);
    if (!dateTime) {
      setToDateTime(null);
      setFormData((prev) => ({ ...prev, from_time: null, to_time: null }));
      setErrors((prev) => ({ ...prev, from_time: '', to_time: '' }));
      return;
    }
    const nextEndDefault = addDays(dateTime, 1);
    setToDateTime((prevTo) => {
      if (!prevTo || prevTo <= dateTime) return nextEndDefault;
      return prevTo;
    });
    setFormData((prev) => {
      const prevTo = prev.to_time ? new Date(prev.to_time) : null;
      const newTo = !prevTo || prevTo <= dateTime ? nextEndDefault : prevTo;
      return { ...prev, from_time: dateTime, to_time: newTo };
    });
    setErrors((prev) => ({ ...prev, from_time: '', to_time: '' }));
  };

  // Handle to date/time changes
  const handleToDateTimeChange = (dateTime) => {
    setToDateTime(dateTime);
    setFormData(prev => ({ ...prev, to_time: dateTime }));
    setErrors((prev) => ({ ...prev, to_time: '' }));
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-6', isReadOnly && 'text-gray-900')}>
      <div className="space-y-3">
        {/* Row 1: Client | Issue category | Irrigation systems | Season (4 columns on large screens) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0">
            <Label className="text-sm mb-2 block">Select Client <span className="text-red-600">*</span></Label>
            {isLoadingClients ? (
              <SelectSkeleton />
            ) : (
              <div className="flex items-center gap-2">
                <Select
                  modal={false}
                  value={formData.client_id ? String(formData.client_id) : undefined}
                  onValueChange={handleClientSelect}
                  disabled={isReadOnly || clientsForSelect.length === 0}
                >
                  <SelectTrigger
                    className={cn(
                      selectTriggerChrome({ filled: !!formData.client_id, flex: true }),
                      isReadOnly && SELECT_TRIGGER_READ_ONLY,
                      errors.client_id && 'border-red-500'
                    )}
                    aria-invalid={errors.client_id ? true : undefined}
                  >
                    <SelectValue placeholder="Choose a client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clientsForSelect.length > 0 ? (
                      clientsForSelect.map((client) => (
                        <SelectItem key={client.id} value={String(client.id)}>
                          {[client.name, client.farm_name].filter(Boolean).join(' — ') || String(client.id)}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__none__" disabled>
                        No clients available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {formData.client_id ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0 border-primary/60 text-primary hover:bg-primary/10"
                    title={
                      isReadOnly
                        ? 'Client notes history — view only'
                        : 'Client notes history — view and add entries'
                    }
                    aria-label="Open client notes history"
                    onClick={() => setClientNotesHistoryOpen(true)}
                  >
                    <History className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            )}
            {errors.client_id && <p className="mt-1 text-xs text-red-600">{errors.client_id}</p>}
          </div>

          <div className="min-w-0">
            <Label className="mb-2 block text-sm">
              Issue Category <span className="text-red-600">*</span>
            </Label>
            <Select
              modal={false}
              value={formData.issue_category || undefined}
              onValueChange={(v) => {
                setFormData((prev) => ({ ...prev, issue_category: v }));
                setErrors((prev) => ({ ...prev, issue_category: '' }));
              }}
              disabled={isReadOnly}
            >
              <SelectTrigger
                className={cn(
                  selectTriggerChrome({ filled: !!formData.issue_category, flex: false }),
                  isReadOnly && SELECT_TRIGGER_READ_ONLY,
                  errors.issue_category && 'border-red-500'
                )}
                aria-invalid={errors.issue_category ? true : undefined}
              >
                <SelectValue placeholder="Select issue category..." />
              </SelectTrigger>
              <SelectContent>
                {issueCategories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.issue_category && <p className="mt-1 text-xs text-red-600">{errors.issue_category}</p>}
          </div>

          <div className="min-w-0">
            <Label className="mb-2 block text-sm">
              Irrigation Systems <span className="text-red-600">*</span>
            </Label>
            <>
              <Select
                value=""
                modal={false}
                disabled={isReadOnly}
                onValueChange={(v) => {
                  if (isReadOnly) return;
                  if (v === '__add_new__') {
                    setShowAddIrrigationDialog(true);
                  } else if (v && !formData.irrigation_systems.includes(v)) {
                    setFormData((prev) => ({
                      ...prev,
                      irrigation_systems: [...prev.irrigation_systems, v],
                    }));
                    setErrors((prev) => ({ ...prev, irrigation_systems: '' }));
                  }
                }}
              >
                <SelectTrigger
                  className={cn(
                    selectTriggerChrome({
                      filled: formData.irrigation_systems.length > 0,
                      flex: false,
                    }),
                    isReadOnly && SELECT_TRIGGER_READ_ONLY,
                    errors.irrigation_systems && 'border-red-500'
                  )}
                  aria-invalid={errors.irrigation_systems ? true : undefined}
                >
                  <SelectValue placeholder={isReadOnly ? 'Systems on this request' : 'Add system type...'} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {irrigationPickList.length > 0 ? (
                    irrigationPickList.map((sys) => (
                      <SelectItem key={sys} value={sys}>
                        {sys}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__all_added__" disabled>
                      All listed systems added — add custom below
                    </SelectItem>
                  )}
                  <SelectSeparator />
                  <SelectItem value="__add_new__" className="font-medium text-primary" disabled={isReadOnly}>
                    <Plus className="mr-2 inline h-4 w-4" />
                    Add new Irrigation System
                  </SelectItem>
                </SelectContent>
              </Select>
              {formData.irrigation_systems.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {formData.irrigation_systems.map((sys, idx) => (
                    <Badge
                      key={`${sys}-${idx}`}
                      variant={isReadOnly ? 'outline' : undefined}
                      className={
                        isReadOnly
                          ? 'cursor-default border-gray-300 bg-transparent text-gray-900'
                          : 'cursor-pointer bg-primary text-primary-foreground transition-colors hover:bg-primary/90'
                      }
                      onClick={
                        isReadOnly
                          ? undefined
                          : () =>
                              setFormData((prev) => ({
                                ...prev,
                                irrigation_systems: prev.irrigation_systems.filter((_, i) => i !== idx),
                              }))
                      }
                    >
                      {sys}
                      {!isReadOnly ? ' ×' : ''}
                    </Badge>
                  ))}
                </div>
              )}
            </>
            {errors.irrigation_systems && (
              <p className="mt-1 text-xs text-red-600">{errors.irrigation_systems}</p>
            )}
          </div>

          <div className="min-w-0">
            <Label className="mb-2 block text-sm">
              Season <span className="text-red-600">*</span>
            </Label>
            <Select
              modal={false}
              value={formData.season || undefined}
              onValueChange={(v) => {
                setFormData((prev) => ({ ...prev, season: v }));
                setErrors((prev) => ({ ...prev, season: '' }));
              }}
              disabled={isReadOnly}
            >
              <SelectTrigger
                className={cn(
                  selectTriggerChrome({ filled: !!formData.season, flex: false }),
                  isReadOnly && SELECT_TRIGGER_READ_ONLY,
                  errors.season && 'border-red-500'
                )}
                aria-invalid={errors.season ? true : undefined}
                aria-label="Season"
              >
                <SelectValue placeholder="Select season..." />
              </SelectTrigger>
              <SelectContent>
                {SEASON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.season && <p className="mt-1 text-xs text-red-600">{errors.season}</p>}
          </div>
        </div>

        {/* Row 2: From Time, To Time, Technician (3 columns) */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="min-w-0">
            <Label className="text-sm mb-2 block">Start date & time <span className="text-red-600">*</span></Label>
            <DateTimePicker
              date={fromDateTime}
              onDateChange={handleFromDateTimeChange}
              placeholder="Select start date & time"
              className={cn('border-primary/30 focus-visible:ring-primary')}
              disabled={isReadOnly}
              disabledAsViewOnly={isReadOnly}
            />
            {errors.from_time && <p className="mt-1 text-xs text-red-600">{errors.from_time}</p>}
          </div>

          <div className="min-w-0">
            <Label className="text-sm mb-2 block">End date & time <span className="text-red-600">*</span></Label>
            <DateTimePicker
              date={toDateTime}
              onDateChange={handleToDateTimeChange}
              placeholder="Select end date & time"
              className={cn('border-primary/30 focus-visible:ring-primary')}
              disabled={isReadOnly}
              disabledAsViewOnly={isReadOnly}
            />
            {errors.to_time && <p className="mt-1 text-xs text-red-600">{errors.to_time}</p>}
          </div>

          <div className="flex min-w-0 gap-2">
            <div className="min-w-0 flex-1">
              <Label className="text-sm mb-2 block">Technician</Label>
              {isLoadingTechnicians ? (
                <SelectSkeleton />
              ) : (
                <Select
                  modal={false}
                  value={formData.assigned_technician_id ? String(formData.assigned_technician_id) : undefined}
                  onValueChange={(v) => {
                    const technician = techniciansForSelect.find((t) => String(t.id) === String(v));
                    setFormData((prev) => ({
                      ...prev,
                      assigned_technician_id: v || '',
                      assigned_technician_name: technician ? technician.name : '',
                      assigned_technician_phone: technician ? technician.phone : '',
                    }));
                  }}
                  disabled={isReadOnly || techniciansForSelect.length === 0}
                >
                  <SelectTrigger
                    className={cn(
                      selectTriggerChrome({ filled: !!formData.assigned_technician_id, flex: false }),
                      isReadOnly && SELECT_TRIGGER_READ_ONLY
                    )}
                  >
                    <SelectValue placeholder="Select technician..." />
                  </SelectTrigger>
                  <SelectContent>
                    {techniciansForSelect.length > 0 ? (
                      techniciansForSelect.map((tech) => (
                        <SelectItem key={tech.id} value={String(tech.id)}>
                          {tech.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__no-tech__" disabled>
                        No technicians available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowAssignmentDialog(true)}
                className="h-10 w-10 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                disabled={!formData.client_id || !formData.assigned_technician_id}
                title={
                  !formData.client_id || !formData.assigned_technician_id
                    ? 'Select a client and a technician to view assignment details'
                    : 'View assignment details'
                }
              >
                <Eye className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Map (Dashboard-style) */}
        <DashboardMap
          jobs={mapJobs}
          center={[39.5, -98.5]}
          zoom={4}
          autoCenterFromJobs={false}
          selectedJobId={mapUiSelectedJobId}
          flyToTarget={mapEffectiveFlyTo}
          onSelectJob={isReadOnly ? undefined : (job) => handleClientSelect(job.id)}
          onOpenClientDetail={(job) => openMapClientSheet(job)}
          className="h-[300px]"
        />
      </div>

      {/* Assignment Details Dialog */}
      <Dialog open={showAssignmentDialog} onOpenChange={setShowAssignmentDialog}>
        <DialogContent
          overlayClassName={isReadOnly ? 'z-[10024]' : undefined}
          className={cn('max-w-md', isReadOnly && 'z-[10025]')}
        >
          <DialogHeader>
            <DialogTitle>Assignment Details</DialogTitle>
            <DialogDescription>
              View technician assignment and scheduled information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Client Name */}
            <div>
              <Label className="text-sm font-medium text-gray-500">Client Name</Label>
              <p className="text-base font-semibold text-gray-900 mt-1">
                {formData.client_name || 'Not specified'}
              </p>
            </div>

            {/* Technician Name */}
            {formData.assigned_technician_name && (
              <div>
                <Label className="text-sm font-medium text-gray-500">Assigned Technician</Label>
                <p className="text-base font-semibold text-gray-900 mt-1">
                  {formData.assigned_technician_name}
                </p>
              </div>
            )}

            {/* Start Date & Time */}
            {fromDateTime && (
              <div>
                <Label className="text-sm font-medium text-gray-500">Start Date & Time</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="w-4 h-4 text-primary" />
                  <p className="text-base font-semibold text-gray-900">
                    {format(fromDateTime, 'PPpp')}
                  </p>
                </div>
              </div>
            )}

            {/* End Date & Time */}
            {toDateTime && (
              <div>
                <Label className="text-sm font-medium text-gray-500">End Date & Time</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="w-4 h-4 text-primary" />
                  <p className="text-base font-semibold text-gray-900">
                    {format(toDateTime, 'PPpp')}
                  </p>
                </div>
              </div>
            )}

            {/* Show message if no dates are set */}
            {!fromDateTime && !toDateTime && (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500">
                  No scheduled dates and times have been set yet.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={actionsDisabled}
          className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
        >
          Close
        </Button>
        {isReadOnly && showEditInReadOnly ? (
          !isCompletedOrCancelled ? (
          <Button
            type="button"
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={onEditRequest}
            disabled={actionsDisabled}
          >
            Edit Request
          </Button>
          ) : null
        ) : null}
        {request ? (
          <Button
            type="button"
            variant={isCompletedOrCancelled ? 'default' : 'outline'}
            className={
              isCompletedStatus
                ? 'bg-emerald-600 text-white hover:bg-emerald-600 disabled:bg-emerald-600 disabled:text-white disabled:opacity-100'
                : isCancelledStatus
                  ? 'bg-destructive text-white hover:bg-destructive disabled:bg-destructive disabled:text-white disabled:opacity-100'
                  : 'border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive'
            }
            disabled={isLoading || isCancelSaving || actionsDisabled || isCompletedOrCancelled}
            onClick={() => {
              if (isCompletedOrCancelled) return;
              setCancelConfirmOpen(true);
            }}
          >
            {isCompletedStatus ? 'Completed' : isCancelledStatus ? 'Cancelled' : 'Cancel Request'}
          </Button>
        ) : null}
        {!isReadOnly && !isCompletedOrCancelled ? (
          <Button
            type="submit"
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={isLoading || isCancelSaving || actionsDisabled}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary-foreground" />}
            {request ? 'Edit Request' : 'Save Request'}
          </Button>
        ) : null}
      </div>

      <AlertDialog open={!isReadOnly && cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel request?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure want to cancel the request
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelSaving}>No</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={isCancelSaving}
              onClick={() => void handleConfirmCancelRequest()}
            >
              {isCancelSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling…
                </>
              ) : (
                'OK'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!isReadOnly && showAddIrrigationDialog}
        onOpenChange={(open) => {
          if (!isReadOnly) setShowAddIrrigationDialog(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Irrigation System</DialogTitle>
            <DialogDescription>
              Add a new irrigation system type to the available options
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Irrigation System Name</Label>
              <Input
                value={newIrrigationSystem}
                onChange={(e) => setNewIrrigationSystem(e.target.value)}
                placeholder="e.g., Smart Drip System"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddIrrigationSystem();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddIrrigationDialog(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={
                  !newIrrigationSystem.trim() ||
                  createIrrigationSystemMutation.isPending ||
                  dbIrrigationSystems.some(
                    (row) =>
                      (row.irrigation_systems || '').trim().toLowerCase() ===
                      newIrrigationSystem.trim().toLowerCase()
                  )
                }
                onClick={() => handleAddIrrigationSystem()}
              >
                {createIrrigationSystemMutation.isPending ? 'Adding...' : 'Add system'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet
        open={mapClientSheetOpen}
        onOpenChange={(open) => {
          setMapClientSheetOpen(open);
          if (!open) setMapSheetClientId(null);
        }}
      >
        <SheetContent
          side="right"
          overlayClassName="z-[10090] bg-black/40"
          className="z-[10091] w-full overflow-y-auto sm:max-w-md"
        >
          {sheetClientEntity && sheetMapJob ? (
            <>
              <SheetHeader>
                <SheetTitle className="pr-8 text-left">Client card</SheetTitle>
                <SheetDescription className="text-left break-words text-muted-foreground">
                  {concatClientAddress(sheetClientEntity)}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-medium text-emerald-800">
                    {(sheetClientEntity.name || '?')
                      .split(/\s+/)
                      .filter(Boolean)
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{sheetClientEntity.name}</p>
                    {sheetClientEntity.farm_name ? (
                      <p className="text-xs text-muted-foreground">{sheetClientEntity.farm_name}</p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Contact details
                  </p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Phone</span>
                      <span>{sheetClientEntity.phone || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="shrink-0 text-muted-foreground">Address</span>
                      <span className="max-w-[70%] text-right break-words">
                        {concatClientAddress(sheetClientEntity)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Email</span>
                      <span className="truncate text-right text-[11px] text-blue-700">
                        {sheetClientEntity.email || '—'}
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
                          MAP_CLIENT_CARD_STATUS_PILL[sheetMapJob.mapStatus] ||
                            MAP_CLIENT_CARD_STATUS_PILL.unscheduled
                        )}
                      >
                        {sheetMapJob.mapStatusLabel}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Next appt</span>
                      <span>{sheetMapJob.nextApptText || '—'}</span>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-black/10" />
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Service history
                  </p>
                  <div className="space-y-2">
                    {sheetClientRequests.slice(0, 5).map((r) => {
                      const hist = getClientCardHistoryBucket(r);
                      return (
                        <div
                          key={r.id}
                          className="rounded-md border border-border bg-muted/40 px-2 py-2 text-[11px]"
                        >
                          <Link
                            to={`${createPageUrl('ServiceRequests')}?id=${encodeURIComponent(String(r.id))}`}
                            className="block text-left transition-colors hover:opacity-90"
                            onClick={() => setMapClientSheetOpen(false)}
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
                              {r.created_at && ` · ${format(new Date(r.created_at), 'MMM d, yyyy')}`}
                            </div>
                          </Link>
                        </div>
                      );
                    })}
                    {sheetClientRequests.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No service requests for this client yet.</p>
                    ) : null}
                  </div>
                  <div className="mt-3 border-t border-black/10" />
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Notes history
                  </p>
                  <div className="space-y-2">
                    {sheetClientNotesHistory.slice(0, 5).map((entry, idx) => {
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
                          {when ? <div className="mb-1 text-[10px] text-muted-foreground">{when}</div> : null}
                          <div className="line-clamp-3 text-foreground/90">{text}</div>
                        </div>
                      );
                    })}
                    {sheetClientNotesHistory.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No notes history available.</p>
                    ) : null}
                  </div>
                </div>

                {!isReadOnly && !request ? (
                  <div className="pt-1">
                    <Button
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                      type="button"
                      onClick={() => {
                        setMapClientSheetOpen(false);
                        handleClientSelect(sheetClientEntity.id);
                      }}
                    >
                      Use this client for this request
                    </Button>
                  </div>
                ) : null}
              </div>
            </>
          ) : sheetClientEntity && !sheetMapJob ? (
            <SheetHeader>
              <SheetTitle className="pr-8 text-left">Client card</SheetTitle>
              <SheetDescription>{concatClientAddress(sheetClientEntity)}</SheetDescription>
              <p className="mt-4 text-sm text-muted-foreground">
                This client has no map pin context. Contact details: {sheetClientEntity.phone || '—'}
              </p>
            </SheetHeader>
          ) : (
            <SheetHeader>
              <SheetTitle>Client</SheetTitle>
              <SheetDescription>No client selected.</SheetDescription>
            </SheetHeader>
          )}
        </SheetContent>
      </Sheet>

      <ClientNotesHistoryDialog
        open={clientNotesHistoryOpen}
        onOpenChange={setClientNotesHistoryOpen}
        clientId={formData.client_id}
        clientName={formData.client_name ? `${formData.client_name}${formData.farm_name ? ` · ${formData.farm_name}` : ''}` : ''}
        allowAdd={!isReadOnly}
        elevatedStack={isReadOnly}
      />
    </form>
  );
}