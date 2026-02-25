import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { serviceRequestService, clientService, workReportService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  MapPin,
  Phone,
  Calendar,
  Navigation,
  Play,
  CheckCircle,
  Droplets,
  AlertTriangle
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatusBadge from '@/components/ui/StatusBadge';
import WorkflowStepper from '@/components/ui/WorkflowStepper';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

const irrigationLabels = {
  drip: 'Drip Irrigation',
  sprinkler: 'Sprinkler System',
  center_pivot: 'Center Pivot',
  flood: 'Flood Irrigation',
  micro_sprinkler: 'Micro Sprinkler',
  subsurface: 'Subsurface Drip'
};

/**
 * Admin drill-down: same as JobDetails but used when navigating from AdminTechnicianJobs.
 * Back / "Back to Jobs" go to AdminTechnicianJobs.
 */
export default function AdminJobDetails() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const jobId = urlParams.get('id');

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => serviceRequestService.getById(jobId),
    enabled: !!jobId
  });

  const { data: client } = useQuery({
    queryKey: ['client', job?.client_id],
    queryFn: () => job?.client_id ? clientService.getById(job.client_id) : null,
    enabled: !!job?.client_id
  });

  const updateJobMutation = useMutation({
    mutationFn: async (data) => serviceRequestService.update(jobId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
      queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
      toast.success('Job updated');
    }
  });

  const createWorkReportMutation = useMutation({
    mutationFn: async (data) => workReportService.create(data),
    onSuccess: (data) => {
      navigate(createPageUrl('AdminJobExecution') + `?id=${jobId}&reportId=${data.id}`);
    }
  });

  const handleStartJob = async () => {
    await updateJobMutation.mutateAsync({
      status: 'in_progress',
      actual_start_time: new Date().toISOString()
    });
    await createWorkReportMutation.mutateAsync({
      service_request_id: jobId,
      request_number: job.request_number,
      technician_id: job.assigned_technician_id,
      technician_name: job.assigned_technician_name,
      client_name: job.client_name,
      farm_name: job.farm_name,
      check_in_time: new Date().toISOString(),
      status: 'draft'
    });
    toast.success('Job started! Check-in recorded.');
  };

  const handleContinueJob = () => {
    navigate(createPageUrl('AdminJobExecution') + `?id=${jobId}`);
  };

  const openNavigation = () => {
    if (job?.location?.lat && job?.location?.lng) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${job.location.lat},${job.location.lng}`;
      window.open(url, '_blank');
    }
  };

  const goBackToList = () => {
    navigate(createPageUrl('AdminTechnicianJobs'));
  };

  if (isLoading || !job) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" text="Loading job details..." />
      </div>
    );
  }

  const isInProgress = job.status === 'in_progress';
  const canStart = ['scheduled', 'assigned'].includes(job.status);

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBackToList}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold text-gray-900">Job #{job?.request_number}</h1>
            <p className="text-sm text-gray-500">{job?.client_name}</p>
          </div>
          <StatusBadge status={job?.status} />
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card>
          <CardContent className="p-4">
            <WorkflowStepper
              currentStatus={job.status}
              size="sm"
              steps={[
                { key: 'assigned', label: 'Assigned' },
                { key: 'in_progress', label: 'Working' },
                { key: 'completed', label: 'Complete' },
                { key: 'approved', label: 'Approved' }
              ]}
            />
          </CardContent>
        </Card>

        {(job.priority === 'urgent' || job.priority === 'high') && (
          <div className={`flex items-center gap-3 p-4 rounded-xl ${
            job.priority === 'urgent' ? 'bg-red-50 border border-red-200' : 'bg-orange-50 border border-orange-200'
          }`}>
            <AlertTriangle className={`w-5 h-5 ${job.priority === 'urgent' ? 'text-red-500' : 'text-orange-500'}`} />
            <div>
              <p className={`font-medium ${job.priority === 'urgent' ? 'text-red-700' : 'text-orange-700'}`}>
                {job.priority === 'urgent' ? 'Urgent Job' : 'High Priority'}
              </p>
              <p className={`text-sm ${job.priority === 'urgent' ? 'text-red-600' : 'text-orange-600'}`}>
                {job.priority === 'urgent' ? 'Immediate attention required' : 'Complete as soon as possible'}
              </p>
            </div>
          </div>
        )}

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">{job.farm_name}</h3>
                <div className="flex items-start gap-2 text-gray-600">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{job.location?.address || 'No address provided'}</span>
                </div>
              </div>
              <Button
                onClick={openNavigation}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                // disabled={!job.location?.lat}
                disabled={true}
              >
                <Navigation className="w-4 h-4 mr-2" />
                Navigate
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Scheduled</span>
              </div>
              {job.scheduled_start_time ? (
                <p className="font-semibold text-gray-900">
                  {format(parseISO(job.scheduled_start_time), 'MMM d, yyyy')} • {format(parseISO(job.scheduled_start_time), 'h:mm a')} - {job.scheduled_end_time ? format(parseISO(job.scheduled_end_time), 'h:mm a') : 'N/A'}
                </p>
              ) : (
                <p className="font-semibold text-gray-900">Not set</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Phone className="w-4 h-4" />
                <span className="text-sm">Contact</span>
              </div>
              <a href={`tel:${job.contact_phone}`} className="font-semibold text-emerald-600">
                {job.contact_phone || 'No phone'}
              </a>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Service Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-gray-500">Irrigation Type</span>
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-blue-500" />
                <span className="font-medium">{irrigationLabels[job.irrigation_type] || job.irrigation_type}</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-gray-500">Issue Category</span>
              <span className="font-medium capitalize">{job.issue_category?.replace(/_/g, ' ')}</span>
            </div>
            {job.estimated_duration && (
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-500">Est. Duration</span>
                <span className="font-medium">{job.estimated_duration} hours</span>
              </div>
            )}
          </CardContent>
        </Card>

        {job.notes && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{job.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bottom actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t lg:relative lg:mt-6 lg:border lg:rounded-lg">
        {canStart && (
          <Button
            onClick={handleStartJob}
            disabled={updateJobMutation.isPending || createWorkReportMutation.isPending}
            className="w-full h-12 text-base bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Play className="w-5 h-5 mr-2" />
            Check In & Start Job
          </Button>
        )}
        {isInProgress && (
          <Button
            onClick={handleContinueJob}
            className="w-full h-12 text-base bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            Continue Work
          </Button>
        )}
        {['completed', 'approved', 'closed'].includes(job.status) && (
          <Button variant="outline" onClick={goBackToList} className="w-full h-12 text-base">
            Back to Technician Jobs
          </Button>
        )}
      </div>
    </div>
  );
}
