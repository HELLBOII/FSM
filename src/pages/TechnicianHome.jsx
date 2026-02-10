import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { technicianService, serviceRequestService } from '@/services';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Droplets,
  MapPin,
  Clock,
  ChevronRight,
  Calendar,
  CheckCircle,
  RefreshCw } from
'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';

const irrigationIcons = {
  drip: '💧',
  sprinkler: '🌊',
  center_pivot: '🔄',
  flood: '🌊',
  micro_sprinkler: '💦',
  subsurface: '🌱'
};

export default function TechnicianHome() {
  const { user, isLoading: userLoading } = useAuth();
  const queryClient = useQueryClient();

  const { data: technician, isLoading: isLoadingTechnician } = useQuery({
    queryKey: ['technician', user?.id],
    queryFn: () => technicianService.getByUserId(user?.id),
    enabled: !!user?.id
  });

  const { data: myJobs = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['technicianJobs', technician?.id],
    queryFn: () => technician?.id ? serviceRequestService.getByTechnicianId(technician.id) : [],
    enabled: !!technician?.id
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['technician', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['technicianJobs', technician?.id] });
  };

  const todayJobs = myJobs.filter((job) => {
    if (!job.scheduled_date) return false;
    try {
      return isToday(parseISO(job.scheduled_date));
    } catch (e) {
      return false;
    }
  });

  const upcomingJobs = myJobs.filter((job) =>
  job.scheduled_date && !isToday(parseISO(job.scheduled_date)) &&
  ['scheduled', 'assigned'].includes(job.status)
  ).slice(0, 3);

  const inProgressJob = myJobs.find((job) => job.status === 'in_progress');

  const stats = {
    today: todayJobs.length,
    completed: todayJobs.filter((j) => ['completed', 'approved', 'closed'].includes(j.status)).length,
    pending: todayJobs.filter((j) => ['assigned', 'scheduled'].includes(j.status)).length
  };

  if (userLoading || isLoadingTechnician || requestsLoading) {
    return (
      <div data-source-location="pages/TechnicianHome:92:6" data-dynamic-content="false" className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner data-source-location="pages/TechnicianHome:93:8" data-dynamic-content="false" size="lg" text="Loading..." />
      </div>);
  }

  return (
    <div data-source-location="pages/TechnicianHome:99:4" data-dynamic-content="true" className="p-4 space-y-6 pb-24">
      {/* Welcome Header */}
      <div data-source-location="pages/TechnicianHome:111:6" data-dynamic-content="true" className="flex items-center justify-between">
        <div data-source-location="pages/TechnicianHome:112:8" data-dynamic-content="true" className="flex items-center gap-4">
          <Avatar data-source-location="pages/TechnicianHome:113:10" data-dynamic-content="true" className="h-14 w-14">
            <AvatarImage data-source-location="pages/TechnicianHome:114:12" data-dynamic-content="false" src={user?.avatar_url} />
            <AvatarFallback data-source-location="pages/TechnicianHome:115:12" data-dynamic-content="true" className="bg-gradient-to-br from-emerald-100 to-blue-100 text-emerald-700 text-lg">
              {user?.email?.charAt(0).toUpperCase() || 'T'}
            </AvatarFallback>
          </Avatar>
          <div data-source-location="pages/TechnicianHome:119:10" data-dynamic-content="true">
            <p data-source-location="pages/TechnicianHome:120:12" data-dynamic-content="true" className="text-gray-500 text-sm">Hello Technician,</p>
            <h1 data-source-location="pages/TechnicianHome:121:12" data-dynamic-content="true" className="text-xl font-bold text-gray-900">{user?.email || 'Technician'}</h1>
          </div>
        </div>
        {/* <Button data-source-location="pages/TechnicianHome:124:8" data-dynamic-content="false" variant="outline" size="icon" onClick={handleRefresh}>
          <RefreshCw data-source-location="pages/TechnicianHome:125:10" data-dynamic-content="false" className="w-4 h-4" />
        </Button> */}
      </div>

      {/* Today's Summary */}
      <div data-source-location="pages/TechnicianHome:130:6" data-dynamic-content="true" className="grid grid-cols-3 gap-3">
        <motion.div data-source-location="pages/TechnicianHome:131:8" data-dynamic-content="true"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 rounded-2xl text-white">

          <Calendar data-source-location="pages/TechnicianHome:136:10" data-dynamic-content="false" className="w-6 h-6 mb-2 opacity-80" />
          <p data-source-location="pages/TechnicianHome:137:10" data-dynamic-content="true" className="text-3xl font-bold">{stats.today}</p>
          <p data-source-location="pages/TechnicianHome:138:10" data-dynamic-content="false" className="text-sm opacity-80">Today's Jobs</p>
        </motion.div>

        <motion.div data-source-location="pages/TechnicianHome:141:8" data-dynamic-content="true"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-2xl text-white">

          <Clock data-source-location="pages/TechnicianHome:147:10" data-dynamic-content="false" className="w-6 h-6 mb-2 opacity-80" />
          <p data-source-location="pages/TechnicianHome:148:10" data-dynamic-content="true" className="text-3xl font-bold">{stats.pending}</p>
          <p data-source-location="pages/TechnicianHome:149:10" data-dynamic-content="false" className="text-sm opacity-80">Pending</p>
        </motion.div>

        <motion.div data-source-location="pages/TechnicianHome:152:8" data-dynamic-content="true"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 rounded-2xl text-white">

          <CheckCircle data-source-location="pages/TechnicianHome:158:10" data-dynamic-content="false" className="w-6 h-6 mb-2 opacity-80" />
          <p data-source-location="pages/TechnicianHome:159:10" data-dynamic-content="true" className="text-3xl font-bold">{stats.completed}</p>
          <p data-source-location="pages/TechnicianHome:160:10" data-dynamic-content="false" className="text-sm opacity-80">Completed</p>
        </motion.div>
      </div>

      {/* Current Job (if in progress) */}
      {inProgressJob &&
      <motion.div data-source-location="pages/TechnicianHome:166:8" data-dynamic-content="true"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}>

          <div data-source-location="pages/TechnicianHome:170:10" data-dynamic-content="false" className="flex items-center justify-between mb-3">
            <h2 data-source-location="pages/TechnicianHome:171:12" data-dynamic-content="false" className="text-lg font-semibold text-gray-900">Current Job</h2>
            <span data-source-location="pages/TechnicianHome:172:12" data-dynamic-content="false" className="flex items-center gap-1 text-sm text-emerald-600">
              <span data-source-location="pages/TechnicianHome:173:14" data-dynamic-content="false" className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              In Progress
            </span>
          </div>
          <Link data-source-location="pages/TechnicianHome:177:10" data-dynamic-content="true" to={createPageUrl('JobDetails') + `?id=${inProgressJob.id}`}>
            <Card data-source-location="pages/TechnicianHome:178:12" data-dynamic-content="true" className="border-2 border-emerald-500 bg-emerald-50/50 hover:shadow-lg transition-all">
              <CardContent data-source-location="pages/TechnicianHome:179:14" data-dynamic-content="true" className="p-4">
                <div data-source-location="pages/TechnicianHome:180:16" data-dynamic-content="true" className="flex items-start justify-between">
                  <div data-source-location="pages/TechnicianHome:181:18" data-dynamic-content="true" className="flex-1">
                    <div data-source-location="pages/TechnicianHome:182:20" data-dynamic-content="true" className="flex items-center gap-2 mb-2">
                      <span data-source-location="pages/TechnicianHome:183:22" data-dynamic-content="true" className="text-2xl">{irrigationIcons[inProgressJob.irrigation_type] || '💧'}</span>
                      <span data-source-location="pages/TechnicianHome:184:22" data-dynamic-content="true" className="font-semibold text-gray-900">#{inProgressJob.request_number}</span>
                      <StatusBadge data-source-location="pages/TechnicianHome:185:22" data-dynamic-content="false" status={inProgressJob.priority} size="xs" />
                    </div>
                    <h3 data-source-location="pages/TechnicianHome:187:20" data-dynamic-content="true" className="font-semibold text-gray-900 mb-1">{inProgressJob.client_name}</h3>
                    <p data-source-location="pages/TechnicianHome:188:20" data-dynamic-content="true" className="text-sm text-gray-600 mb-2">{inProgressJob.farm_name}</p>
                    <div data-source-location="pages/TechnicianHome:189:20" data-dynamic-content="true" className="flex items-center gap-2 text-sm text-gray-500">
                      <MapPin data-source-location="pages/TechnicianHome:190:22" data-dynamic-content="false" className="w-4 h-4" />
                      <span data-source-location="pages/TechnicianHome:191:22" data-dynamic-content="true" className="truncate">{inProgressJob.location?.address || 'No address'}</span>
                    </div>
                  </div>
                  <ChevronRight data-source-location="pages/TechnicianHome:194:18" data-dynamic-content="false" className="w-6 h-6 text-emerald-500" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      }

      {/* Today's Jobs */}
      <div data-source-location="pages/TechnicianHome:203:6" data-dynamic-content="true">
        <div data-source-location="pages/TechnicianHome:204:8" data-dynamic-content="true" className="flex items-center justify-between mb-3">
          <h2 data-source-location="pages/TechnicianHome:205:10" data-dynamic-content="false" className="text-lg font-semibold text-gray-900">Today's Schedule</h2>
          <Link data-source-location="pages/TechnicianHome:206:10" data-dynamic-content="false" to={createPageUrl('TechnicianJobs')} className="text-sm text-emerald-600 font-medium">
            View All
          </Link>
        </div>

        {todayJobs.length === 0 ?
        <Card data-source-location="pages/TechnicianHome:212:10" data-dynamic-content="false">
            <CardContent data-source-location="pages/TechnicianHome:213:12" data-dynamic-content="false" className="p-8 text-center">
              <CheckCircle data-source-location="pages/TechnicianHome:214:14" data-dynamic-content="false" className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
              <p data-source-location="pages/TechnicianHome:215:14" data-dynamic-content="false" className="text-gray-600">No jobs scheduled for today</p>
            </CardContent>
          </Card> :

        <div data-source-location="pages/TechnicianHome:219:10" data-dynamic-content="true" className="space-y-3">
            {todayJobs.filter((j) => j.id !== inProgressJob?.id).slice(0, 4).map((job, idx) =>
          <motion.div data-source-location="pages/TechnicianHome:221:14" data-dynamic-content="true"
          key={job.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.1 }}>

                <Link data-source-location="pages/TechnicianHome:227:16" data-dynamic-content="true" to={createPageUrl('JobDetails') + `?id=${job.id}`}>
                  <Card data-source-location="pages/TechnicianHome:228:18" data-dynamic-content="true" className="hover:shadow-md transition-all active:scale-[0.99]">
                    <CardContent data-source-location="pages/TechnicianHome:229:20" data-dynamic-content="true" className="p-4">
                      <div data-source-location="pages/TechnicianHome:230:22" data-dynamic-content="true" className="flex items-center justify-between">
                        <div data-source-location="pages/TechnicianHome:231:24" data-dynamic-content="true" className="flex items-center gap-3">
                          <div data-source-location="pages/TechnicianHome:232:26" data-dynamic-content="true" className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-emerald-100 flex items-center justify-center text-xl">
                            {irrigationIcons[job.irrigation_type] || '💧'}
                          </div>
                          <div data-source-location="pages/TechnicianHome:235:26" data-dynamic-content="true">
                            <div data-source-location="pages/TechnicianHome:236:28" data-dynamic-content="true" className="flex items-center gap-2 mb-0.5">
                              <span data-source-location="pages/TechnicianHome:237:30" data-dynamic-content="true" className="font-semibold text-gray-900">{job.client_name}</span>
                              <StatusBadge data-source-location="pages/TechnicianHome:238:30" data-dynamic-content="false" status={job.status} size="xs" />
                            </div>
                            <p data-source-location="pages/TechnicianHome:240:28" data-dynamic-content="true" className="text-sm text-gray-500">
                              {job.scheduled_time_slot || 'No time set'} • {job.issue_category?.replace(/_/g, ' ')}
                            </p>
                          </div>
                        </div>
                        <ChevronRight data-source-location="pages/TechnicianHome:245:24" data-dynamic-content="false" className="w-5 h-5 text-gray-400" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
          )}
          </div>
        }
      </div>

      {/* Upcoming Jobs */}
      {upcomingJobs.length > 0 &&
      <div data-source-location="pages/TechnicianHome:258:8" data-dynamic-content="true">
          <h2 data-source-location="pages/TechnicianHome:259:10" data-dynamic-content="false" className="text-lg font-semibold text-gray-900 mb-3">Upcoming</h2>
          <div data-source-location="pages/TechnicianHome:260:10" data-dynamic-content="true" className="space-y-2">
            {upcomingJobs.map((job) =>
          <Link data-source-location="pages/TechnicianHome:262:14" data-dynamic-content="true" key={job.id} to={createPageUrl('JobDetails') + `?id=${job.id}`}>
                <div data-source-location="pages/TechnicianHome:263:16" data-dynamic-content="true" className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div data-source-location="pages/TechnicianHome:264:18" data-dynamic-content="true" className="flex items-center gap-3">
                    <div data-source-location="pages/TechnicianHome:265:20" data-dynamic-content="true" className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-lg border">
                      {irrigationIcons[job.irrigation_type] || '💧'}
                    </div>
                    <div data-source-location="pages/TechnicianHome:268:20" data-dynamic-content="true">
                      <p data-source-location="pages/TechnicianHome:269:22" data-dynamic-content="true" className="font-medium text-gray-900">{job.client_name}</p>
                      <p data-source-location="pages/TechnicianHome:270:22" data-dynamic-content="true" className="text-xs text-gray-500">
                        {job.scheduled_date && (
                    isTomorrow(parseISO(job.scheduled_date)) ?
                    'Tomorrow' :
                    format(parseISO(job.scheduled_date), 'EEE, MMM d'))
                    }
                        {job.scheduled_time_slot && ` • ${job.scheduled_time_slot}`}
                      </p>
                    </div>
                  </div>
                  <StatusBadge data-source-location="pages/TechnicianHome:280:18" data-dynamic-content="false" status={job.priority} size="xs" />
                </div>
              </Link>
          )}
          </div>
        </div>
      }
    </div>);

}