import React, { useState } from 'react';
import { serviceRequestService, technicianService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  User,
  Plus,
  Droplets } from
'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle } from
"@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import PageHeader from '@/components/common/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { toast } from 'sonner';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  addWeeks,
  subWeeks,
  isToday,
  parseISO } from
'date-fns';

const timeSlots = [
'08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM',
'12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM',
'04:00 PM', '05:00 PM'];


export default function Scheduling() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    date: null,
    timeSlot: '',
    technicianId: ''
  });

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['serviceRequests'],
    queryFn: () => serviceRequestService.list('created_at', 'desc', 200)
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => technicianService.filter({ status: 'active' })
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => serviceRequestService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
      setShowScheduleDialog(false);
      setSelectedRequest(null);
      toast.success('Job scheduled successfully');
    }
  });

  // Filter unscheduled and scheduled requests
  const unscheduledRequests = requests.filter((r) => r.status === 'new' && !r.scheduled_date);

  const scheduledJobs = requests.filter((r) => r.scheduled_date);

  const getJobsForDay = (date) => {
    return scheduledJobs.filter((job) => {
      if (!job.scheduled_date) return false;
      return isSameDay(parseISO(job.scheduled_date), date);
    });
  };

  const getJobsForTimeSlot = (date, timeSlot) => {
    return getJobsForDay(date).filter((job) => job.scheduled_time_slot === timeSlot);
  };

  const getTechnicianJobs = (techId, date) => {
    return getJobsForDay(date).filter((job) => job.assigned_technician_id === techId);
  };

  const handleSchedule = () => {
    if (!selectedRequest || !scheduleForm.date || !scheduleForm.timeSlot) {
      toast.error('Please select date and time');
      return;
    }

    const tech = technicians.find((t) => t.id === scheduleForm.technicianId);

    updateMutation.mutate({
      id: selectedRequest.id,
      data: {
        scheduled_date: format(scheduleForm.date, 'yyyy-MM-dd'),
        scheduled_time_slot: scheduleForm.timeSlot,
        assigned_technician_id: scheduleForm.technicianId || null,
        assigned_technician_name: tech?.name || null,
        status: scheduleForm.technicianId ? 'assigned' : 'scheduled'
      }
    });
  };

  const openScheduleDialog = (request) => {
    setSelectedRequest(request);
    setScheduleForm({
      date: request.scheduled_date ? parseISO(request.scheduled_date) : selectedDate,
      timeSlot: request.scheduled_time_slot || '',
      technicianId: request.assigned_technician_id || ''
    });
    setShowScheduleDialog(true);
  };

  if (requestsLoading) {
    return (
      <div data-source-location="pages/Scheduling:144:6" data-dynamic-content="false" className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner data-source-location="pages/Scheduling:145:8" data-dynamic-content="false" size="lg" text="Loading schedule..." />
      </div>);

  }

  return (
    <div data-source-location="pages/Scheduling:151:4" data-dynamic-content="true" className="space-y-6">
      <PageHeader data-source-location="pages/Scheduling:152:6" data-dynamic-content="false"
      title="Scheduling"
      subtitle="Manage appointments and technician assignments" />


      <div data-source-location="pages/Scheduling:157:6" data-dynamic-content="true" className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Calendar Sidebar */}
        <div data-source-location="pages/Scheduling:159:8" data-dynamic-content="true" className="xl:col-span-1 space-y-4">
          {/* Mini Calendar */}
          <Card data-source-location="pages/Scheduling:161:10" data-dynamic-content="true">
            <CardContent data-source-location="pages/Scheduling:162:12" data-dynamic-content="true" className="p-4">
              <Calendar data-source-location="pages/Scheduling:163:14" data-dynamic-content="false"
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (date) {
                  setSelectedDate(date);
                  setCurrentDate(date);
                }
              }}
              className="rounded-md" />

            </CardContent>
          </Card>

          {/* Unscheduled Requests */}
          <Card data-source-location="pages/Scheduling:178:10" data-dynamic-content="true">
            <CardHeader data-source-location="pages/Scheduling:179:12" data-dynamic-content="true" className="pb-2">
              <CardTitle data-source-location="pages/Scheduling:180:14" data-dynamic-content="true" className="text-base flex items-center justify-between">
                Unscheduled Jobs
                <Badge data-source-location="pages/Scheduling:182:16" data-dynamic-content="true" variant="secondary">{unscheduledRequests.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent data-source-location="pages/Scheduling:185:12" data-dynamic-content="true" className="space-y-2 max-h-[300px] overflow-y-auto">
              {unscheduledRequests.map((request) =>
              <motion.div data-source-location="pages/Scheduling:187:16" data-dynamic-content="true"
              key={request.id}
              whileHover={{ scale: 1.02 }}
              className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => openScheduleDialog(request)}
              draggable>

                  <div data-source-location="pages/Scheduling:194:18" data-dynamic-content="true" className="flex items-center gap-2 mb-1">
                    <span data-source-location="pages/Scheduling:195:20" data-dynamic-content="true" className="text-sm font-medium">#{request.request_number}</span>
                    <StatusBadge data-source-location="pages/Scheduling:196:20" data-dynamic-content="false" status={request.priority} size="xs" />
                  </div>
                  <p data-source-location="pages/Scheduling:198:18" data-dynamic-content="true" className="text-sm text-gray-600 truncate">{request.client_name}</p>
                  <p data-source-location="pages/Scheduling:199:18" data-dynamic-content="true" className="text-xs text-gray-500">{request.irrigation_type}</p>
                </motion.div>
              )}
              {unscheduledRequests.length === 0 &&
              <p data-source-location="pages/Scheduling:203:16" data-dynamic-content="false" className="text-sm text-gray-500 text-center py-4">No pending jobs</p>
              }
            </CardContent>
          </Card>

          {/* Technician Availability */}
          <Card data-source-location="pages/Scheduling:209:10" data-dynamic-content="true">
            <CardHeader data-source-location="pages/Scheduling:210:12" data-dynamic-content="false" className="pb-2">
              <CardTitle data-source-location="pages/Scheduling:211:14" data-dynamic-content="false" className="text-base">Technician Availability</CardTitle>
            </CardHeader>
            <CardContent data-source-location="pages/Scheduling:213:12" data-dynamic-content="true" className="space-y-2">
              {technicians.slice(0, 5).map((tech) => {
                const dayJobs = getTechnicianJobs(tech.id, selectedDate);
                return (
                  <div data-source-location="pages/Scheduling:217:18" data-dynamic-content="true" key={tech.id} className="flex items-center justify-between py-2">
                    <div data-source-location="pages/Scheduling:218:20" data-dynamic-content="true" className="flex items-center gap-2">
                      <Avatar data-source-location="pages/Scheduling:219:22" data-dynamic-content="true" className="h-8 w-8">
                        <AvatarFallback data-source-location="pages/Scheduling:220:24" data-dynamic-content="true" className="bg-emerald-100 text-emerald-700 text-xs">
                          {tech.name?.split(' ').map((n) => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div data-source-location="pages/Scheduling:224:22" data-dynamic-content="true">
                        <p data-source-location="pages/Scheduling:225:24" data-dynamic-content="true" className="text-sm font-medium">{tech.name}</p>
                        <p data-source-location="pages/Scheduling:226:24" data-dynamic-content="true" className="text-xs text-gray-500">{dayJobs.length} jobs</p>
                      </div>
                    </div>
                    <StatusBadge data-source-location="pages/Scheduling:229:20" data-dynamic-content="false" status={tech.availability_status} size="xs" />
                  </div>);

              })}
            </CardContent>
          </Card>
        </div>

        {/* Week View */}
        <Card data-source-location="pages/Scheduling:238:8" data-dynamic-content="true" className="xl:col-span-3">
          <CardHeader data-source-location="pages/Scheduling:239:10" data-dynamic-content="true" className="pb-4">
            <div data-source-location="pages/Scheduling:240:12" data-dynamic-content="true" className="flex items-center justify-between">
              <div data-source-location="pages/Scheduling:241:14" data-dynamic-content="true" className="flex items-center gap-4">
                <Button data-source-location="pages/Scheduling:242:16" data-dynamic-content="false"
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate(subWeeks(currentDate, 1))}>

                  <ChevronLeft data-source-location="pages/Scheduling:247:18" data-dynamic-content="false" className="w-4 h-4" />
                </Button>
                <h2 data-source-location="pages/Scheduling:249:16" data-dynamic-content="true" className="text-lg font-semibold">
                  {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
                </h2>
                <Button data-source-location="pages/Scheduling:252:16" data-dynamic-content="false"
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate(addWeeks(currentDate, 1))}>

                  <ChevronRight data-source-location="pages/Scheduling:257:18" data-dynamic-content="false" className="w-4 h-4" />
                </Button>
              </div>
              <Button data-source-location="pages/Scheduling:260:14" data-dynamic-content="false"
              variant="outline"
              onClick={() => setCurrentDate(new Date())}>

                Today
              </Button>
            </div>
          </CardHeader>
          <CardContent data-source-location="pages/Scheduling:268:10" data-dynamic-content="true" className="p-0 overflow-x-auto">
            <div data-source-location="pages/Scheduling:269:12" data-dynamic-content="true" className="min-w-[800px]">
              {/* Header */}
              <div data-source-location="pages/Scheduling:271:14" data-dynamic-content="true" className="grid grid-cols-8 border-b">
                <div data-source-location="pages/Scheduling:272:16" data-dynamic-content="false" className="p-3 border-r bg-gray-50">
                  <span data-source-location="pages/Scheduling:273:18" data-dynamic-content="false" className="text-xs font-medium text-gray-500">Time</span>
                </div>
                {weekDays.map((day) =>
                <div data-source-location="pages/Scheduling:276:18" data-dynamic-content="true"
                key={day.toISOString()}
                className={`p-3 text-center border-r ${
                isSameDay(day, selectedDate) ? 'bg-emerald-50' :
                isToday(day) ? 'bg-blue-50' : ''}`
                }
                onClick={() => setSelectedDate(day)}>

                    <p data-source-location="pages/Scheduling:284:20" data-dynamic-content="true" className="text-xs text-gray-500 uppercase">{format(day, 'EEE')}</p>
                    <p data-source-location="pages/Scheduling:285:20" data-dynamic-content="true" className={`text-lg font-semibold ${
                  isToday(day) ? 'text-blue-600' :
                  isSameDay(day, selectedDate) ? 'text-emerald-600' : 'text-gray-900'}`
                  }>
                      {format(day, 'd')}
                    </p>
                    <p data-source-location="pages/Scheduling:291:20" data-dynamic-content="true" className="text-xs text-gray-500">{getJobsForDay(day).length} jobs</p>
                  </div>
                )}
              </div>

              {/* Time Slots */}
              <div data-source-location="pages/Scheduling:297:14" data-dynamic-content="true" className="max-h-[500px] overflow-y-auto">
                {timeSlots.map((timeSlot) =>
                <div data-source-location="pages/Scheduling:299:18" data-dynamic-content="true" key={timeSlot} className="grid grid-cols-8 border-b hover:bg-gray-50/50">
                    <div data-source-location="pages/Scheduling:300:20" data-dynamic-content="true" className="p-2 border-r bg-gray-50 text-xs font-medium text-gray-500">
                      {timeSlot}
                    </div>
                    {weekDays.map((day) => {
                    const jobs = getJobsForTimeSlot(day, timeSlot);
                    return (
                      <div data-source-location="pages/Scheduling:306:24" data-dynamic-content="true"
                      key={`${day.toISOString()}-${timeSlot}`}
                      className="p-1 border-r min-h-[60px] cursor-pointer hover:bg-emerald-50/50"
                      onClick={() => {
                        setSelectedDate(day);
                        setScheduleForm((prev) => ({ ...prev, date: day, timeSlot }));
                      }}>

                          {jobs.map((job) =>
                        <motion.div data-source-location="pages/Scheduling:315:28" data-dynamic-content="true"
                        key={job.id}
                        whileHover={{ scale: 1.02 }}
                        className={`p-1.5 rounded text-xs mb-1 cursor-pointer ${
                        job.priority === 'urgent' ? 'bg-red-100 border-l-2 border-red-500' :
                        job.priority === 'high' ? 'bg-orange-100 border-l-2 border-orange-500' :
                        'bg-blue-100 border-l-2 border-blue-500'}`
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          openScheduleDialog(job);
                        }}>

                              <p data-source-location="pages/Scheduling:328:30" data-dynamic-content="true" className="font-medium truncate">{job.client_name}</p>
                              <div data-source-location="pages/Scheduling:329:30" data-dynamic-content="true" className="flex items-center gap-1 text-gray-600">
                                <Droplets data-source-location="pages/Scheduling:330:32" data-dynamic-content="false" className="w-3 h-3" />
                                <span data-source-location="pages/Scheduling:331:32" data-dynamic-content="true" className="truncate">{job.irrigation_type}</span>
                              </div>
                              {job.assigned_technician_name &&
                          <div data-source-location="pages/Scheduling:334:32" data-dynamic-content="true" className="flex items-center gap-1 text-gray-500">
                                  <User data-source-location="pages/Scheduling:335:34" data-dynamic-content="false" className="w-3 h-3" />
                                  <span data-source-location="pages/Scheduling:336:34" data-dynamic-content="true" className="truncate">{job.assigned_technician_name}</span>
                                </div>
                          }
                            </motion.div>
                        )}
                        </div>);

                  })}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schedule Dialog */}
      <Dialog data-source-location="pages/Scheduling:353:6" data-dynamic-content="true" open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent data-source-location="pages/Scheduling:354:8" data-dynamic-content="true" className="max-w-lg">
          <DialogHeader data-source-location="pages/Scheduling:355:10" data-dynamic-content="true">
            <DialogTitle data-source-location="pages/Scheduling:356:12" data-dynamic-content="false">Schedule Job</DialogTitle>
            <DialogDescription data-source-location="pages/Scheduling:357:12" data-dynamic-content="true">
              {selectedRequest && `#${selectedRequest.request_number} - ${selectedRequest.client_name}`}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest &&
          <div data-source-location="pages/Scheduling:363:12" data-dynamic-content="true" className="space-y-4">
              {/* Job Summary */}
              <div data-source-location="pages/Scheduling:365:14" data-dynamic-content="true" className="p-4 bg-gray-50 rounded-lg">
                <div data-source-location="pages/Scheduling:366:16" data-dynamic-content="true" className="flex items-center gap-2 mb-2">
                  <StatusBadge data-source-location="pages/Scheduling:367:18" data-dynamic-content="false" status={selectedRequest.status} />
                  <StatusBadge data-source-location="pages/Scheduling:368:18" data-dynamic-content="false" status={selectedRequest.priority} />
                </div>
                <p data-source-location="pages/Scheduling:370:16" data-dynamic-content="true" className="text-sm text-gray-600 mb-1">
                  <strong data-source-location="pages/Scheduling:371:18" data-dynamic-content="false">Farm:</strong> {selectedRequest.farm_name}
                </p>
                <p data-source-location="pages/Scheduling:373:16" data-dynamic-content="true" className="text-sm text-gray-600 mb-1">
                  <strong data-source-location="pages/Scheduling:374:18" data-dynamic-content="false">Issue:</strong> {selectedRequest.issue_category?.replace(/_/g, ' ')}
                </p>
                <p data-source-location="pages/Scheduling:376:16" data-dynamic-content="true" className="text-sm text-gray-600">
                  <strong data-source-location="pages/Scheduling:377:18" data-dynamic-content="false">Type:</strong> {selectedRequest.irrigation_type?.replace(/_/g, ' ')}
                </p>
              </div>

              {/* Date Selection */}
              <div data-source-location="pages/Scheduling:382:14" data-dynamic-content="true">
                <label data-source-location="pages/Scheduling:383:16" data-dynamic-content="false" className="text-sm font-medium mb-2 block">Select Date</label>
                <Calendar data-source-location="pages/Scheduling:384:16" data-dynamic-content="false"
              mode="single"
              selected={scheduleForm.date}
              onSelect={(date) => setScheduleForm((prev) => ({ ...prev, date }))}
              className="rounded-md border"
              disabled={(date) => date < new Date()} />

              </div>

              {/* Time Slot */}
              <div data-source-location="pages/Scheduling:394:14" data-dynamic-content="true">
                <label data-source-location="pages/Scheduling:395:16" data-dynamic-content="false" className="text-sm font-medium mb-2 block">Time Slot</label>
                <Select data-source-location="pages/Scheduling:396:16" data-dynamic-content="true"
              value={scheduleForm.timeSlot}
              onValueChange={(v) => setScheduleForm((prev) => ({ ...prev, timeSlot: v }))}>

                  <SelectTrigger data-source-location="pages/Scheduling:400:18" data-dynamic-content="false">
                    <SelectValue data-source-location="pages/Scheduling:401:20" data-dynamic-content="false" placeholder="Select time..." />
                  </SelectTrigger>
                  <SelectContent data-source-location="pages/Scheduling:403:18" data-dynamic-content="true">
                    {timeSlots.map((slot) =>
                  <SelectItem data-source-location="pages/Scheduling:405:22" data-dynamic-content="true" key={slot} value={slot}>{slot}</SelectItem>
                  )}
                  </SelectContent>
                </Select>
              </div>

              {/* Technician Assignment */}
              <div data-source-location="pages/Scheduling:412:14" data-dynamic-content="true">
                <label data-source-location="pages/Scheduling:413:16" data-dynamic-content="false" className="text-sm font-medium mb-2 block">Assign Technician (Optional)</label>
                <Select data-source-location="pages/Scheduling:414:16" data-dynamic-content="true"
              value={scheduleForm.technicianId}
              onValueChange={(v) => setScheduleForm((prev) => ({ ...prev, technicianId: v }))}>

                  <SelectTrigger data-source-location="pages/Scheduling:418:18" data-dynamic-content="false">
                    <SelectValue data-source-location="pages/Scheduling:419:20" data-dynamic-content="false" placeholder="Select technician..." />
                  </SelectTrigger>
                  <SelectContent data-source-location="pages/Scheduling:421:18" data-dynamic-content="true">
                    <SelectItem data-source-location="pages/Scheduling:422:20" data-dynamic-content="false" value={null}>Unassigned</SelectItem>
                    {technicians.map((tech) =>
                  <SelectItem data-source-location="pages/Scheduling:424:22" data-dynamic-content="true" key={tech.id} value={tech.id}>
                        {tech.name} ({tech.employee_id})
                      </SelectItem>
                  )}
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
              <div data-source-location="pages/Scheduling:433:14" data-dynamic-content="true" className="flex gap-3 pt-4">
                <Button data-source-location="pages/Scheduling:434:16" data-dynamic-content="false"
              variant="outline"
              className="flex-1"
              onClick={() => setShowScheduleDialog(false)}>

                  Cancel
                </Button>
                <Button data-source-location="pages/Scheduling:441:16" data-dynamic-content="true"
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleSchedule}
              disabled={updateMutation.isPending}>

                  {updateMutation.isPending ? 'Scheduling...' : 'Confirm Schedule'}
                </Button>
              </div>
            </div>
          }
        </DialogContent>
      </Dialog>
    </div>);

}