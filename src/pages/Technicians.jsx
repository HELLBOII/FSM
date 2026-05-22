import React, { useState, useEffect, useMemo } from 'react';
import { technicianService, specializationsService, userService } from '@/services';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Star,
  ChevronRight,
  ChevronLeft,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  User,
  UserCog } from
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import PageHeader from '@/components/common/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/common/EmptyState';
import { toast } from 'sonner';
import { toAuthEmail, toDisplayUsername } from '@/lib/userEmail';
import {
  generateTechnicianIdentifiers,
  shouldPreserveTechnicianIdentifiers,
  filterUsedIdentifiersForEdit
} from '@/utils/technicianIdentifiers';

const PAGE_SIZE_OPTIONS = [12, 24, 48];
const TECHNICIAN_DEFAULT_PASSWORD = 'Tech@123';

function buildTechnicianFullName({ first_name, middle_name, last_name }) {
  return [first_name, middle_name, last_name]
    .map((p) => (p == null ? '' : String(p).trim()))
    .filter(Boolean)
    .join(' ');
}

const readonlyGeneratedFieldClass =
  'bg-gray-50 text-foreground opacity-100 disabled:opacity-100 disabled:cursor-default cursor-default';

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


function formatTechnicianAddressLine(tech) {
  const parts = [tech.address, tech.city, tech.state, tech.zipcode]
    .map((p) => (p == null ? '' : String(p).trim()))
    .filter(Boolean);
  return parts.join(', ');
}

function TechnicianCardSkeleton() {
  return (
    <Card className="h-full min-h-0 border bg-card shadow-sm">
      <CardContent className="p-5 flex flex-col gap-4">
        <div className="flex items-start gap-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-12 w-12 rounded-full bg-muted animate-pulse shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
              <div className="h-4 w-[70%] max-w-[12rem] rounded bg-muted animate-pulse" />
              <div className="h-3 w-1/2 max-w-[8rem] rounded bg-muted animate-pulse" />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-muted animate-pulse" />
          <div className="h-3 w-4/5 rounded bg-muted animate-pulse" />
          <div className="h-3 w-full rounded bg-muted animate-pulse" />
        </div>
        <div className="flex justify-between gap-2 pt-1">
          <div className="h-6 w-16 rounded-full bg-muted animate-pulse" />
          <div className="h-6 w-16 rounded-full bg-muted animate-pulse" />
        </div>
        <div className="h-px w-full bg-muted/60" />
        <div className="flex items-center justify-between">
          <div className="h-4 w-12 rounded bg-muted animate-pulse" />
          <div className="h-4 w-28 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex flex-wrap gap-1">
          <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
          <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Technicians() {
  const queryClient = useQueryClient();
  const { createUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [showForm, setShowForm] = useState(false);
  const [selectedTech, setSelectedTech] = useState(null);
  const [showAddSpecializationDialog, setShowAddSpecializationDialog] = useState(false);
  const [newSpecialization, setNewSpecialization] = useState('');
  const [inactiveDateTime, setInactiveDateTime] = useState(null);
  const [showUpdateUserModal, setShowUpdateUserModal] = useState(false);
  const [updateUserPassword, setUpdateUserPassword] = useState('');
  const [showUpdateUserPassword, setShowUpdateUserPassword] = useState(false);
  const [authUserIdForUpdate, setAuthUserIdForUpdate] = useState(null);
  const [isResolvingAuthUser, setIsResolvingAuthUser] = useState(false);
  const [isUpdatingUserPassword, setIsUpdatingUserPassword] = useState(false);
  const [isProvisioningUser, setIsProvisioningUser] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    username: '',
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
    country: '',
    app_visible: true
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, pageSize]);

  useEffect(() => {
    if (!showForm) return;
    const fullName = buildTechnicianFullName({
      first_name: formData.first_name,
      middle_name: formData.middle_name,
      last_name: formData.last_name
    });
    setFormData((prev) => (prev.name === fullName ? prev : { ...prev, name: fullName }));
  }, [showForm, formData.first_name, formData.middle_name, formData.last_name]);

  const {
    data: pageResult,
    isPending: techniciansPending,
    isFetching: techniciansFetching
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

  const showPageSkeleton = techniciansPending && !pageResult;
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

  const { data: usedIdentifiers, isLoading: identifiersLoading } = useQuery({
    queryKey: ['technicians', 'usedIdentifiers'],
    queryFn: () => technicianService.listUsedIdentifiers(),
    enabled: showForm
  });

  const generatedDisplay = useMemo(() => {
    const firstName = formData.first_name;
    const lastName = formData.last_name;

    if (
      shouldPreserveTechnicianIdentifiers(selectedTech, firstName, lastName)
    ) {
      return {
        username: selectedTech.username || '',
        employee_id: selectedTech.employee_id || ''
      };
    }

    const { usedUsernames, usedEmployeeIds } = filterUsedIdentifiersForEdit(
      usedIdentifiers?.usernames ?? [],
      usedIdentifiers?.employeeIds ?? [],
      selectedTech
    );

    return generateTechnicianIdentifiers({
      firstName,
      lastName,
      usedUsernames,
      usedEmployeeIds
    });
  }, [selectedTech, formData.first_name, formData.last_name, usedIdentifiers]);

  /** DB rows + any labels already on technicians (legacy / not yet in `specializations` table). */
  const availableSpecializations = useMemo(() => {
    const fromDb = dbSpecializations
      .map((row) => (row.specializations == null ? '' : String(row.specializations).trim()))
      .filter(Boolean);
    const fromTechnicians = technicians.flatMap((tech) =>
      (tech.specializations || []).map((s) => (s == null ? '' : String(s).trim())).filter(Boolean)
    );
    return [...new Set([...fromDb, ...fromTechnicians])].sort((a, b) => a.localeCompare(b));
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
    if (!specializationName) return;

    try {
      const existing = await specializationsService.getByName(specializationName);
      if (existing) {
        toast.error('This specialization already exists');
        return;
      }
    } catch (error) {
      if (error.code !== 'PGRST116') {
        throw error;
      }
    }

    await createSpecializationMutation.mutateAsync({
      specializations: specializationName
    });
  };

  const patchTechnicianInListCache = (row) => {
    if (!row?.id) return;
    queryClient.setQueriesData({ queryKey: ['technicians', 'paged'] }, (old) => {
      if (!old?.data) return old;
      const idx = old.data.findIndex((t) => t.id === row.id);
      if (idx === -1) return old;
      const next = [...old.data];
      next[idx] = { ...next[idx], ...row };
      return { ...old, data: next };
    });
  };

  const scheduleTechniciansRefetch = (opts = {}) => {
    const { refreshIdentifiers = false, refreshAppUsers = false } = opts;
    queryClient.invalidateQueries({
      queryKey: ['technicians'],
      refetchType: 'active'
    });
    if (refreshIdentifiers) {
      queryClient.invalidateQueries({
        queryKey: ['technicians', 'usedIdentifiers'],
        refetchType: 'active'
      });
    }
    if (refreshAppUsers) {
      queryClient.invalidateQueries({
        queryKey: ['appUsers'],
        refetchType: 'active'
      });
    }
  };

  const createMutation = useMutation({
    mutationFn: (data) => technicianService.create(data),
    onSuccess: (created) => {
      resetForm();
      toast.success(
        `Technician and sign-in account created (default password: ${TECHNICIAN_DEFAULT_PASSWORD})`
      );
      if (created) patchTechnicianInListCache(created);
      scheduleTechniciansRefetch({
        refreshIdentifiers: true,
        refreshAppUsers: true
      });
    },
    onError: (error) => {
      toast.error('Failed to add technician: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => technicianService.update(id, data),
    onSuccess: (updated) => {
      resetForm();
      toast.success('Technician updated successfully');
      if (updated) patchTechnicianInListCache(updated);
      scheduleTechniciansRefetch();
    },
    onError: (error) => {
      toast.error('Failed to update technician: ' + error.message);
    }
  });

  const isSavingTechnician =
    createMutation.isPending ||
    updateMutation.isPending ||
    isProvisioningUser;

  const emptyFormState = () => ({
    name: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    username: '',
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
    country: '',
    app_visible: true
  });

  const closeUpdateUserModal = () => {
    setShowUpdateUserModal(false);
    setUpdateUserPassword('');
    setShowUpdateUserPassword(false);
    setAuthUserIdForUpdate(null);
  };

  const openUpdateUserModal = async () => {
    const username =
      generatedDisplay.username?.trim() || selectedTech?.username?.trim();
    if (!username) {
      toast.error('No sign-in username is available for this technician');
      return;
    }

    setUpdateUserPassword('');
    setShowUpdateUserPassword(false);
    setShowUpdateUserModal(true);
    setAuthUserIdForUpdate(null);
    setIsResolvingAuthUser(true);

    try {
      const userId = await userService.resolveAuthUserIdForTechnician(
        selectedTech,
        username
      );
      if (!userId) {
        toast.error('No sign-in account found for this username');
        setShowUpdateUserModal(false);
        return;
      }
      setAuthUserIdForUpdate(userId);
    } catch (error) {
      toast.error(error.message || 'Failed to load sign-in account');
      setShowUpdateUserModal(false);
    } finally {
      setIsResolvingAuthUser(false);
    }
  };

  const handleUpdateUserPassword = async (e) => {
    e.preventDefault();
    if (!authUserIdForUpdate) return;

    if (!updateUserPassword) {
      toast.error('Please enter a new password');
      return;
    }
    if (updateUserPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    setIsUpdatingUserPassword(true);
    try {
      await userService.updatePassword(authUserIdForUpdate, updateUserPassword);
      toast.success('Password updated successfully');
      closeUpdateUserModal();
    } catch (error) {
      toast.error(error.message || 'Failed to update password. Please try again.');
    } finally {
      setIsUpdatingUserPassword(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setSelectedTech(null);
    setInactiveDateTime(null);
    closeUpdateUserModal();
    setFormData(emptyFormState());
  };

  const openCreateForm = () => {
    setSelectedTech(null);
    setInactiveDateTime(null);
    setFormData(emptyFormState());
    setShowForm(true);
  };

  const handleEdit = (tech) => {
    setSelectedTech(tech);
    if (tech.inactivedate) {
      const d = new Date(tech.inactivedate);
      setInactiveDateTime(Number.isNaN(d.getTime()) ? null : d);
    } else {
      setInactiveDateTime(null);
    }
    setFormData({
      name: tech.name || '',
      first_name: tech.first_name || '',
      middle_name: tech.middle_name || '',
      last_name: tech.last_name || '',
      username: tech.username || '',
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
      country: tech.country || '',
      app_visible: tech.app_visible !== false
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const firstName = formData.first_name?.trim() ?? '';
    const middleName = formData.middle_name?.trim() ?? '';
    const lastName = formData.last_name?.trim() ?? '';

    if (!firstName) {
      toast.error('First name is required');
      return;
    }
    if (!lastName) {
      toast.error('Last name is required');
      return;
    }

    if (formData.status === 'inactive' && !inactiveDateTime) {
      toast.error('Inactive date and time are required when status is inactive');
      return;
    }
    const lat = parseOptionalNumber(formData.latitude);
    const lng = parseOptionalNumber(formData.longitude);
    const inactiveIso =
      formData.status === 'inactive' && inactiveDateTime
        ? inactiveDateTime.toISOString()
        : null;

    const fullName = buildTechnicianFullName({
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName
    });

    const username = generatedDisplay.username?.trim() || null;
    const employee_id = generatedDisplay.employee_id?.trim() || null;

    const needsFreshIds =
      !selectedTech ||
      !shouldPreserveTechnicianIdentifiers(
        selectedTech,
        firstName,
        lastName
      );
    if (needsFreshIds && identifiersLoading) {
      toast.error('Please wait while IDs are being prepared');
      return;
    }
    if (!employee_id) {
      toast.error('Employee ID is required');
      return;
    }

    const submitData = {
      ...formData,
      name: fullName || formData.name?.trim() || null,
      first_name: firstName || null,
      middle_name: middleName || null,
      last_name: lastName || null,
      username,
      employee_id,
      latitude: lat,
      longitude: lng,
      inactivedate: inactiveIso,
      app_visible: formData.app_visible !== false
    };

    if (selectedTech) {
      const prevStatus = selectedTech.status || 'active';
      const nextStatus = formData.status || 'active';
      const statusChanged = prevStatus !== nextStatus;
      const authUserId = selectedTech.user_id?.trim() || null;

      const updatePromise = updateMutation.mutateAsync({
        id: selectedTech.id,
        data: submitData
      });

      if (
        statusChanged &&
        (nextStatus === 'active' || nextStatus === 'inactive')
      ) {
        try {
          const loginAccessPromise = userService.syncTechnicianLoginAccess({
            technician: selectedTech,
            username,
            status: nextStatus,
            authUserId
          });

          const [{ synced }] = await Promise.all([
            loginAccessPromise,
            updatePromise
          ]);

          if (!synced) {
            toast.warning(
              'No sign-in account found to update login access. Technician record was saved.'
            );
          }
        } catch (error) {
          toast.error(
            error.message ||
              'Failed to update sign-in access for this technician'
          );
        }
      } else {
        await updatePromise;
      }
      return;
    }

    setIsProvisioningUser(true);
    let authUserId;
    try {
      const authData = await createUser(username, TECHNICIAN_DEFAULT_PASSWORD, {
        user_role: 'technician',
        full_name: fullName || toDisplayUsername(username)
      });
      authUserId = authData?.user?.id;
      if (!authUserId) {
        throw new Error('Sign-in account was created but user id was missing');
      }
    } catch (error) {
      toast.error(
        error.message || 'Failed to create technician sign-in account'
      );
      setIsProvisioningUser(false);
      return;
    }

    try {
      const createPromise = createMutation.mutateAsync({
        ...submitData,
        user_id: authUserId
      });

      if (submitData.status === 'inactive') {
        const [, banResult] = await Promise.allSettled([
          createPromise,
          userService.setLoginAccess(authUserId, false)
        ]);
        if (banResult.status === 'rejected') {
          toast.warning(
            banResult.reason?.message ||
              'Technician created, but sign-in access could not be disabled.'
          );
        }
      } else {
        await createPromise;
      }
    } finally {
      setIsProvisioningUser(false);
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
        action={openCreateForm}
        actionLabel="Add Technician"
        actionIcon={Plus} />

        <div data-source-location="pages/Technicians:159:6" data-dynamic-content="true" className="flex flex-col sm:flex-row gap-4">
          <div data-source-location="pages/Technicians:160:8" data-dynamic-content="true" className="relative flex-1">
            <Search data-source-location="pages/Technicians:161:10" data-dynamic-content="false" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input data-source-location="pages/Technicians:162:10" data-dynamic-content="false"
            placeholder="Search by name, username, employee ID, or phone..."
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
        action={debouncedSearch || statusFilter !== 'all' ? undefined : openCreateForm}
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
          className="h-full min-h-0"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}>

                <Card
                  data-source-location="pages/Technicians:200:16"
                  data-dynamic-content="true"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleEdit(tech)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleEdit(tech);
                    }
                  }}
                  className="h-full flex flex-col min-h-0 cursor-pointer transition-all hover:shadow-lg hover:shadow-[0_12px_40px_-12px_hsl(var(--primary)_/_0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <CardContent data-source-location="pages/Technicians:201:18" data-dynamic-content="true" className="p-5 flex flex-col flex-1 h-full min-h-0">
                    <div data-source-location="pages/Technicians:202:20" data-dynamic-content="true" className="flex items-start mb-4 shrink-0">
                      <div data-source-location="pages/Technicians:203:22" data-dynamic-content="true" className="flex items-center gap-3 min-w-0 flex-1">
                        <Avatar data-source-location="pages/Technicians:204:24" data-dynamic-content="true" className="h-12 w-12 shrink-0">
                          <AvatarImage data-source-location="pages/Technicians:205:26" data-dynamic-content="false" src={tech.avatar_url} />
                          <AvatarFallback data-source-location="pages/Technicians:206:26" data-dynamic-content="true" className="bg-gradient-to-br from-emerald-100 to-blue-100 text-emerald-700 text-lg">
                            {tech.name?.split(' ').map((n) => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div data-source-location="pages/Technicians:210:24" data-dynamic-content="true" className="min-w-0">
                          <h3 data-source-location="pages/Technicians:211:26" data-dynamic-content="true" className="font-semibold text-gray-900">{tech.name}</h3>
                          <p data-source-location="pages/Technicians:212:26" data-dynamic-content="true" className="text-sm text-gray-500">{tech.employee_id}</p>
                        </div>
                      </div>
                    </div>

                    <div data-source-location="pages/Technicians:230:20" data-dynamic-content="true" className="space-y-2 mb-4 flex-1 min-h-0 flex flex-col justify-start">
                      {tech.phone &&
                  <div data-source-location="pages/Technicians:232:24" data-dynamic-content="true" className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone data-source-location="pages/Technicians:233:26" data-dynamic-content="false" className="w-4 h-4 shrink-0 text-gray-400" />
                          <span className="truncate">{tech.phone}</span>
                        </div>
                  }
                      {tech.email &&
                  <div data-source-location="pages/Technicians:238:24" data-dynamic-content="true" className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail data-source-location="pages/Technicians:239:26" data-dynamic-content="false" className="w-4 h-4 shrink-0 text-gray-400" />
                          <span className="truncate">{tech.email}</span>
                        </div>
                  }
                      <div data-source-location="pages/Technicians:address-line" data-dynamic-content="true" className="flex items-start gap-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4 shrink-0 text-gray-400 mt-0.5" />
                        <span className="min-w-0 line-clamp-2 break-words">
                          {formatTechnicianAddressLine(tech) || 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div data-source-location="pages/Technicians:245:20" data-dynamic-content="true" className="flex items-center justify-between mb-3 shrink-0">
                      <StatusBadge data-source-location="pages/Technicians:246:22" data-dynamic-content="false" status={tech.availability_status || 'offline'} size="sm" />
                      <StatusBadge data-source-location="pages/Technicians:247:22" data-dynamic-content="false" status={tech.status} size="sm" />
                      {tech.app_visible === false && (
                        <Badge className="text-xs bg-red-100 text-red-600 border-red-200 hover:bg-red-100">
                          Hidden from app
                        </Badge>
                      )}
                    </div>

                    <div data-source-location="pages/Technicians:250:20" data-dynamic-content="true" className="flex items-center justify-between pt-3 border-t shrink-0">
                      <div data-source-location="pages/Technicians:251:22" data-dynamic-content="true" className="flex items-center gap-1 text-sm">
                        <Star data-source-location="pages/Technicians:252:24" data-dynamic-content="false" className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span data-source-location="pages/Technicians:253:24" data-dynamic-content="true" className="font-medium">{tech.rating?.toFixed(1) || 'N/A'}</span>
                      </div>
                      <div data-source-location="pages/Technicians:255:22" data-dynamic-content="true" className="text-sm text-gray-500">
                        {tech.jobs_completed || 0} jobs completed
                      </div>
                    </div>

                    {tech.specializations?.length > 0 &&
                <div data-source-location="pages/Technicians:261:22" data-dynamic-content="true" className="flex flex-wrap gap-1 mt-3 shrink-0">
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
                  disabled={page <= 1 || techniciansFetching}
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
                  disabled={page >= totalPages || techniciansFetching}
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
                <div className="sr-only" aria-hidden="true">
                  <Label>Full Name</Label>
                  <Input
                    value={formData.name}
                    readOnly
                    tabIndex={-1}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>
                      First Name
                      <RequiredMark />
                    </Label>
                    <Input
                      value={formData.first_name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, first_name: e.target.value }))}
                      placeholder="Enter first name"
                      required
                    />
                  </div>
                  <div>
                    <Label>Middle Name</Label>
                    <Input
                      value={formData.middle_name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, middle_name: e.target.value }))}
                      placeholder="Enter middle name"
                    />
                  </div>
                  <div>
                    <Label>
                      Last Name
                      <RequiredMark />
                    </Label>
                    <Input
                      value={formData.last_name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, last_name: e.target.value }))}
                      placeholder="Enter last name"
                      required
                    />
                  </div>
                </div>

                <div className="sr-only" aria-hidden="true">
                  <Label>Username</Label>
                  <Input
                    className={readonlyGeneratedFieldClass}
                    value={generatedDisplay.username}
                    readOnly
                    // tabIndex={-1}
                  />
                </div>

                <div data-source-location="pages/Technicians:306:14" data-dynamic-content="true">
                  <Label data-source-location="pages/Technicians:307:16" data-dynamic-content="false">
                    Employee ID
                    <RequiredMark />
                  </Label>
                  <Input
                    className={readonlyGeneratedFieldClass}
                    data-source-location="pages/Technicians:308:16"
                    value={generatedDisplay.employee_id}
                    readOnly
                    required
                    placeholder="Generated from first and last name"
                  />
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

                <div className="flex items-center justify-between gap-4 rounded-lg border border-primary/20 bg-muted/30 px-4 py-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Visible in application</Label>
                    <p className="text-xs text-muted-foreground">
                      When off, this technician is hidden from assignment and selection lists in the app.
                    </p>
                  </div>
                  <Switch
                    checked={formData.app_visible !== false}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, app_visible: checked }))
                    }
                    aria-label="Visible in application"
                  />
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

                <div
                  data-source-location="pages/Technicians:377:12"
                  data-dynamic-content="true"
                  className="flex items-end gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <Label data-source-location="pages/Technicians:378:14" data-dynamic-content="false">
                      Status
                      <RequiredMark />
                    </Label>
                    <Select
                      data-source-location="pages/Technicians:379:14"
                      data-dynamic-content="false"
                      value={formData.status}
                      required
                      onValueChange={(v) => {
                        if (v === 'active') setInactiveDateTime(null);
                        setFormData((prev) => ({ ...prev, status: v }));
                      }}
                    >
                      <SelectTrigger data-source-location="pages/Technicians:383:16" data-dynamic-content="false">
                        <SelectValue data-source-location="pages/Technicians:384:18" data-dynamic-content="false" />
                      </SelectTrigger>
                      <SelectContent data-source-location="pages/Technicians:386:16" data-dynamic-content="false">
                        <SelectItem data-source-location="pages/Technicians:387:18" data-dynamic-content="false" value="active">Active</SelectItem>
                        <SelectItem data-source-location="pages/Technicians:388:18" data-dynamic-content="false" value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedTech && (
                    <Button
                      type="button"
                      className="shrink-0 bg-primary hover:bg-primary/90 text-white"
                      onClick={(e) => {
                        e.preventDefault();
                        openUpdateUserModal();
                      }}
                      disabled={
                        isResolvingAuthUser ||
                        !(
                          generatedDisplay.username?.trim() ||
                          selectedTech?.username?.trim()
                        )
                      }
                    >
                      {isResolvingAuthUser ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <UserCog className="w-4 h-4" aria-hidden="true" />
                      )}
                      Update User
                    </Button>
                  )}
                </div>

                {formData.status === 'inactive' && (
                  <div data-source-location="pages/Technicians:status-inactive-date" data-dynamic-content="true">
                    <Label className="text-sm mb-2 block">
                      Inactive date
                      <RequiredMark />
                    </Label>
                    <DateTimePicker
                      date={inactiveDateTime}
                      onDateChange={setInactiveDateTime}
                      placeholder="Select inactive date & time"
                      className="border-primary/30 focus-visible:ring-primary"
                    />
                  </div>
                )}
              </div>
            </div>

            <div data-source-location="pages/Technicians:393:12" data-dynamic-content="true" className="flex gap-3 pt-4">
              <Button
                data-source-location="pages/Technicians:394:14"
                data-dynamic-content="false"
                type="button"
                variant="outline"
                className="flex-1"
                onClick={resetForm}
                disabled={isSavingTechnician}
              >
                Cancel
              </Button>
              <Button
                data-source-location="pages/Technicians:397:14"
                data-dynamic-content="true"
                type="submit"
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={
                  isSavingTechnician ||
                  (identifiersLoading &&
                    (!selectedTech ||
                      !shouldPreserveTechnicianIdentifiers(
                        selectedTech,
                        formData.first_name,
                        formData.last_name
                      )))
                }
                aria-busy={isSavingTechnician}
              >
                {isSavingTechnician ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    {selectedTech ? 'Updating technician…' : 'Saving technician…'}
                  </>
                ) : (
                  `${selectedTech ? 'Update' : 'Add'} Technician`
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showUpdateUserModal}
        onOpenChange={(open) => {
          if (!open) closeUpdateUserModal();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update User</DialogTitle>
            <DialogDescription>
              Set a new sign-in password for this technician&apos;s account.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateUserPassword} className="space-y-4">
            {/* <div className="space-y-2">
              <Label htmlFor="tech-update-username">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="tech-update-username"
                  type="text"
                  className={`pl-10 ${readonlyGeneratedFieldClass}`}
                  value={toDisplayUsername(
                    generatedDisplay.username || selectedTech?.username || ''
                  )}
                  readOnly
                  tabIndex={-1}
                />
              </div>
            </div> */}

            <div className="space-y-2">
              <Label htmlFor="tech-update-password">
                New Password
                <RequiredMark />
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="tech-update-password"
                  type={showUpdateUserPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  value={updateUserPassword}
                  onChange={(e) => setUpdateUserPassword(e.target.value)}
                  required
                  disabled={isUpdatingUserPassword || isResolvingAuthUser || !authUserIdForUpdate}
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowUpdateUserPassword(!showUpdateUserPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showUpdateUserPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isUpdatingUserPassword}
                onClick={closeUpdateUserModal}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90"
                disabled={
                  isUpdatingUserPassword ||
                  isResolvingAuthUser ||
                  !authUserIdForUpdate ||
                  !updateUserPassword
                }
              >
                {isUpdatingUserPassword || isResolvingAuthUser ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isResolvingAuthUser ? 'Loading…' : 'Saving…'}
                  </>
                ) : (
                  'Save password'
                )}
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
                disabled={
                  !newSpecialization.trim() ||
                  createSpecializationMutation.isPending ||
                  dbSpecializations.some(
                    (row) =>
                      (row.specializations || '').trim().toLowerCase() === newSpecialization.trim().toLowerCase()
                  )
                }
              >
                {createSpecializationMutation.isPending ? 'Adding...' : 'Add Specialization'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>);

}
