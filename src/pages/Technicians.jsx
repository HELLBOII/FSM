import React, { useState, useEffect, useMemo } from 'react';
import { technicianService, specializationsService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  Star,
  ChevronRight,
  ChevronLeft,
  Edit,
  MoreVertical } from
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import PageHeader from '@/components/common/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/common/EmptyState';
import { toast } from 'sonner';

const specializations = [
'Drip Irrigation',
'Sprinkler Systems',
'Center Pivot',
'Pump Repair',
'Controller Programming',
'Water Management'];


const PAGE_SIZE_OPTIONS = [12, 24, 48];

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

function TechnicianCardSkeleton() {
  return (
    <Card className="border bg-card shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-12 w-12 rounded-full bg-muted animate-pulse shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
              <div className="h-4 w-[70%] max-w-[12rem] rounded bg-muted animate-pulse" />
              <div className="h-3 w-1/2 max-w-[8rem] rounded bg-muted animate-pulse" />
            </div>
          </div>
          <div className="h-8 w-8 rounded-md bg-muted animate-pulse shrink-0" />
        </div>
        <div className="space-y-2 mb-4">
          <div className="h-3 w-full rounded bg-muted animate-pulse" />
          <div className="h-3 w-4/5 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex justify-between gap-2 mb-3">
          <div className="h-6 w-16 rounded-full bg-muted animate-pulse" />
          <div className="h-6 w-16 rounded-full bg-muted animate-pulse" />
        </div>
        <div className="flex items-center justify-between pt-3 border-t">
          <div className="h-4 w-12 rounded bg-muted animate-pulse" />
          <div className="h-4 w-28 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex flex-wrap gap-1 mt-3">
          <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
          <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Technicians() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [showForm, setShowForm] = useState(false);
  const [selectedTech, setSelectedTech] = useState(null);
  const [showAddSpecializationDialog, setShowAddSpecializationDialog] = useState(false);
  const [newSpecialization, setNewSpecialization] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    employee_id: '',
    specializations: [],
    status: 'active',
    latitude: '',
    longitude: '',
    address: '',
    city: '',
    state: '',
    zipcode: '',
    country: ''
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
    isFetching
  } = useQuery({
    queryKey: ['technicians', 'paged', page, pageSize, debouncedSearch, statusFilter],
    queryFn: () =>
      technicianService.listPaged({
        page,
        pageSize,
        search: debouncedSearch,
        status: statusFilter
      }),
    placeholderData: (previousData) => previousData
  });

  const showPageSkeleton = isFetching;
  const technicians = pageResult?.data ?? [];
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

  const { data: dbSpecializations = [] } = useQuery({
    queryKey: ['specializations'],
    queryFn: () => specializationsService.list()
  });

  // Hardcoded + DB + specializations seen on the current page (for add/edit dropdown)
  const availableSpecializations = useMemo(() => {
    const dbSystemNames = dbSpecializations.map((sys) => sys.specializations);
    const technicianSystems = technicians.flatMap((tech) => tech.specializations || []);
    const allSystems = [...new Set([...specializations, ...dbSystemNames, ...technicianSystems])];
    return allSystems.sort();
  }, [technicians, dbSpecializations]);

  const createSpecializationMutation = useMutation({
    mutationFn: (data) => specializationsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specializations'] });
      setNewSpecialization('');
      setShowAddSpecializationDialog(false);
      toast.success('Specialization added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add specialization: ' + error.message);
    }
  });

  const handleAddSpecialization = async () => {
    const specializationName = newSpecialization.trim();
    if (specializationName && !availableSpecializations.includes(specializationName)) {
      // Check if it already exists in database
      try {
        const existing = await specializationsService.getByName(specializationName);
        if (existing) {
          toast.error('This specialization already exists');
          return;
        }
      } catch (error) {
        // If error is not "not found", rethrow it
        if (error.code !== 'PGRST116') {
          throw error;
        }
      }

      // Create new specialization in database
      await createSpecializationMutation.mutateAsync({
        specializations: specializationName
      });
    }
  };

  const createMutation = useMutation({
    mutationFn: (data) => technicianService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicians'] });
      resetForm();
      toast.success('Technician added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add technician: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => technicianService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicians'] });
      resetForm();
      toast.success('Technician updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update technician: ' + error.message);
    }
  });

  const resetForm = () => {
    setShowForm(false);
    setSelectedTech(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      employee_id: '',
      specializations: [],
      status: 'active',
      latitude: '',
      longitude: '',
      address: '',
      city: '',
      state: '',
      zipcode: '',
      country: ''
    });
  };

  const handleEdit = (tech) => {
    setSelectedTech(tech);
    setFormData({
      name: tech.name || '',
      phone: tech.phone || '',
      email: tech.email || '',
      employee_id: tech.employee_id || '',
      specializations: tech.specializations || [],
      status: tech.status || 'active',
      latitude: tech.latitude || '',
      longitude: tech.longitude || '',
      address: tech.address || '',
      city: tech.city || '',
      state: tech.state || '',
      zipcode: tech.zipcode || '',
      country: tech.country || ''
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const lat = parseOptionalNumber(formData.latitude);
    const lng = parseOptionalNumber(formData.longitude);
    const submitData = {
      ...formData,
      employee_id: formData.employee_id?.trim() || null,
      latitude: lat,
      longitude: lng
    };

    if (selectedTech) {
      await updateMutation.mutateAsync({ id: selectedTech.id, data: submitData });
    } else {
      await createMutation.mutateAsync(submitData);
    }
  };

  return (
    <div data-source-location="pages/Technicians:149:4" data-dynamic-content="true" className="space-y-6">
      <div className="space-y-4 pb-4 border-b border-gray-200 bg-gray-50">
        <PageHeader data-source-location="pages/Technicians:150:6" data-dynamic-content="false"
        title="Technicians"
        className="mb-0"
        subtitle={
          total > 0
            ? `${total.toLocaleString()} field technicians`
            : 'Field technicians'
        }
        action={() => setShowForm(true)}
        actionLabel="Add Technician"
        actionIcon={Plus} />

        <div data-source-location="pages/Technicians:159:6" data-dynamic-content="true" className="flex flex-col sm:flex-row gap-4">
          <div data-source-location="pages/Technicians:160:8" data-dynamic-content="true" className="relative flex-1">
            <Search data-source-location="pages/Technicians:161:10" data-dynamic-content="false" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input data-source-location="pages/Technicians:162:10" data-dynamic-content="false"
            placeholder="Search by name, ID, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10" />

          </div>
          <Select data-source-location="pages/Technicians:169:8" data-dynamic-content="false" value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger data-source-location="pages/Technicians:170:10" data-dynamic-content="false" className="w-[150px] border-primary/30 focus:ring-primary focus:border-primary">
              <SelectValue data-source-location="pages/Technicians:171:12" data-dynamic-content="false" />
            </SelectTrigger>
            <SelectContent data-source-location="pages/Technicians:173:10" data-dynamic-content="false">
              <SelectItem data-source-location="pages/Technicians:174:12" data-dynamic-content="false" value="all">All Status</SelectItem>
              <SelectItem data-source-location="pages/Technicians:175:12" data-dynamic-content="false" value="active">Active</SelectItem>
              <SelectItem data-source-location="pages/Technicians:176:12" data-dynamic-content="false" value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Technicians Grid */}
      {pageResult && total === 0 ? (
      <div className="flex min-h-[min(50vh,28rem)] items-center justify-center py-8">
        <EmptyState data-source-location="pages/Technicians:183:8" data-dynamic-content="false"
        icon={Users}
        title={debouncedSearch || statusFilter !== 'all' ? 'No matching technicians' : 'No technicians yet'}
        description={
          debouncedSearch || statusFilter !== 'all'
            ? 'Try different search terms or filters'
            : 'Add your first field technician'
        }
        action={debouncedSearch || statusFilter !== 'all' ? undefined : () => setShowForm(true)}
        actionLabel={debouncedSearch || statusFilter !== 'all' ? undefined : 'Add Technician'} />
      </div>
      ) : (
      <>
      <div className="space-y-0">
      {showPageSkeleton ? (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch"
          aria-busy="true"
          aria-label="Loading technicians"
        >
          {Array.from({ length: Math.min(pageSize, 24) }).map((_, i) => (
            <TechnicianCardSkeleton key={`sk-${i}`} />
          ))}
        </div>
      ) : (
      <div data-source-location="pages/Technicians:191:8" data-dynamic-content="true" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
          <AnimatePresence data-source-location="pages/Technicians:192:10" data-dynamic-content="true" mode="popLayout">
            {technicians.map((tech) =>
          <motion.div data-source-location="pages/Technicians:194:14" data-dynamic-content="true"
          key={tech.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}>

                <Card data-source-location="pages/Technicians:200:16" data-dynamic-content="true" className="hover:shadow-lg transition-all cursor-pointer group">
                  <CardContent data-source-location="pages/Technicians:201:18" data-dynamic-content="true" className="p-5">
                    <div data-source-location="pages/Technicians:202:20" data-dynamic-content="true" className="flex items-start justify-between mb-4">
                      <div data-source-location="pages/Technicians:203:22" data-dynamic-content="true" className="flex items-center gap-3">
                        <Avatar data-source-location="pages/Technicians:204:24" data-dynamic-content="true" className="h-12 w-12">
                          <AvatarImage data-source-location="pages/Technicians:205:26" data-dynamic-content="false" src={tech.avatar_url} />
                          <AvatarFallback data-source-location="pages/Technicians:206:26" data-dynamic-content="true" className="bg-gradient-to-br from-emerald-100 to-blue-100 text-emerald-700 text-lg">
                            {tech.name?.split(' ').map((n) => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div data-source-location="pages/Technicians:210:24" data-dynamic-content="true">
                          <h3 data-source-location="pages/Technicians:211:26" data-dynamic-content="true" className="font-semibold text-gray-900">{tech.name}</h3>
                          <p data-source-location="pages/Technicians:212:26" data-dynamic-content="true" className="text-sm text-gray-500">{tech.employee_id}</p>
                        </div>
                      </div>
                      <DropdownMenu data-source-location="pages/Technicians:215:22" data-dynamic-content="true">
                        <DropdownMenuTrigger data-source-location="pages/Technicians:216:24" data-dynamic-content="false" asChild>
                          <Button data-source-location="pages/Technicians:217:26" data-dynamic-content="false" variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                            <MoreVertical data-source-location="pages/Technicians:218:28" data-dynamic-content="false" className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent data-source-location="pages/Technicians:221:24" data-dynamic-content="true" align="end">
                          <DropdownMenuItem data-source-location="pages/Technicians:222:26" data-dynamic-content="false" onClick={() => handleEdit(tech)}>
                            <Edit data-source-location="pages/Technicians:223:28" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div data-source-location="pages/Technicians:230:20" data-dynamic-content="true" className="space-y-2 mb-4">
                      {tech.phone &&
                  <div data-source-location="pages/Technicians:232:24" data-dynamic-content="true" className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone data-source-location="pages/Technicians:233:26" data-dynamic-content="false" className="w-4 h-4 text-gray-400" />
                          {tech.phone}
                        </div>
                  }
                      {tech.email &&
                  <div data-source-location="pages/Technicians:238:24" data-dynamic-content="true" className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail data-source-location="pages/Technicians:239:26" data-dynamic-content="false" className="w-4 h-4 text-gray-400" />
                          {tech.email}
                        </div>
                  }
                    </div>

                    <div data-source-location="pages/Technicians:245:20" data-dynamic-content="true" className="flex items-center justify-between mb-3">
                      <StatusBadge data-source-location="pages/Technicians:246:22" data-dynamic-content="false" status={tech.availability_status || 'offline'} size="sm" />
                      <StatusBadge data-source-location="pages/Technicians:247:22" data-dynamic-content="false" status={tech.status} size="sm" />
                    </div>

                    <div data-source-location="pages/Technicians:250:20" data-dynamic-content="true" className="flex items-center justify-between pt-3 border-t">
                      <div data-source-location="pages/Technicians:251:22" data-dynamic-content="true" className="flex items-center gap-1 text-sm">
                        <Star data-source-location="pages/Technicians:252:24" data-dynamic-content="false" className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span data-source-location="pages/Technicians:253:24" data-dynamic-content="true" className="font-medium">{tech.rating?.toFixed(1) || 'N/A'}</span>
                      </div>
                      <div data-source-location="pages/Technicians:255:22" data-dynamic-content="true" className="text-sm text-gray-500">
                        {tech.jobs_completed || 0} jobs completed
                      </div>
                    </div>

                    {tech.specializations?.length > 0 &&
                <div data-source-location="pages/Technicians:261:22" data-dynamic-content="true" className="flex flex-wrap gap-1 mt-3">
                        {tech.specializations.slice(0, 3).map((spec, idx) =>
                  <Badge data-source-location="pages/Technicians:263:26" data-dynamic-content="true" key={idx} className="bg-primary text-primary-foreground text-xs">
                            {spec}
                          </Badge>
                  )}
                        {tech.specializations.length > 3 &&
                  <Badge data-source-location="pages/Technicians:268:26" data-dynamic-content="true" className="bg-primary text-primary-foreground text-xs">
                            +{tech.specializations.length - 3}
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
      <Dialog data-source-location="pages/Technicians:283:6" data-dynamic-content="true" open={showForm} onOpenChange={(open) => {if (!open) resetForm();}}>
        <DialogContent data-source-location="pages/Technicians:284:8" data-dynamic-content="true" className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader data-source-location="pages/Technicians:285:10" data-dynamic-content="true">
            <DialogTitle data-source-location="pages/Technicians:286:12" data-dynamic-content="true">
              {selectedTech ? 'Edit Technician' : 'Add Technician'}
            </DialogTitle>
            <DialogDescription data-source-location="pages/Technicians:289:12" data-dynamic-content="true">
              {selectedTech ? 'Update technician details' : 'Add a new field technician'}
            </DialogDescription>
          </DialogHeader>

          <form data-source-location="pages/Technicians:294:10" data-dynamic-content="true" onSubmit={handleSubmit} className="space-y-4">
            <div data-source-location="pages/Technicians:295:12" data-dynamic-content="true" className="grid grid-cols-2 gap-4">
              {/* Left Column */}
              <div data-source-location="pages/Technicians:295:12" data-dynamic-content="true" className="space-y-4">
                <div data-source-location="pages/Technicians:295:12" data-dynamic-content="true">
                  <Label data-source-location="pages/Technicians:296:14" data-dynamic-content="false">
                    Full Name
                    <RequiredMark />
                  </Label>
                  <Input data-source-location="pages/Technicians:297:14" data-dynamic-content="false"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="John Smith"
                  required />
                </div>

                <div data-source-location="pages/Technicians:306:14" data-dynamic-content="true">
                  <Label data-source-location="pages/Technicians:307:16" data-dynamic-content="false">Employee ID</Label>
                  <Input data-source-location="pages/Technicians:308:16" data-dynamic-content="false"
                  value={formData.employee_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, employee_id: e.target.value }))}
                  placeholder="EMP-001" />
                </div>

                <div data-source-location="pages/Technicians:315:14" data-dynamic-content="true">
                  <Label data-source-location="pages/Technicians:316:16" data-dynamic-content="false">
                    Phone
                    <RequiredMark />
                  </Label>
                  <Input data-source-location="pages/Technicians:317:16" data-dynamic-content="false"
                  value={formData.phone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="+1 234 567 8900"
                  required />
                </div>

                <div data-source-location="pages/Technicians:326:12" data-dynamic-content="true">
                  <Label data-source-location="pages/Technicians:327:14" data-dynamic-content="false">
                    Email
                    <RequiredMark />
                  </Label>
                  <Input data-source-location="pages/Technicians:328:14" data-dynamic-content="false"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="john@example.com"
                  required />
                </div>

                <div data-source-location="pages/Technicians:326:12" data-dynamic-content="true" className="grid grid-cols-2 gap-4">
                  <div data-source-location="pages/Technicians:326:14" data-dynamic-content="true">
                    <Label data-source-location="pages/Technicians:327:14" data-dynamic-content="false">Latitude</Label>
                    <Input data-source-location="pages/Technicians:328:14" data-dynamic-content="false"
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => setFormData((prev) => ({ ...prev, latitude: e.target.value }))}
                    placeholder="36.0800" />
                  </div>
                  <div data-source-location="pages/Technicians:326:14" data-dynamic-content="true">
                    <Label data-source-location="pages/Technicians:327:14" data-dynamic-content="false">Longitude</Label>
                    <Input data-source-location="pages/Technicians:328:14" data-dynamic-content="false"
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => setFormData((prev) => ({ ...prev, longitude: e.target.value }))}
                    placeholder="-115.1522" />
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div data-source-location="pages/Technicians:295:12" data-dynamic-content="true" className="space-y-4">
                <div data-source-location="pages/Technicians:326:12" data-dynamic-content="true">
                  <Label data-source-location="pages/Technicians:327:14" data-dynamic-content="false">
                    Street Address
                    <RequiredMark />
                  </Label>
                  <Textarea data-source-location="pages/Technicians:328:14" data-dynamic-content="false"
                  value={formData.address}
                  onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Street address"
                  rows={2}
                  required />
                </div>

                <div data-source-location="pages/Technicians:326:12" data-dynamic-content="true" className="grid grid-cols-2 gap-4">
                  <div data-source-location="pages/Technicians:326:14" data-dynamic-content="true">
                    <Label data-source-location="pages/Technicians:327:14" data-dynamic-content="false">
                      City
                      <RequiredMark />
                    </Label>
                    <Input data-source-location="pages/Technicians:328:14" data-dynamic-content="false"
                    value={formData.city}
                    onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                    placeholder="City"
                    required />
                  </div>
                  <div data-source-location="pages/Technicians:326:14" data-dynamic-content="true">
                    <Label data-source-location="pages/Technicians:327:14" data-dynamic-content="false">
                      State
                      <RequiredMark />
                    </Label>
                    <Input data-source-location="pages/Technicians:328:14" data-dynamic-content="false"
                    value={formData.state}
                    onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
                    placeholder="State"
                    required />
                  </div>
                </div>

                <div data-source-location="pages/Technicians:326:12" data-dynamic-content="true" className="grid grid-cols-2 gap-4">
                  <div data-source-location="pages/Technicians:326:14" data-dynamic-content="true">
                    <Label data-source-location="pages/Technicians:327:14" data-dynamic-content="false">
                      Zipcode
                      <RequiredMark />
                    </Label>
                    <Input data-source-location="pages/Technicians:328:14" data-dynamic-content="false"
                    value={formData.zipcode}
                    onChange={(e) => setFormData((prev) => ({ ...prev, zipcode: e.target.value }))}
                    placeholder="Zipcode"
                    required />
                  </div>
                  <div data-source-location="pages/Technicians:326:14" data-dynamic-content="true">
                    <Label data-source-location="pages/Technicians:327:14" data-dynamic-content="false">
                      Country
                      <RequiredMark />
                    </Label>
                    <Input data-source-location="pages/Technicians:328:14" data-dynamic-content="false"
                    value={formData.country}
                    onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
                    placeholder="Country"
                    required />
                  </div>
                </div>

                <div data-source-location="pages/Technicians:336:12" data-dynamic-content="true">
                  <Label data-source-location="pages/Technicians:337:14" data-dynamic-content="false">Specializations</Label>
                  <Select data-source-location="pages/Technicians:338:14" data-dynamic-content="true"
                  value=""
                  modal={false}
                  onValueChange={(v) => {
                    if (v === '__add_new__') {
                      setShowAddSpecializationDialog(true);
                    } else if (v && !formData.specializations.includes(v)) {
                      setFormData((prev) => ({
                        ...prev,
                        specializations: [...prev.specializations, v]
                      }));
                    }
                  }}>

                    <SelectTrigger data-source-location="pages/Technicians:349:16" data-dynamic-content="false">
                      <SelectValue data-source-location="pages/Technicians:350:18" data-dynamic-content="false" placeholder="Add specialization..." />
                    </SelectTrigger>
                    <SelectContent data-source-location="pages/Technicians:352:16" data-dynamic-content="true" className="max-h-[300px]">
                      {availableSpecializations.map((spec) =>
                      <SelectItem data-source-location="pages/Technicians:354:20" data-dynamic-content="true" key={spec} value={spec}>{spec}</SelectItem>
                      )}
                      <SelectSeparator />
                      <SelectItem data-source-location="pages/Technicians:354:20" data-dynamic-content="true" value="__add_new__" className="text-primary font-medium">
                        <Plus className="w-4 h-4 inline mr-2" />
                        Add new Specialization
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.specializations.length > 0 &&
                  <div data-source-location="pages/Technicians:359:16" data-dynamic-content="true" className="flex flex-wrap gap-1 mt-2">
                      {formData.specializations.map((spec, idx) =>
                    <Badge data-source-location="pages/Technicians:361:20" data-dynamic-content="true"
                    key={idx}
                    className="bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors"
                    onClick={() => setFormData((prev) => ({
                      ...prev,
                      specializations: prev.specializations.filter((_, i) => i !== idx)
                    }))}>

                        {spec} ×
                      </Badge>
                    )}
                    </div>
                  }
                </div>

                <div data-source-location="pages/Technicians:377:12" data-dynamic-content="true">
                  <Label data-source-location="pages/Technicians:378:14" data-dynamic-content="false">
                    Status
                    <RequiredMark />
                  </Label>
                  <Select data-source-location="pages/Technicians:379:14" data-dynamic-content="false"
                  value={formData.status}
                  required
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, status: v }))}>

                    <SelectTrigger data-source-location="pages/Technicians:383:16" data-dynamic-content="false">
                      <SelectValue data-source-location="pages/Technicians:384:18" data-dynamic-content="false" />
                    </SelectTrigger>
                    <SelectContent data-source-location="pages/Technicians:386:16" data-dynamic-content="false">
                      <SelectItem data-source-location="pages/Technicians:387:18" data-dynamic-content="false" value="active">Active</SelectItem>
                      <SelectItem data-source-location="pages/Technicians:388:18" data-dynamic-content="false" value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div data-source-location="pages/Technicians:393:12" data-dynamic-content="true" className="flex gap-3 pt-4">
              <Button data-source-location="pages/Technicians:394:14" data-dynamic-content="false" type="button" variant="outline" className="flex-1" onClick={resetForm}>
                Cancel
              </Button>
              <Button data-source-location="pages/Technicians:397:14" data-dynamic-content="true"
              type="submit"
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={createMutation.isPending || updateMutation.isPending}>

                {selectedTech ? 'Update' : 'Add'} Technician
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add New Specialization Dialog */}
      <Dialog open={showAddSpecializationDialog} onOpenChange={setShowAddSpecializationDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Specialization</DialogTitle>
            <DialogDescription>
              Add a new specialization type to the available options
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Specialization Name</Label>
              <Input
                value={newSpecialization}
                onChange={(e) => setNewSpecialization(e.target.value)}
                placeholder="e.g., Smart Controller Setup"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSpecialization();
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
                  setShowAddSpecializationDialog(false);
                  setNewSpecialization('');
                }}
                disabled={createSpecializationMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={handleAddSpecialization}
                disabled={!newSpecialization.trim() || availableSpecializations.includes(newSpecialization.trim()) || createSpecializationMutation.isPending}
              >
                {createSpecializationMutation.isPending ? 'Adding...' : 'Add Specialization'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>);

}
