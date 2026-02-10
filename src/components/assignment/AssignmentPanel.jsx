import React, { useState } from 'react';
import { technicianService, serviceRequestService, notificationService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import { UserCheck, Sparkles, X } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import { toast } from 'sonner';

export default function AssignmentPanel({ serviceRequest, onClose }) {
  const [selectedTechId, setSelectedTechId] = useState(
    serviceRequest.assigned_technician_id || ''
  );
  const queryClient = useQueryClient();

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => technicianService.list().then(techs => techs.filter(t => t.status === 'active'))
  });

  const assignMutation = useMutation({
    mutationFn: async (technicianId) => {
      const technician = technicians.find((t) => t.id === technicianId);
      const updatedRequest = await serviceRequestService.update(serviceRequest.id, {
        assigned_technician_id: technicianId,
        assigned_technician_name: technician?.name,
        status: serviceRequest.status === 'new' ? 'assigned' : serviceRequest.status
      });

      // Create notification for technician
      if (technician?.user_id) {
        await notificationService.create({
          user_id: technician.user_id,
          title: 'New Job Assigned',
          message: `You have been assigned to SR #${serviceRequest.request_number} - ${serviceRequest.client_name}`,
          type: 'job_assigned',
          link: `/JobDetails?id=${serviceRequest.id}`,
          related_id: serviceRequest.id,
          read: false
        });
      }

      return updatedRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
      queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
      toast.success('Technician assigned successfully!');
      onClose?.();
    }
  });

  const unassignMutation = useMutation({
    mutationFn: () => {
      return serviceRequestService.update(serviceRequest.id, {
        assigned_technician_id: null,
        assigned_technician_name: null,
        status: 'new'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
      queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
      toast.success('Technician unassigned');
      setSelectedTechId('');
    }
  });

  const handleAssign = () => {
    if (selectedTechId) {
      assignMutation.mutate(selectedTechId);
    }
  };

  const handleUnassign = () => {
    unassignMutation.mutate();
  };

  const selectedTech = technicians.find((t) => t.id === selectedTechId);

  return (
    <Card data-source-location="components/assignment/AssignmentPanel:88:4" data-dynamic-content="true">
      <CardHeader data-source-location="components/assignment/AssignmentPanel:89:6" data-dynamic-content="true" className="flex flex-row items-center justify-between">
        <CardTitle data-source-location="components/assignment/AssignmentPanel:90:8" data-dynamic-content="false" className="text-base flex items-center gap-2">
          <UserCheck data-source-location="components/assignment/AssignmentPanel:91:10" data-dynamic-content="false" className="w-5 h-5 text-emerald-600" />
          Assign Technician
        </CardTitle>
        {onClose &&
        <Button data-source-location="components/assignment/AssignmentPanel:95:10" data-dynamic-content="false" variant="ghost" size="icon" onClick={onClose}>
            <X data-source-location="components/assignment/AssignmentPanel:96:12" data-dynamic-content="false" className="w-4 h-4" />
          </Button>
        }
      </CardHeader>
      <CardContent data-source-location="components/assignment/AssignmentPanel:100:6" data-dynamic-content="true" className="space-y-4">
        <div data-source-location="components/assignment/AssignmentPanel:101:8" data-dynamic-content="true">
          <label data-source-location="components/assignment/AssignmentPanel:102:10" data-dynamic-content="false" className="text-sm font-medium text-gray-700 mb-2 block">
            Select Technician
          </label>
          <Select data-source-location="components/assignment/AssignmentPanel:105:10" data-dynamic-content="true" value={selectedTechId} onValueChange={setSelectedTechId}>
            <SelectTrigger data-source-location="components/assignment/AssignmentPanel:106:12" data-dynamic-content="false">
              <SelectValue data-source-location="components/assignment/AssignmentPanel:107:14" data-dynamic-content="false" placeholder="Choose a technician..." />
            </SelectTrigger>
            <SelectContent data-source-location="components/assignment/AssignmentPanel:109:12" data-dynamic-content="true">
              {technicians.map((tech) =>
              <SelectItem data-source-location="components/assignment/AssignmentPanel:111:16" data-dynamic-content="true" key={tech.id} value={tech.id}>
                  <div data-source-location="components/assignment/AssignmentPanel:112:18" data-dynamic-content="true" className="flex items-center gap-2">
                    <span data-source-location="components/assignment/AssignmentPanel:113:20" data-dynamic-content="true">{tech.name}</span>
                    <Badge data-source-location="components/assignment/AssignmentPanel:114:20" data-dynamic-content="true" variant="outline" className="text-xs">
                      {tech.availability_status}
                    </Badge>
                  </div>
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {selectedTech &&
        <div data-source-location="components/assignment/AssignmentPanel:125:10" data-dynamic-content="true" className="p-3 bg-gray-50 rounded-lg">
            <div data-source-location="components/assignment/AssignmentPanel:126:12" data-dynamic-content="true" className="flex items-start gap-3">
              <Avatar data-source-location="components/assignment/AssignmentPanel:127:14" data-dynamic-content="true" className="w-10 h-10">
                <AvatarFallback data-source-location="components/assignment/AssignmentPanel:128:16" data-dynamic-content="true" className="bg-blue-100 text-blue-700">
                  {selectedTech.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div data-source-location="components/assignment/AssignmentPanel:132:14" data-dynamic-content="true" className="flex-1">
                <p data-source-location="components/assignment/AssignmentPanel:133:16" data-dynamic-content="true" className="font-medium text-gray-900">{selectedTech.name}</p>
                <p data-source-location="components/assignment/AssignmentPanel:134:16" data-dynamic-content="true" className="text-xs text-gray-500">{selectedTech.employee_id}</p>
                <div data-source-location="components/assignment/AssignmentPanel:135:16" data-dynamic-content="true" className="flex items-center gap-2 mt-1">
                  <StatusBadge data-source-location="components/assignment/AssignmentPanel:136:18" data-dynamic-content="false" status={selectedTech.availability_status} size="xs" />
                  <span data-source-location="components/assignment/AssignmentPanel:137:18" data-dynamic-content="true" className="text-xs text-gray-600">
                    {selectedTech.jobs_completed} jobs completed
                  </span>
                </div>
                {selectedTech.specializations &&
              <div data-source-location="components/assignment/AssignmentPanel:142:18" data-dynamic-content="true" className="flex flex-wrap gap-1 mt-2">
                    {selectedTech.specializations.slice(0, 3).map((spec, idx) =>
                <span data-source-location="components/assignment/AssignmentPanel:144:22" data-dynamic-content="true"
                key={idx}
                className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">

                        {spec}
                      </span>
                )}
                  </div>
              }
              </div>
            </div>
          </div>
        }

        <div data-source-location="components/assignment/AssignmentPanel:158:8" data-dynamic-content="true" className="flex gap-2">
          <Button data-source-location="components/assignment/AssignmentPanel:159:10" data-dynamic-content="false"
          onClick={handleAssign}
          disabled={!selectedTechId || assignMutation.isPending}
          className="flex-1">

            Assign
          </Button>
          {serviceRequest.assigned_technician_id &&
          <Button data-source-location="components/assignment/AssignmentPanel:167:12" data-dynamic-content="false"
          variant="outline"
          onClick={handleUnassign}
          disabled={unassignMutation.isPending}>

              Unassign
            </Button>
          }
        </div>
      </CardContent>
    </Card>);

}