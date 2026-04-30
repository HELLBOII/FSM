import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { clientService, storageService, technicianService, emailService } from '@/services';
import { useQuery } from '@tanstack/react-query';
import { Loader2, MapPin, Upload, X, Calendar, Eye, History } from 'lucide-react';
import ClientNotesHistoryDialog from '@/components/clients/ClientNotesHistoryDialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import DashboardMap, { MAP_PIN_COLORS } from '@/components/map/DashboardMap';

const irrigationTypes = [
  { value: 'drip', label: 'Drip Irrigation', icon: '💧' },
  { value: 'sprinkler', label: 'Sprinkler System', icon: '🌊' },
  { value: 'center_pivot', label: 'Center Pivot', icon: '🔄' },
  { value: 'flood', label: 'Flood Irrigation', icon: '🌊' },
  { value: 'micro_sprinkler', label: 'Micro Sprinkler', icon: '💦' },
  { value: 'subsurface', label: 'Subsurface Drip', icon: '🌱' }
];

const issueCategories = [
  { value: 'leak_repair', label: 'Leak Repair' },
  { value: 'system_installation', label: 'New Installation' },
  { value: 'maintenance', label: 'Scheduled Maintenance' },
  { value: 'pump_issue', label: 'Pump Issue' },
  { value: 'valve_replacement', label: 'Valve Replacement' },
  { value: 'filter_cleaning', label: 'Filter Cleaning' },
  { value: 'pipe_repair', label: 'Pipe Repair' },
  { value: 'controller_issue', label: 'Controller/Timer Issue' },
  { value: 'water_pressure', label: 'Water Pressure Problem' },
  { value: 'other', label: 'Other' }
];

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

export default function ServiceRequestForm({ request, onSubmit, onCancel, initialClientId, initialStartTime, initialEndTime }) {
  const [formData, setFormData] = useState({
    client_id: '',
    client_name: '',
    farm_name: '',
    contact_phone: '',
    location: { lat: null, lng: null, address: '' },
    irrigation_type: '',
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
    to_time: null
  });
  const [fromDateTime, setFromDateTime] = useState(null);
  const [toDateTime, setToDateTime] = useState(null);
  const [photoPaths, setPhotoPaths] = useState([]); // Store file paths for deletion
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [clientNotesHistoryOpen, setClientNotesHistoryOpen] = useState(false);
  const [errors, setErrors] = useState({});

  const { data: clients = [], isLoading: isLoadingClients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientService.list()
  });

  const { data: technicians = [], isLoading: isLoadingTechnicians } = useQuery({
    queryKey: ['technicians', 'active'],
    queryFn: () => technicianService.filter({ status: 'active' })
  });
  const { data: requests = [] } = useQuery({
    queryKey: ['serviceRequests'],
    queryFn: () => serviceRequestService.list('created_at', 'desc', 100)
  });

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

  // Reusable skeleton component for Select fields
  const SelectSkeleton = () => (
    <div className="h-9 w-full rounded-md border border-input bg-muted animate-pulse flex items-center px-3">
      <div className="h-4 w-32 bg-muted-foreground/20 rounded"></div>
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
      }

      setFromDateTime(fromDateTimeValue);
      setToDateTime(toDateTimeValue);

      setFormData({
        ...request,
        acreage_affected: request.acreage_affected?.toString() || '1',
        from_time: fromDateTimeValue,
        to_time: toDateTimeValue
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
        const endVal = initialEndTime != null ? new Date(initialEndTime) : null;
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
        }));
      }
    }
  }, [request, initialClientId, clients]);

  const handleClientSelect = (clientId) => {
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
        }
      }));
      setErrors((prev) => ({ ...prev, client_id: '' }));
    }
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!formData.client_id) nextErrors.client_id = 'Client is required.';
    if (!formData.irrigation_type) nextErrors.irrigation_type = 'Irrigation type is required.';
    if (!formData.issue_category) nextErrors.issue_category = 'Issue category is required.';
    if (!fromDateTime) nextErrors.from_time = 'Start time is required.';
    if (!toDateTime) nextErrors.to_time = 'End time is required.';
    if (!formData.assigned_technician_id) nextErrors.assigned_technician_id = 'Technician is required.';
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

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      const submitData = {
        ...formData,
        acreage_affected: formData.acreage_affected ? parseFloat(formData.acreage_affected) : null,
        request_number: request?.request_number || `SR-${Date.now().toString(36).toUpperCase()}`,
        scheduled_start_time: startTime ? startTime.toISOString() : null,
        scheduled_end_time: endTime ? endTime.toISOString() : null,
        // Ensure these fields are explicitly included and properly formatted
        contact_phone: formData.contact_phone || '',
        location: locationData,
        assigned_technician_phone: formData.assigned_technician_phone || ''
      };
      // Remove from_time and to_time from submit data as they're now mapped to scheduled_start_time and scheduled_end_time
      delete submitData.from_time;
      delete submitData.to_time;
      
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

  // Handle from date/time changes
  const handleFromDateTimeChange = (dateTime) => {
    setFromDateTime(dateTime);
    setFormData(prev => ({ ...prev, from_time: dateTime }));
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
        {/* Row 1: Select Client, Irrigation Type, Issue Category */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-sm mb-2 block">Select Client <span className="text-red-600">*</span></Label>
            {isLoadingClients ? (
              <SelectSkeleton />
            ) : (
              <div className="flex items-center gap-2">
                <Select value={formData.client_id} onValueChange={handleClientSelect}>
                  <SelectTrigger className={`h-9 text-sm flex-1 min-w-0 ${errors.client_id ? 'border-red-500' : ''}`}>
                    <SelectValue placeholder="Choose a client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.length > 0 ? (
                      clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name} - {client.farm_name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="" disabled>No clients available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {formData.client_id ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0 border-primary/30"
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

          <div>
            <Label className="text-sm mb-2 block">Irrigation Type <span className="text-red-600">*</span></Label>
            <Select 
              value={formData.irrigation_type} 
              onValueChange={(v) => {
                setFormData(prev => ({ ...prev, irrigation_type: v }));
                setErrors((prev) => ({ ...prev, irrigation_type: '' }));
              }}
            >
              <SelectTrigger className={`h-9 text-sm ${errors.irrigation_type ? 'border-red-500' : ''}`}>
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {irrigationTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.irrigation_type && <p className="mt-1 text-xs text-red-600">{errors.irrigation_type}</p>}
          </div>

          <div>
            <Label className="text-sm mb-2 block">Issue Category <span className="text-red-600">*</span></Label>
            <Select 
              value={formData.issue_category} 
              onValueChange={(v) => {
                const selectedCategory = issueCategories.find(cat => cat.value === v);
                setFormData(prev => ({ 
                  ...prev, 
                  issue_category: v,
                  description: selectedCategory ? selectedCategory.label : prev.description
                }));
                setErrors((prev) => ({ ...prev, issue_category: '' }));
              }}
            >
              <SelectTrigger className={`h-9 text-sm ${errors.issue_category ? 'border-red-500' : ''}`}>
                <SelectValue placeholder="Select issue..." />
              </SelectTrigger>
              <SelectContent>
                {issueCategories.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.issue_category && <p className="mt-1 text-xs text-red-600">{errors.issue_category}</p>}
          </div>
        </div>

        {/* Row 2: From Time, To Time, Technician */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-sm mb-2 block">Start Time <span className="text-red-600">*</span></Label>
            <DateTimePicker
              date={fromDateTime}
              onDateChange={handleFromDateTimeChange}
              placeholder="Select start date & time"
            />
            {errors.from_time && <p className="mt-1 text-xs text-red-600">{errors.from_time}</p>}
          </div>

          <div>
            <Label className="text-sm mb-2 block">End Time <span className="text-red-600">*</span></Label>
            <DateTimePicker
              date={toDateTime}
              onDateChange={handleToDateTimeChange}
              placeholder="Select end date & time"
            />
            {errors.to_time && <p className="mt-1 text-xs text-red-600">{errors.to_time}</p>}
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-sm mb-2 block">Technician <span className="text-red-600">*</span></Label>
              {isLoadingTechnicians ? (
                <SelectSkeleton />
              ) : (
                <Select 
                  value={formData.assigned_technician_id || ''} 
                  onValueChange={(v) => {
                    const technician = technicians.find(t => t.id === v);
                    setFormData(prev => ({ 
                      ...prev, 
                      assigned_technician_id: v || '',
                      assigned_technician_name: technician ? technician.name : '',
                      assigned_technician_phone: technician ? technician.phone : ''
                    }));
                    setErrors((prev) => ({ ...prev, assigned_technician_id: '' }));
                  }}
                >
                  <SelectTrigger className={`h-9 text-sm ${errors.assigned_technician_id ? 'border-red-500' : ''}`}>
                    <SelectValue placeholder="Select technician..." />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.length > 0 ? (
                      technicians.map(tech => (
                        <SelectItem key={tech.id} value={tech.id}>
                          {tech.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="" disabled>No technicians available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
              {errors.assigned_technician_id && <p className="mt-1 text-xs text-red-600">{errors.assigned_technician_id}</p>}
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowAssignmentDialog(true)}
                className="h-9 w-9 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                disabled={!formData.assigned_technician_id || !formData.client_name}
                title="View assignment details"
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
            onSelectJob={(job) => handleClientSelect(job.id)}
            onOpenClientDetail={(job) => handleClientSelect(job.id)}
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

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
          Cancel
        </Button>
        <Button 
          type="submit" 
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
          disabled={isLoading}
        >
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin text-primary-foreground" />}
          {request ? 'Update Request' : 'Create Request'}
        </Button>
      </div>

      <ClientNotesHistoryDialog
        open={clientNotesHistoryOpen}
        onOpenChange={setClientNotesHistoryOpen}
        clientId={formData.client_id}
        clientName={formData.client_name ? `${formData.client_name}${formData.farm_name ? ` · ${formData.farm_name}` : ''}` : ''}
        allowAdd
      />
    </form>
  );
}