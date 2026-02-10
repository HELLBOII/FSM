import React, { useState, useEffect } from 'react';
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
import { Loader2, MapPin, Upload, X, Calendar, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import TechnicianMap from '@/components/map/TechnicianMap';

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

export default function ServiceRequestForm({ request, onSubmit, onCancel }) {
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

  const { data: clients = [], isLoading: isLoadingClients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientService.list()
  });

  const { data: technicians = [], isLoading: isLoadingTechnicians } = useQuery({
    queryKey: ['technicians', 'active'],
    queryFn: () => technicianService.filter({ status: 'active' })
  });

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
    }
  }, [request]);

  const handleClientSelect = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      // Extract location data from client
      const lat = client.latitude ?? null;
      const lng = client.longitude ?? null;
      const address = client.address || '';
      
      setFormData(prev => ({
        ...prev,
        client_id: clientId,
        client_name: client.name,
        farm_name: client.farm_name,
        contact_phone: client.phone,
        location: {
          lat: lat,
          lng: lng,
          address: address
        }
      }));
    }
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

      const submitData = {
        ...formData,
        acreage_affected: formData.acreage_affected ? parseFloat(formData.acreage_affected) : null,
        request_number: request?.request_number || `SR-${Date.now().toString(36).toUpperCase()}`,
        scheduled_start_time: formData.from_time ? formData.from_time.toISOString() : null,
        scheduled_end_time: formData.to_time ? formData.to_time.toISOString() : null,
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
      if (submitData.assigned_technician_id) {
        technician = technicians.find(t => t.id === submitData.assigned_technician_id);
        // Add technician phone to submitData for client email
        if (technician && technician.phone) {
          submitData.technician_mobile = technician.phone;
        }
      }
      
      // Send email to client
      if (submitData.client_id) {
        const client = clients.find(c => c.id === submitData.client_id);
        if (client && client.email) {
          try {
            await emailService.sendClientNotification(submitData, client, isUpdate);
          } catch (error) {
            console.error('Failed to send email to client:', error);
            // Don't show error to user, email sending failure shouldn't block form submission
          }
        }
      }
      
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
  };

  // Handle to date/time changes
  const handleToDateTimeChange = (dateTime) => {
    setToDateTime(dateTime);
    setFormData(prev => ({ ...prev, to_time: dateTime }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3">
        {/* Row 1: Select Client, Irrigation Type, Issue Category */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-sm mb-2 block">Select Client</Label>
            {isLoadingClients ? (
              <SelectSkeleton />
            ) : (
              <Select value={formData.client_id} onValueChange={handleClientSelect}>
                <SelectTrigger className="h-9 text-sm">
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
            )}
          </div>

          <div>
            <Label className="text-sm mb-2 block">Irrigation Type</Label>
            <Select 
              value={formData.irrigation_type} 
              onValueChange={(v) => setFormData(prev => ({ ...prev, irrigation_type: v }))}
            >
              <SelectTrigger className="h-9 text-sm">
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
          </div>

          <div>
            <Label className="text-sm mb-2 block">Issue Category</Label>
            <Select 
              value={formData.issue_category} 
              onValueChange={(v) => {
                const selectedCategory = issueCategories.find(cat => cat.value === v);
                setFormData(prev => ({ 
                  ...prev, 
                  issue_category: v,
                  description: selectedCategory ? selectedCategory.label : prev.description
                }));
              }}
            >
              <SelectTrigger className="h-9 text-sm">
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
          </div>
        </div>

        {/* Row 2: From Time, To Time, Technician */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-sm mb-2 block">Start Time</Label>
            <DateTimePicker
              date={fromDateTime}
              onDateChange={handleFromDateTimeChange}
              placeholder="Select start date & time"
            />
          </div>

          <div>
            <Label className="text-sm mb-2 block">End Time</Label>
            <DateTimePicker
              date={toDateTime}
              onDateChange={handleToDateTimeChange}
              placeholder="Select end date & time"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-sm mb-2 block">Technician</Label>
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
                  }}
                >
                  <SelectTrigger className="h-9 text-sm">
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

        {/* Map (View Only) */}
        <div>
          <TechnicianMap
            technicians={[]}
            jobs={clients
              .filter(client => {
                // Check if client has location data (either in location object or latitude/longitude fields)
                const lat = client.location?.lat ?? client.latitude;
                const lng = client.location?.lng ?? client.longitude;
                return lat != null && lng != null;
              })
              .map(client => {
                // Transform client to job-like format for the map
                const lat = client.location?.lat ?? client.latitude;
                const lng = client.location?.lng ?? client.longitude;
                return {
                  id: client.id,
                  client_name: client.name,
                  farm_name: client.farm_name,
                  location: {
                    lat: lat,
                    lng: lng,
                    address: client.address || ''
                  }
                  // No request_number, status, or priority - these are clients, not jobs
                };
              })}
            center={(() => {
              // Calculate center based on client locations
              const clientLocations = clients
                .filter(client => {
                  const lat = client.location?.lat ?? client.latitude;
                  const lng = client.location?.lng ?? client.longitude;
                  return lat != null && lng != null;
                })
                .map(client => ({
                  lat: client.location?.lat ?? client.latitude,
                  lng: client.location?.lng ?? client.longitude
                }));
              
              if (clientLocations.length > 0) {
                const avgLat = clientLocations.reduce((sum, loc) => sum + loc.lat, 0) / clientLocations.length;
                const avgLng = clientLocations.reduce((sum, loc) => sum + loc.lng, 0) / clientLocations.length;
                return [avgLat, avgLng];
              }
              return [39.8283, -98.5795]; // Default center (US center)
            })()}
            zoom={6}
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
    </form>
  );
}