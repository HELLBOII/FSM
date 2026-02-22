import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { serviceRequestService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Filter,
  Grid3X3,
  List,
  SlidersHorizontal,
  X,
  Download,
  RefreshCw,
  Sparkles,
  UserCheck } from
'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger } from
"@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle } from
"@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import PageHeader from '@/components/common/PageHeader';
import JobCard from '@/components/ui/JobCard';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';
import ServiceRequestForm from '@/components/forms/ServiceRequestForm';
import AutoAssignDialog from '@/components/assignment/AutoAssignDialog';
import AssignmentPanel from '@/components/assignment/AssignmentPanel';
import { toast } from 'sonner';
import { format } from 'date-fns';

const statusFilters = [
{ value: 'all', label: 'All Status' },
{ value: 'new', label: 'New' },
{ value: 'scheduled', label: 'Scheduled' },
{ value: 'assigned', label: 'Assigned' },
{ value: 'in_progress', label: 'In Progress' },
{ value: 'completed', label: 'Completed' },
{ value: 'approved', label: 'Approved' },
{ value: 'closed', label: 'Closed' },
{ value: 'rework', label: 'Rework' }];


const priorityFilters = [
{ value: 'all', label: 'All Priority' },
{ value: 'urgent', label: 'Urgent' },
{ value: 'high', label: 'High' },
{ value: 'medium', label: 'Medium' },
{ value: 'low', label: 'Low' }];


const irrigationFilters = [
{ value: 'all', label: 'All Types' },
{ value: 'drip', label: 'Drip' },
{ value: 'sprinkler', label: 'Sprinkler' },
{ value: 'center_pivot', label: 'Center Pivot' },
{ value: 'flood', label: 'Flood' },
{ value: 'micro_sprinkler', label: 'Micro Sprinkler' },
{ value: 'subsurface', label: 'Subsurface' }];


export default function ServiceRequests() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState('card');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [irrigationFilter, setIrrigationFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [showAutoAssign, setShowAutoAssign] = useState(false);
  const [showAssignPanel, setShowAssignPanel] = useState(false);
  const [assigningRequest, setAssigningRequest] = useState(null);

  // Check URL params for actions
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'new') {
      setShowForm(true);
    }
    if (params.get('id')) {

      // TODO: Load and show specific request
    }}, []);

  const { data: requests = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['serviceRequests'],
    queryFn: () => serviceRequestService.list('created_at', 'desc', 200)
  });

  const createMutation = useMutation({
    mutationFn: (data) => serviceRequestService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
      queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
      setShowForm(false);
      setSelectedRequest(null);
      toast.success('Service request created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create request: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => serviceRequestService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
      queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
      setShowForm(false);
      setSelectedRequest(null);
      toast.success('Request updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update request: ' + error.message);
    }
  });

  // Filter requests
  const filteredRequests = requests.filter((request) => {
    const matchesSearch = !searchQuery ||
    request.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    request.farm_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    request.request_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    request.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || request.priority === priorityFilter;
    const matchesIrrigation = irrigationFilter === 'all' || request.irrigation_type === irrigationFilter;

    // Tab filters
    let matchesTab = true;
    if (activeTab === 'active') {
      matchesTab = ['new', 'scheduled', 'assigned', 'in_progress'].includes(request.status);
    } else if (activeTab === 'pending') {
      matchesTab = request.status === 'completed';
    } else if (activeTab === 'closed') {
      matchesTab = ['approved', 'closed'].includes(request.status);
    }

    return matchesSearch && matchesStatus && matchesPriority && matchesIrrigation && matchesTab;
  });

  const handleSubmit = async (data) => {
    if (selectedRequest) {
      await updateMutation.mutateAsync({ id: selectedRequest.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const handleEdit = (request) => {
    setSelectedRequest(request);
    setShowForm(true);
  };

  const handleAutoAssign = (request) => {
    setAssigningRequest(request);
    setShowAutoAssign(true);
  };

  const handleManualAssign = (request) => {
    setAssigningRequest(request);
    setShowAssignPanel(true);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setIrrigationFilter('all');
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' || irrigationFilter !== 'all';

  // Show loading indicator while data is being fetched (initial load or refetch)
  if (isLoading || (isFetching && requests.length === 0)) {
    return (
      <div data-source-location="pages/ServiceRequests:201:6" data-dynamic-content="false" className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner data-source-location="pages/ServiceRequests:202:8" data-dynamic-content="false" size="lg" text="Loading requests..." />
      </div>);
  }

  return (
    <div data-source-location="pages/ServiceRequests:208:4" data-dynamic-content="true" className="space-y-6">
      <PageHeader data-source-location="pages/ServiceRequests:209:6" data-dynamic-content="false"
      title="Service Requests"
      subtitle={`${requests.length} total requests`}
      action={() => setShowForm(true)}
      actionLabel="New Request"
      actionIcon={Plus} />


      {/* Tabs */}
      <Tabs data-source-location="pages/ServiceRequests:218:6" data-dynamic-content="true" value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-source-location="pages/ServiceRequests:219:8" data-dynamic-content="true" className="bg-gray-100 p-1">
          <TabsTrigger data-source-location="pages/ServiceRequests:220:10" data-dynamic-content="true" value="all" className="data-[state=active]:bg-white">
            All ({requests.length})
          </TabsTrigger>
          <TabsTrigger data-source-location="pages/ServiceRequests:223:10" data-dynamic-content="true" value="active" className="data-[state=active]:bg-white">
            Active ({requests.filter((r) => ['new', 'scheduled', 'assigned', 'in_progress'].includes(r.status)).length})
          </TabsTrigger>
          <TabsTrigger data-source-location="pages/ServiceRequests:226:10" data-dynamic-content="true" value="pending" className="data-[state=active]:bg-white">
            Pending Approval ({requests.filter((r) => r.status === 'completed').length})
          </TabsTrigger>
          <TabsTrigger data-source-location="pages/ServiceRequests:229:10" data-dynamic-content="true" value="closed" className="data-[state=active]:bg-white">
            Closed ({requests.filter((r) => ['approved', 'closed'].includes(r.status)).length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div data-source-location="pages/ServiceRequests:236:6" data-dynamic-content="true" className="flex flex-col sm:flex-row gap-4">
        <div data-source-location="pages/ServiceRequests:237:8" data-dynamic-content="true" className="relative flex-1">
          <Search data-source-location="pages/ServiceRequests:238:10" data-dynamic-content="false" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input data-source-location="pages/ServiceRequests:239:10" data-dynamic-content="false"
          placeholder="Search by client, farm, or request number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10" />

        </div>
        
        <div data-source-location="pages/ServiceRequests:247:8" data-dynamic-content="true" className="flex gap-2 flex-wrap">
          <Select data-source-location="pages/ServiceRequests:248:10" data-dynamic-content="true" value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger data-source-location="pages/ServiceRequests:249:12" data-dynamic-content="false" className="w-[140px]">
              <SelectValue data-source-location="pages/ServiceRequests:250:14" data-dynamic-content="false" placeholder="Status" />
            </SelectTrigger>
            <SelectContent data-source-location="pages/ServiceRequests:252:12" data-dynamic-content="true">
              {statusFilters.map((s) =>
              <SelectItem data-source-location="pages/ServiceRequests:254:16" data-dynamic-content="true" key={s.value} value={s.value}>{s.label}</SelectItem>
              )}
            </SelectContent>
          </Select>

          <Select data-source-location="pages/ServiceRequests:259:10" data-dynamic-content="true" value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger data-source-location="pages/ServiceRequests:260:12" data-dynamic-content="false" className="w-[130px]">
              <SelectValue data-source-location="pages/ServiceRequests:261:14" data-dynamic-content="false" placeholder="Priority" />
            </SelectTrigger>
            <SelectContent data-source-location="pages/ServiceRequests:263:12" data-dynamic-content="true">
              {priorityFilters.map((p) =>
              <SelectItem data-source-location="pages/ServiceRequests:265:16" data-dynamic-content="true" key={p.value} value={p.value}>{p.label}</SelectItem>
              )}
            </SelectContent>
          </Select>

          <Select data-source-location="pages/ServiceRequests:270:10" data-dynamic-content="true" value={irrigationFilter} onValueChange={setIrrigationFilter}>
            <SelectTrigger data-source-location="pages/ServiceRequests:271:12" data-dynamic-content="false" className="w-[140px]">
              <SelectValue data-source-location="pages/ServiceRequests:272:14" data-dynamic-content="false" placeholder="Irrigation" />
            </SelectTrigger>
            <SelectContent data-source-location="pages/ServiceRequests:274:12" data-dynamic-content="true">
              {irrigationFilters.map((i) =>
              <SelectItem data-source-location="pages/ServiceRequests:276:16" data-dynamic-content="true" key={i.value} value={i.value}>{i.label}</SelectItem>
              )}
            </SelectContent>
          </Select>

          {hasActiveFilters &&
          <Button data-source-location="pages/ServiceRequests:282:12" data-dynamic-content="false" variant="outline" size="icon" onClick={clearFilters} className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
              <X data-source-location="pages/ServiceRequests:283:14" data-dynamic-content="false" className="w-4 h-4" />
            </Button>
          }

          <Button data-source-location="pages/ServiceRequests:287:10" data-dynamic-content="false" variant="outline" size="icon" onClick={() => refetch()} className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
            <RefreshCw data-source-location="pages/ServiceRequests:288:12" data-dynamic-content="false" className="w-4 h-4" />
          </Button>

          <div data-source-location="pages/ServiceRequests:291:10" data-dynamic-content="true" className="flex border border-primary/30 rounded-lg overflow-hidden">
            <Button data-source-location="pages/ServiceRequests:292:12" data-dynamic-content="false"
            variant={viewMode === 'card' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('card')}
            className={viewMode === 'card' ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : 'hover:bg-primary/10 text-primary'}>

              <Grid3X3 data-source-location="pages/ServiceRequests:298:14" data-dynamic-content="false" className="w-4 h-4" />
            </Button>
            <Button data-source-location="pages/ServiceRequests:300:12" data-dynamic-content="false"
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('list')}
            className={viewMode === 'list' ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : 'hover:bg-primary/10 text-primary'}>

              <List data-source-location="pages/ServiceRequests:306:14" data-dynamic-content="false" className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Active Filters */}
      {hasActiveFilters &&
      <div data-source-location="pages/ServiceRequests:314:8" data-dynamic-content="true" className="flex flex-wrap gap-2">
          {searchQuery &&
        <Badge data-source-location="pages/ServiceRequests:316:12" data-dynamic-content="true" variant="secondary" className="gap-1">
              Search: {searchQuery}
              <X data-source-location="pages/ServiceRequests:318:14" data-dynamic-content="false" className="w-3 h-3 cursor-pointer" onClick={() => setSearchQuery('')} />
            </Badge>
        }
          {statusFilter !== 'all' &&
        <Badge data-source-location="pages/ServiceRequests:322:12" data-dynamic-content="true" variant="secondary" className="gap-1">
              Status: {statusFilter}
              <X data-source-location="pages/ServiceRequests:324:14" data-dynamic-content="false" className="w-3 h-3 cursor-pointer" onClick={() => setStatusFilter('all')} />
            </Badge>
        }
          {priorityFilter !== 'all' &&
        <Badge data-source-location="pages/ServiceRequests:328:12" data-dynamic-content="true" variant="secondary" className="gap-1">
              Priority: {priorityFilter}
              <X data-source-location="pages/ServiceRequests:330:14" data-dynamic-content="false" className="w-3 h-3 cursor-pointer" onClick={() => setPriorityFilter('all')} />
            </Badge>
        }
          {irrigationFilter !== 'all' &&
        <Badge data-source-location="pages/ServiceRequests:334:12" data-dynamic-content="true" variant="secondary" className="gap-1">
              Type: {irrigationFilter}
              <X data-source-location="pages/ServiceRequests:336:14" data-dynamic-content="false" className="w-3 h-3 cursor-pointer" onClick={() => setIrrigationFilter('all')} />
            </Badge>
        }
        </div>
      }

      {/* Results */}
      {filteredRequests.length === 0 ?
      <EmptyState data-source-location="pages/ServiceRequests:344:8" data-dynamic-content="false"
      icon={Filter}
      title="No requests found"
      description={hasActiveFilters ? "Try adjusting your filters" : "Create your first service request"}
      action={hasActiveFilters ? clearFilters : () => setShowForm(true)}
      actionLabel={hasActiveFilters ? "Clear Filters" : "New Request"} /> :

      viewMode === 'card' ?
      <div data-source-location="pages/ServiceRequests:352:8" data-dynamic-content="true" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence data-source-location="pages/ServiceRequests:353:10" data-dynamic-content="true" mode="popLayout">
            {filteredRequests.map((request) =>
          <motion.div data-source-location="pages/ServiceRequests:355:14" data-dynamic-content="true"
          key={request.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative group">

                <JobCard data-source-location="pages/ServiceRequests:362:16" data-dynamic-content="false"
            job={request}
            onClick={() => handleEdit(request)}
            showTechnician />

                {/* {!request.assigned_technician_id && ['new', 'scheduled'].includes(request.status) &&
            <div data-source-location="pages/ServiceRequests:368:18" data-dynamic-content="true" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <Button data-source-location="pages/ServiceRequests:369:20" data-dynamic-content="false"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleAutoAssign(request);
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground h-8">

                      <Sparkles data-source-location="pages/ServiceRequests:377:22" data-dynamic-content="false" className="w-3 h-3 mr-1" />
                      Auto
                    </Button>
                    <Button data-source-location="pages/ServiceRequests:380:20" data-dynamic-content="false"
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                handleManualAssign(request);
              }}
              className="h-8 border-primary text-primary hover:bg-primary hover:text-primary-foreground">

                      <UserCheck data-source-location="pages/ServiceRequests:389:22" data-dynamic-content="false" className="w-3 h-3" />
                    </Button>
                  </div>
            } */}
              </motion.div>
          )}
          </AnimatePresence>
        </div> :

      <Card data-source-location="pages/ServiceRequests:398:8" data-dynamic-content="true">
          <div data-source-location="pages/ServiceRequests:399:10" data-dynamic-content="true" className="overflow-x-auto">
            <table data-source-location="pages/ServiceRequests:400:12" data-dynamic-content="true" className="w-full">
              <thead data-source-location="pages/ServiceRequests:401:14" data-dynamic-content="false" className="bg-gray-50 border-b">
                <tr data-source-location="pages/ServiceRequests:402:16" data-dynamic-content="false">
                  <th data-source-location="pages/ServiceRequests:403:18" data-dynamic-content="false" className="text-left px-4 py-3 text-sm font-medium text-gray-600">Request #</th>
                  <th data-source-location="pages/ServiceRequests:404:18" data-dynamic-content="false" className="text-left px-4 py-3 text-sm font-medium text-gray-600">Client</th>
                  <th data-source-location="pages/ServiceRequests:405:18" data-dynamic-content="false" className="text-left px-4 py-3 text-sm font-medium text-gray-600">Type</th>
                  <th data-source-location="pages/ServiceRequests:406:18" data-dynamic-content="false" className="text-left px-4 py-3 text-sm font-medium text-gray-600">Issue</th>
                  <th data-source-location="pages/ServiceRequests:407:18" data-dynamic-content="false" className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  <th data-source-location="pages/ServiceRequests:408:18" data-dynamic-content="false" className="text-left px-4 py-3 text-sm font-medium text-gray-600">Priority</th>
                  <th data-source-location="pages/ServiceRequests:409:18" data-dynamic-content="false" className="text-left px-4 py-3 text-sm font-medium text-gray-600">Scheduled</th>
                  <th data-source-location="pages/ServiceRequests:410:18" data-dynamic-content="false" className="text-left px-4 py-3 text-sm font-medium text-gray-600">Technician</th>
                </tr>
              </thead>
              <tbody data-source-location="pages/ServiceRequests:413:14" data-dynamic-content="true" className="divide-y">
                {filteredRequests.map((request) =>
              <tr data-source-location="pages/ServiceRequests:415:18" data-dynamic-content="true"
              key={request.id}
              className="hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => handleEdit(request)}>

                    <td data-source-location="pages/ServiceRequests:420:20" data-dynamic-content="true" className="px-4 py-3 text-sm font-medium text-gray-900">{request.request_number}</td>
                    <td data-source-location="pages/ServiceRequests:421:20" data-dynamic-content="true" className="px-4 py-3">
                      <div data-source-location="pages/ServiceRequests:422:22" data-dynamic-content="true">
                        <p data-source-location="pages/ServiceRequests:423:24" data-dynamic-content="true" className="text-sm font-medium text-gray-900">{request.client_name}</p>
                        <p data-source-location="pages/ServiceRequests:424:24" data-dynamic-content="true" className="text-xs text-gray-500">{request.farm_name}</p>
                      </div>
                    </td>
                    <td data-source-location="pages/ServiceRequests:427:20" data-dynamic-content="true" className="px-4 py-3 text-sm text-gray-600 capitalize">
                      {request.irrigation_type?.replace(/_/g, ' ')}
                    </td>
                    <td data-source-location="pages/ServiceRequests:430:20" data-dynamic-content="true" className="px-4 py-3 text-sm text-gray-600 capitalize">
                      {request.issue_category?.replace(/_/g, ' ')}
                    </td>
                    <td data-source-location="pages/ServiceRequests:433:20" data-dynamic-content="true" className="px-4 py-3">
                      <StatusBadge data-source-location="pages/ServiceRequests:434:22" data-dynamic-content="false" status={request.status} size="sm" />
                    </td>
                    <td data-source-location="pages/ServiceRequests:436:20" data-dynamic-content="true" className="px-4 py-3">
                      <StatusBadge data-source-location="pages/ServiceRequests:437:22" data-dynamic-content="false" status={request.priority} size="sm" />
                    </td>
                    <td data-source-location="pages/ServiceRequests:439:20" data-dynamic-content="true" className="px-4 py-3 text-sm text-gray-600">
                      {request.scheduled_date ? format(new Date(request.scheduled_date), 'MMM d') : '-'}
                    </td>
                    <td data-source-location="pages/ServiceRequests:442:20" data-dynamic-content="true" className="px-4 py-3 text-sm text-gray-600">
                      {request.assigned_technician_name || '-'}
                    </td>
                  </tr>
              )}
              </tbody>
            </table>
          </div>
        </Card>
      }

      {/* Form Dialog */}
      <Dialog data-source-location="pages/ServiceRequests:454:6" data-dynamic-content="true" open={showForm} onOpenChange={(open) => {
        setShowForm(open);
        if (!open) setSelectedRequest(null);
      }}>
        <DialogContent data-source-location="pages/ServiceRequests:458:8" data-dynamic-content="true" className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader data-source-location="pages/ServiceRequests:459:10" data-dynamic-content="true">
            <DialogTitle data-source-location="pages/ServiceRequests:460:12" data-dynamic-content="true">
              {selectedRequest ? 'Edit Service Request' : 'New Service Request'}
            </DialogTitle>
            <DialogDescription data-source-location="pages/ServiceRequests:463:12" data-dynamic-content="true">
              {selectedRequest ? 'Update the service request details below' : 'Fill in the details for the new service request'}
            </DialogDescription>
          </DialogHeader>
          <ServiceRequestForm data-source-location="pages/ServiceRequests:467:10" data-dynamic-content="false"
          request={selectedRequest}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setSelectedRequest(null);
          }} />

        </DialogContent>
      </Dialog>

      {/* Auto Assignment Dialog */}
      {assigningRequest &&
      <AutoAssignDialog data-source-location="pages/ServiceRequests:480:8" data-dynamic-content="false"
      serviceRequest={assigningRequest}
      open={showAutoAssign}
      onOpenChange={(open) => {
        setShowAutoAssign(open);
        if (!open) setAssigningRequest(null);
      }} />

      }

      {/* Manual Assignment Panel */}
      <Dialog data-source-location="pages/ServiceRequests:491:6" data-dynamic-content="true" open={showAssignPanel} onOpenChange={(open) => {
        setShowAssignPanel(open);
        if (!open) setAssigningRequest(null);
      }}>
        <DialogContent data-source-location="pages/ServiceRequests:495:8" data-dynamic-content="true" className="max-w-lg">
          {assigningRequest &&
          <AssignmentPanel data-source-location="pages/ServiceRequests:497:12" data-dynamic-content="false"
          serviceRequest={assigningRequest}
          onClose={() => {
            setShowAssignPanel(false);
            setAssigningRequest(null);
          }} />

          }
        </DialogContent>
      </Dialog>
    </div>);

}