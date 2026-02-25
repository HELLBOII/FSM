import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { serviceRequestService, technicianService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  MapPin,
  Clock,
  ChevronRight,
  Calendar,
  CheckCircle,
  UserPlus
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { format, parseISO, isToday, isTomorrow, isPast, startOfDay } from 'date-fns';
import { toast } from 'sonner';

const irrigationIcons = {
  drip: '💧',
  sprinkler: '🌊',
  center_pivot: '🔄',
  flood: '🌊',
  micro_sprinkler: '💦',
  subsurface: '🌱'
};

/**
 * Admin view: same as TechnicianJobs but for admin role (all jobs, reassign to any technician).
 * Used when admin clicks "Technician Jobs" in the sidebar.
 */
export default function AdminTechnicianJobs() {
  const [activeTab, setActiveTab] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [reassignJob, setReassignJob] = useState(null);

  const queryClient = useQueryClient();

  const { data: myJobs = [], isLoading: isLoadingJobs } = useQuery({
    queryKey: ['technicianJobs', 'all'],
    queryFn: () => serviceRequestService.list('created_at', 'desc', 500)
  });

  const { data: allTechnicians = [], isLoading: isLoadingTechnicians } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => technicianService.list(),
    enabled: !!reassignJob
  });

  const reassignMutation = useMutation({
    mutationFn: ({ requestId, technicianId }) =>
      serviceRequestService.update(requestId, { assigned_technician_id: technicianId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
      queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
      setReassignJob(null);
      toast.success('Job reassigned successfully');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to reassign job');
    }
  });

  const filteredJobs = myJobs.filter((job) => {
    const matchesSearch = !searchQuery ||
    job.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.request_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.farm_name?.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === 'pending') {
      return matchesSearch && ['scheduled', 'assigned', 'in_progress'].includes(job.status);
    } else if (activeTab === 'completed') {
      return matchesSearch && ['completed', 'approved', 'closed'].includes(job.status);
    } else if (activeTab === 'today') {
      return matchesSearch && job.scheduled_date && isToday(parseISO(job.scheduled_date));
    }
    return matchesSearch;
  });

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
    if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
    if (a.scheduled_date && b.scheduled_date) {
      return new Date(a.scheduled_date) - new Date(b.scheduled_date);
    }
    return 0;
  });

  const getDateLabel = (dateStr) => {
    if (!dateStr) return 'Unscheduled';
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isPast(startOfDay(date))) return 'Overdue';
    return format(date, 'EEE, MMM d');
  };

  const jobCounts = {
    pending: myJobs.filter((j) => ['scheduled', 'assigned', 'in_progress'].includes(j.status)).length,
    today: myJobs.filter((j) => j.scheduled_date && isToday(parseISO(j.scheduled_date))).length,
    completed: myJobs.filter((j) => ['completed', 'approved', 'closed'].includes(j.status)).length
  };

  if (isLoadingJobs) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" text="Loading jobs..." />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Technician Jobs</h1>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          placeholder="Search jobs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-11 h-12 text-base rounded-xl bg-gray-50 border-gray-200"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full bg-gray-100 p-1 rounded-xl h-12">
          <TabsTrigger value="pending" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Pending ({jobCounts.pending})
          </TabsTrigger>
          <TabsTrigger value="today" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Today ({jobCounts.today})
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Done ({jobCounts.completed})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {sortedJobs.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 text-lg">No jobs found</p>
          <p className="text-gray-400 text-sm mt-1">
            {activeTab === 'pending' ? "No pending jobs" : "No matching jobs"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {sortedJobs.map((job, idx) => {
              const dateLabel = getDateLabel(job.scheduled_date);
              const isOverdue = dateLabel === 'Overdue';
              const isInProgress = job.status === 'in_progress';

              return (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className={`
                    hover:shadow-lg transition-all active:scale-[0.99]
                    ${isInProgress ? 'border-2 border-emerald-500 bg-emerald-50/30' : ''}
                    ${isOverdue ? 'border-l-4 border-l-red-500' : ''}
                  `}>
                    <CardContent className="p-4">
                      <Link to={createPageUrl('AdminJobDetails') + `?id=${job.id}`} className="block">
                        <div className="flex items-start gap-3">
                          <div className={`
                            w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0
                            ${isInProgress ? 'bg-gradient-to-br from-emerald-100 to-emerald-200' : 'bg-gradient-to-br from-gray-100 to-gray-200'}
                          `}>
                            {irrigationIcons[job.irrigation_type] || '💧'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-gray-500">#{job.request_number}</span>
                              <StatusBadge status={job.status} size="xs" />
                              {(job.priority === 'urgent' || job.priority === 'high') && (
                                <StatusBadge status={job.priority} size="xs" />
                              )}
                            </div>
                            <h3 className="font-semibold text-gray-900 truncate">{job.client_name}</h3>
                            <p className="text-sm text-gray-500 truncate">{job.farm_name}</p>
                            {job.assigned_technician_name && (
                              <p className="text-xs text-gray-500 mt-0.5">Assigned: {job.assigned_technician_name}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                                  {job.scheduled_start_time ? format(parseISO(job.scheduled_start_time), 'MMM d, yyyy') : '—'}
                                </span>
                              </div>
                              {job.scheduled_start_time && (
                                <div className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  <span>{format(parseISO(job.scheduled_start_time), 'h:mm a')}</span>
                                </div>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-2 line-clamp-1">
                              {job.issue_category?.replace(/_/g, ' ')} - {job.description}
                            </p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-2" />
                        </div>
                      </Link>
                      {['scheduled', 'assigned', 'in_progress'].includes(job.status) && (
                        <div className="border-t mt-3 pt-3">
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={(e) => {
                              e.preventDefault();
                              setReassignJob(job);
                            }}
                          >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Reassign
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={!!reassignJob} onOpenChange={(open) => !open && setReassignJob(null)}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Reassign job</DialogTitle>
            <DialogDescription>
              {reassignJob && (
                <>Select a technician to assign to #{reassignJob.request_number} – {reassignJob.client_name}</>
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
              allTechnicians.map((tech) => (
                <button
                  key={tech.id}
                  type="button"
                  className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 text-left transition-colors"
                  onClick={() => {
                    reassignMutation.mutate({
                      requestId: reassignJob.id,
                      technicianId: tech.id
                    });
                  }}
                  disabled={reassignMutation.isPending}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                    {tech.name?.split(' ').map((n) => n[0]).join('') || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{tech.name}</p>
                    <p className="text-xs text-gray-500 truncate">{tech.employee_id || tech.email}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
