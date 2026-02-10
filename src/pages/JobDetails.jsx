import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { serviceRequestService, clientService, workReportService } from '@/services';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  MapPin,
  Phone,
  Clock,
  Calendar,
  Navigation,
  Play,
  CheckCircle,
  Droplets,
  User,
  FileText,
  AlertTriangle,
  ExternalLink } from
'lucide-react';
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

export default function JobDetails() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const jobId = urlParams.get('id');

  const { user } = useAuth();

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      const jobData = await serviceRequestService.getById(jobId);
      return jobData;
    },
    enabled: !!jobId
  });

  const { data: client } = useQuery({
    queryKey: ['client', job?.client_id],
    queryFn: () => job?.client_id ? clientService.getById(job.client_id) : null,
    enabled: !!job?.client_id
  });

  const updateJobMutation = useMutation({
    mutationFn: async (data) => {
      return serviceRequestService.update(jobId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
      queryClient.invalidateQueries({ queryKey: ['myJobs'] });
      toast.success('Job updated');
    }
  });

  const createWorkReportMutation = useMutation({
    mutationFn: async (data) => {
      return workReportService.create(data);
    },
    onSuccess: (data) => {
      navigate(createPageUrl('JobExecution') + `?id=${jobId}&reportId=${data.id}`);
    }
  });

  const handleStartJob = async () => {
    // Create work report and start job
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
    navigate(createPageUrl('JobExecution') + `?id=${jobId}`);
  };

  const openNavigation = () => {
    if (job?.location?.lat && job?.location?.lng) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${job.location.lat},${job.location.lng}`;
      window.open(url, '_blank');
    }
  };

  if (isLoading || !job) {
    return (
      <div data-source-location="pages/JobDetails:159:6" data-dynamic-content="false" className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner data-source-location="pages/JobDetails:160:8" data-dynamic-content="false" size="lg" text="Loading job details..." />
      </div>);

  }

  const isInProgress = job.status === 'in_progress';
  const canStart = ['scheduled', 'assigned'].includes(job.status);

  return (
    <div data-source-location="pages/JobDetails:171:4" data-dynamic-content="true" className="pb-32">
      
      {/* Header */}
      <div data-source-location="pages/JobDetails:175:6" data-dynamic-content="true" className="bg-white border-b px-4 py-3 sticky top-0 z-30">
        <div data-source-location="pages/JobDetails:176:8" data-dynamic-content="true" className="flex items-center gap-3">
          <Button data-source-location="pages/JobDetails:177:10" data-dynamic-content="false" variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft data-source-location="pages/JobDetails:178:12" data-dynamic-content="false" className="w-5 h-5" />
          </Button>
          <div data-source-location="pages/JobDetails:180:10" data-dynamic-content="true" className="flex-1">
            <h1 data-source-location="pages/JobDetails:181:12" data-dynamic-content="true" className="font-semibold text-gray-900">Job #{job?.request_number}</h1>
            <p data-source-location="pages/JobDetails:182:12" data-dynamic-content="true" className="text-sm text-gray-500">{job?.client_name}</p>
          </div>
          <StatusBadge data-source-location="pages/JobDetails:184:10" data-dynamic-content="false" status={job?.status} />
        </div>
      </div>

      <div data-source-location="pages/JobDetails:188:6" data-dynamic-content="true" className="p-4 space-y-4">
        {/* Status Stepper */}
        <Card data-source-location="pages/JobDetails:190:8" data-dynamic-content="true">
          <CardContent data-source-location="pages/JobDetails:191:10" data-dynamic-content="true" className="p-4">
            <WorkflowStepper data-source-location="pages/JobDetails:192:12" data-dynamic-content="false"
            currentStatus={job.status}
            size="sm"
            steps={[
            { key: 'assigned', label: 'Assigned' },
            { key: 'in_progress', label: 'Working' },
            { key: 'completed', label: 'Complete' },
            { key: 'approved', label: 'Approved' }]
            } />

          </CardContent>
        </Card>

        {/* Priority Alert */}
        {(job.priority === 'urgent' || job.priority === 'high') &&
        <div data-source-location="pages/JobDetails:207:10" data-dynamic-content="true" className={`flex items-center gap-3 p-4 rounded-xl ${
        job.priority === 'urgent' ? 'bg-red-50 border border-red-200' : 'bg-orange-50 border border-orange-200'}`
        }>
            <AlertTriangle data-source-location="pages/JobDetails:210:12" data-dynamic-content="false" className={`w-5 h-5 ${
          job.priority === 'urgent' ? 'text-red-500' : 'text-orange-500'}`
          } />
            <div data-source-location="pages/JobDetails:213:12" data-dynamic-content="true">
              <p data-source-location="pages/JobDetails:214:14" data-dynamic-content="true" className={`font-medium ${
            job.priority === 'urgent' ? 'text-red-700' : 'text-orange-700'}`
            }>
                {job.priority === 'urgent' ? 'Urgent Job' : 'High Priority'}
              </p>
              <p data-source-location="pages/JobDetails:219:14" data-dynamic-content="true" className={`text-sm ${
            job.priority === 'urgent' ? 'text-red-600' : 'text-orange-600'}`
            }>
                {job.priority === 'urgent' ? 'Immediate attention required' : 'Complete as soon as possible'}
              </p>
            </div>
          </div>
        }

        {/* Location Card */}
        <Card data-source-location="pages/JobDetails:229:8" data-dynamic-content="true">
          <CardContent data-source-location="pages/JobDetails:230:10" data-dynamic-content="true" className="p-4">
            <div data-source-location="pages/JobDetails:231:12" data-dynamic-content="true" className="flex items-start justify-between">
              <div data-source-location="pages/JobDetails:232:14" data-dynamic-content="true" className="flex-1">
                <h3 data-source-location="pages/JobDetails:233:16" data-dynamic-content="true" className="font-semibold text-gray-900 mb-1">{job.farm_name}</h3>
                <div data-source-location="pages/JobDetails:234:16" data-dynamic-content="true" className="flex items-start gap-2 text-gray-600">
                  <MapPin data-source-location="pages/JobDetails:235:18" data-dynamic-content="false" className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span data-source-location="pages/JobDetails:236:18" data-dynamic-content="true" className="text-sm">{job.location?.address || 'No address provided'}</span>
                </div>
              </div>
              <Button data-source-location="pages/JobDetails:239:14" data-dynamic-content="false"
              onClick={openNavigation}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={!job.location?.lat}>

                <Navigation data-source-location="pages/JobDetails:244:16" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                Navigate
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Schedule & Contact */}
        <div data-source-location="pages/JobDetails:252:8" data-dynamic-content="true" className="grid grid-cols-2 gap-3">
          <Card data-source-location="pages/JobDetails:253:10" data-dynamic-content="true">
            <CardContent data-source-location="pages/JobDetails:254:12" data-dynamic-content="true" className="p-4">
              <div data-source-location="pages/JobDetails:255:14" data-dynamic-content="false" className="flex items-center gap-2 text-gray-500 mb-1">
                <Calendar data-source-location="pages/JobDetails:256:16" data-dynamic-content="false" className="w-4 h-4" />
                <span data-source-location="pages/JobDetails:257:16" data-dynamic-content="false" className="text-sm">Scheduled</span>
              </div>
              {job.scheduled_start_time ? (
                <p data-source-location="pages/JobDetails:259:14" data-dynamic-content="true" className="font-semibold text-gray-900">
                  {format(parseISO(job.scheduled_start_time), 'MMM d, yyyy')} • {format(parseISO(job.scheduled_start_time), 'h:mm a')} - {job.scheduled_end_time ? format(parseISO(job.scheduled_end_time), 'h:mm a') : 'N/A'}
                </p>
              ) : (
                <p data-source-location="pages/JobDetails:259:14" data-dynamic-content="true" className="font-semibold text-gray-900">Not set</p>
              )}
            </CardContent>
          </Card>

          <Card data-source-location="pages/JobDetails:266:10" data-dynamic-content="true">
            <CardContent data-source-location="pages/JobDetails:267:12" data-dynamic-content="true" className="p-4">
              <div data-source-location="pages/JobDetails:268:14" data-dynamic-content="false" className="flex items-center gap-2 text-gray-500 mb-1">
                <Phone data-source-location="pages/JobDetails:269:16" data-dynamic-content="false" className="w-4 h-4" />
                <span data-source-location="pages/JobDetails:270:16" data-dynamic-content="false" className="text-sm">Contact</span>
              </div>
              <a data-source-location="pages/JobDetails:272:14" data-dynamic-content="true"
              href={`tel:${job.contact_phone}`}
              className="font-semibold text-emerald-600">

                {job.contact_phone || 'No phone'}
              </a>
            </CardContent>
          </Card>
        </div>

        {/* Service Details */}
        <Card data-source-location="pages/JobDetails:283:8" data-dynamic-content="true">
          <CardHeader data-source-location="pages/JobDetails:284:10" data-dynamic-content="false" className="pb-2">
            <CardTitle data-source-location="pages/JobDetails:285:12" data-dynamic-content="false" className="text-base">Service Details</CardTitle>
          </CardHeader>
          <CardContent data-source-location="pages/JobDetails:287:10" data-dynamic-content="true" className="space-y-3">
            <div data-source-location="pages/JobDetails:288:12" data-dynamic-content="true" className="flex items-center justify-between py-2 border-b">
              <span data-source-location="pages/JobDetails:289:14" data-dynamic-content="false" className="text-gray-500">Irrigation Type</span>
              <div data-source-location="pages/JobDetails:290:14" data-dynamic-content="true" className="flex items-center gap-2">
                <Droplets data-source-location="pages/JobDetails:291:16" data-dynamic-content="false" className="w-4 h-4 text-blue-500" />
                <span data-source-location="pages/JobDetails:292:16" data-dynamic-content="true" className="font-medium">{irrigationLabels[job.irrigation_type] || job.irrigation_type}</span>
              </div>
            </div>
            <div data-source-location="pages/JobDetails:295:12" data-dynamic-content="true" className="flex items-center justify-between py-2 border-b">
              <span data-source-location="pages/JobDetails:296:14" data-dynamic-content="false" className="text-gray-500">Issue Category</span>
              <span data-source-location="pages/JobDetails:297:14" data-dynamic-content="true" className="font-medium capitalize">{job.issue_category?.replace(/_/g, ' ')}</span>
            </div>
            {job.estimated_duration &&
            <div data-source-location="pages/JobDetails:306:14" data-dynamic-content="true" className="flex items-center justify-between py-2">
                <span data-source-location="pages/JobDetails:307:16" data-dynamic-content="false" className="text-gray-500">Est. Duration</span>
                <span data-source-location="pages/JobDetails:308:16" data-dynamic-content="true" className="font-medium">{job.estimated_duration} hours</span>
              </div>
            }
          </CardContent>
        </Card>

        {/* Notes */}
        {job.notes &&
        <Card data-source-location="pages/JobDetails:350:10" data-dynamic-content="true">
            <CardHeader data-source-location="pages/JobDetails:351:12" data-dynamic-content="false" className="pb-2">
              <CardTitle data-source-location="pages/JobDetails:352:14" data-dynamic-content="false" className="text-base">Additional Notes</CardTitle>
            </CardHeader>
            <CardContent data-source-location="pages/JobDetails:354:12" data-dynamic-content="true">
              <p data-source-location="pages/JobDetails:355:14" data-dynamic-content="true" className="text-gray-700">{job.notes}</p>
            </CardContent>
          </Card>
        }
      </div>

      {/* Fixed Bottom Action */}
      <div data-source-location="pages/JobDetails:371:6" data-dynamic-content="true" className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t">
        {canStart &&
        <Button data-source-location="pages/JobDetails:373:10" data-dynamic-content="false"
        onClick={handleStartJob}
        disabled={updateJobMutation.isPending || createWorkReportMutation.isPending}
        className="w-full h-14 text-lg bg-primary hover:bg-primary/90 text-primary-foreground">

            <Play data-source-location="pages/JobDetails:378:12" data-dynamic-content="false" className="w-5 h-5 mr-2" />
            Check In & Start Job
          </Button>
        }
        {isInProgress &&
        <Button data-source-location="pages/JobDetails:383:10" data-dynamic-content="false"
        onClick={handleContinueJob}
        className="w-full h-14 text-lg bg-primary hover:bg-primary/90 text-primary-foreground">

            <CheckCircle data-source-location="pages/JobDetails:387:12" data-dynamic-content="false" className="w-5 h-5 mr-2" />
            Continue Work
          </Button>
        }
        {['completed', 'approved', 'closed'].includes(job.status) &&
        <Button data-source-location="pages/JobDetails:392:10" data-dynamic-content="false"
        variant="outline"
        onClick={() => navigate(createPageUrl('TechnicianJobs'))}
        className="w-full h-14 text-lg">

            Back to Jobs
          </Button>
        }
      </div>
    </div>);

}