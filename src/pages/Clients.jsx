import React, { useState, useEffect, useMemo } from 'react';
import { clientService, serviceRequestService, irrigationSystemsService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCircle,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Leaf,
  ChevronRight,
  ChevronLeft,
  Edit,
  MoreVertical,
  Droplets,
  History,
  StickyNote } from
'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator } from
"@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle } from
"@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import PageHeader from '@/components/common/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';
import ClientNotesHistoryDialog from '@/components/clients/ClientNotesHistoryDialog';
import { normalizeNotesHistory } from '@/utils/clientNotesHistory';
import { toast } from 'sonner';

const irrigationSystems = [
'Drip Irrigation',
'Sprinkler System',
'Center Pivot',
'Flood Irrigation',
'Micro Sprinkler',
'Subsurface Drip'];


const PAGE_SIZE_OPTIONS = [12, 24, 48];

/** Red asterisk for required form labels */
function RequiredMark() {
  return <span className="text-red-600 ml-0.5" aria-hidden="true">*</span>;
}

/** Empty or whitespace → null; invalid number → null */
function parseOptionalNumber(value) {
  const s = String(value ?? '').trim();
  if (s === '') return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function ClientCardSkeleton() {
  return (
    <Card className="h-full min-h-0 border bg-card shadow-sm">
      <CardContent className="p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-12 w-12 rounded-full bg-muted animate-pulse shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
              <div className="h-4 w-[66%] max-w-[12rem] rounded bg-muted animate-pulse" />
              <div className="h-3 w-1/2 max-w-[8rem] rounded bg-muted animate-pulse" />
            </div>
          </div>
          <div className="h-8 w-8 rounded-md bg-muted animate-pulse shrink-0" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-muted animate-pulse" />
          <div className="h-3 w-full rounded bg-muted animate-pulse" />
        </div>
        <div className="flex justify-between gap-2 pt-1">
          <div className="h-6 w-16 rounded-full bg-muted animate-pulse" />
          <div className="h-4 w-12 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-px w-full bg-muted/60" />
        <div className="h-4 w-28 rounded bg-muted animate-pulse" />
      </CardContent>
    </Card>
  );
}

export default function Clients() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [showForm, setShowForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showAddIrrigationDialog, setShowAddIrrigationDialog] = useState(false);
  const [newIrrigationSystem, setNewIrrigationSystem] = useState('');
  const [notesHistoryOpen, setNotesHistoryOpen] = useState(false);
  const [notesHistoryTarget, setNotesHistoryTarget] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    latitude: '',
    longitude: '',
    farm_name: '',
    address: '',
    city: '',
    state: '',
    zipcode: '',
    country: '',
    total_acreage: '',
    irrigation_systems: [],
    notes: '',
    status: 'active'
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, pageSize]);

  const {
    data: pageResult,
    isLoading,
    isFetching
  } = useQuery({
    queryKey: ['clients', 'paged', page, pageSize, debouncedSearch, statusFilter],
    queryFn: () =>
      clientService.listPaged({
        page,
        pageSize,
        search: debouncedSearch,
        status: statusFilter
      }),
    placeholderData: (previousData) => previousData
  });

  /** Skeleton only (no full-page spinner): show while any clients query is in flight */
  const showPageSkeleton = isFetching;

  const clients = pageResult?.data ?? [];
  const total = pageResult?.total ?? 0;

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize) || 1),
    [total, pageSize]
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const { data: dbIrrigationSystems = [], isLoading: isLoadingIrrigationSystems } = useQuery({
    queryKey: ['irrigationSystems'],
    queryFn: () => irrigationSystemsService.list()
  });

  // Get all unique irrigation systems from database and combine with hardcoded ones
  const getAllIrrigationSystems = (clientsData = [], dbSystems = []) => {
    const dbSystemNames = dbSystems.map(sys => sys.irrigation_systems);
    const clientSystems = clientsData.flatMap(client => client.irrigation_systems || []);
    const allSystems = [...new Set([...irrigationSystems, ...dbSystemNames, ...clientSystems])];
    return allSystems.sort();
  };

  const availableIrrigationSystems = getAllIrrigationSystems(clients, dbIrrigationSystems);

  const createIrrigationSystemMutation = useMutation({
    mutationFn: (data) => irrigationSystemsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['irrigationSystems'] });
      setNewIrrigationSystem('');
      setShowAddIrrigationDialog(false);
      toast.success('Irrigation system added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add irrigation system: ' + error.message);
    }
  });

  const handleAddIrrigationSystem = async () => {
    const systemName = newIrrigationSystem.trim();
    if (systemName && !availableIrrigationSystems.includes(systemName)) {
      // Check if it already exists in database
      try {
        const existing = await irrigationSystemsService.getByName(systemName);
        if (existing) {
          toast.error('This irrigation system already exists');
          return;
        }
      } catch (error) {
        // If error is not "not found", rethrow it
        if (error.code !== 'PGRST116') {
          throw error;
        }
      }

      // Create new irrigation system in database
      await createIrrigationSystemMutation.mutateAsync({
        irrigation_systems: systemName
      });
    }
  };

  const { data: requests = [] } = useQuery({
    queryKey: ['serviceRequests'],
    queryFn: () => serviceRequestService.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => clientService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      resetForm();
      toast.success('Client added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add client: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => clientService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      resetForm();
      toast.success('Client updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update client: ' + error.message);
    }
  });

  const resetForm = () => {
    setShowForm(false);
    setSelectedClient(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      latitude: '',
      longitude: '',
      farm_name: '',
      address: '',
      city: '',
      state: '',
      zipcode: '',
      country: '',
      total_acreage: '',
      irrigation_systems: [],
      notes: '',
      status: 'active'
    });
  };

  const handleEdit = (client) => {
    setSelectedClient(client);
    setFormData({
      name: client.name || '',
      phone: client.phone || '',
      email: client.email || '',
      latitude: client.location?.lat?.toString() || client.latitude?.toString() || '',
      longitude: client.location?.lng?.toString() || client.longitude?.toString() || '',
      farm_name: client.farm_name || '',
      address: client.address || '',
      city: client.city || '',
      state: client.state || '',
      zipcode: client.zipcode || '',
      country: client.country || '',
      total_acreage: client.total_acreage?.toString() || '',
      irrigation_systems: client.irrigation_systems || [],
      notes: client.notes || '',
      status: client.status || 'active'
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const lat = parseOptionalNumber(formData.latitude);
    const lng = parseOptionalNumber(formData.longitude);
    const submitData = {
      ...formData,
      total_acreage: parseOptionalNumber(formData.total_acreage),
      latitude: lat,
      longitude: lng,
      location: lat != null && lng != null ? { lat, lng } : null,
      notes_history: selectedClient ? normalizeNotesHistory(selectedClient.notes_history) : []
    };
    if (selectedClient) {
      await updateMutation.mutateAsync({ id: selectedClient.id, data: submitData });
    } else {
      await createMutation.mutateAsync(submitData);
    }
  };

  const getClientRequestCount = (clientId) => {
    return requests.filter((r) => r.client_id === clientId).length;
  };

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div className="space-y-6">
      <div className="space-y-4 pb-4 border-b border-gray-200 bg-gray-50">
        <PageHeader
          title="Clients"
          className="mb-0"
          subtitle={
            total > 0
              ? `${total.toLocaleString()} registered farmers/clients`
              : 'Registered farmers/clients'
          }
          action={() => setShowForm(true)}
          actionLabel="Add Client"
          actionIcon={Plus}
        />

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by name, farm, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] border-primary/30 focus:ring-primary focus:border-primary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Clients Grid */}
      {pageResult && total === 0 ? (
        <div className="flex min-h-[min(50vh,28rem)] items-center justify-center py-8">
          <EmptyState
            icon={UserCircle}
            title={debouncedSearch || statusFilter !== 'all' ? 'No matching clients' : 'No clients yet'}
            description={
              debouncedSearch || statusFilter !== 'all'
                ? 'Try different search terms or filters'
                : 'Add your first client/farmer'
            }
            action={debouncedSearch || statusFilter !== 'all' ? undefined : () => setShowForm(true)}
            actionLabel={debouncedSearch || statusFilter !== 'all' ? undefined : 'Add Client'}
          />
        </div>
      ) : (
      <>
      <div className="space-y-0">
      {showPageSkeleton ? (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch"
          aria-busy="true"
          aria-label="Loading clients"
        >
          {Array.from({ length: Math.min(pageSize, 24) }).map((_, i) => (
            <ClientCardSkeleton key={`sk-${i}`} />
          ))}
        </div>
      ) : (
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch"
      >
          <AnimatePresence data-source-location="pages/Clients:216:10" data-dynamic-content="true" mode="popLayout">
            {clients.map((client) =>
          <motion.div data-source-location="pages/Clients:218:14" data-dynamic-content="true"
          key={client.id}
          className="h-full min-h-0"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}>

                <Card data-source-location="pages/Clients:224:16" data-dynamic-content="true" className="hover:shadow-lg transition-all cursor-pointer group h-full flex flex-col min-h-0">
                  <CardContent data-source-location="pages/Clients:225:18" data-dynamic-content="true" className="p-5 flex flex-col flex-1 h-full min-h-0">
                    <div data-source-location="pages/Clients:226:20" data-dynamic-content="true" className="flex items-start justify-between mb-4 shrink-0">
                      <div data-source-location="pages/Clients:227:22" data-dynamic-content="true" className="flex items-center gap-3">
                        <Avatar data-source-location="pages/Clients:228:24" data-dynamic-content="true" className="h-12 w-12">
                          <AvatarFallback data-source-location="pages/Clients:229:26" data-dynamic-content="true" className="bg-gradient-to-br from-green-100 to-emerald-100 text-green-700 text-lg">
                            {/* {client.name?.split(' ').map((n) => n[0]).join('')} */}
                            {client.name
                              ?.split(' ')
                              .map((n) => n[0])
                              .slice(0, 1)
                              .join('')
                            }
                          </AvatarFallback>
                        </Avatar>
                        <div data-source-location="pages/Clients:233:24" data-dynamic-content="true">
                          <h3 data-source-location="pages/Clients:234:26" data-dynamic-content="true" className="font-semibold text-gray-900">{client.name}</h3>
                          <div data-source-location="pages/Clients:235:26" data-dynamic-content="true" className="flex items-center gap-1 text-sm text-gray-500">
                            <Leaf data-source-location="pages/Clients:236:28" data-dynamic-content="false" className="w-3.5 h-3.5" />
                            {client.farm_name}
                          </div>
                        </div>
                      </div>
                      <DropdownMenu data-source-location="pages/Clients:241:22" data-dynamic-content="true">
                        <DropdownMenuTrigger data-source-location="pages/Clients:242:24" data-dynamic-content="false" asChild>
                          <Button data-source-location="pages/Clients:243:26" data-dynamic-content="false" variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                            <MoreVertical data-source-location="pages/Clients:244:28" data-dynamic-content="false" className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent data-source-location="pages/Clients:247:24" data-dynamic-content="true" align="end">
                          <DropdownMenuItem data-source-location="pages/Clients:248:26" data-dynamic-content="false" onClick={() => handleEdit(client)}>
                            <Edit data-source-location="pages/Clients:249:28" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="flex items-center justify-between gap-2"
                            onClick={() => {
                              setNotesHistoryTarget({ id: client.id, name: client.name });
                              setNotesHistoryOpen(true);
                            }}
                          >
                            <span className="flex items-center">
                              <History className="w-4 h-4 mr-2 shrink-0" />
                              Notes history
                            </span>
                            {normalizeNotesHistory(client.notes_history).length > 0 && (
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {normalizeNotesHistory(client.notes_history).length}
                              </span>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div data-source-location="pages/Clients:256:20" data-dynamic-content="true" className="space-y-2 mb-4 flex-1 min-h-0 flex flex-col justify-start">
                      {/* {client.phone && */}
                  <div data-source-location="pages/Clients:258:24" data-dynamic-content="true" className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone data-source-location="pages/Clients:259:26" data-dynamic-content="false" className="w-4 h-4 text-gray-400" />
                          {client.phone ? client.phone : 'N/A'}
                        </div>
                  {/* } */}
                      {/* {client.address && */}
                  <div data-source-location="pages/Clients:264:24" data-dynamic-content="true" className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin data-source-location="pages/Clients:265:26" data-dynamic-content="false" className="w-4 h-4 text-gray-400" />
                          <span data-source-location="pages/Clients:266:26" data-dynamic-content="true" className="truncate">{client.address ? client.address : 'N/A'}</span>
                        </div>
                  {/* } */}
                    </div>

                    <div data-source-location="pages/Clients:271:20" data-dynamic-content="true" className="flex items-center justify-between mb-3 shrink-0">
                      <StatusBadge data-source-location="pages/Clients:272:22" data-dynamic-content="false" status={client.status} size="sm" />
                      {client.total_acreage &&
                  <span data-source-location="pages/Clients:274:24" data-dynamic-content="true" className="text-sm text-gray-500">{client.total_acreage} acres</span>
                  }
                    </div>

                    <div data-source-location="pages/Clients:278:20" data-dynamic-content="true" className="flex items-center justify-between pt-3 border-t shrink-0">
                      <div data-source-location="pages/Clients:279:22" data-dynamic-content="true" className="flex items-center gap-1 text-sm text-gray-600">
                        <Droplets data-source-location="pages/Clients:280:24" data-dynamic-content="false" className="w-4 h-4 text-primary" />
                        <span data-source-location="pages/Clients:281:24" data-dynamic-content="true">{getClientRequestCount(client.id)} requests</span>
                      </div>
                    </div>

                    {client.irrigation_systems?.length > 0 &&
                <div data-source-location="pages/Clients:286:22" data-dynamic-content="true" className="flex flex-wrap gap-1 mt-3 shrink-0">
                        {client.irrigation_systems.slice(0, 2).map((sys, idx) =>
                  <Badge data-source-location="pages/Clients:288:26" data-dynamic-content="true" key={idx} className="bg-primary text-primary-foreground text-xs">
                            {sys}
                          </Badge>
                  )}
                        {client.irrigation_systems.length > 2 &&
                  <Badge data-source-location="pages/Clients:293:26" data-dynamic-content="true" className="bg-primary text-primary-foreground text-xs">
                            +{client.irrigation_systems.length - 2}
                          </Badge>
                  }
                      </div>
                }
                  </CardContent>
                </Card>
              </motion.div>
          )}
          </AnimatePresence>
        </div>
      )}
      </div>

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
      <Dialog data-source-location="pages/Clients:308:6" data-dynamic-content="true" open={showForm} onOpenChange={(open) => {if (!open) resetForm();}}>
        <DialogContent data-source-location="pages/Clients:309:8" data-dynamic-content="true" className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader data-source-location="pages/Clients:310:10" data-dynamic-content="true">
            <DialogTitle data-source-location="pages/Clients:311:12" data-dynamic-content="true">
              {selectedClient ? 'Edit Client' : 'Add Client'}
            </DialogTitle>
            <DialogDescription data-source-location="pages/Clients:314:12" data-dynamic-content="true">
              {selectedClient ? 'Update client details' : 'Add a new farmer/client'}
            </DialogDescription>
          </DialogHeader>

          <form data-source-location="pages/Clients:319:10" data-dynamic-content="true" onSubmit={handleSubmit} className="space-y-4">
            <div data-source-location="pages/Clients:320:12" data-dynamic-content="true" className="grid grid-cols-2 gap-4">
              {/* Left Column */}
              <div data-source-location="pages/Clients:320:12" data-dynamic-content="true" className="space-y-4">
                <div data-source-location="pages/Clients:320:12" data-dynamic-content="true">
                  <Label data-source-location="pages/Clients:321:14" data-dynamic-content="false">
                    Client Name
                    <RequiredMark />
                  </Label>
                  <Input data-source-location="pages/Clients:322:14" data-dynamic-content="false"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="John Farmer"
                  required />
                </div>

                <div data-source-location="pages/Clients:330:12" data-dynamic-content="true">
                  <Label data-source-location="pages/Clients:331:14" data-dynamic-content="false">
                    Farm Name
                    <RequiredMark />
                  </Label>
                  <Input data-source-location="pages/Clients:332:14" data-dynamic-content="false"
                  value={formData.farm_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, farm_name: e.target.value }))}
                  placeholder="Green Acres Farm"
                  required />
                </div>

                <div data-source-location="pages/Clients:341:14" data-dynamic-content="true">
                  <Label data-source-location="pages/Clients:342:16" data-dynamic-content="false">
                    Phone
                    <RequiredMark />
                  </Label>
                  <Input data-source-location="pages/Clients:343:16" data-dynamic-content="false"
                  value={formData.phone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="+1 234 567 8900"
                  required />
                </div>

                <div data-source-location="pages/Clients:350:14" data-dynamic-content="true">
                  <Label data-source-location="pages/Clients:351:16" data-dynamic-content="false">Total Acreage</Label>
                  <Input data-source-location="pages/Clients:352:16" data-dynamic-content="false"
                  type="number"
                  value={formData.total_acreage}
                  onChange={(e) => setFormData((prev) => ({ ...prev, total_acreage: e.target.value }))}
                  placeholder="50" />
                </div>

                <div data-source-location="pages/Clients:361:12" data-dynamic-content="true">
                  <Label data-source-location="pages/Clients:362:14" data-dynamic-content="false">
                    Email
                    <RequiredMark />
                  </Label>
                  <Input data-source-location="pages/Clients:363:14" data-dynamic-content="false"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="john@farm.com"
                  required />
                </div>

                <div data-source-location="pages/Clients:361:12" data-dynamic-content="true">
                  <Label data-source-location="pages/Clients:362:14" data-dynamic-content="false">Latitude</Label>
                  <Input data-source-location="pages/Clients:363:14" data-dynamic-content="false"
                  type="number"
                  step="any"
                  value={formData.latitude}
                  onChange={(e) => setFormData((prev) => ({ ...prev, latitude: e.target.value }))}
                  placeholder="36.0800" />
                </div>
                <div data-source-location="pages/Clients:361:12" data-dynamic-content="true">
                  <Label data-source-location="pages/Clients:362:14" data-dynamic-content="false">Longitude</Label>
                  <Input data-source-location="pages/Clients:363:14" data-dynamic-content="false"
                  type="number"
                  step="any"
                  value={formData.longitude}
                  onChange={(e) => setFormData((prev) => ({ ...prev, longitude: e.target.value }))}
                  placeholder="-115.1522" />
                </div>
              </div>

              {/* Right Column */}
              <div data-source-location="pages/Clients:320:12" data-dynamic-content="true" className="space-y-4">
                <div data-source-location="pages/Clients:371:12" data-dynamic-content="true">
                  <Label data-source-location="pages/Clients:372:14" data-dynamic-content="false">
                    Street Address
                    <RequiredMark />
                  </Label>
                  <Textarea data-source-location="pages/Clients:373:14" data-dynamic-content="false"
                  value={formData.address}
                  onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Street address"
                  rows={5}
                  className="min-h-[120px] resize-y"
                  required />
                </div>

                <div data-source-location="pages/Clients:371:12" data-dynamic-content="true" className="grid grid-cols-2 gap-4">
                  <div data-source-location="pages/Clients:371:12" data-dynamic-content="true">
                    <Label data-source-location="pages/Clients:372:14" data-dynamic-content="false">
                      City
                      <RequiredMark />
                    </Label>
                    <Input data-source-location="pages/Clients:373:14" data-dynamic-content="false"
                    value={formData.city}
                    onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                    placeholder="City"
                    required />
                  </div>
                  <div data-source-location="pages/Clients:371:12" data-dynamic-content="true">
                    <Label data-source-location="pages/Clients:372:14" data-dynamic-content="false">
                      State
                      <RequiredMark />
                    </Label>
                    <Input data-source-location="pages/Clients:373:14" data-dynamic-content="false"
                    value={formData.state}
                    onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
                    placeholder="State"
                    required />
                  </div>
                </div>

                <div data-source-location="pages/Clients:371:12" data-dynamic-content="true" className="grid grid-cols-2 gap-4">
                  <div data-source-location="pages/Clients:371:12" data-dynamic-content="true">
                    <Label data-source-location="pages/Clients:372:14" data-dynamic-content="false">
                      Zipcode
                      <RequiredMark />
                    </Label>
                    <Input data-source-location="pages/Clients:373:14" data-dynamic-content="false"
                    value={formData.zipcode}
                    onChange={(e) => setFormData((prev) => ({ ...prev, zipcode: e.target.value }))}
                    placeholder="Zipcode"
                    required />
                  </div>
                  <div data-source-location="pages/Clients:371:12" data-dynamic-content="true">
                    <Label data-source-location="pages/Clients:372:14" data-dynamic-content="false">
                      Country
                      <RequiredMark />
                    </Label>
                    <Input data-source-location="pages/Clients:373:14" data-dynamic-content="false"
                    value={formData.country}
                    onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
                    placeholder="Country"
                    required />
                  </div>
                </div>

                <div data-source-location="pages/Clients:381:12" data-dynamic-content="true">
                  <Label data-source-location="pages/Clients:382:14" data-dynamic-content="false">Irrigation Systems</Label>
                  <Select data-source-location="pages/Clients:383:14" data-dynamic-content="true"
                  value=""
                  modal={false}
                  onValueChange={(v) => {
                    if (v === '__add_new__') {
                      setShowAddIrrigationDialog(true);
                    } else if (v && !formData.irrigation_systems.includes(v)) {
                      setFormData((prev) => ({
                        ...prev,
                        irrigation_systems: [...prev.irrigation_systems, v]
                      }));
                    }
                  }}>

                    <SelectTrigger data-source-location="pages/Clients:394:16" data-dynamic-content="false" className="border-primary/30 focus:ring-primary focus:border-primary">
                      <SelectValue data-source-location="pages/Clients:395:18" data-dynamic-content="false" placeholder="Add system type..." />
                    </SelectTrigger>
                    <SelectContent data-source-location="pages/Clients:397:16" data-dynamic-content="true" className="max-h-[300px]">
                      {availableIrrigationSystems.map((sys) =>
                      <SelectItem data-source-location="pages/Clients:399:20" data-dynamic-content="true" key={sys} value={sys}>{sys}</SelectItem>
                      )}
                      <SelectSeparator />
                      <SelectItem data-source-location="pages/Clients:399:20" data-dynamic-content="true" value="__add_new__" className="text-primary font-medium">
                        <Plus className="w-4 h-4 inline mr-2" />
                        Add new Irrigation System
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.irrigation_systems.length > 0 &&
                  <div data-source-location="pages/Clients:404:16" data-dynamic-content="true" className="flex flex-wrap gap-1 mt-2">
                      {formData.irrigation_systems.map((sys, idx) =>
                    <Badge data-source-location="pages/Clients:406:20" data-dynamic-content="true"
                    key={idx}
                    className="bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors"
                    onClick={() => setFormData((prev) => ({
                      ...prev,
                      irrigation_systems: prev.irrigation_systems.filter((_, i) => i !== idx)
                    }))}>

                          {sys} ×
                        </Badge>
                    )}
                    </div>
                  }
                </div>

                <div data-source-location="pages/Clients:432:12" data-dynamic-content="true">
                  <Label data-source-location="pages/Clients:433:14" data-dynamic-content="false">
                    Status
                    <RequiredMark />
                  </Label>
                  <Select data-source-location="pages/Clients:434:14" data-dynamic-content="false"
                  value={formData.status}
                  required
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, status: v }))}>

                    <SelectTrigger data-source-location="pages/Clients:438:16" data-dynamic-content="false" className="border-primary/30 focus:ring-primary focus:border-primary">
                      <SelectValue data-source-location="pages/Clients:439:18" data-dynamic-content="false" />
                    </SelectTrigger>
                    <SelectContent data-source-location="pages/Clients:441:16" data-dynamic-content="false">
                      <SelectItem data-source-location="pages/Clients:442:18" data-dynamic-content="false" value="active">Active</SelectItem>
                      <SelectItem data-source-location="pages/Clients:443:18" data-dynamic-content="false" value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div data-source-location="pages/Clients:422:12" data-dynamic-content="true">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Label data-source-location="pages/Clients:423:14" data-dynamic-content="false" className="mb-0">
                      Notes
                    </Label>
                    {selectedClient && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs border-primary/30"
                        onClick={() => {
                          setNotesHistoryTarget({ id: selectedClient.id, name: selectedClient.name });
                          setNotesHistoryOpen(true);
                        }}
                      >
                        <StickyNote className="w-3.5 h-3.5 mr-1.5" />
                        History
                        {normalizeNotesHistory(selectedClient.notes_history).length > 0 && (
                          <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px]">
                            {normalizeNotesHistory(selectedClient.notes_history).length}
                          </Badge>
                        )}
                      </Button>
                    )}
                  </div>
                  <Textarea data-source-location="pages/Clients:424:14" data-dynamic-content="false"
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="General notes (separate from dated history below)..."
                  rows={5}
                  className="min-h-[120px] resize-y" />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Use <span className="font-medium">History</span> to add timestamped entries that stay in the client log.
                  </p>
                </div>
              </div>
            </div>

            <div data-source-location="pages/Clients:448:12" data-dynamic-content="true" className="flex gap-3 pt-4">
              <Button data-source-location="pages/Clients:449:14" data-dynamic-content="false" type="button" variant="outline" className="flex-1 border-primary/30 hover:bg-primary/10 hover:border-primary" onClick={resetForm}>
                Cancel
              </Button>
              <Button data-source-location="pages/Clients:452:14" data-dynamic-content="true"
              type="submit"
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={createMutation.isPending || updateMutation.isPending}>

                {selectedClient ? 'Update' : 'Add'} Client
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ClientNotesHistoryDialog
        open={notesHistoryOpen}
        onOpenChange={(open) => {
          setNotesHistoryOpen(open);
          if (!open) setNotesHistoryTarget(null);
        }}
        clientId={notesHistoryTarget?.id}
        clientName={notesHistoryTarget?.name}
        allowAdd
        onClientUpdated={(updated) => {
          if (selectedClient?.id === updated?.id) setSelectedClient(updated);
        }}
      />

      {/* Add New Irrigation System Dialog */}
      <Dialog open={showAddIrrigationDialog} onOpenChange={setShowAddIrrigationDialog}>
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
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowAddIrrigationDialog(false);
                  setNewIrrigationSystem('');
                }}
                disabled={createIrrigationSystemMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={handleAddIrrigationSystem}
                disabled={!newIrrigationSystem.trim() || availableIrrigationSystems.includes(newIrrigationSystem.trim()) || createIrrigationSystemMutation.isPending}
              >
                {createIrrigationSystemMutation.isPending ? 'Adding...' : 'Add System'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>);

}
