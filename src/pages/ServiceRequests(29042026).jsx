import React, { useState, useEffect, useMemo } from 'react';
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
  UserCheck,
  ChevronLeft,
  ChevronRight } from
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


const PAGE_SIZE_OPTIONS = [12, 24, 48];

function ServiceRequestCardSkeleton() {
  return (
    <div className="relative bg-white rounded-xl border p-4 animate-pulse">
      <div className="flex gap-2 mb-2">
        <div className="h-5 w-5 rounded bg-muted" />
        <div className="h-4 w-28 rounded bg-muted" />
        <div className="h-5 w-16 rounded-full bg-muted" />
      </div>
      <div className="h-5 w-4/5 max-w-[14rem] rounded bg-muted mb-2" />
      <div className="h-4 w-3/5 rounded bg-muted mb-3" />
      <div className="h-10 w-full rounded bg-muted/70 mb-3" />
      <div className="flex justify-between gap-2">
        <div className="h-4 w-20 rounded bg-muted" />
        <div className="h-4 w-24 rounded bg-muted" />
      </div>
    </div>
  );
}

function ServiceRequestTableSkeleton({ rows = 10 }) {
  const n = Math.min(Math.max(1, rows), 24);
  return (
    <div className="overflow-x-auto" aria-busy="true" aria-label="Loading service requests">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            {['Request #', 'Client', 'Type', 'Issue', 'Status', 'Priority', 'Scheduled', 'Technician'].map((h, i) => (
              <th key={i} className="text-left px-4 py-3 text-sm font-medium text-gray-600">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {Array.from({ length: n }).map((_, i) => (
            <tr key={i}>
              <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-muted animate-pulse" /></td>
              <td className="px-4 py-3">
                <div className="h-4 w-36 rounded bg-muted animate-pulse mb-1" />
                <div className="h-3 w-28 rounded bg-muted animate-pulse" />
              </td>
              <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-muted animate-pulse" /></td>
              <td className="px-4 py-3"><div className="h-4 w-28 rounded bg-muted animate-pulse" /></td>
              <td className="px-4 py-3"><div className="h-6 w-20 rounded-full bg-muted animate-pulse" /></td>
              <td className="px-4 py-3"><div className="h-6 w-16 rounded-full bg-muted animate-pulse" /></td>
              <td className="px-4 py-3"><div className="h-4 w-14 rounded bg-muted animate-pulse" /></td>
              <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-muted animate-pulse" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  // Check URL params for actions
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'new') {
      setShowForm(true);
    }
    if (params.get('id')) {

      // TODO: Load and show specific request
    }}, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, priorityFilter, irrigationFilter, activeTab, pageSize]);

  const {
    data: pageResult,
    isFetching,
    refetch
  } = useQuery({
    queryKey: [
      'serviceRequests',
      'paged',
      page,
      pageSize,
      debouncedSearch,
      statusFilter,
      priorityFilter,
      irrigationFilter,
      activeTab
    ],
    queryFn: () =>
      serviceRequestService.listPaged({
        page,
        pageSize,
        search: debouncedSearch,
        status: statusFilter,
        priority: priorityFilter,
        irrigation: irrigationFilter,
        activeTab
      }),
    placeholderData: (previousData) => previousData
  });

  const { data: tabCounts } = useQuery({
    queryKey: ['serviceRequests', 'tabCounts'],
    queryFn: () => serviceRequestService.getTabCounts()
  });

  const showPageSkeleton = isFetching;
  const requests = pageResult?.data ?? [];
  const total = pageResult?.total ?? 0;

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize) || 1),
    [total, pageSize]
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

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

  return (
    <div data-source-location="pages/ServiceRequests:208:4" data-dynamic-content="true" className="space-y-6">
      <div className="space-y-4 pb-4 border-b border-gray-200 bg-gray-50">
      <PageHeader data-source-location="pages/ServiceRequests:209:6" data-dynamic-content="false"
      title="Service Requests"
      className="mb-0"
      subtitle={
        total > 0
          ? `${total.toLocaleString()} request${total === 1 ? '' : 's'} (this view)`
          : 'Service requests'
      }
      action={() => setShowForm(true)}
      actionLabel="New Request"
      actionIcon={Plus} />


      {/* Tabs */}
      <Tabs data-source-location="pages/ServiceRequests:218:6" data-dynamic-content="true" value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-source-location="pages/ServiceRequests:219:8" data-dynamic-content="true" className="bg-gray-100 p-1">
          <TabsTrigger data-source-location="pages/ServiceRequests:220:10" data-dynamic-content="true" value="all" className="data-[state=active]:bg-white">
            All ({(tabCounts?.all ?? 0).toLocaleString()})
          </TabsTrigger>
          <TabsTrigger data-source-location="pages/ServiceRequests:223:10" data-dynamic-content="true" value="active" className="data-[state=active]:bg-white">
            Active ({(tabCounts?.active ?? 0).toLocaleString()})
          </TabsTrigger>
          <TabsTrigger data-source-location="pages/ServiceRequests:226:10" data-dynamic-content="true" value="pending" className="data-[state=active]:bg-white">
            Pending Approval ({(tabCounts?.pending ?? 0).toLocaleString()})
          </TabsTrigger>
          <TabsTrigger data-source-location="pages/ServiceRequests:229:10" data-dynamic-content="true" value="closed" className="data-[state=active]:bg-white">
            Closed ({(tabCounts?.closed ?? 0).toLocaleString()})
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
      {pageResult && total === 0 ? (
      <div className="flex min-h-[min(50vh,28rem)] items-center justify-center py-8">
      <EmptyState data-source-location="pages/ServiceRequests:344:8" data-dynamic-content="false"
      icon={Filter}
      title={debouncedSearch || hasActiveFilters ? 'No matching requests' : 'No requests yet'}
      description={
        debouncedSearch || hasActiveFilters
          ? 'Try different search terms or filters'
          : 'Create your first service request'
      }
      action={debouncedSearch || hasActiveFilters ? clearFilters : () => setShowForm(true)}
      actionLabel={debouncedSearch || hasActiveFilters ? 'Clear filters' : 'New Request'} />
      </div>
      ) : (
      <>
      {viewMode === 'card' ? (
      showPageSkeleton ? (
      <div
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        aria-busy="true"
        aria-label="Loading service requests"
      >
        {Array.from({ length: Math.min(pageSize, 24) }).map((_, i) => (
          <ServiceRequestCardSkeleton key={`sk-${i}`} />
        ))}
      </div>
      ) : (
      <div data-source-location="pages/ServiceRequests:352:8" data-dynamic-content="true" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence data-source-location="pages/ServiceRequests:353:10" data-dynamic-content="true" mode="popLayout">
            {requests.map((request) =>
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
        </div>
      )) : (
      showPageSkeleton ? (
      <Card data-source-location="pages/ServiceRequests:398:8" data-dynamic-content="true">
        <ServiceRequestTableSkeleton rows={pageSize} />
      </Card>
      ) : (
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
                {requests.map((request) =>
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
      )
      )}

      {pageResult && total > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-200 bg-gray-50 rounded-lg px-1 pb-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600 leading-tight">
              Showing{' '}
              <span className="font-medium text-gray-900">
                {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()}
              </span>{' '}
              of <span className="font-medium text-gray-900">{total.toLocaleString()}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <Select
                value={String(pageSize)}
                onValueChange={(v) => setPageSize(Number(v))}
              >
                <SelectTrigger className="w-[130px] border-primary/30">
                  <SelectValue placeholder="Per page" />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} per page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  disabled={page <= 1 || isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-700 px-2 min-w-[7rem] text-center tabular-nums">
                  Page {page} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  disabled={page >= totalPages || isFetching}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      </>
      )}

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
