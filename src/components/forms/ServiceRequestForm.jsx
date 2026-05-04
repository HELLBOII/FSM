import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { toast } from 'sonner';
import { addDays, format } from 'date-fns';
import DashboardMap, { MAP_PIN_COLORS } from '@/components/map/DashboardMap';

/** Default irrigation system option labels (merged with DB + client lists). */
const HARDCODED_IRRIGATION_SYSTEMS = [
  'Drip Irrigation',
  'Sprinkler System',
  'Center Pivot',
  'Flood Irrigation',
  'Micro Sprinkler',
  'Subsurface Drip',
];

/** Stored in DB; UI labels per product (Repair & Service maps to `leak_repair` for CHECK constraint). */
const issueCategories = [
  { value: 'Scheduled Maintenance', label: 'Scheduled Maintenance' },
  { value: 'Repair & Service', label: 'Repair & Service' },
  { value: 'Other', label: 'Other' },
];

const FORM_ISSUE_CATEGORY_VALUES = new Set(issueCategories.map((c) => c.value));

/**
 * Map stored `issue_category` (CHECK constraint / legacy snake_case) to form Select values.
 * Used when hydrating the form from API rows (e.g. read-only view from completed/cancelled lists).
 */
function LEGACY_ISSUE_TO_FORM(raw) {
  if (raw == null || String(raw).trim() === '') return '';
  const s = String(raw).trim();
  if (FORM_ISSUE_CATEGORY_VALUES.has(s)) return s;

  const lower = s.toLowerCase().replace(/\s+/g, ' ');
  if (
    ['leak_repair', 'pump_issue', 'pipe_repair', 'valve_replacement'].includes(lower) ||
    lower === 'repair & service' ||
    lower === 'repair and service'
  ) {
    return 'Repair & Service';
  }
  if (lower === 'scheduled_maintenance' || lower === 'scheduled maintenance') {
    return 'Scheduled Maintenance';
  }
  if (lower === 'other') return 'Other';

  const asWords = lower.replace(/_/g, ' ');
  const match = issueCategories.find(
    (c) => c.label.toLowerCase() === asWords || c.value.toLowerCase() === asWords
  );
  return match ? match.value : '';
}

/** API may return 'T'/'F', boolean, or missing */
function normalizeIsCancelled(value) {
  if (value === true || value === 'T' || value === 't' || String(value).toLowerCase() === 'true') return 'T';
  return 'F';
}

const priorities = [
  { value: 'low', label: 'Low', description: 'Non-urgent, can wait' },
  { value: 'medium', label: 'Medium', description: 'Standard service' },
  { value: 'high', label: 'High', description: 'Needs attention soon' },
  { value: 'urgent', label: 'Urgent', description: 'Critical - crop damage risk' }
];

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

export default function ServiceRequestForm({
  request,
  onSubmit,
  onCancel,
  initialClientId,
  initialStartTime,
  initialEndTime,
  readOnly = false,
}) {
  const isReadOnly = readOnly === true;
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
  /** Bumps when client is chosen so embedded map opens that marker's popup (Leaflet). */
  const [formMapPopupNonce, setFormMapPopupNonce] = useState(0);
  const lastInitialClientMapBumpRef = useRef(null);

  const { data: clients = [], isLoading: isLoadingClients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientService.list()
  });

  const { data: technicians = [], isLoading: isLoadingTechnicians } = useQuery({
    queryKey: ['technicians', 'active'],
    queryFn: () => technicianService.filter({ status: 'active' })
  });
  const { data: requestsBundle } = useQuery({
    queryKey: ['serviceRequests', 'listForRequestsPage', 500],
    queryFn: () => serviceRequestService.listActiveWithCancelledCount(500),
  });
  const requests = requestsBundle?.requests ?? [];
  const { data: dbIrrigationSystems = [] } = useQuery({
    queryKey: ['irrigationSystems'],
    queryFn: () => irrigationSystemsService.list()
  });

  const availableIrrigationSystems = useMemo(() => {
    const dbNames = dbIrrigationSystems.map((s) => s.irrigation_systems);
    const fromClients = clients.flatMap((c) => c.irrigation_systems || []);
    return [...new Set([...HARDCODED_IRRIGATION_SYSTEMS, ...dbNames, ...fromClients])].sort();
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
    if (!systemName || availableIrrigationSystems.includes(systemName)) {
      if (systemName && availableIrrigationSystems.includes(systemName)) {
        toast.error('This irrigation system is already in the list');
      }
      return;
    }
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

  const bumpFormMapPopupIfLocated = useCallback((client) => {
    if (!client) return;
    const lat = Number(client.location?.lat ?? client.latitude);
    const lng = Number(client.location?.lng ?? client.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setFormMapPopupNonce((n) => n + 1);
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

      const irrigationSystemsFromRequest =
        Array.isArray(request.irrigation_systems) && request.irrigation_systems.length > 0
          ? [...request.irrigation_systems]
          : [];

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
        issue_category: LEGACY_ISSUE_TO_FORM(request.issue_category),
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
          bumpFormMapPopupIfLocated(client);
        }
      }
    }
  }, [request, initialClientId, clients, bumpFormMapPopupIfLocated]);

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
      bumpFormMapPopupIfLocated(client);
    }
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!formData.client_id) nextErrors.client_id = 'Client is required.';
    if (!formData.irrigation_systems?.length) nextErrors.irrigation_systems = 'Add at least one irrigation system.';
    if (!formData.issue_category) nextErrors.issue_category = 'Issue category is required.';
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
      const isUpdate = !!request;
      
      // Get technician data if assigned (for including in client email)
      let technician = null;
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
      if (technician && technician.email) {
        try {
          await emailService.sendTechnicianNotification(submitData, technician, isUpdate);
        } catch (error) {
          console.error('Failed to send email to technician:', error);
          // Don't show error to user, email sending failure shouldn't block form submission
        }
      }
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3">
        {/* Row 1: Client | Issue category | Irrigation systems */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="min-w-0">
            <Label className="text-sm mb-2 block">Select Client <span className="text-red-600">*</span></Label>
            {isLoadingClients ? (
              <SelectSkeleton />
            ) : (
              <div className="flex items-center gap-2">
                <Select
                  value={formData.client_id ? String(formData.client_id) : undefined}
                  onValueChange={handleClientSelect}
                  disabled={isReadOnly || clients.length === 0}
                >
                  <SelectTrigger
                    className={`h-10 min-h-10 flex-1 min-w-0 border-primary/30 text-sm focus:border-primary focus:ring-primary sm:text-base ${errors.client_id ? 'border-red-500' : ''}`}
                    aria-invalid={errors.client_id ? true : undefined}
                  >
                    <SelectValue placeholder="Choose a client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.length > 0 ? (
                      clients.map((client) => (
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
                {formData.client_id && !isReadOnly ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0 border-primary/30"
                    title="Client notes history — view and add entries"
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
              value={formData.issue_category || undefined}
              onValueChange={(v) => {
                setFormData((prev) => ({ ...prev, issue_category: v }));
                setErrors((prev) => ({ ...prev, issue_category: '' }));
              }}
              disabled={isReadOnly}
            >
              <SelectTrigger
                className={`h-10 min-h-10 text-sm sm:text-base ${errors.issue_category ? 'border-red-500' : ''}`}
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
            <Select
              value=""
              modal={false}
              disabled={isReadOnly}
              onValueChange={(v) => {
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
                className={`h-10 min-h-10 border-primary/30 text-sm focus:border-primary focus:ring-primary sm:text-base ${errors.irrigation_systems ? 'border-red-500' : ''}`}
                aria-invalid={errors.irrigation_systems ? true : undefined}
              >
                <SelectValue placeholder="Add system type..." />
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
                <SelectItem value="__add_new__" className="font-medium text-primary">
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
                    className={
                      isReadOnly
                        ? 'cursor-default bg-primary text-primary-foreground'
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
            {errors.irrigation_systems && (
              <p className="mt-1 text-xs text-red-600">{errors.irrigation_systems}</p>
            )}
          </div>
        </div>

        {/* Row 2: From Time, To Time, Technician */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-sm mb-2 block">Start date & time <span className="text-red-600">*</span></Label>
            <DateTimePicker
              date={fromDateTime}
              onDateChange={handleFromDateTimeChange}
              placeholder="Select start date & time"
              className="border-primary/30 focus-visible:ring-primary"
              disabled={isReadOnly}
            />
            {errors.from_time && <p className="mt-1 text-xs text-red-600">{errors.from_time}</p>}
          </div>

          <div>
            <Label className="text-sm mb-2 block">End date & time <span className="text-red-600">*</span></Label>
            <DateTimePicker
              date={toDateTime}
              onDateChange={handleToDateTimeChange}
              placeholder="Select end date & time"
              className="border-primary/30 focus-visible:ring-primary"
              disabled={isReadOnly}
            />
            {errors.to_time && <p className="mt-1 text-xs text-red-600">{errors.to_time}</p>}
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-sm mb-2 block">Technician</Label>
              {isLoadingTechnicians ? (
                <SelectSkeleton />
              ) : (
                <Select
                  value={formData.assigned_technician_id ? String(formData.assigned_technician_id) : undefined}
                  onValueChange={(v) => {
                    const technician = technicians.find((t) => String(t.id) === String(v));
                    setFormData((prev) => ({
                      ...prev,
                      assigned_technician_id: v || '',
                      assigned_technician_name: technician ? technician.name : '',
                      assigned_technician_phone: technician ? technician.phone : '',
                    }));
                  }}
                  disabled={isReadOnly || technicians.length === 0}
                >
                  <SelectTrigger className="h-10 min-h-10 text-sm sm:text-base">
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
        <div>
          <DashboardMap
            jobs={mapJobs}
            center={[39.5, -98.5]}
            zoom={4}
            autoCenterFromJobs={false}
            selectedJobId={formData.client_id ? String(formData.client_id) : null}
            flyToTarget={formMapFlyTo}
            listSelectionPopupNonce={formMapPopupNonce}
            onSelectJob={isReadOnly ? undefined : (job) => handleClientSelect(job.id)}
            onOpenClientDetail={isReadOnly ? undefined : (job) => handleClientSelect(job.id)}
            className="h-[300px]"
          />
        </div>
      </div>

      {/* Assignment Details Dialog */}
      <Dialog open={showAssignmentDialog} onOpenChange={setShowAssignmentDialog}>
        <DialogContent className="max-w-md">
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

      {normalizeIsCancelled(formData.is_cancelled) === 'T' && (
        <p className="text-sm font-medium text-destructive">This request has been cancelled.</p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
        <Button type="button" variant="outline" onClick={onCancel} className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
          Close
        </Button>
        {!isReadOnly && request && normalizeIsCancelled(formData.is_cancelled) !== 'T' ? (
          <Button
            type="button"
            variant="outline"
            className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={isLoading || isCancelSaving}
            onClick={() => setCancelConfirmOpen(true)}
          >
            Cancel Request
          </Button>
        ) : null}
        {!isReadOnly ? (
          <Button
            type="submit"
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={isLoading || isCancelSaving || normalizeIsCancelled(formData.is_cancelled) === 'T'}
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
                disabled={!newIrrigationSystem.trim() || createIrrigationSystemMutation.isPending}
                onClick={() => handleAddIrrigationSystem()}
              >
                {createIrrigationSystemMutation.isPending ? 'Adding...' : 'Add system'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ClientNotesHistoryDialog
        open={clientNotesHistoryOpen}
        onOpenChange={setClientNotesHistoryOpen}
        clientId={formData.client_id}
        clientName={formData.client_name ? `${formData.client_name}${formData.farm_name ? ` · ${formData.farm_name}` : ''}` : ''}
        allowAdd={!isReadOnly}
      />
    </form>
  );
}