import React, { useState } from 'react';
import { technicianService, serviceRequestService } from '@/services';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  MapPin,
  Phone,
  Clock,
  User,
  Navigation,
  Filter,
  RefreshCw,
  Maximize2,
  ZoomIn,
  ZoomOut } from
'lucide-react';
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import PageHeader from '@/components/common/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import TechnicianMap from '@/components/map/TechnicianMap';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { format } from 'date-fns';

export default function LiveTracking() {
  const [selectedTechnician, setSelectedTechnician] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sample data for demo purposes (US locations)
  const sampleTechnicians = [
  {
    id: 'sample-1',
    name: 'John Martinez',
    employee_id: 'TECH-001',
    availability_status: 'on_job',
    current_location: { lat: 36.1699, lng: -115.1398 }, // Las Vegas, NV
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
    jobs_completed: 87,
    rating: 4.8,
    specializations: ['Drip Irrigation', 'Sprinkler Systems']
  },
  {
    id: 'sample-2',
    name: 'Sarah Johnson',
    employee_id: 'TECH-002',
    availability_status: 'available',
    current_location: { lat: 33.4484, lng: -112.0740 }, // Phoenix, AZ
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    jobs_completed: 124,
    rating: 4.9,
    specializations: ['Center Pivot', 'Pump Maintenance']
  },
  {
    id: 'sample-3',
    name: 'Michael Davis',
    employee_id: 'TECH-003',
    availability_status: 'on_job',
    current_location: { lat: 34.0522, lng: -118.2437 }, // Los Angeles, CA
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Michael',
    jobs_completed: 156,
    rating: 4.7,
    specializations: ['Leak Repair', 'Valve Replacement']
  },
  {
    id: 'sample-4',
    name: 'Emily Thompson',
    employee_id: 'TECH-004',
    availability_status: 'break',
    current_location: { lat: 32.7157, lng: -117.1611 }, // San Diego, CA
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emily',
    jobs_completed: 92,
    rating: 4.6,
    specializations: ['Drip Irrigation', 'Filter Cleaning']
  },
  {
    id: 'sample-5',
    name: 'David Wilson',
    employee_id: 'TECH-005',
    availability_status: 'available',
    current_location: { lat: 37.7749, lng: -122.4194 }, // San Francisco, CA
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David',
    jobs_completed: 203,
    rating: 5.0,
    specializations: ['All Systems', 'Controller Issues']
  }];


  const { data: dbTechnicians = [], isLoading: techLoading, refetch: refetchTech } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => technicianService.list(),
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Combine real and sample data
  const technicians = [...dbTechnicians, ...sampleTechnicians];

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

  // Get active technicians with location
  const activeTechnicians = filteredTechnicians.filter((t) =>
  t.current_location?.lat && t.availability_status !== 'offline'
  );

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

  if (techLoading) {
    return (
      <div data-source-location="pages/LiveTracking:149:6" data-dynamic-content="false" className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner data-source-location="pages/LiveTracking:150:8" data-dynamic-content="false" size="lg" text="Loading tracking data..." />
      </div>);

  }

  return (
    <div data-source-location="pages/LiveTracking:156:4" data-dynamic-content="true" className="space-y-6">
      <PageHeader data-source-location="pages/LiveTracking:157:6" data-dynamic-content="false"
      title="Live Field Tracking"
      subtitle="Real-time technician locations and job status"
      secondaryAction={() => refetchTech()}
      secondaryLabel="Refresh" />


      {/* Status Summary */}
      <div data-source-location="pages/LiveTracking:165:6" data-dynamic-content="true" className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
        { key: 'all', label: 'All', color: 'bg-gray-100 text-gray-700' },
        { key: 'available', label: 'Available', color: 'bg-green-100 text-green-700' },
        { key: 'on_job', label: 'On Job', color: 'bg-blue-100 text-blue-700' },
        { key: 'break', label: 'On Break', color: 'bg-yellow-100 text-yellow-700' },
        { key: 'offline', label: 'Offline', color: 'bg-gray-100 text-gray-500' }].
        map((status) =>
        <motion.div data-source-location="pages/LiveTracking:173:10" data-dynamic-content="true"
        key={status.key}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setStatusFilter(status.key)}
        className={`p-4 rounded-xl cursor-pointer transition-all border-2 ${
        statusFilter === status.key ?
        'border-emerald-500 ring-2 ring-emerald-500/20' :
        'border-transparent hover:border-gray-200'} ${
        status.color}`}>

            <p data-source-location="pages/LiveTracking:184:12" data-dynamic-content="true" className="text-2xl font-bold">{statusCounts[status.key]}</p>
            <p data-source-location="pages/LiveTracking:185:12" data-dynamic-content="true" className="text-sm font-medium">{status.label}</p>
          </motion.div>
        )}
      </div>

      <div data-source-location="pages/LiveTracking:190:6" data-dynamic-content="true" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <Card data-source-location="pages/LiveTracking:192:8" data-dynamic-content="true" className="lg:col-span-2">
          <CardHeader data-source-location="pages/LiveTracking:193:10" data-dynamic-content="false" className="pb-2">
            <div data-source-location="pages/LiveTracking:194:12" data-dynamic-content="false" className="flex items-center justify-between">
              <CardTitle data-source-location="pages/LiveTracking:195:14" data-dynamic-content="false" className="flex items-center gap-2">
                <MapPin data-source-location="pages/LiveTracking:196:16" data-dynamic-content="false" className="w-5 h-5 text-emerald-600" />
                Live Map
              </CardTitle>
              <div data-source-location="pages/LiveTracking:199:14" data-dynamic-content="false" className="flex gap-2">
                <Button data-source-location="pages/LiveTracking:200:16" data-dynamic-content="false" variant="outline" size="icon">
                  <ZoomIn data-source-location="pages/LiveTracking:201:18" data-dynamic-content="false" className="w-4 h-4" />
                </Button>
                <Button data-source-location="pages/LiveTracking:203:16" data-dynamic-content="false" variant="outline" size="icon">
                  <ZoomOut data-source-location="pages/LiveTracking:204:18" data-dynamic-content="false" className="w-4 h-4" />
                </Button>
                <Button data-source-location="pages/LiveTracking:206:16" data-dynamic-content="false" variant="outline" size="icon">
                  <Maximize2 data-source-location="pages/LiveTracking:207:18" data-dynamic-content="false" className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent data-source-location="pages/LiveTracking:212:10" data-dynamic-content="true">
            <TechnicianMap data-source-location="pages/LiveTracking:213:12" data-dynamic-content="false"
            technicians={activeTechnicians}
            jobs={activeJobs}
            className="h-[500px]"
            onTechnicianClick={(tech) => setSelectedTechnician(tech)}
            onJobClick={(job) => {
              const tech = technicians.find((t) => t.id === job.assigned_technician_id);
              if (tech) setSelectedTechnician(tech);
            }} />

          </CardContent>
        </Card>

        {/* Technician List */}
        <Card data-source-location="pages/LiveTracking:227:8" data-dynamic-content="true">
          <CardHeader data-source-location="pages/LiveTracking:228:10" data-dynamic-content="true" className="pb-2">
            <CardTitle data-source-location="pages/LiveTracking:229:12" data-dynamic-content="false">Technicians</CardTitle>
            <div data-source-location="pages/LiveTracking:230:12" data-dynamic-content="true" className="space-y-2 pt-2">
              <Input data-source-location="pages/LiveTracking:231:14" data-dynamic-content="false"
              placeholder="Search by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9" />

            </div>
          </CardHeader>
          <CardContent data-source-location="pages/LiveTracking:239:10" data-dynamic-content="true" className="p-0">
            <div data-source-location="pages/LiveTracking:240:12" data-dynamic-content="true" className="max-h-[480px] overflow-y-auto">
              {filteredTechnicians.map((tech) => {
                const currentJob = getTechnicianCurrentJob(tech.id);
                const isSelected = selectedTechnician?.id === tech.id;

                return (
                  <motion.div data-source-location="pages/LiveTracking:246:18" data-dynamic-content="true"
                  key={tech.id}
                  whileHover={{ backgroundColor: 'rgba(16, 185, 129, 0.05)' }}
                  className={`p-4 border-b cursor-pointer transition-all ${
                  isSelected ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : ''}`
                  }
                  onClick={() => setSelectedTechnician(tech)}>

                    <div data-source-location="pages/LiveTracking:254:20" data-dynamic-content="true" className="flex items-start gap-3">
                      <Avatar data-source-location="pages/LiveTracking:255:22" data-dynamic-content="true" className="h-10 w-10">
                        <AvatarImage data-source-location="pages/LiveTracking:256:24" data-dynamic-content="false" src={tech.avatar_url} />
                        <AvatarFallback data-source-location="pages/LiveTracking:257:24" data-dynamic-content="true" className="bg-gradient-to-br from-emerald-100 to-blue-100 text-emerald-700 text-sm">
                          {tech.name?.split(' ').map((n) => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div data-source-location="pages/LiveTracking:261:22" data-dynamic-content="true" className="flex-1 min-w-0">
                        <div data-source-location="pages/LiveTracking:262:24" data-dynamic-content="true" className="flex items-center justify-between mb-1">
                          <p data-source-location="pages/LiveTracking:263:26" data-dynamic-content="true" className="font-medium text-gray-900 truncate">{tech.name}</p>
                          <StatusBadge data-source-location="pages/LiveTracking:264:26" data-dynamic-content="false" status={tech.availability_status} size="xs" />
                        </div>
                        <p data-source-location="pages/LiveTracking:266:24" data-dynamic-content="true" className="text-xs text-gray-500 mb-2">{tech.employee_id}</p>
                        
                        {currentJob &&
                        <div data-source-location="pages/LiveTracking:269:26" data-dynamic-content="true" className="p-2 bg-blue-50 rounded-lg text-xs">
                            <p data-source-location="pages/LiveTracking:270:28" data-dynamic-content="true" className="font-medium text-blue-800">#{currentJob.request_number}</p>
                            <p data-source-location="pages/LiveTracking:271:28" data-dynamic-content="true" className="text-blue-600">{currentJob.client_name}</p>
                          </div>
                        }
                        
                        {tech.current_location?.updated_at &&
                        <p data-source-location="pages/LiveTracking:276:26" data-dynamic-content="true" className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                            <Clock data-source-location="pages/LiveTracking:277:28" data-dynamic-content="false" className="w-3 h-3" />
                            Updated {format(new Date(tech.current_location.updated_at), 'HH:mm')}
                          </p>
                        }
                      </div>
                    </div>
                  </motion.div>);

              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selected Technician Details */}
      {selectedTechnician &&
      <motion.div data-source-location="pages/LiveTracking:293:8" data-dynamic-content="true"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}>

          <Card data-source-location="pages/LiveTracking:297:10" data-dynamic-content="true">
            <CardContent data-source-location="pages/LiveTracking:298:12" data-dynamic-content="true" className="p-6">
              <div data-source-location="pages/LiveTracking:299:14" data-dynamic-content="true" className="flex flex-col md:flex-row gap-6">
                <div data-source-location="pages/LiveTracking:300:16" data-dynamic-content="true" className="flex items-center gap-4">
                  <Avatar data-source-location="pages/LiveTracking:301:18" data-dynamic-content="true" className="h-16 w-16">
                    <AvatarImage data-source-location="pages/LiveTracking:302:20" data-dynamic-content="false" src={selectedTechnician.avatar_url} />
                    <AvatarFallback data-source-location="pages/LiveTracking:303:20" data-dynamic-content="true" className="bg-gradient-to-br from-emerald-100 to-blue-100 text-emerald-700 text-xl">
                      {selectedTechnician.name?.split(' ').map((n) => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div data-source-location="pages/LiveTracking:307:18" data-dynamic-content="true">
                    <h3 data-source-location="pages/LiveTracking:308:20" data-dynamic-content="true" className="text-xl font-semibold text-gray-900">{selectedTechnician.name}</h3>
                    <p data-source-location="pages/LiveTracking:309:20" data-dynamic-content="true" className="text-gray-500">{selectedTechnician.employee_id}</p>
                    <div data-source-location="pages/LiveTracking:310:20" data-dynamic-content="true" className="flex items-center gap-2 mt-1">
                      <StatusBadge data-source-location="pages/LiveTracking:311:22" data-dynamic-content="false" status={selectedTechnician.availability_status} />
                    </div>
                  </div>
                </div>

                <div data-source-location="pages/LiveTracking:316:16" data-dynamic-content="true" className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div data-source-location="pages/LiveTracking:317:18" data-dynamic-content="true" className="p-3 bg-gray-50 rounded-lg">
                    <p data-source-location="pages/LiveTracking:318:20" data-dynamic-content="false" className="text-sm text-gray-500">Phone</p>
                    <p data-source-location="pages/LiveTracking:319:20" data-dynamic-content="true" className="font-medium text-gray-900">{selectedTechnician.phone || '-'}</p>
                  </div>
                  <div data-source-location="pages/LiveTracking:321:18" data-dynamic-content="true" className="p-3 bg-gray-50 rounded-lg">
                    <p data-source-location="pages/LiveTracking:322:20" data-dynamic-content="false" className="text-sm text-gray-500">Jobs Completed</p>
                    <p data-source-location="pages/LiveTracking:323:20" data-dynamic-content="true" className="font-medium text-gray-900">{selectedTechnician.jobs_completed || 0}</p>
                  </div>
                  <div data-source-location="pages/LiveTracking:325:18" data-dynamic-content="true" className="p-3 bg-gray-50 rounded-lg">
                    <p data-source-location="pages/LiveTracking:326:20" data-dynamic-content="false" className="text-sm text-gray-500">Rating</p>
                    <p data-source-location="pages/LiveTracking:327:20" data-dynamic-content="true" className="font-medium text-gray-900">{selectedTechnician.rating?.toFixed(1) || '-'} ⭐</p>
                  </div>
                  <div data-source-location="pages/LiveTracking:329:18" data-dynamic-content="true" className="p-3 bg-gray-50 rounded-lg">
                    <p data-source-location="pages/LiveTracking:330:20" data-dynamic-content="false" className="text-sm text-gray-500">Specializations</p>
                    <p data-source-location="pages/LiveTracking:331:20" data-dynamic-content="true" className="font-medium text-gray-900 text-sm truncate">
                      {selectedTechnician.specializations?.join(', ') || '-'}
                    </p>
                  </div>
                </div>

                <div data-source-location="pages/LiveTracking:337:16" data-dynamic-content="false" className="flex gap-2">
                  <Button data-source-location="pages/LiveTracking:338:18" data-dynamic-content="false" variant="outline" size="icon">
                    <Phone data-source-location="pages/LiveTracking:339:20" data-dynamic-content="false" className="w-4 h-4" />
                  </Button>
                  <Button data-source-location="pages/LiveTracking:341:18" data-dynamic-content="false" variant="outline" size="icon">
                    <Navigation data-source-location="pages/LiveTracking:342:20" data-dynamic-content="false" className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      }
    </div>);

}