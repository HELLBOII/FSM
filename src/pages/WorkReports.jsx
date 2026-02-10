import React, { useState } from 'react';
import { workReportService, serviceRequestService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardCheck,
  Search,
  Filter,
  Check,
  X,
  Eye,
  Image,
  FileText,
  Clock,
  User,
  MapPin,
  ChevronRight,
  Droplets,
  ThumbsUp,
  ThumbsDown,
  MessageSquare } from
'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
  DialogTitle,
  DialogFooter } from
"@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import PageHeader from '@/components/common/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

export default function WorkReports() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('submitted');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['workReports'],
    queryFn: () => workReportService.list('created_at', 'desc')
  });

  const updateReportMutation = useMutation({
    mutationFn: ({ id, data }) => workReportService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workReports'] });
    },
    onError: (error) => {
      toast.error('Failed to update report: ' + error.message);
    }
  });

  const updateRequestMutation = useMutation({
    mutationFn: ({ id, data }) => serviceRequestService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRequests'] });
    },
    onError: (error) => {
      toast.error('Failed to update request: ' + error.message);
    }
  });

  const filteredReports = reports.filter((report) => {
    const matchesSearch = !searchQuery ||
    report.request_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    report.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    report.technician_name?.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === 'submitted') return matchesSearch && report.status === 'submitted';
    if (activeTab === 'approved') return matchesSearch && report.status === 'approved';
    if (activeTab === 'rejected') return matchesSearch && report.status === 'rejected';
    return matchesSearch;
  });

  const handleApprove = async (report) => {
    try {
      // Use the approve method from service
      await workReportService.approve(report.id, 'current_user_id'); // TODO: Replace with actual user ID

      // Update the service request status
      if (report.service_request_id) {
        await updateRequestMutation.mutateAsync({
          id: report.service_request_id,
          data: { status: 'approved' }
        });
      }

      queryClient.invalidateQueries({ queryKey: ['workReports'] });
      toast.success('Report approved successfully');
      setShowDetailDialog(false);
      setSelectedReport(null);
    } catch (error) {
      toast.error('Failed to approve report: ' + error.message);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    await updateReportMutation.mutateAsync({
      id: selectedReport.id,
      data: {
        status: 'rejected',
        rejection_reason: rejectionReason
      }
    });

    // Update service request to rework
    if (selectedReport.service_request_id) {
      await updateRequestMutation.mutateAsync({
        id: selectedReport.service_request_id,
        data: { status: 'rework' }
      });
    }

    toast.success('Report sent back for rework');
    setShowRejectDialog(false);
    setShowDetailDialog(false);
    setSelectedReport(null);
    setRejectionReason('');
  };

  const openReportDetail = (report) => {
    setSelectedReport(report);
    setShowDetailDialog(true);
  };

  const statusCounts = {
    all: reports.length,
    submitted: reports.filter((r) => r.status === 'submitted').length,
    approved: reports.filter((r) => r.status === 'approved').length,
    rejected: reports.filter((r) => r.status === 'rejected').length
  };

  if (isLoading) {
    return (
      <div data-source-location="pages/WorkReports:157:6" data-dynamic-content="false" className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner data-source-location="pages/WorkReports:158:8" data-dynamic-content="false" size="lg" text="Loading reports..." />
      </div>);

  }

  return (
    <div data-source-location="pages/WorkReports:164:4" data-dynamic-content="true" className="space-y-6">
      <PageHeader data-source-location="pages/WorkReports:165:6" data-dynamic-content="false"
      title="Work Reports"
      subtitle="Review and approve completed job reports" />


      {/* Tabs */}
      <Tabs data-source-location="pages/WorkReports:171:6" data-dynamic-content="true" value={activeTab} onValueChange={setActiveTab}>
        <div data-source-location="pages/WorkReports:172:8" data-dynamic-content="true" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList data-source-location="pages/WorkReports:173:10" data-dynamic-content="true" className="bg-gray-100 p-1">
            <TabsTrigger data-source-location="pages/WorkReports:174:12" data-dynamic-content="true" value="submitted" className="data-[state=active]:bg-white">
              Pending Review ({statusCounts.submitted})
            </TabsTrigger>
            <TabsTrigger data-source-location="pages/WorkReports:177:12" data-dynamic-content="true" value="approved" className="data-[state=active]:bg-white">
              Approved ({statusCounts.approved})
            </TabsTrigger>
            <TabsTrigger data-source-location="pages/WorkReports:180:12" data-dynamic-content="true" value="rejected" className="data-[state=active]:bg-white">
              Rejected ({statusCounts.rejected})
            </TabsTrigger>
            <TabsTrigger data-source-location="pages/WorkReports:183:12" data-dynamic-content="true" value="all" className="data-[state=active]:bg-white">
              All ({statusCounts.all})
            </TabsTrigger>
          </TabsList>

          <div data-source-location="pages/WorkReports:188:10" data-dynamic-content="true" className="relative w-full sm:w-64">
            <Search data-source-location="pages/WorkReports:189:12" data-dynamic-content="false" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input data-source-location="pages/WorkReports:190:12" data-dynamic-content="false"
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10" />

          </div>
        </div>
      </Tabs>

      {/* Reports Grid */}
      {filteredReports.length === 0 ?
      <EmptyState data-source-location="pages/WorkReports:202:8" data-dynamic-content="false"
      icon={ClipboardCheck}
      title="No reports found"
      description={activeTab === 'submitted' ? "No reports pending review" : "No matching reports"} /> :


      <div data-source-location="pages/WorkReports:208:8" data-dynamic-content="true" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence data-source-location="pages/WorkReports:209:10" data-dynamic-content="true" mode="popLayout">
            {filteredReports.map((report) =>
          <motion.div data-source-location="pages/WorkReports:211:14" data-dynamic-content="true"
          key={report.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          whileHover={{ y: -2 }}>

                <Card data-source-location="pages/WorkReports:218:16" data-dynamic-content="true"
            className="cursor-pointer hover:shadow-lg transition-all border-l-4"
            style={{
              borderLeftColor: report.status === 'submitted' ? '#3b82f6' :
              report.status === 'approved' ? '#22c55e' : '#ef4444'
            }}
            onClick={() => openReportDetail(report)}>

                  <CardContent data-source-location="pages/WorkReports:226:18" data-dynamic-content="true" className="p-4">
                    <div data-source-location="pages/WorkReports:227:20" data-dynamic-content="true" className="flex items-start justify-between mb-3">
                      <div data-source-location="pages/WorkReports:228:22" data-dynamic-content="true">
                        <div data-source-location="pages/WorkReports:229:24" data-dynamic-content="true" className="flex items-center gap-2 mb-1">
                          <span data-source-location="pages/WorkReports:230:26" data-dynamic-content="true" className="font-semibold text-gray-900">#{report.request_number}</span>
                          <StatusBadge data-source-location="pages/WorkReports:231:26" data-dynamic-content="false" status={report.status} size="xs" />
                        </div>
                        <p data-source-location="pages/WorkReports:233:24" data-dynamic-content="true" className="text-sm text-gray-600">{report.client_name}</p>
                        <p data-source-location="pages/WorkReports:234:24" data-dynamic-content="true" className="text-xs text-gray-500">{report.farm_name}</p>
                      </div>
                      <ChevronRight data-source-location="pages/WorkReports:236:22" data-dynamic-content="false" className="w-5 h-5 text-gray-400" />
                    </div>

                    <div data-source-location="pages/WorkReports:239:20" data-dynamic-content="true" className="flex items-center gap-2 mb-3">
                      <Avatar data-source-location="pages/WorkReports:240:22" data-dynamic-content="true" className="h-7 w-7">
                        <AvatarFallback data-source-location="pages/WorkReports:241:24" data-dynamic-content="true" className="bg-emerald-100 text-emerald-700 text-xs">
                          {report.technician_name?.split(' ').map((n) => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <span data-source-location="pages/WorkReports:245:22" data-dynamic-content="true" className="text-sm text-gray-600">{report.technician_name}</span>
                    </div>

                    <div data-source-location="pages/WorkReports:248:20" data-dynamic-content="true" className="flex items-center justify-between text-xs text-gray-500">
                      <div data-source-location="pages/WorkReports:249:22" data-dynamic-content="true" className="flex items-center gap-3">
                        {report.before_photos?.length > 0 &&
                    <span data-source-location="pages/WorkReports:251:26" data-dynamic-content="true" className="flex items-center gap-1">
                            <Image data-source-location="pages/WorkReports:252:28" data-dynamic-content="false" className="w-3.5 h-3.5" />
                            {report.before_photos.length + (report.after_photos?.length || 0)}
                          </span>
                    }
                        {report.tasks_completed?.length > 0 &&
                    <span data-source-location="pages/WorkReports:257:26" data-dynamic-content="true" className="flex items-center gap-1">
                            <Check data-source-location="pages/WorkReports:258:28" data-dynamic-content="false" className="w-3.5 h-3.5" />
                            {report.tasks_completed.filter((t) => t.completed).length}/{report.tasks_completed.length}
                          </span>
                    }
                      </div>
                      <span data-source-location="pages/WorkReports:263:22" data-dynamic-content="true">
                        {report.created_date && formatDistanceToNow(new Date(report.created_date), { addSuffix: true })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
          )}
          </AnimatePresence>
        </div>
      }

      {/* Report Detail Dialog */}
      <Dialog data-source-location="pages/WorkReports:276:6" data-dynamic-content="true" open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent data-source-location="pages/WorkReports:277:8" data-dynamic-content="true" className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedReport &&
          <>
              <DialogHeader data-source-location="pages/WorkReports:280:14" data-dynamic-content="true">
                <div data-source-location="pages/WorkReports:281:16" data-dynamic-content="true" className="flex items-center justify-between">
                  <div data-source-location="pages/WorkReports:282:18" data-dynamic-content="true">
                    <DialogTitle data-source-location="pages/WorkReports:283:20" data-dynamic-content="true" className="text-xl">
                      Work Report #{selectedReport.request_number}
                    </DialogTitle>
                    <DialogDescription data-source-location="pages/WorkReports:286:20" data-dynamic-content="true">
                      {selectedReport.client_name} • {selectedReport.farm_name}
                    </DialogDescription>
                  </div>
                  <StatusBadge data-source-location="pages/WorkReports:290:18" data-dynamic-content="false" status={selectedReport.status} size="md" />
                </div>
              </DialogHeader>

              <div data-source-location="pages/WorkReports:294:14" data-dynamic-content="true" className="space-y-6">
                {/* Technician & Time Info */}
                <div data-source-location="pages/WorkReports:296:16" data-dynamic-content="true" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card data-source-location="pages/WorkReports:297:18" data-dynamic-content="true">
                    <CardContent data-source-location="pages/WorkReports:298:20" data-dynamic-content="true" className="p-4">
                      <div data-source-location="pages/WorkReports:299:22" data-dynamic-content="true" className="flex items-center gap-3">
                        <Avatar data-source-location="pages/WorkReports:300:24" data-dynamic-content="true" className="h-12 w-12">
                          <AvatarFallback data-source-location="pages/WorkReports:301:26" data-dynamic-content="true" className="bg-emerald-100 text-emerald-700">
                            {selectedReport.technician_name?.split(' ').map((n) => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div data-source-location="pages/WorkReports:305:24" data-dynamic-content="true">
                          <p data-source-location="pages/WorkReports:306:26" data-dynamic-content="true" className="font-semibold text-gray-900">{selectedReport.technician_name}</p>
                          <p data-source-location="pages/WorkReports:307:26" data-dynamic-content="false" className="text-sm text-gray-500">Field Technician</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card data-source-location="pages/WorkReports:313:18" data-dynamic-content="true">
                    <CardContent data-source-location="pages/WorkReports:314:20" data-dynamic-content="true" className="p-4">
                      <div data-source-location="pages/WorkReports:315:22" data-dynamic-content="true" className="grid grid-cols-2 gap-4 text-sm">
                        <div data-source-location="pages/WorkReports:316:24" data-dynamic-content="true">
                          <p data-source-location="pages/WorkReports:317:26" data-dynamic-content="false" className="text-gray-500">Check-in</p>
                          <p data-source-location="pages/WorkReports:318:26" data-dynamic-content="true" className="font-medium">
                            {selectedReport.check_in_time ?
                          format(new Date(selectedReport.check_in_time), 'MMM d, HH:mm') :
                          '-'}
                          </p>
                        </div>
                        <div data-source-location="pages/WorkReports:324:24" data-dynamic-content="true">
                          <p data-source-location="pages/WorkReports:325:26" data-dynamic-content="false" className="text-gray-500">Check-out</p>
                          <p data-source-location="pages/WorkReports:326:26" data-dynamic-content="true" className="font-medium">
                            {selectedReport.check_out_time ?
                          format(new Date(selectedReport.check_out_time), 'MMM d, HH:mm') :
                          '-'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Photos */}
                <div data-source-location="pages/WorkReports:338:16" data-dynamic-content="true" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Before Photos */}
                  <div data-source-location="pages/WorkReports:340:18" data-dynamic-content="true">
                    <h4 data-source-location="pages/WorkReports:341:20" data-dynamic-content="false" className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <Image data-source-location="pages/WorkReports:342:22" data-dynamic-content="false" className="w-4 h-4" />
                      Before Photos
                    </h4>
                    <div data-source-location="pages/WorkReports:345:20" data-dynamic-content="true" className="grid grid-cols-2 gap-2">
                      {selectedReport.before_photos?.length > 0 ?
                    selectedReport.before_photos.map((photo, idx) =>
                    <img data-source-location="pages/WorkReports:348:26" data-dynamic-content="false"
                    key={idx}
                    src={photo}
                    alt={`Before ${idx + 1}`}
                    className="w-full h-32 object-cover rounded-lg border" />

                    ) :

                    <p data-source-location="pages/WorkReports:356:24" data-dynamic-content="false" className="text-sm text-gray-500 col-span-2">No before photos</p>
                    }
                    </div>
                  </div>

                  {/* After Photos */}
                  <div data-source-location="pages/WorkReports:362:18" data-dynamic-content="true">
                    <h4 data-source-location="pages/WorkReports:363:20" data-dynamic-content="false" className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <Image data-source-location="pages/WorkReports:364:22" data-dynamic-content="false" className="w-4 h-4" />
                      After Photos
                    </h4>
                    <div data-source-location="pages/WorkReports:367:20" data-dynamic-content="true" className="grid grid-cols-2 gap-2">
                      {selectedReport.after_photos?.length > 0 ?
                    selectedReport.after_photos.map((photo, idx) =>
                    <img data-source-location="pages/WorkReports:370:26" data-dynamic-content="false"
                    key={idx}
                    src={photo}
                    alt={`After ${idx + 1}`}
                    className="w-full h-32 object-cover rounded-lg border" />

                    ) :

                    <p data-source-location="pages/WorkReports:378:24" data-dynamic-content="false" className="text-sm text-gray-500 col-span-2">No after photos</p>
                    }
                    </div>
                  </div>
                </div>

                {/* Tasks Completed */}
                {selectedReport.tasks_completed?.length > 0 &&
              <div data-source-location="pages/WorkReports:386:18" data-dynamic-content="true">
                    <h4 data-source-location="pages/WorkReports:387:20" data-dynamic-content="false" className="font-medium text-gray-900 mb-2">Tasks Completed</h4>
                    <div data-source-location="pages/WorkReports:388:20" data-dynamic-content="true" className="space-y-2">
                      {selectedReport.tasks_completed.map((task, idx) =>
                  <div data-source-location="pages/WorkReports:390:24" data-dynamic-content="true"
                  key={idx}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                  task.completed ? 'bg-green-50' : 'bg-gray-50'}`
                  }>

                          <div data-source-location="pages/WorkReports:396:26" data-dynamic-content="true" className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    task.completed ? 'bg-green-500' : 'bg-gray-300'}`
                    }>
                            {task.completed && <Check data-source-location="pages/WorkReports:399:47" data-dynamic-content="false" className="w-3 h-3 text-white" />}
                          </div>
                          <div data-source-location="pages/WorkReports:401:26" data-dynamic-content="true" className="flex-1">
                            <p data-source-location="pages/WorkReports:402:28" data-dynamic-content="true" className="font-medium text-gray-900">{task.task}</p>
                            {task.notes && <p data-source-location="pages/WorkReports:403:43" data-dynamic-content="true" className="text-sm text-gray-500">{task.notes}</p>}
                          </div>
                        </div>
                  )}
                    </div>
                  </div>
              }

                {/* Equipment Used */}
                {selectedReport.equipment_used?.length > 0 &&
              <div data-source-location="pages/WorkReports:413:18" data-dynamic-content="true">
                    <h4 data-source-location="pages/WorkReports:414:20" data-dynamic-content="false" className="font-medium text-gray-900 mb-2">Equipment & Materials Used</h4>
                    <div data-source-location="pages/WorkReports:415:20" data-dynamic-content="true" className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {selectedReport.equipment_used.map((item, idx) =>
                  <div data-source-location="pages/WorkReports:417:24" data-dynamic-content="true" key={idx} className="p-3 bg-gray-50 rounded-lg">
                          <p data-source-location="pages/WorkReports:418:26" data-dynamic-content="true" className="font-medium text-gray-900">{item.name}</p>
                          <p data-source-location="pages/WorkReports:419:26" data-dynamic-content="true" className="text-sm text-gray-500">{item.quantity} {item.unit}</p>
                        </div>
                  )}
                    </div>
                  </div>
              }

                {/* Readings */}
                <div data-source-location="pages/WorkReports:427:16" data-dynamic-content="true" className="grid grid-cols-2 gap-4">
                  {selectedReport.water_flow_reading &&
                <Card data-source-location="pages/WorkReports:429:20" data-dynamic-content="true">
                      <CardContent data-source-location="pages/WorkReports:430:22" data-dynamic-content="true" className="p-4 flex items-center gap-3">
                        <Droplets data-source-location="pages/WorkReports:431:24" data-dynamic-content="false" className="w-8 h-8 text-blue-500" />
                        <div data-source-location="pages/WorkReports:432:24" data-dynamic-content="true">
                          <p data-source-location="pages/WorkReports:433:26" data-dynamic-content="false" className="text-sm text-gray-500">Water Flow</p>
                          <p data-source-location="pages/WorkReports:434:26" data-dynamic-content="true" className="text-xl font-bold text-gray-900">{selectedReport.water_flow_reading} GPM</p>
                        </div>
                      </CardContent>
                    </Card>
                }
                  {selectedReport.pressure_reading &&
                <Card data-source-location="pages/WorkReports:440:20" data-dynamic-content="true">
                      <CardContent data-source-location="pages/WorkReports:441:22" data-dynamic-content="true" className="p-4 flex items-center gap-3">
                        <div data-source-location="pages/WorkReports:442:24" data-dynamic-content="false" className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                          <span data-source-location="pages/WorkReports:443:26" data-dynamic-content="false" className="text-orange-600 font-bold text-sm">PSI</span>
                        </div>
                        <div data-source-location="pages/WorkReports:445:24" data-dynamic-content="true">
                          <p data-source-location="pages/WorkReports:446:26" data-dynamic-content="false" className="text-sm text-gray-500">Pressure</p>
                          <p data-source-location="pages/WorkReports:447:26" data-dynamic-content="true" className="text-xl font-bold text-gray-900">{selectedReport.pressure_reading} PSI</p>
                        </div>
                      </CardContent>
                    </Card>
                }
                </div>

                {/* Notes */}
                {selectedReport.work_notes &&
              <div data-source-location="pages/WorkReports:456:18" data-dynamic-content="true">
                    <h4 data-source-location="pages/WorkReports:457:20" data-dynamic-content="false" className="font-medium text-gray-900 mb-2">Work Notes</h4>
                    <p data-source-location="pages/WorkReports:458:20" data-dynamic-content="true" className="text-gray-600 p-3 bg-gray-50 rounded-lg">{selectedReport.work_notes}</p>
                  </div>
              }

                {/* Farmer Signature */}
                {selectedReport.farmer_signature_url &&
              <div data-source-location="pages/WorkReports:464:18" data-dynamic-content="true">
                    <h4 data-source-location="pages/WorkReports:465:20" data-dynamic-content="false" className="font-medium text-gray-900 mb-2">Farmer Signature</h4>
                    <img data-source-location="pages/WorkReports:466:20" data-dynamic-content="false"
                src={selectedReport.farmer_signature_url}
                alt="Signature"
                className="h-20 border rounded-lg p-2 bg-white" />

                  </div>
              }

                {/* Rejection reason if rejected */}
                {selectedReport.status === 'rejected' && selectedReport.rejection_reason &&
              <div data-source-location="pages/WorkReports:476:18" data-dynamic-content="true" className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h4 data-source-location="pages/WorkReports:477:20" data-dynamic-content="false" className="font-medium text-red-800 mb-1">Rejection Reason</h4>
                    <p data-source-location="pages/WorkReports:478:20" data-dynamic-content="true" className="text-red-700">{selectedReport.rejection_reason}</p>
                  </div>
              }
              </div>

              {/* Actions */}
              {selectedReport.status === 'submitted' &&
            <DialogFooter data-source-location="pages/WorkReports:485:16" data-dynamic-content="true" className="gap-3 pt-4">
                  <Button data-source-location="pages/WorkReports:486:18" data-dynamic-content="false"
              variant="outline"
              onClick={() => {
                setShowRejectDialog(true);
              }}
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-600 [&:hover_svg]:text-red-600">

                    <ThumbsDown data-source-location="pages/WorkReports:493:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Reject & Request Rework
                  </Button>
                  <Button data-source-location="pages/WorkReports:496:18" data-dynamic-content="false"
              onClick={() => handleApprove(selectedReport)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={updateReportMutation.isPending}>

                    <ThumbsUp data-source-location="pages/WorkReports:501:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Approve Report
                  </Button>
                </DialogFooter>
            }
            </>
          }
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog data-source-location="pages/WorkReports:512:6" data-dynamic-content="true" open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent data-source-location="pages/WorkReports:513:8" data-dynamic-content="true">
          <DialogHeader data-source-location="pages/WorkReports:514:10" data-dynamic-content="false">
            <DialogTitle data-source-location="pages/WorkReports:515:12" data-dynamic-content="false">Reject Report</DialogTitle>
            <DialogDescription data-source-location="pages/WorkReports:516:12" data-dynamic-content="false">
              Please provide a reason for rejection. This will be sent to the technician.
            </DialogDescription>
          </DialogHeader>
          <Textarea data-source-location="pages/WorkReports:520:10" data-dynamic-content="false"
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          placeholder="Enter rejection reason and required corrections..."
          rows={4} />

          <DialogFooter data-source-location="pages/WorkReports:526:10" data-dynamic-content="true" className="gap-3">
            <Button data-source-location="pages/WorkReports:527:12" data-dynamic-content="false" variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button data-source-location="pages/WorkReports:530:12" data-dynamic-content="false"
            onClick={handleReject}
            className="bg-red-600 hover:bg-red-700"
            disabled={updateReportMutation.isPending}>

              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);

}