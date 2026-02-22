import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { serviceRequestService, technicianService, workReportService, clientService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  FileText,
  Calendar,
  Clock,
  AlertTriangle,
  MapPin,
  TrendingUp,
  Users,
  CheckCircle,
  ArrowRight,
  Droplets,
  Activity,
  Expand,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StatCard from '@/components/ui/StatCard';
import TechnicianPerformanceCard from '@/components/dashboard/TechnicianPerformanceCard';
import StatusBadge from '@/components/ui/StatusBadge';
import JobCard from '@/components/ui/JobCard';
import DashboardMap from '@/components/map/DashboardMap';
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

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [showServiceRequestDialog, setShowServiceRequestDialog] = useState(false);
  const [clientForServiceRequest, setClientForServiceRequest] = useState(null);
  const [mapFullScreen, setMapFullScreen] = useState(false);

  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['serviceRequests'],
    queryFn: () => serviceRequestService.list('created_at', 'desc', 100)
  });

  const { data: technicians = [], isLoading: techLoading } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => technicianService.list()
  });

  const { data: workReports = [] } = useQuery({
    queryKey: ['workReports'],
    queryFn: () => workReportService.list('created_at', 'desc')
  });

  const { data: allReports = [] } = useQuery({
    queryKey: ['allReports'],
    queryFn: () => workReportService.list('created_at', 'desc')
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

  // Clients with location for map (same format as LiveTracking clients map)
  const clientsForMap = clients
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

  // Calculate stats
  const stats = {
    total: requests.length,
    scheduled: requests.filter((r) => r.status === 'scheduled').length,
    inProgress: requests.filter((r) => r.status === 'in_progress').length,
    slaAlerts: requests.filter((r) => r.is_sla_breached).length,
    pendingApproval: workReports.filter((r) => r.status === 'submitted').length,
    availableTechs: technicians.filter((t) => t.availability_status === 'available').length
  };

  const recentRequests = requests.slice(0, 5);
  const urgentRequests = requests.filter((r) =>
  (r.priority === 'urgent' || r.priority === 'high') &&
  ['new', 'scheduled', 'assigned', 'in_progress'].includes(r.status)
  ).slice(0, 3);

  const activeTechnicians = technicians.filter((t) =>
  t.availability_status !== 'offline' && t.current_location?.lat
  );


  // Performance analytics
  const sortedTechnicians = [...technicians].sort((a, b) => {
    const scoreA = (a.rating || 0) * 0.5 + (a.jobs_completed || 0) * 0.5;
    const scoreB = (b.rating || 0) * 0.5 + (b.jobs_completed || 0) * 0.5;
    return scoreB - scoreA;
  });

  const needsTraining = technicians.filter((t) =>
  t.rating && t.rating < 4.0 || (t.jobs_completed || 0) < 10
  );

  if (requestsLoading || techLoading) {
    return (
      <div data-source-location="pages/AdminDashboard:125:6" data-dynamic-content="false" className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner data-source-location="pages/AdminDashboard:126:8" data-dynamic-content="false" size="lg" text="Loading dashboard..." />
      </div>);

  }

  return (
    <div data-source-location="pages/AdminDashboard:132:4" data-dynamic-content="true" className="space-y-6">
      {/* Page Header */}
      <div data-source-location="pages/AdminDashboard:134:6" data-dynamic-content="true" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div data-source-location="pages/AdminDashboard:135:8" data-dynamic-content="false">
          <h1 data-source-location="pages/AdminDashboard:136:10" data-dynamic-content="false" className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
          <p data-source-location="pages/AdminDashboard:137:10" data-dynamic-content="false" className="text-gray-500 mt-1">Welcome back! Here's your field operations overview.</p>
        </div>
        <div data-source-location="pages/AdminDashboard:139:8" data-dynamic-content="true" className="flex gap-3">
          <Button data-source-location="pages/AdminDashboard:140:10" data-dynamic-content="true" variant="outline" className="border-primary/30 hover:bg-primary/10 hover:border-primary" asChild>
            <Link data-source-location="pages/AdminDashboard:141:12" data-dynamic-content="false" to={createPageUrl('Reports')}>
              <TrendingUp data-source-location="pages/AdminDashboard:142:14" data-dynamic-content="false" className="w-4 h-4 mr-2" />
              View Reports
            </Link>
          </Button>
          <Button data-source-location="pages/AdminDashboard:146:10" data-dynamic-content="true" className="bg-primary hover:bg-primary/90 text-primary-foreground" asChild>
            <Link data-source-location="pages/AdminDashboard:147:12" data-dynamic-content="false" to={createPageUrl('ServiceRequests') + '?action=new'}>
              <FileText data-source-location="pages/AdminDashboard:148:14" data-dynamic-content="false" className="w-4 h-4 mr-2" />
              New Request
            </Link>
          </Button>
        </div>
      </div>

      <Tabs data-source-location="pages/AdminDashboard:155:6" data-dynamic-content="true" value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-source-location="pages/AdminDashboard:156:8" data-dynamic-content="false">
          <TabsTrigger data-source-location="pages/AdminDashboard:157:10" data-dynamic-content="false" value="overview">Overview</TabsTrigger>
          <TabsTrigger data-source-location="pages/AdminDashboard:158:10" data-dynamic-content="false" value="team">Team Performance</TabsTrigger>
        </TabsList>

        <TabsContent data-source-location="pages/AdminDashboard:161:8" data-dynamic-content="true" value="overview" className="space-y-6">
          {/* KPI Cards */}
          <div data-source-location="pages/AdminDashboard:163:10" data-dynamic-content="true" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard data-source-location="pages/AdminDashboard:164:8" data-dynamic-content="false"
            title="Total Requests"
            value={stats.total}
            icon={FileText}
            color="blue"
            trend="up"
            trendValue="+12% this month" />

        <StatCard data-source-location="pages/AdminDashboard:172:8" data-dynamic-content="false"
            title="Scheduled Jobs"
            value={stats.scheduled}
            icon={Calendar}
            color="orange" />

        <StatCard data-source-location="pages/AdminDashboard:178:8" data-dynamic-content="false"
            title="In Progress"
            value={stats.inProgress}
            icon={Clock}
            color="yellow" />

        <StatCard data-source-location="pages/AdminDashboard:184:8" data-dynamic-content="false"
            title="SLA Alerts"
            value={stats.slaAlerts}
            icon={AlertTriangle}
            color={stats.slaAlerts > 0 ? 'red' : 'emerald'} />

      </div>

      {/* Quick Stats Row */}
      <div data-source-location="pages/AdminDashboard:193:6" data-dynamic-content="true" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card data-source-location="pages/AdminDashboard:194:8" data-dynamic-content="true" className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent data-source-location="pages/AdminDashboard:195:10" data-dynamic-content="true" className="p-4">
            <div data-source-location="pages/AdminDashboard:196:12" data-dynamic-content="true" className="flex items-center justify-between">
              <div data-source-location="pages/AdminDashboard:197:14" data-dynamic-content="true">
                <p data-source-location="pages/AdminDashboard:198:16" data-dynamic-content="false" className="text-emerald-100 text-sm">Available Technicians</p>
                <p data-source-location="pages/AdminDashboard:199:16" data-dynamic-content="true" className="text-2xl font-bold mt-1">{stats.availableTechs}/{technicians.length}</p>
              </div>
              <Users data-source-location="pages/AdminDashboard:201:14" data-dynamic-content="false" className="w-8 h-8 text-emerald-200" />
            </div>
          </CardContent>
        </Card>
        <Card data-source-location="pages/AdminDashboard:205:8" data-dynamic-content="true" className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent data-source-location="pages/AdminDashboard:206:10" data-dynamic-content="true" className="p-4">
            <div data-source-location="pages/AdminDashboard:207:12" data-dynamic-content="true" className="flex items-center justify-between">
              <div data-source-location="pages/AdminDashboard:208:14" data-dynamic-content="true">
                <p data-source-location="pages/AdminDashboard:209:16" data-dynamic-content="false" className="text-blue-100 text-sm">Pending Approval</p>
                <p data-source-location="pages/AdminDashboard:210:16" data-dynamic-content="true" className="text-2xl font-bold mt-1">{stats.pendingApproval}</p>
              </div>
              <CheckCircle data-source-location="pages/AdminDashboard:212:14" data-dynamic-content="false" className="w-8 h-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        <Card data-source-location="pages/AdminDashboard:216:8" data-dynamic-content="true" className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent data-source-location="pages/AdminDashboard:217:10" data-dynamic-content="true" className="p-4">
            <div data-source-location="pages/AdminDashboard:218:12" data-dynamic-content="true" className="flex items-center justify-between">
              <div data-source-location="pages/AdminDashboard:219:14" data-dynamic-content="true">
                <p data-source-location="pages/AdminDashboard:220:16" data-dynamic-content="false" className="text-purple-100 text-sm">Completed Today</p>
                <p data-source-location="pages/AdminDashboard:221:16" data-dynamic-content="true" className="text-2xl font-bold mt-1">
                  {requests.filter((r) =>
                      r.status === 'completed' &&
                      r.actual_end_time &&
                      format(new Date(r.actual_end_time), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                      ).length}
                </p>
              </div>
              <Activity data-source-location="pages/AdminDashboard:229:14" data-dynamic-content="false" className="w-8 h-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>
        <Card data-source-location="pages/AdminDashboard:233:8" data-dynamic-content="false" className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white">
          <CardContent data-source-location="pages/AdminDashboard:234:10" data-dynamic-content="false" className="p-4">
            <div data-source-location="pages/AdminDashboard:235:12" data-dynamic-content="false" className="flex items-center justify-between">
              <div data-source-location="pages/AdminDashboard:236:14" data-dynamic-content="false">
                <p data-source-location="pages/AdminDashboard:237:16" data-dynamic-content="false" className="text-cyan-100 text-sm">Avg. Response Time</p>
                <p data-source-location="pages/AdminDashboard:238:16" data-dynamic-content="false" className="text-2xl font-bold mt-1">2.4h</p>
              </div>
              <Clock data-source-location="pages/AdminDashboard:240:14" data-dynamic-content="false" className="w-8 h-8 text-cyan-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div data-source-location="pages/AdminDashboard:247:6" data-dynamic-content="true" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Map */}
        <Card data-source-location="pages/AdminDashboard:249:8" data-dynamic-content="true" className="lg:col-span-2">
          <CardHeader data-source-location="pages/AdminDashboard:250:10" data-dynamic-content="true" className="pb-2">
            <div data-source-location="pages/AdminDashboard:251:12" data-dynamic-content="true" className="flex items-center justify-between">
              <CardTitle data-source-location="pages/AdminDashboard:252:14" data-dynamic-content="false" className="flex items-center gap-2">
                <MapPin data-source-location="pages/AdminDashboard:253:16" data-dynamic-content="false" className="w-5 h-5 text-emerald-600" />
                Live Field Tracking
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setMapFullScreen(true)}>
                  <Expand className="h-4 w-4" />
                </Button>
                {/* <Button data-source-location="pages/AdminDashboard:256:14" data-dynamic-content="true" variant="ghost" size="sm" asChild>
                  <Link data-source-location="pages/AdminDashboard:257:16" data-dynamic-content="false" to={createPageUrl('LiveTracking')}>
                    Full Map <ArrowRight data-source-location="pages/AdminDashboard:258:27" data-dynamic-content="false" className="w-4 h-4 ml-1" />
                  </Link>
                </Button> */}
              </div>
            </div>
          </CardHeader>
          <CardContent data-source-location="pages/AdminDashboard:263:10" data-dynamic-content="true">
            <DashboardMap
                jobs={clientsForMap}
                className="h-[350px]"
                onCreateServiceRequest={handleCreateServiceRequestFromMap}
              />

          </CardContent>
        </Card>

        {/* Urgent Requests */}
        <Card data-source-location="pages/AdminDashboard:273:8" data-dynamic-content="true">
          <CardHeader data-source-location="pages/AdminDashboard:274:10" data-dynamic-content="true" className="pb-2">
            <div data-source-location="pages/AdminDashboard:275:12" data-dynamic-content="true" className="flex items-center justify-between">
              <CardTitle data-source-location="pages/AdminDashboard:276:14" data-dynamic-content="false" className="flex items-center gap-2">
                <AlertTriangle data-source-location="pages/AdminDashboard:277:16" data-dynamic-content="false" className="w-5 h-5 text-red-500" />
                Urgent Attention
              </CardTitle>
              <span data-source-location="pages/AdminDashboard:280:14" data-dynamic-content="true" className="text-sm text-gray-500">{urgentRequests.length} items</span>
            </div>
          </CardHeader>
          <CardContent data-source-location="pages/AdminDashboard:283:10" data-dynamic-content="true" className="space-y-3">
            {urgentRequests.length === 0 ?
                <div data-source-location="pages/AdminDashboard:285:14" data-dynamic-content="false" className="flex items-center justify-center min-h-[200px] text-primary">
                  <div className="text-center">
                    <AlertTriangle data-source-location="pages/AdminDashboard:286:16" data-dynamic-content="false" className="w-12 h-12 mx-auto mb-2 text-primary" />
                    <p data-source-location="pages/AdminDashboard:287:16" data-dynamic-content="false" className="text-sm font-medium text-primary">No data found</p>
                    <p data-source-location="pages/AdminDashboard:287:16" data-dynamic-content="false" className="text-xs text-primary/70 mt-1">No urgent issues at this time</p>
                  </div>
                </div> :

                urgentRequests.map((request) =>
                <Link data-source-location="pages/AdminDashboard:291:16" data-dynamic-content="true"
                key={request.id}
                to={createPageUrl('ServiceRequests') + `?id=${request.id}`}
                className="block">

                  <motion.div data-source-location="pages/AdminDashboard:296:18" data-dynamic-content="true"
                  whileHover={{ scale: 1.02 }}
                  className="p-3 rounded-lg border border-red-200 bg-red-50/50 hover:bg-red-50 transition-colors">

                    <div data-source-location="pages/AdminDashboard:300:20" data-dynamic-content="true" className="flex items-center justify-between mb-1">
                      <span data-source-location="pages/AdminDashboard:301:22" data-dynamic-content="true" className="text-sm font-semibold text-gray-900">#{request.request_number}</span>
                      <StatusBadge data-source-location="pages/AdminDashboard:302:22" data-dynamic-content="false" status={request.priority} size="xs" />
                    </div>
                    <p data-source-location="pages/AdminDashboard:304:20" data-dynamic-content="true" className="text-sm text-gray-600 truncate">{request.client_name}</p>
                    <p data-source-location="pages/AdminDashboard:305:20" data-dynamic-content="true" className="text-xs text-gray-500 mt-1">
                      {request.issue_category?.replace(/_/g, ' ')}
                    </p>
                  </motion.div>
                </Link>
                )
                }
          </CardContent>
        </Card>
      </div>

      {/* Recent Requests & Technician Status */}
      <div data-source-location="pages/AdminDashboard:317:6" data-dynamic-content="true" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Service Requests */}
        <Card data-source-location="pages/AdminDashboard:319:8" data-dynamic-content="true">
          <CardHeader data-source-location="pages/AdminDashboard:320:10" data-dynamic-content="true" className="pb-2">
            <div data-source-location="pages/AdminDashboard:321:12" data-dynamic-content="true" className="flex items-center justify-between">
              <CardTitle data-source-location="pages/AdminDashboard:322:14" data-dynamic-content="false" className="flex items-center gap-2">
                <Droplets data-source-location="pages/AdminDashboard:323:16" data-dynamic-content="false" className="w-5 h-5 text-blue-500" />
                Recent Requests
              </CardTitle>
              <Button data-source-location="pages/AdminDashboard:326:14" data-dynamic-content="true" variant="ghost" size="sm" asChild>
                <Link data-source-location="pages/AdminDashboard:327:16" data-dynamic-content="false" to={createPageUrl('ServiceRequests')}>
                  View All <ArrowRight data-source-location="pages/AdminDashboard:328:27" data-dynamic-content="false" className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent data-source-location="pages/AdminDashboard:333:10" data-dynamic-content="true" className="space-y-3">
            {recentRequests.length === 0 ?
              <div className="text-center py-8 text-primary">
                <Droplets className="w-12 h-12 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium text-primary">No recent requests</p>
                <p className="text-xs text-primary/70 mt-1">No service requests found</p>
              </div> :
              recentRequests.map((request) =>
                <Link data-source-location="pages/AdminDashboard:335:14" data-dynamic-content="true"
                key={request.id}
                to={createPageUrl('ServiceRequests') + `?id=${request.id}`}
                className="block">

                <div data-source-location="pages/AdminDashboard:340:16" data-dynamic-content="true" className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                  <div data-source-location="pages/AdminDashboard:341:18" data-dynamic-content="true" className="flex-1 min-w-0">
                    <div data-source-location="pages/AdminDashboard:342:20" data-dynamic-content="true" className="flex items-center gap-2 mb-1">
                      <span data-source-location="pages/AdminDashboard:343:22" data-dynamic-content="true" className="font-medium text-gray-900">#{request.request_number}</span>
                      <StatusBadge data-source-location="pages/AdminDashboard:344:22" data-dynamic-content="false" status={request.status} size="xs" />
                    </div>
                    <p data-source-location="pages/AdminDashboard:346:20" data-dynamic-content="true" className="text-sm text-gray-600 truncate">{request.client_name} • {request.farm_name}</p>
                    <p data-source-location="pages/AdminDashboard:347:20" data-dynamic-content="true" className="text-xs text-gray-500">{request.irrigation_type} - {request.issue_category?.replace(/_/g, ' ')}</p>
                  </div>
                  <ArrowRight data-source-location="pages/AdminDashboard:349:18" data-dynamic-content="false" className="w-4 h-4 text-gray-400" />
                </div>
              </Link>
                )
            }
          </CardContent>
        </Card>

        {/* Technician Status */}
        <Card data-source-location="pages/AdminDashboard:357:8" data-dynamic-content="true">
          <CardHeader data-source-location="pages/AdminDashboard:358:10" data-dynamic-content="true" className="pb-2">
            <div data-source-location="pages/AdminDashboard:359:12" data-dynamic-content="true" className="flex items-center justify-between">
              <CardTitle data-source-location="pages/AdminDashboard:360:14" data-dynamic-content="false" className="flex items-center gap-2">
                <Users data-source-location="pages/AdminDashboard:361:16" data-dynamic-content="false" className="w-5 h-5 text-purple-500" />
                Technician Status
              </CardTitle>
              <Button data-source-location="pages/AdminDashboard:364:14" data-dynamic-content="true" variant="ghost" size="sm" asChild>
                <Link data-source-location="pages/AdminDashboard:365:16" data-dynamic-content="false" to={createPageUrl('Technicians')}>
                  Manage <ArrowRight data-source-location="pages/AdminDashboard:366:25" data-dynamic-content="false" className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent data-source-location="pages/AdminDashboard:371:10" data-dynamic-content="true" className="space-y-3">
            {technicians.length === 0 ?
              <div className="text-center py-8 text-primary">
                <Users className="w-12 h-12 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium text-primary">No technicians</p>
                <p className="text-xs text-primary/70 mt-1">No technicians found</p>
              </div> :
              technicians.slice(0, 5).map((tech) =>
                <div data-source-location="pages/AdminDashboard:373:14" data-dynamic-content="true" key={tech.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div data-source-location="pages/AdminDashboard:374:16" data-dynamic-content="true" className="flex items-center gap-3">
                  <div data-source-location="pages/AdminDashboard:375:18" data-dynamic-content="true" className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-blue-100 flex items-center justify-center">
                    <span data-source-location="pages/AdminDashboard:376:20" data-dynamic-content="true" className="text-sm font-semibold text-emerald-700">
                      {tech.name?.split(' ').map((n) => n[0]).join('')}
                    </span>
                  </div>
                  <div data-source-location="pages/AdminDashboard:380:18" data-dynamic-content="true">
                    <p data-source-location="pages/AdminDashboard:381:20" data-dynamic-content="true" className="font-medium text-gray-900">{tech.name}</p>
                    <p data-source-location="pages/AdminDashboard:382:20" data-dynamic-content="true" className="text-xs text-gray-500">{tech.employee_id}</p>
                  </div>
                </div>
                <StatusBadge data-source-location="pages/AdminDashboard:385:16" data-dynamic-content="false" status={tech.availability_status} size="sm" />
              </div>
                )
            }
          </CardContent>
        </Card>
      </div>
        </TabsContent>

        <TabsContent data-source-location="pages/AdminDashboard:393:8" data-dynamic-content="true" value="team" className="space-y-6">
          <Card data-source-location="pages/AdminDashboard:394:10" data-dynamic-content="true">
            <CardHeader data-source-location="pages/AdminDashboard:395:12" data-dynamic-content="false">
              <CardTitle data-source-location="pages/AdminDashboard:396:14" data-dynamic-content="false">Top Performers</CardTitle>
            </CardHeader>
            <CardContent data-source-location="pages/AdminDashboard:398:12" data-dynamic-content="true" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sortedTechnicians.length === 0 ?
                <div className="col-span-full text-center py-12 text-primary">
                  <Users className="w-12 h-12 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium text-primary">No data found</p>
                  <p className="text-xs text-primary/70 mt-1">No technician performance data available</p>
                </div> :
                sortedTechnicians.slice(0, 6).map((tech) => {
                  const techJobs = requests.filter((r) => r.assigned_technician_id === tech.id);
                  const techReports = allReports.filter((r) => r.technician_id === tech.id);
                  return (
                    <TechnicianPerformanceCard data-source-location="pages/AdminDashboard:403:18" data-dynamic-content="false"
                    key={tech.id}
                    technician={tech}
                    jobs={techJobs}
                    reports={techReports} />);
                })
              }
            </CardContent>
          </Card>

          {needsTraining.length > 0 &&
          <Card data-source-location="pages/AdminDashboard:415:12" data-dynamic-content="true">
              <CardHeader data-source-location="pages/AdminDashboard:416:14" data-dynamic-content="false">
                <CardTitle data-source-location="pages/AdminDashboard:417:16" data-dynamic-content="false" className="flex items-center gap-2">
                  <AlertTriangle data-source-location="pages/AdminDashboard:418:18" data-dynamic-content="false" className="w-5 h-5 text-orange-500" />
                  Training Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent data-source-location="pages/AdminDashboard:422:14" data-dynamic-content="true">
                <div data-source-location="pages/AdminDashboard:423:16" data-dynamic-content="true" className="space-y-3">
                  {needsTraining.map((tech) =>
                <div data-source-location="pages/AdminDashboard:425:20" data-dynamic-content="true" key={tech.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div data-source-location="pages/AdminDashboard:426:22" data-dynamic-content="true">
                        <p data-source-location="pages/AdminDashboard:427:24" data-dynamic-content="true" className="font-medium text-gray-900">{tech.name}</p>
                        <p data-source-location="pages/AdminDashboard:428:24" data-dynamic-content="true" className="text-sm text-gray-600">
                          {(tech.rating || 0) < 4.0 && 'Low customer rating - '}
                          {(tech.jobs_completed || 0) < 10 && 'Needs more experience'}
                        </p>
                      </div>
                      <Button data-source-location="pages/AdminDashboard:433:22" data-dynamic-content="false" size="sm" variant="outline" className="border-primary/30 hover:bg-primary/10 hover:border-primary">Schedule Training</Button>
                    </div>
                )}
                </div>
              </CardContent>
            </Card>
          }
        </TabsContent>
      </Tabs>

      {/* Full-screen map modal */}
      <Dialog open={mapFullScreen} onOpenChange={(open) => !open && setMapFullScreen(false)}>
        <DialogContent className="max-w-none w-[95vw] h-[90vh] sm:w-[98vw] sm:h-[95vh] rounded-lg p-0 gap-0 overflow-hidden border-0">
          <div className="flex flex-col h-full">
            <div className="flex items-center min-h-12 shrink-0 px-4 pr-12 border-b bg-background">
              <DialogTitle className="text-lg font-semibold m-0">Live Field Tracking</DialogTitle>
            </div>
            <div className="flex-1 min-h-0 p-2">
              <DashboardMap
                jobs={clientsForMap}
                className="h-full min-h-[70vh]"
                onCreateServiceRequest={handleCreateServiceRequestFromMap}
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