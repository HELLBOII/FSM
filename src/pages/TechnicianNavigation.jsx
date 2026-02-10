import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { serviceRequestService, technicianService } from '@/services';
import { useQuery } from '@tanstack/react-query';
import {
  MapPin,
  Navigation,
  Phone,
  Clock,
  ExternalLink,
  ChevronRight } from
'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import TechnicianMap from '@/components/map/TechnicianMap';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { format, parseISO, isToday } from 'date-fns';

const irrigationIcons = {
  drip: '💧',
  sprinkler: '🌊',
  center_pivot: '🔄',
  flood: '🌊',
  micro_sprinkler: '💦',
  subsurface: '🌱'
};

export default function TechnicianNavigation() {
  const [selectedJob, setSelectedJob] = useState(null);

  const { user } = useAuth();

  const { data: technician, isLoading: isLoadingTechnician } = useQuery({
    queryKey: ['technician', user?.id],
    queryFn: () => technicianService.getByUserId(user?.id),
    enabled: !!user?.id
  });

  const { data: requests = [], isLoading: isLoadingJobs } = useQuery({
    queryKey: ['technicianJobs', technician?.id],
    queryFn: () => technician?.id ? serviceRequestService.getByTechnicianId(technician.id) : [],
    enabled: !!technician?.id
  });

  // Filter jobs assigned to this technician that have location
  // Check if location is an object with lat/lng or if it's stored differently
  const myJobs = requests.filter((r) => {
    const hasLocation = r.location && (
      (typeof r.location === 'object' && r.location.lat && r.location.lng) ||
      (r.location.lat !== null && r.location.lat !== undefined && 
       r.location.lng !== null && r.location.lng !== undefined)
    );
    return r.assigned_technician_id === technician?.id &&
           hasLocation &&
           ['scheduled', 'assigned', 'in_progress'].includes(r.status);
  });

  const todayJobs = myJobs.filter((job) =>
  job.scheduled_date && isToday(parseISO(job.scheduled_date))
  );

  const openNavigation = (job) => {
    if (job?.location?.lat && job?.location?.lng) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${job.location.lat},${job.location.lng}`;
      window.open(url, '_blank');
    }
  };

  if (isLoadingTechnician || isLoadingJobs) {
    return (
      <div data-source-location="pages/TechnicianNavigation:63:6" data-dynamic-content="false" className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner data-source-location="pages/TechnicianNavigation:64:8" data-dynamic-content="false" size="lg" text="Loading map..." />
      </div>);
  }

  return (
    <div data-source-location="pages/TechnicianNavigation:70:4" data-dynamic-content="true" className="h-[calc(100vh-140px)] flex flex-col">
      {/* Map */}
      <div data-source-location="pages/TechnicianNavigation:72:6" data-dynamic-content="true" className="flex-1 relative">
        <TechnicianMap data-source-location="pages/TechnicianNavigation:73:8" data-dynamic-content="false"
        jobs={myJobs}
        className="h-full rounded-none"
        onJobClick={(job) => setSelectedJob(job)} />


        {/* Job Count Badge */}
        <div data-source-location="pages/TechnicianNavigation:80:8" data-dynamic-content="true" className="absolute top-4 left-4 bg-white px-4 py-2 rounded-full shadow-lg">
          <span data-source-location="pages/TechnicianNavigation:81:10" data-dynamic-content="true" className="font-semibold text-gray-900">{todayJobs.length}</span>
          <span data-source-location="pages/TechnicianNavigation:82:10" data-dynamic-content="false" className="text-gray-500 ml-1">jobs today</span>
        </div>
      </div>

      {/* Bottom Sheet */}
      <div data-source-location="pages/TechnicianNavigation:87:6" data-dynamic-content="true" className="bg-white border-t rounded-t-3xl shadow-lg">
        <div data-source-location="pages/TechnicianNavigation:88:8" data-dynamic-content="false" className="w-12 h-1 bg-gray-300 rounded-full mx-auto my-3" />
        
        <div data-source-location="pages/TechnicianNavigation:90:8" data-dynamic-content="true" className="px-4 pb-4 max-h-[40vh] overflow-y-auto">
          <h3 data-source-location="pages/TechnicianNavigation:91:10" data-dynamic-content="true" className="font-semibold text-gray-900 mb-3">
            {selectedJob ? 'Selected Job' : 'Today\'s Jobs'}
          </h3>

          {selectedJob ?
          <Card data-source-location="pages/TechnicianNavigation:96:12" data-dynamic-content="true" className="border-2 border-emerald-500">
              <CardContent data-source-location="pages/TechnicianNavigation:97:14" data-dynamic-content="true" className="p-4">
                <div data-source-location="pages/TechnicianNavigation:98:16" data-dynamic-content="true" className="flex items-start gap-3">
                  <div data-source-location="pages/TechnicianNavigation:99:18" data-dynamic-content="true" className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-100 to-blue-100 flex items-center justify-center text-2xl">
                    {irrigationIcons[selectedJob.irrigation_type] || '💧'}
                  </div>
                  <div data-source-location="pages/TechnicianNavigation:102:18" data-dynamic-content="true" className="flex-1">
                    <div data-source-location="pages/TechnicianNavigation:103:20" data-dynamic-content="true" className="flex items-center gap-2 mb-1">
                      <span data-source-location="pages/TechnicianNavigation:104:22" data-dynamic-content="true" className="font-semibold text-gray-900">#{selectedJob.request_number}</span>
                      <StatusBadge data-source-location="pages/TechnicianNavigation:105:22" data-dynamic-content="false" status={selectedJob.status} size="xs" />
                    </div>
                    <h4 data-source-location="pages/TechnicianNavigation:107:20" data-dynamic-content="true" className="font-semibold text-gray-900">{selectedJob.client_name}</h4>
                    <p data-source-location="pages/TechnicianNavigation:108:20" data-dynamic-content="true" className="text-sm text-gray-500">{selectedJob.farm_name}</p>
                    
                    <div data-source-location="pages/TechnicianNavigation:110:20" data-dynamic-content="true" className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                      <MapPin data-source-location="pages/TechnicianNavigation:111:22" data-dynamic-content="false" className="w-4 h-4" />
                      <span data-source-location="pages/TechnicianNavigation:112:22" data-dynamic-content="true" className="truncate">{selectedJob.location?.address}</span>
                    </div>

                    <div data-source-location="pages/TechnicianNavigation:115:20" data-dynamic-content="true" className="flex gap-2 mt-4">
                      <Button data-source-location="pages/TechnicianNavigation:116:22" data-dynamic-content="false"
                    onClick={() => openNavigation(selectedJob)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700">

                        <Navigation data-source-location="pages/TechnicianNavigation:120:24" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                        Navigate
                      </Button>
                      <Link data-source-location="pages/TechnicianNavigation:123:22" data-dynamic-content="false" to={createPageUrl('JobDetails') + `?id=${selectedJob.id}`} className="flex-1">
                        <Button data-source-location="pages/TechnicianNavigation:124:24" data-dynamic-content="false" variant="outline" className="w-full">
                          Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card> :

          <div data-source-location="pages/TechnicianNavigation:134:12" data-dynamic-content="true" className="space-y-2">
              {todayJobs.length === 0 ?
            <p data-source-location="pages/TechnicianNavigation:136:16" data-dynamic-content="false" className="text-center text-gray-500 py-8">No jobs with locations for today</p> :

            todayJobs.map((job) =>
            <Card data-source-location="pages/TechnicianNavigation:139:18" data-dynamic-content="true"
            key={job.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
            job.status === 'in_progress' ? 'border-emerald-500 bg-emerald-50/30' : ''}`
            }
            onClick={() => setSelectedJob(job)}>

                    <CardContent data-source-location="pages/TechnicianNavigation:146:20" data-dynamic-content="true" className="p-3">
                      <div data-source-location="pages/TechnicianNavigation:147:22" data-dynamic-content="true" className="flex items-center gap-3">
                        <div data-source-location="pages/TechnicianNavigation:148:24" data-dynamic-content="true" className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg">
                          {irrigationIcons[job.irrigation_type] || '💧'}
                        </div>
                        <div data-source-location="pages/TechnicianNavigation:151:24" data-dynamic-content="true" className="flex-1 min-w-0">
                          <div data-source-location="pages/TechnicianNavigation:152:26" data-dynamic-content="true" className="flex items-center gap-2">
                            <span data-source-location="pages/TechnicianNavigation:153:28" data-dynamic-content="true" className="font-medium text-gray-900 truncate">{job.client_name}</span>
                            <StatusBadge data-source-location="pages/TechnicianNavigation:154:28" data-dynamic-content="false" status={job.status} size="xs" />
                          </div>
                          <p data-source-location="pages/TechnicianNavigation:156:26" data-dynamic-content="true" className="text-sm text-gray-500 truncate">{job.location?.address}</p>
                        </div>
                        <Button data-source-location="pages/TechnicianNavigation:158:24" data-dynamic-content="false"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    openNavigation(job);
                  }}>

                          <Navigation data-source-location="pages/TechnicianNavigation:166:26" data-dynamic-content="false" className="w-5 h-5 text-blue-600" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
            )
            }
            </div>
          }

          {selectedJob &&
          <Button data-source-location="pages/TechnicianNavigation:177:12" data-dynamic-content="false"
          variant="ghost"
          className="w-full mt-3"
          onClick={() => setSelectedJob(null)}>

              Show All Jobs
            </Button>
          }
        </div>
      </div>
    </div>);

}