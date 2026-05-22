import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { userService } from '@/services';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import {
  Loader2,
  Lock,
  User,
  Eye,
  EyeOff,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { toDisplayUsername } from '@/lib/userEmail';
import { cn } from '@/lib/utils';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'technician', label: 'Technician' },
  { value: 'client', label: 'Client' },
];

function formatRole(role) {
  if (!role) return '—';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function roleBadgeClass(role) {
  switch (role) {
    case 'admin':
      return 'bg-violet-100 text-violet-800';
    case 'supervisor':
      return 'bg-blue-100 text-blue-800';
    case 'technician':
      return 'bg-amber-100 text-amber-800';
    case 'client':
      return 'bg-emerald-100 text-emerald-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function UsersTableSkeleton({ rows = 10 }) {
  return (
    <div className="overflow-x-auto" aria-busy="true" aria-label="Loading users">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Username</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Role</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Created</th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              <td className="px-4 py-3">
                <div className="h-4 w-32 rounded bg-muted animate-pulse" />
              </td>
              <td className="px-4 py-3">
                <div className="h-6 w-20 rounded-full bg-muted animate-pulse" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-28 rounded bg-muted animate-pulse" />
              </td>
              <td className="px-4 py-3">
                <div className="ml-auto h-8 w-16 animate-pulse rounded-lg bg-muted" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const emptyForm = () => ({
  username: '',
  password: '',
  role: '',
});

/** Edit modal: username/role are read-only — keep full opacity (Input uses disabled:opacity-50 by default). */
const editReadonlyFieldClass =
  'bg-gray-50 text-foreground opacity-100 disabled:opacity-100 disabled:cursor-default cursor-default';

export default function CreateUsers() {
  const { user, createUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userRole = user?.user_metadata?.user_role || user?.user_role;

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, pageSize]);

  const {
    data: pageResult,
    isLoading,
    isFetching,
    error: listError,
  } = useQuery({
    queryKey: ['appUsers', 'paged', page, pageSize, debouncedSearch],
    queryFn: () =>
      userService.listPaged({
        page,
        pageSize,
        search: debouncedSearch,
      }),
    enabled: userRole === 'admin',
    placeholderData: (previousData) => previousData,
  });

  const users = pageResult?.data ?? [];
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
  const showTableSkeleton = isLoading || isFetching;

  const resetForm = () => {
    setFormData(emptyForm());
    setShowPassword(false);
  };

  const openCreateModal = () => {
    resetForm();
    setEditingUser(null);
    setShowCreateModal(true);
  };

  const openEditModal = (row) => {
    setEditingUser(row);
    setEditPassword('');
    setShowEditPassword(false);
    setShowCreateModal(false);
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setEditPassword('');
    setShowEditPassword(false);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser?.id) return;

    if (!editPassword) {
      toast.error('Please enter a new password');
      return;
    }

    if (editPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    setIsUpdating(true);
    try {
      await userService.updatePassword(editingUser.id, editPassword);
      toast.success('Password updated successfully');
      closeEditModal();
    } catch (error) {
      console.error('Update password error:', error);
      toast.error(error.message || 'Failed to update password. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const trimmedUsername = formData.username?.trim();

    if (!trimmedUsername || !formData.password || !formData.role) {
      toast.error('Please fill in username, role, and password');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    setIsCreating(true);
    try {
      await createUser(trimmedUsername, formData.password, {
        full_name: trimmedUsername,
        user_role: formData.role,
      });
      toast.success('User created successfully');
      setShowCreateModal(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['appUsers'] });
    } catch (error) {
      console.error('Create user error:', error);
      toast.error(error.message || 'Failed to create user. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  if (userRole !== 'admin') {
    return (
      <div className="space-y-6">
        <PageHeader title="Create Users" subtitle="Administrator access required" />
        <Card className="p-6">
          <p className="text-sm text-gray-600">
            Only administrators can create and manage user accounts. Contact your system administrator if you need access.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => navigate('/AdminDashboard')}
          >
            Back to dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 pb-4 border-b border-gray-200 bg-gray-50">
        <PageHeader
          title="Create Users"
          className="mb-0"
          subtitle={
            total > 0
              ? `${total.toLocaleString()} user account${total === 1 ? '' : 's'}`
              : 'Manage sign-in accounts for your team'
          }
        />

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by username or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            type="button"
            className="shrink-0 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={openCreateModal}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New User
          </Button>
        </div>
      </div>

      {listError ? (
        <Card className="p-6 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">{listError.message}</p>
        </Card>
      ) : pageResult && total === 0 && !showTableSkeleton ? (
        <div className="flex min-h-[min(40vh,24rem)] items-center justify-center py-8">
          <EmptyState
            icon={UserPlus}
            title={debouncedSearch ? 'No matching users' : 'No users yet'}
            description={
              debouncedSearch
                ? 'Try a different search term'
                : 'Create the first user account for your team'
            }
            action={debouncedSearch ? undefined : openCreateModal}
            actionLabel={debouncedSearch ? undefined : 'Create New User'}
          />
        </div>
      ) : (
        <>
          <Card>
            {showTableSkeleton ? (
              <UsersTableSkeleton rows={Math.min(pageSize, 10)} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Username</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Role</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Created</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {users.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50/80">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <User className="w-4 h-4" />
                            </span>
                            <span className="font-medium text-gray-900">
                              {toDisplayUsername(row.username)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`${roleBadgeClass(row.user_role)} pointer-events-none capitalize`}>
                            {formatRole(row.user_role)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {row.created_at
                            ? new Date(row.created_at).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground"
                            onClick={() => openEditModal(row)}
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1.5" />
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {pageResult && total > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-200 bg-gray-50 rounded-lg px-1 pb-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3 py-1">
                <p className="text-sm text-gray-600 leading-tight">
                  Showing{' '}
                  <span className="font-medium text-gray-900">
                    {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()}
                  </span>{' '}
                  of <span className="font-medium text-gray-900">{total.toLocaleString()}</span>
                </p>
                <div className="flex flex-wrap items-center gap-2 justify-end">
                  <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                    <SelectTrigger className="w-[130px] border-primary/30 h-9">
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

      <Dialog
        open={showCreateModal}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setShowCreateModal(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a sign-in account. Enter a username only (for example, 1234 or abcd123); @robertsqifsm.com is added automatically.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-username">
                Username <span className="text-red-600">*</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="create-username"
                  type="text"
                  placeholder="e.g. 1234 or abcd123"
                  className="pl-10"
                  value={formData.username}
                  onChange={(e) => setFormData((f) => ({ ...f, username: e.target.value }))}
                  required
                  disabled={isCreating}
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-role">
                Role <span className="text-red-600">*</span>
              </Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData((f) => ({ ...f, role: value }))}
                disabled={isCreating}
              >
                <SelectTrigger id="create-role" className="border-primary/30">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-password">
                Password <span className="text-red-600">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="create-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  value={formData.password}
                  onChange={(e) => setFormData((f) => ({ ...f, password: e.target.value }))}
                  required
                  disabled={isCreating}
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isCreating}
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90"
                disabled={
                  isCreating ||
                  !formData.username?.trim() ||
                  !formData.password ||
                  !formData.role
                }
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating…
                  </>
                ) : (
                  'Create user'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingUser}
        onOpenChange={(open) => {
          if (!open) closeEditModal();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Username and role cannot be changed. Set a new sign-in password for this account.
            </DialogDescription>
          </DialogHeader>

          {editingUser && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-username">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="edit-username"
                    type="text"
                    className={cn('pl-10', editReadonlyFieldClass)}
                    value={toDisplayUsername(editingUser.username)}
                    readOnly
                    tabIndex={-1}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <div
                  className={cn(
                    'flex h-10 items-center rounded-md border border-input px-3',
                    editReadonlyFieldClass
                  )}
                >
                  <Badge className={`${roleBadgeClass(editingUser.user_role)} pointer-events-none capitalize`}>
                    {formatRole(editingUser.user_role)}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-password">
                  New password <span className="text-red-600">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="edit-password"
                    type={showEditPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    required
                    disabled={isUpdating}
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isUpdating}
                  onClick={closeEditModal}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-primary hover:bg-primary/90"
                  disabled={isUpdating || !editPassword}
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Save password'
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
