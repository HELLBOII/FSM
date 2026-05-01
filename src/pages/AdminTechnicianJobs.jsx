import React, { useMemo, useState } from 'react';
import { serviceRequestService, technicianService, clientService, emailService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Calendar, Clock3, AlertTriangle, Pencil, UserRoundCog } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ServiceRequestForm from '@/components/forms/ServiceRequestForm';
import { format, isBefore, startOfToday } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { mergeServiceRequestUpdateAudit } from '@/utils/serviceRequestAudit';
import {
  getSeasonFromServiceRequest,
  getServiceTypeLabelForSeason,
  formatRequestStatusLabel,
} from '@/utils/serviceRequestSeason';
import { cn } from '@/lib/utils';

const CLOSED_STATUSES = ['completed', 'approved', 'closed'];
const ACTIVE_STATUSES = ['scheduled', 'assigned', 'in_progress'];

/**
 * Admin view: same as TechnicianJobs but for admin role (all jobs, reassign to any technician).
 * Used when admin clicks "Technician Jobs" in the sidebar.
 */
export default function AdminTechnicianJobs() {
  const [reassignJob, setReassignJob] = useState(null);
  const [reassignSelectedTechnician, setReassignSelectedTechnician] = useState(null);
  const [editRequest, setEditRequest] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);

  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: myJobs = [], isLoading: isLoadingJobs } = useQuery({
    queryKey: ['technicianJobs', 'all'],
    queryFn: () => serviceRequestService.list('created_at', 'desc', 500)
  });

  const { data: allTechnicians = [], isLoading: isLoadingTechnicians } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => technicianService.list(),
    enabled: !!reassignJob
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientService.list()
  });

  const reassignMutation = useMutation({
    mutationFn: async ({ request, technician }) => {
      let updatePayload = {
        assigned_technician_id: technician.id,
        assigned_technician_name: technician.name || null,
      };
      updatePayload = mergeServiceRequestUpdateAudit(request, updatePayload, user?.id ?? null, {
        alwaysSetModified: true,
      });
      const updated = await serviceRequestService.update(request.id, updatePayload);

      const submitData = {
        ...request,
        ...updatePayload,
        request_number: request.request_number || `SR-${request.id}`,
        technician_mobile: technician.phone || '',
        location: request.location || { address: request.address || '' },
      };
      const client = clients.find((c) => String(c.id) === String(request.client_id));

      if (client?.email) {
        try {
          await emailService.sendClientNotification(submitData, client, true);
        } catch {
          // Do not block successful reassignment on email failure.
        }
      }
      if (technician?.email) {
        try {
          await emailService.sendTechnicianNotification(submitData, technician, true);
        } catch {
          // Do not block successful reassignment on email failure.
        }
      }

      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
      queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
      setReassignJob(null);
      setReassignSelectedTechnician(null);
      toast.success('Job reassigned successfully');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to reassign job');
    }
  });

  const updateRequestMutation = useMutation({
    mutationFn: ({ id, data }) => serviceRequestService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
      queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
      setShowEditForm(false);
      setEditRequest(null);
      toast.success('Request updated successfully');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update request');
    }
  });

  const openEditForm = (job) => {
    setEditRequest(job);
    setShowEditForm(true);
  };

  const handleSubmitEdit = async (data) => {
    if (!editRequest) return;
    await updateRequestMutation.mutateAsync({ id: editRequest.id, data });
  };

  const parseJobDate = (job) => {
    const raw = job.scheduled_start_time || job.scheduled_date;
    const dt = raw ? new Date(raw) : null;
    return dt && !Number.isNaN(dt.getTime()) ? dt : null;
  };

  const isOverdueJob = (job) => {
    if (CLOSED_STATUSES.includes(job.status)) return false;
    if (job.is_sla_breached) return true;
    const date = parseJobDate(job);
    if (!date) return false;
    return isBefore(date, startOfToday());
  };

  const formatDateTime = (job) => {
    const date = parseJobDate(job);
    if (!date) return 'Unscheduled';
    return format(date, 'MMM d • h:mm a');
  };

  const getClientAddress = (job) => {
    if (job.address || job.client_address || job.location_address) {
      return job.address || job.client_address || job.location_address;
    }
    const client = clients.find((c) => String(c.id) === String(job.client_id));
    return client?.address || '—';
  };

  const getServiceTypeLabel = (job) =>
    getServiceTypeLabelForSeason(getSeasonFromServiceRequest(job));

  const metrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const clientIdsWithScheduledOrCompleted = new Set(
      myJobs
        .filter((j) => ['scheduled', 'completed'].includes(j.status) && j.client_id != null)
        .map((j) => String(j.client_id))
    );

    const completed = myJobs.filter((j) => CLOSED_STATUSES.includes(j.status)).length;
    const scheduled = myJobs.filter((j) => {
      if (j.status !== 'scheduled') return false;
      if (!j.scheduled_end_time) return true;
      const endDate = new Date(j.scheduled_end_time);
      if (Number.isNaN(endDate.getTime())) return true;
      endDate.setHours(0, 0, 0, 0);
      return endDate >= today;
    }).length;
    const unscheduled = clients
      .filter((c) => {
        const lat = c.location?.lat ?? c.latitude;
        const lng = c.location?.lng ?? c.longitude;
        return lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));
      })
      .filter((c) => !clientIdsWithScheduledOrCompleted.has(String(c.id))).length;

    const overdue = myJobs.filter((j) => {
      if (j.status !== 'scheduled') return false;
      if (!j.scheduled_end_time) return false;
      const endDate = new Date(j.scheduled_end_time);
      if (Number.isNaN(endDate.getTime())) return false;
      endDate.setHours(0, 0, 0, 0);
      return endDate < today;
    }).length;
    return { completed, scheduled, unscheduled, overdue };
  }, [myJobs, clients]);

  const groupedTechnicians = useMemo(() => {
    const groups = new Map();
    myJobs.forEach((job) => {
      const id = job.assigned_technician_id || 'unassigned';
      const name = job.assigned_technician_name || 'Unassigned Jobs';
      if (!groups.has(id)) {
        groups.set(id, { id, name, jobs: [] });
      }
      groups.get(id).jobs.push(job);
    });

    const withMeta = [...groups.values()].map((group) => {
      const sortedJobs = [...group.jobs].sort((a, b) => {
        const da = parseJobDate(a);
        const db = parseJobDate(b);
        if (da && db) return da - db;
        if (da && !db) return -1;
        if (!da && db) return 1;
        return String(a.client_name || '').localeCompare(String(b.client_name || ''));
      });

      const activeCount = sortedJobs.filter((j) => ACTIVE_STATUSES.includes(j.status)).length;
      const todayCount = sortedJobs.filter((j) => {
        const d = parseJobDate(j);
        if (!d) return false;
        return format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
      }).length;
      const overdueCount = sortedJobs.filter((j) => isOverdueJob(j)).length;

      return { ...group, jobs: sortedJobs, activeCount, todayCount, overdueCount };
    });

    // Only show groups with an assigned technician (hide unassigned bucket)
    return withMeta
      .filter((g) => g.id !== 'unassigned')
      .sort((a, b) => b.activeCount - a.activeCount);
  }, [myJobs]);

  const getInitials = (name) =>
    name
      ?.split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'NA';

  const statusTone = (job, overdue) => {
    const status = job.status;
    const closed = CLOSED_STATUSES.includes(status);
    if (overdue) return 'bg-[#FCEBEB] text-[#A32D2D]';
    if (status === 'pending') return 'bg-[#FCEBEB] text-[#A32D2D]';
    if (closed) return 'bg-[#EAF3DE] text-[#3B6D11]';
    if (status === 'scheduled' || status === 'assigned') return 'bg-[#EEEDFE] text-[#534AB7]';
    if (status === 'in_progress') return 'bg-[#E6F1FB] text-[#185FA5]';
    return 'bg-[#FAEEDA] text-[#BA7517]';
  };

  const statusLabel = (job, overdue) => {
    if (overdue) return 'Overdue';
    if (job.status === 'pending') return 'Pending';
    return formatRequestStatusLabel(job.status);
  };

  const dateTimeTone = (job, overdue) => {
    const status = job.status;
    const closed = CLOSED_STATUSES.includes(status);
    if (overdue || status === 'pending') return 'text-[#A32D2D]';
    if (closed) return 'text-[#3B6D11]';
    if (status === 'scheduled' || status === 'assigned') return 'text-[#534AB7]';
    if (status === 'in_progress') return 'text-[#185FA5]';
    return 'text-[#BA7517]';
  };

  const technicianSubLabel = (group) => {
    if (group.overdueCount > 0) {
      return `${group.jobs.length} jobs this week · ${group.overdueCount} overdue`;
    }
    return `${group.jobs.length} jobs this week · ${group.todayCount} today`;
  };

  if (isLoadingJobs) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" text="Loading jobs..." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Technician Jobs</h1>
          <p className="mt-1 text-gray-500">Monitor technician assignments and upcoming jobs</p>
        </div>
        <div className="text-xs text-[#888780]">Ordered by upcoming first · Spring {new Date().getFullYear()}</div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-black/10 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#888780]">
            <span>Completed</span>
            <CheckCircle className="h-3.5 w-3.5 text-[#1D9E75]" />
          </div>
          <div className="text-[22px] font-medium text-[#0F6E56]">{metrics.completed}</div>
        </div>
        <div className="rounded-md border border-black/10 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#888780]">
            <span>Scheduled</span>
            <Calendar className="h-3.5 w-3.5 text-[#534AB7]" />
          </div>
          <div className="text-[22px] font-medium text-[#534AB7]">{metrics.scheduled}</div>
        </div>
        <div className="rounded-md border border-black/10 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#888780]">
            <span>Unscheduled</span>
            <Clock3 className="h-3.5 w-3.5 text-[#BA7517]" />
          </div>
          <div className="text-[22px] font-medium text-[#BA7517]">{metrics.unscheduled}</div>
        </div>
        <div className="rounded-md border border-black/10 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[#888780]">
            <span>Overdue</span>
            <AlertTriangle className="h-3.5 w-3.5 text-[#A32D2D]" />
          </div>
          <div className="text-[22px] font-medium text-[#A32D2D]">{metrics.overdue}</div>
        </div>
      </div>

      {groupedTechnicians.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center text-sm text-gray-500">
          {myJobs.length > 0 ? (
            <>
              <p>No jobs with an assigned technician.</p>
              <p className="mt-2 text-xs text-[#888780]">
                Unassigned jobs are not shown here — assign a technician from Service Requests or Scheduling.
              </p>
            </>
          ) : (
            'No jobs found.'
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {groupedTechnicians.map((group) => (
            <div
              key={group.id}
              className="overflow-hidden rounded-xl border border-black/[0.08] bg-white"
            >
              <div className="flex items-center gap-3 border-b border-black/10 bg-[#f5f5f3] px-2.5 py-3 sm:px-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {getInitials(group.name)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-900">{group.name}</div>
                  <div className="text-xs text-[#888780]">{technicianSubLabel(group)}</div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-xs sm:min-w-[900px] sm:text-sm">
                  <thead>
                    <tr className="bg-[#f8f8f7]">
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-3.5 sm:text-sm">Client</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-2.5 sm:text-sm">Address</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-2.5 sm:text-sm">Service</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-2.5 sm:text-sm">Date & Time</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-2.5 sm:text-sm">Status</th>
                      <th className="border-b border-black/10 px-2 py-2 text-left text-xs font-medium text-[#888780] sm:px-2.5 sm:text-sm">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.jobs.map((job) => {
                      const overdue = isOverdueJob(job);
                      const canReassign = ACTIVE_STATUSES.includes(job.status);
                      const canEdit = !CLOSED_STATUSES.includes(job.status);
                      return (
                        <tr
                          key={job.id}
                          className={overdue ? 'border-b border-black/10 bg-[#FFF8F8] last:border-b-0' : 'border-b border-black/10 last:border-b-0'}
                        >
                          <td className="px-2 py-2.5 font-medium text-gray-900 sm:px-3.5">
                            {job.client_name || `#${job.request_number}`}
                          </td>
                          <td className="px-2 py-2.5 text-[#6f6f68] sm:px-2.5">{getClientAddress(job)}</td>
                          <td className="px-2 py-2.5 text-gray-800 sm:px-2.5">
                            {getServiceTypeLabel(job)}
                          </td>
                          <td className={`px-2 py-2.5 font-medium sm:px-2.5 ${dateTimeTone(job, overdue)}`}>
                            {formatDateTime(job)}
                          </td>
                          <td className="px-2 py-2.5 sm:px-2.5">
                            <span className={`inline-block rounded-[10px] px-2 py-0.5 text-xs font-medium ${statusTone(job, overdue)}`}>
                              {statusLabel(job, overdue)}
                            </span>
                            {job.priority === 'urgent' && (
                              <span className="ml-1.5 align-middle">
                                <StatusBadge status="urgent" size="xs" />
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2.5 sm:px-2.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {canEdit ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="default"
                                  className="h-7 gap-1.5 rounded-[4px] bg-primary px-2.5 text-xs font-medium text-white hover:bg-primary/90 hover:text-white"
                                  onClick={() => openEditForm(job)}
                                >
                                  <Pencil className="h-3.5 w-3.5 shrink-0" />
                                  Edit
                                </Button>
                              ) : null}
                              {canReassign ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="default"
                                  className="h-7 gap-1.5 rounded-[4px] bg-primary px-2.5 text-xs font-medium text-white hover:bg-primary/90 hover:text-white"
                                  onClick={() => setReassignJob(job)}
                                >
                                  <UserRoundCog className="h-3.5 w-3.5 shrink-0" />
                                  Reassign
                                </Button>
                              ) : null}
                              {!canEdit && !canReassign ? (
                                <span className="text-xs text-[#888780]">—</span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={!!reassignJob}
        onOpenChange={(open) => {
          if (!open) {
            setReassignJob(null);
            setReassignSelectedTechnician(null);
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Reassign job</DialogTitle>
            <DialogDescription>
              {reassignJob && (
                <>
                  Choose a technician for #{reassignJob.request_number || reassignJob.id} —{' '}
                  {reassignJob.client_name || 'Client'}, then click Save.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-2">
            {isLoadingTechnicians ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="md" text="Loading technicians..." />
              </div>
            ) : allTechnicians.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No technicians available to assign.</p>
            ) : (
              allTechnicians.map((tech) => {
                const isSelected =
                  reassignSelectedTechnician &&
                  String(reassignSelectedTechnician.id) === String(tech.id);
                return (
                  <button
                    key={tech.id}
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/50',
                      isSelected && 'border-primary bg-primary/5 ring-1 ring-primary/30'
                    )}
                    onClick={() => setReassignSelectedTechnician(tech)}
                    disabled={reassignMutation.isPending}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      {(tech.name || '?')
                        .split(/\s+/)
                        .filter(Boolean)
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900">{tech.name}</p>
                      <p className="truncate text-xs text-gray-500">{tech.employee_id || tech.email}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <div className="mt-3 flex shrink-0 flex-wrap justify-end gap-2 border-t border-black/10 pt-3">
            <Button
              type="button"
              variant="outline"
              disabled={reassignMutation.isPending}
              onClick={() => {
                setReassignJob(null);
                setReassignSelectedTechnician(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                !reassignJob || !reassignSelectedTechnician || reassignMutation.isPending
              }
              onClick={() => {
                if (!reassignJob || !reassignSelectedTechnician) return;
                reassignMutation.mutate({
                  request: reassignJob,
                  technician: reassignSelectedTechnician,
                });
              }}
            >
              {reassignMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showEditForm}
        onOpenChange={(open) => {
          setShowEditForm(open);
          if (!open) setEditRequest(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Service Request</DialogTitle>
            <DialogDescription>Update the service request details below</DialogDescription>
          </DialogHeader>
          {editRequest && (
            <ServiceRequestForm
              request={editRequest}
              onSubmit={handleSubmitEdit}
              onCancel={() => {
                setShowEditForm(false);
                setEditRequest(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
