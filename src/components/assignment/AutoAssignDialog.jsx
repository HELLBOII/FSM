import React, { useState } from 'react';
import { technicianService, serviceRequestService, notificationService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter } from
"@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sparkles, MapPin, Briefcase, Star, CheckCircle } from 'lucide-react';
import { calculateBestTechnician } from '@/components/utils/assignmentAlgorithm';
import { toast } from 'sonner';

export default function AutoAssignDialog({ serviceRequest, open, onOpenChange }) {
  const [selectedTechId, setSelectedTechId] = useState(null);
  const queryClient = useQueryClient();

  const { data: technicians = [] } = useQuery({
    queryKey: ['availableTechnicians'],
    queryFn: () => technicianService.getByAvailabilityStatus('available'),
    enabled: open
  });

  const assignMutation = useMutation({
    mutationFn: async (technicianId) => {
      const technician = technicians.find((t) => t.id === technicianId);
      const updatedRequest = await serviceRequestService.update(serviceRequest.id, {
        assigned_technician_id: technicianId,
        assigned_technician_name: technician.name,
        status: 'assigned'
      });

      // Create notification for technician
      if (technician.user_id) {
        await notificationService.create({
          user_id: technician.user_id,
          title: 'New Job Assigned',
          message: `You have been assigned to SR #${serviceRequest.request_number} - ${serviceRequest.client_name}`,
          type: 'job_assigned',
          link: createPageUrl(`JobDetails?id=${serviceRequest.id}`),
          related_id: serviceRequest.id,
          read: false
        });
      }

      return updatedRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
      queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
      toast.success('Job assigned successfully!');
      onOpenChange(false);
    }
  });

  const rankedTechnicians = calculateBestTechnician(serviceRequest, technicians);

  const handleAssign = () => {
    if (selectedTechId) {
      assignMutation.mutate(selectedTechId);
    }
  };

  const handleAutoAssign = () => {
    if (rankedTechnicians.length > 0) {
      assignMutation.mutate(rankedTechnicians[0].id);
    }
  };

  return (
    <Dialog data-source-location="components/assignment/AutoAssignDialog:74:4" data-dynamic-content="true" open={open} onOpenChange={onOpenChange}>
      <DialogContent data-source-location="components/assignment/AutoAssignDialog:75:6" data-dynamic-content="true" className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader data-source-location="components/assignment/AutoAssignDialog:76:8" data-dynamic-content="true">
          <DialogTitle data-source-location="components/assignment/AutoAssignDialog:77:10" data-dynamic-content="true" className="flex items-center gap-2">
            <Sparkles data-source-location="components/assignment/AutoAssignDialog:78:12" data-dynamic-content="false" className="w-5 h-5 text-emerald-600" />
            Smart Assignment for SR #{serviceRequest?.request_number}
          </DialogTitle>
        </DialogHeader>

        <div data-source-location="components/assignment/AutoAssignDialog:83:8" data-dynamic-content="true" className="space-y-4">
          <div data-source-location="components/assignment/AutoAssignDialog:84:10" data-dynamic-content="true" className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p data-source-location="components/assignment/AutoAssignDialog:85:12" data-dynamic-content="false" className="text-sm font-medium text-blue-900 mb-1">Job Details</p>
            <p data-source-location="components/assignment/AutoAssignDialog:86:12" data-dynamic-content="true" className="text-sm text-blue-700">
              {serviceRequest?.irrigation_type} - {serviceRequest?.issue_category?.replace(/_/g, ' ')}
            </p>
            <p data-source-location="components/assignment/AutoAssignDialog:89:12" data-dynamic-content="true" className="text-xs text-blue-600 mt-1">{serviceRequest?.farm_name}</p>
          </div>

          <div data-source-location="components/assignment/AutoAssignDialog:92:10" data-dynamic-content="true" className="space-y-2">
            <p data-source-location="components/assignment/AutoAssignDialog:93:12" data-dynamic-content="false" className="text-sm font-medium text-gray-700">Recommended Technicians</p>
            {rankedTechnicians.length === 0 ?
            <p data-source-location="components/assignment/AutoAssignDialog:95:14" data-dynamic-content="false" className="text-sm text-gray-500 text-center py-8">No available technicians found</p> :

            rankedTechnicians.map((tech, index) =>
            <button data-source-location="components/assignment/AutoAssignDialog:98:16" data-dynamic-content="true"
            key={tech.id}
            onClick={() => setSelectedTechId(tech.id)}
            className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
            selectedTechId === tech.id ?
            'border-emerald-500 bg-emerald-50' :
            'border-gray-200 hover:border-emerald-300'}`
            }>

                  <div data-source-location="components/assignment/AutoAssignDialog:107:18" data-dynamic-content="true" className="flex items-start gap-3">
                    <Avatar data-source-location="components/assignment/AutoAssignDialog:108:20" data-dynamic-content="true" className="w-12 h-12 shrink-0">
                      <AvatarFallback data-source-location="components/assignment/AutoAssignDialog:109:22" data-dynamic-content="true" className="bg-blue-100 text-blue-700">
                        {tech.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>

                    <div data-source-location="components/assignment/AutoAssignDialog:114:20" data-dynamic-content="true" className="flex-1 min-w-0">
                      <div data-source-location="components/assignment/AutoAssignDialog:115:22" data-dynamic-content="true" className="flex items-center gap-2 mb-1">
                        <p data-source-location="components/assignment/AutoAssignDialog:116:24" data-dynamic-content="true" className="font-semibold text-gray-900">{tech.name}</p>
                        {index === 0 &&
                    <Badge data-source-location="components/assignment/AutoAssignDialog:118:26" data-dynamic-content="false" className="bg-emerald-500 text-white">Best Match</Badge>
                    }
                        <Badge data-source-location="components/assignment/AutoAssignDialog:120:24" data-dynamic-content="true" variant="outline" className="ml-auto">
                          {tech.availability_status}
                        </Badge>
                      </div>

                      <div data-source-location="components/assignment/AutoAssignDialog:125:22" data-dynamic-content="true" className="flex items-center gap-3 text-xs text-gray-600 mb-2">
                        <div data-source-location="components/assignment/AutoAssignDialog:126:24" data-dynamic-content="true" className="flex items-center gap-1">
                          <Star data-source-location="components/assignment/AutoAssignDialog:127:26" data-dynamic-content="false" className="w-3 h-3 text-yellow-500" />
                          <span data-source-location="components/assignment/AutoAssignDialog:128:26" data-dynamic-content="true">{tech.rating?.toFixed(1)}</span>
                        </div>
                        <div data-source-location="components/assignment/AutoAssignDialog:130:24" data-dynamic-content="true" className="flex items-center gap-1">
                          <Briefcase data-source-location="components/assignment/AutoAssignDialog:131:26" data-dynamic-content="false" className="w-3 h-3" />
                          <span data-source-location="components/assignment/AutoAssignDialog:132:26" data-dynamic-content="true">{tech.jobs_completed} jobs</span>
                        </div>
                        {tech.distance &&
                    <div data-source-location="components/assignment/AutoAssignDialog:135:26" data-dynamic-content="true" className="flex items-center gap-1">
                            <MapPin data-source-location="components/assignment/AutoAssignDialog:136:28" data-dynamic-content="false" className="w-3 h-3" />
                            <span data-source-location="components/assignment/AutoAssignDialog:137:28" data-dynamic-content="true">{tech.distance.toFixed(1)} km away</span>
                          </div>
                    }
                      </div>

                      {tech.matchReasons && tech.matchReasons.length > 0 &&
                  <div data-source-location="components/assignment/AutoAssignDialog:143:24" data-dynamic-content="true" className="flex flex-wrap gap-1">
                          {tech.matchReasons.map((reason, idx) =>
                    <span data-source-location="components/assignment/AutoAssignDialog:145:28" data-dynamic-content="true"
                    key={idx}
                    className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">

                              <CheckCircle data-source-location="components/assignment/AutoAssignDialog:149:30" data-dynamic-content="false" className="w-3 h-3" />
                              {reason}
                            </span>
                    )}
                        </div>
                  }
                    </div>
                  </div>
                </button>
            )
            }
          </div>
        </div>

        <DialogFooter data-source-location="components/assignment/AutoAssignDialog:163:8" data-dynamic-content="true">
          <Button data-source-location="components/assignment/AutoAssignDialog:164:10" data-dynamic-content="false" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button data-source-location="components/assignment/AutoAssignDialog:167:10" data-dynamic-content="false"
          onClick={handleAutoAssign}
          disabled={rankedTechnicians.length === 0 || assignMutation.isPending}
          className="bg-emerald-600 hover:bg-emerald-700">

            <Sparkles data-source-location="components/assignment/AutoAssignDialog:172:12" data-dynamic-content="false" className="w-4 h-4 mr-2" />
            Auto-Assign Best Match
          </Button>
          <Button data-source-location="components/assignment/AutoAssignDialog:175:10" data-dynamic-content="false"
          onClick={handleAssign}
          disabled={!selectedTechId || assignMutation.isPending}>

            Assign Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);

}