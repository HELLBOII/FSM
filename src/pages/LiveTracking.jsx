import React, { useState } from 'react';
import { technicianService, serviceRequestService, clientService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  MapPin,
  Phone,
  Clock,
  User,
  Navigation,
  Filter,
  Users,
  Building2,
  Expand,
  Inbox,
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import PageHeader from '@/components/common/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import LiveTrackingMap from '@/components/map/LiveTrackingMap';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ServiceRequestForm from '@/components/forms/ServiceRequestForm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function LiveTracking() {
  const queryClient = useQueryClient();
  const [selectedTechnician, setSelectedTechnician] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('live'); // 'live', 'clients', 'technicians'
  const [showServiceRequestDialog, setShowServiceRequestDialog] = useState(false);
  const [clientForServiceRequest, setClientForServiceRequest] = useState(null);
  const [mapFullScreen, setMapFullScreen] = useState(null); // 'live' | 'clients' | 'technicians'

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

  const { data: technicians = [], isLoading: techLoading } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => technicianService.list(),
    refetchInterval: 30000
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientService.list()
  });

  const { data: requests = [] } = useQuery({
    queryKey: ['serviceRequests'],
    queryFn: () => serviceRequestService.filter({
      status: ['scheduled', 'assigned', 'in_progress']
    })
  });

  // Filter technicians
  const filteredTechnicians = technicians.filter((tech) => {
    const matchesSearch = !searchQuery ||
    tech.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tech.employee_id?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || tech.availability_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filter clients
  const filteredClients = clients.filter((client) => {
    const matchesSearch = !searchQuery ||
    client.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.farm_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.phone?.includes(searchQuery);
    return matchesSearch;
  });

  // Get ALL clients with location (for map - no filters)
  const allClientsWithLocation = clients
    .filter(client => {
      const lat = client.location?.lat ?? client.latitude;
      const lng = client.location?.lng ?? client.longitude;
      return lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng));
    })
    .map(client => {
      const lat = client.location?.lat ?? client.latitude;
      const lng = client.location?.lng ?? client.longitude;
      return {
        id: client.id,
        client_name: client.name,
        farm_name: client.farm_name,
        location: {
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          address: client.address || ''
        },
        priority: 'medium'
      };
    });


  // Get ALL technicians with location (for map - no filters)
  // Handle both current_location object and direct latitude/longitude fields
  const allTechniciansWithLocation = technicians
    .filter(tech => {
      const lat = tech.current_location?.lat ?? tech.latitude;
      const lng = tech.current_location?.lng ?? tech.longitude;
      return lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng));
    })
    .map(tech => {
      const lat = tech.current_location?.lat ?? tech.latitude;
      const lng = tech.current_location?.lng ?? tech.longitude;
      return {
        ...tech,
        current_location: {
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          updated_at: tech.current_location?.updated_at
        }
      };
    });

  // Get active technicians with location (for live tracking - filtered by status)
  const activeTechnicians = filteredTechnicians.filter((t) =>
    t.current_location?.lat && t.availability_status !== 'offline'
  );

  // Get filtered clients with location (for list display)
  const clientsWithLocation = filteredClients
    .filter(client => {
      const lat = client.location?.lat ?? client.latitude;
      const lng = client.location?.lng ?? client.longitude;
      return lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng));
    })
    .map(client => {
      const lat = client.location?.lat ?? client.latitude;
      const lng = client.location?.lng ?? client.longitude;
      return {
        id: client.id,
        client_name: client.name,
        farm_name: client.farm_name,
        location: {
          lat: Number(lat),
          lng: Number(lng),
          address: client.address || ''
        },
        priority: 'medium'
      };
    });

  // Get filtered technicians with location (for list display)
  const techniciansWithLocation = filteredTechnicians
    .filter(tech => {
      const lat = tech.current_location?.lat;
      const lng = tech.current_location?.lng;
      return lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng));
    })
    .map(tech => ({
      ...tech,
      current_location: {
        lat: Number(tech.current_location.lat),
        lng: Number(tech.current_location.lng),
        updated_at: tech.current_location.updated_at
      }
    }));

  // Get active jobs with location
  const activeJobs = requests.filter((r) => r.location?.lat);

  const getTechnicianCurrentJob = (techId) => {
    return requests.find((r) =>
    r.assigned_technician_id === techId &&
    ['assigned', 'in_progress'].includes(r.status)
    );
  };

  const statusCounts = {
    all: technicians.length,
    available: technicians.filter((t) => t.availability_status === 'available').length,
    on_job: technicians.filter((t) => t.availability_status === 'on_job').length,
    break: technicians.filter((t) => t.availability_status === 'break').length,
    offline: technicians.filter((t) => t.availability_status === 'offline').length
  };

  if (techLoading || clientsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" text="Loading tracking data..." />
      </div>
    );
  }

  // Determine what to show on map and list based on active tab
  // Live map: clients only (no technicians). Other tabs: tab-specific only.
  const mapTechnicians = activeTab === 'technicians' ? allTechniciansWithLocation : [];
  const mapJobs = activeTab === 'clients' ? allClientsWithLocation : 
                  activeTab === 'live' ? allClientsWithLocation : [];

  // Get selected location for map centering
  const selectedLocation = (() => {
    if (selectedTechnician && selectedTechnician.current_location?.lat) {
      return [selectedTechnician.current_location.lat, selectedTechnician.current_location.lng];
    }
    if (selectedClient) {
      const lat = selectedClient.location?.lat ?? selectedClient.latitude;
      const lng = selectedClient.location?.lng ?? selectedClient.longitude;
      if (lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
        return [Number(lat), Number(lng)];
      }
    }
    return null;
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Field Tracking"
        subtitle="Real-time technician locations and job status" />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-gray-100 p-1">
            <TabsTrigger value="live" className="data-[state=active]:bg-white">
              Live Tracking
            </TabsTrigger>
            <TabsTrigger value="clients" className="data-[state=active]:bg-white">
              Clients
            </TabsTrigger>
            <TabsTrigger value="technicians" className="data-[state=active]:bg-white">
              Technicians
            </TabsTrigger>
          </TabsList>
        <TabsContent value="live" className="mt-0 space-y-6">
          {technicians.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-lg border border-dashed bg-muted/30">
              <Inbox className="w-14 h-14 mb-4 text-primary" />
              <p className="text-base font-medium text-muted-foreground">No Data Found</p>
              <p className="text-sm text-muted-foreground/80 mt-1">No technicians, clients, or status data available</p>
            </div>
          ) : (
            <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { key: 'all', label: 'All', color: 'bg-gray-100 text-gray-700' },
              { key: 'available', label: 'Available', color: 'bg-green-100 text-green-700' },
              { key: 'on_job', label: 'On Job', color: 'bg-blue-100 text-blue-700' },
              { key: 'break', label: 'On Break', color: 'bg-yellow-100 text-yellow-700' },
              { key: 'offline', label: 'Offline', color: 'bg-gray-100 text-gray-500' }
            ].map((status) => (
              <motion.div
                key={status.key}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setStatusFilter(status.key)}
                className={`p-4 rounded-xl cursor-pointer transition-all border-2 ${
                  statusFilter === status.key
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'border-transparent hover:border-gray-200'
                } ${status.color}`}
              >
                <p className="text-2xl font-bold">{statusCounts[status.key]}</p>
                <p className="text-sm font-medium">{status.label}</p>
              </motion.div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-emerald-600" />
                    Live Map
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setMapFullScreen('live')}
                  >
                    <Expand className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <LiveTrackingMap
                  key="live-map"
                  technicians={mapTechnicians}
                  jobs={mapJobs}
                  className="h-[500px]"
                  selectedLocation={selectedLocation}
                  onCreateServiceRequest={handleCreateServiceRequestFromMap}
                  onTechnicianClick={(tech) => {
                    setSelectedTechnician(tech);
                    setSelectedClient(null);
                  }}
                  onJobClick={(job) => {
                    const client = clients.find((c) => c.id === job.id);
                    if (client) {
                      setSelectedClient(client);
                      setSelectedTechnician(null);
                    } else {
                      const tech = technicians.find((t) => t.id === job.assigned_technician_id);
                      if (tech) {
                        setSelectedTechnician(tech);
                        setSelectedClient(null);
                      }
                    }
                  }}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Technicians</CardTitle>
                <div className="space-y-2 pt-2">
                  <Input
                    placeholder="Search by name or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[480px] overflow-y-auto">
                  {filteredTechnicians.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                      <Inbox className="w-12 h-12 mb-3 text-primary" />
                      <p className="text-sm font-medium text-muted-foreground">No Data Found</p>
                    </div>
                  ) : (
                    filteredTechnicians.map((tech) => {
                      const currentJob = getTechnicianCurrentJob(tech.id);
                      return (
                        <div
                          key={tech.id}
                          className="p-4 border-b transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={tech.avatar_url} />
                              <AvatarFallback className="bg-gradient-to-br from-emerald-100 to-blue-100 text-emerald-700 text-sm">
                                {tech.name?.split(' ').map((n) => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-medium text-gray-900 truncate">{tech.name}</p>
                                <StatusBadge status={tech.availability_status} size="xs" />
                              </div>
                              <p className="text-xs text-gray-500 mb-2">{tech.employee_id}</p>
                              {currentJob && (
                                <div className="p-2 bg-blue-50 rounded-lg text-xs">
                                  <p className="font-medium text-blue-800">#{currentJob.request_number}</p>
                                  <p className="text-blue-600">{currentJob.client_name}</p>
                                </div>
                              )}
                              {tech.current_location?.updated_at && (
                                <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Updated {format(new Date(tech.current_location.updated_at), 'HH:mm')}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
            </>
          )}
        </TabsContent>

        {/* Tab: Clients - separate map + list */}
        <TabsContent value="clients" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-emerald-600" />
                    Clients Map
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setMapFullScreen('clients')}
                  >
                    <Expand className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <LiveTrackingMap
                  key="clients-map"
                  technicians={[]}
                  jobs={mapJobs}
                  className="h-[500px]"
                  selectedLocation={selectedLocation}
                  onCreateServiceRequest={handleCreateServiceRequestFromMap}
                  onJobClick={(job) => {
                    const client = clients.find((c) => c.id === job.id);
                    if (client) {
                      setSelectedClient(client);
                      setSelectedTechnician(null);
                    }
                  }}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Clients</CardTitle>
                <div className="space-y-2 pt-2">
                  <Input
                    placeholder="Search clients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[480px] overflow-y-auto">
                  {filteredClients.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                      <Inbox className="w-12 h-12 mb-3 text-primary" />
                      <p className="text-sm font-medium text-muted-foreground">No Data Found</p>
                    </div>
                  ) : (
                    filteredClients.map((client) => {
                      const lat = client.location?.lat ?? client.latitude;
                      const lng = client.location?.lng ?? client.longitude;
                      const hasLocation = lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng));
                      return (
                        <div
                          key={client.id}
                          className="p-4 border-b transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-gradient-to-br from-blue-100 to-emerald-100 text-blue-700 text-sm">
                                {client.name?.split(' ').map((n) => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-medium text-gray-900 truncate">{client.name}</p>
                                {hasLocation && (
                                  <Badge variant="outline" className="text-xs">
                                    <MapPin className="w-3 h-3 mr-1" />
                                    Located
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mb-1">{client.farm_name}</p>
                              {client.phone && (
                                <p className="text-xs text-gray-400 flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {client.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Technicians - separate map + list */}
        <TabsContent value="technicians" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-emerald-600" />
                    Technicians Map
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setMapFullScreen('technicians')}
                  >
                    <Expand className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <LiveTrackingMap
                  key="technicians-map"
                  technicians={mapTechnicians}
                  jobs={[]}
                  className="h-[500px]"
                  selectedLocation={selectedLocation}
                  onTechnicianClick={(tech) => {
                    setSelectedTechnician(tech);
                    setSelectedClient(null);
                  }}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Technicians</CardTitle>
                <div className="space-y-2 pt-2">
                  <Input
                    placeholder="Search by name or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[480px] overflow-y-auto">
                  {filteredTechnicians.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                      <Inbox className="w-12 h-12 mb-3 text-primary" />
                      <p className="text-sm font-medium text-muted-foreground">No Data Found</p>
                    </div>
                  ) : (
                    filteredTechnicians.map((tech) => {
                      const currentJob = getTechnicianCurrentJob(tech.id);
                      return (
                        <div
                          key={tech.id}
                          className="p-4 border-b transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={tech.avatar_url} />
                              <AvatarFallback className="bg-gradient-to-br from-emerald-100 to-blue-100 text-emerald-700 text-sm">
                                {tech.name?.split(' ').map((n) => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-medium text-gray-900 truncate">{tech.name}</p>
                                <StatusBadge status={tech.availability_status} size="xs" />
                              </div>
                              <p className="text-xs text-gray-500 mb-2">{tech.employee_id}</p>
                              {currentJob && (
                                <div className="p-2 bg-blue-50 rounded-lg text-xs">
                                  <p className="font-medium text-blue-800">#{currentJob.request_number}</p>
                                  <p className="text-blue-600">{currentJob.client_name}</p>
                                </div>
                              )}
                              {tech.current_location?.updated_at && (
                                <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Updated {format(new Date(tech.current_location.updated_at), 'HH:mm')}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Selected Technician Details */}
      {selectedTechnician && activeTab !== 'clients' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={selectedTechnician.avatar_url} />
                    <AvatarFallback className="bg-gradient-to-br from-emerald-100 to-blue-100 text-emerald-700 text-xl">
                      {selectedTechnician.name?.split(' ').map((n) => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{selectedTechnician.name}</h3>
                    <p className="text-gray-500">{selectedTechnician.employee_id}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge status={selectedTechnician.availability_status} />
                    </div>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-medium text-gray-900">{selectedTechnician.phone || '-'}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Jobs Completed</p>
                    <p className="font-medium text-gray-900">{selectedTechnician.jobs_completed || 0}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Rating</p>
                    <p className="font-medium text-gray-900">{selectedTechnician.rating?.toFixed(1) || '-'} ⭐</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Specializations</p>
                    <p className="font-medium text-gray-900 text-sm truncate">
                      {selectedTechnician.specializations?.join(', ') || '-'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="icon">
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon">
                    <Navigation className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Selected Client Details */}
      {selectedClient && activeTab === 'clients' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-gradient-to-br from-blue-100 to-emerald-100 text-blue-700 text-xl">
                      {selectedClient.name?.split(' ').map((n) => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{selectedClient.name}</h3>
                    <p className="text-gray-500">{selectedClient.farm_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge status={selectedClient.status || 'active'} />
                    </div>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-medium text-gray-900">{selectedClient.phone || '-'}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium text-gray-900 text-sm truncate">{selectedClient.email || '-'}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Acreage</p>
                    <p className="font-medium text-gray-900">{selectedClient.total_acreage || '-'}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Address</p>
                    <p className="font-medium text-gray-900 text-sm truncate">{selectedClient.address || '-'}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="icon">
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon">
                    <Navigation className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Full-screen map modal - uses high z-index from dialog */}
      <Dialog open={!!mapFullScreen} onOpenChange={(open) => !open && setMapFullScreen(null)}>
        <DialogContent className="max-w-none w-[95vw] h-[90vh] sm:w-[98vw] sm:h-[95vh] rounded-lg p-0 gap-0 overflow-hidden border-0">
          <div className="flex flex-col h-full">
            <div className="flex items-center min-h-12 shrink-0 px-4 pr-12 border-b bg-background">
              <DialogTitle className="text-lg font-semibold m-0">
                {mapFullScreen === 'live' && 'Live Map'}
                {mapFullScreen === 'clients' && 'Clients Map'}
                {mapFullScreen === 'technicians' && 'Technicians Map'}
              </DialogTitle>
            </div>
            <div className="flex-1 min-h-0 p-2">
              {mapFullScreen === 'live' && (
                <LiveTrackingMap
                  key="live-map-fullscreen"
                  technicians={mapTechnicians}
                  jobs={mapJobs}
                  className="h-full min-h-[70vh]"
                  selectedLocation={selectedLocation}
                  onCreateServiceRequest={handleCreateServiceRequestFromMap}
                  onTechnicianClick={(tech) => {
                    setSelectedTechnician(tech);
                    setSelectedClient(null);
                  }}
                  onJobClick={(job) => {
                    const client = clients.find((c) => c.id === job.id);
                    if (client) {
                      setSelectedClient(client);
                      setSelectedTechnician(null);
                    } else {
                      const tech = technicians.find((t) => t.id === job.assigned_technician_id);
                      if (tech) {
                        setSelectedTechnician(tech);
                        setSelectedClient(null);
                      }
                    }
                  }}
                />
              )}
              {mapFullScreen === 'clients' && (
                <LiveTrackingMap
                  key="clients-map-fullscreen"
                  technicians={[]}
                  jobs={mapJobs}
                  className="h-full min-h-[70vh]"
                  selectedLocation={selectedLocation}
                  onCreateServiceRequest={handleCreateServiceRequestFromMap}
                  onJobClick={(job) => {
                    const client = clients.find((c) => c.id === job.id);
                    if (client) {
                      setSelectedClient(client);
                      setSelectedTechnician(null);
                    }
                  }}
                />
              )}
              {mapFullScreen === 'technicians' && (
                <LiveTrackingMap
                  key="technicians-map-fullscreen"
                  technicians={mapTechnicians}
                  jobs={[]}
                  className="h-full min-h-[70vh]"
                  selectedLocation={selectedLocation}
                  onTechnicianClick={(tech) => {
                    setSelectedTechnician(tech);
                    setSelectedClient(null);
                  }}
                />
              )}
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
    </div>
  );
}
