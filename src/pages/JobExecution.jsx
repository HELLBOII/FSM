import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { serviceRequestService, workReportService, equipmentService, storageService, tasksService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  Camera,
  Check,
  Plus,
  Trash2,
  Droplets,
  Gauge,
  FileText,
  Mic,
  MicOff,
  Save,
  Send,
  Loader2,
  CheckCircle,
  X,
  Package } from
'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { toast } from 'sonner';

export default function JobExecution() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const jobId = urlParams.get('id');
  const reportId = urlParams.get('reportId');

  const fileInputRef = useRef(null);
  const [activeSection, setActiveSection] = useState('tasks');
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoType, setPhotoType] = useState('before');

  const [formData, setFormData] = useState({
    tasks: [],
    equipment: [],
    water_flow_reading: '',
    pressure_reading: '',
    work_notes: '',
    before_photos: [],
    after_photos: [],
    farmer_signature_url: ''
  });

  const { data: job } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => serviceRequestService.filter({ id: jobId }).then((res) => res[0]),
    enabled: !!jobId
  });

  const { data: workReport } = useQuery({
    queryKey: ['workReport', reportId],
    queryFn: () => reportId ?
    workReportService.filter({ id: reportId }).then((res) => res[0]) :
    workReportService.filter({ service_request_id: jobId, status: 'draft' }).then((res) => res[0]),
    enabled: !!jobId
  });

  const { data: equipment = [] } = useQuery({
    queryKey: ['equipment'],
    queryFn: () => equipmentService.list()
  });

  const { data: dbTasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksService.list()
  });

  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [newTaskLabel, setNewTaskLabel] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const tasksInitializedFromDb = useRef(false);

  // Load existing report data or default tasks from DB
  useEffect(() => {
    if (workReport) {
      tasksInitializedFromDb.current = true;
      setFormData((prev) => ({
        ...prev,
        tasks: workReport.tasks_completed?.length > 0
          ? workReport.tasks_completed
          : dbTasks.length > 0
            ? dbTasks.map((t) => ({ task: t.label, completed: false, notes: '' }))
            : prev.tasks,
        equipment: workReport.equipment_used || [],
        water_flow_reading: workReport.water_flow_reading?.toString() || '',
        pressure_reading: workReport.pressure_reading?.toString() || '',
        work_notes: workReport.work_notes || '',
        before_photos: workReport.before_photos || [],
        after_photos: workReport.after_photos || []
      }));
    } else if (dbTasks.length > 0 && !tasksInitializedFromDb.current) {
      tasksInitializedFromDb.current = true;
      setFormData((prev) => ({
        ...prev,
        tasks: dbTasks.map((t) => ({ task: t.label, completed: false, notes: '' }))
      }));
    }
  }, [workReport, dbTasks]);

  const updateReportMutation = useMutation({
    mutationFn: (data) => workReportService.update(workReport?.id || reportId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workReport'] });
    }
  });

  const updateJobMutation = useMutation({
    mutationFn: (data) => serviceRequestService.update(jobId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['myJobs'] });
    }
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const { file_url } = await storageService.uploadFile(file);
      setFormData((prev) => ({
        ...prev,
        [photoType === 'before' ? 'before_photos' : 'after_photos']: [
        ...prev[photoType === 'before' ? 'before_photos' : 'after_photos'],
        file_url]

      }));
      toast.success('Photo uploaded');
    } catch (error) {
      toast.error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = (type, index) => {
    const key = type === 'before' ? 'before_photos' : 'after_photos';
    setFormData((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index)
    }));
  };

  const toggleTask = (index) => {
    setFormData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task, i) =>
      i === index ? { ...task, completed: !task.completed } : task
      )
    }));
  };

  const addEquipment = (equipmentId) => {
    const item = equipment.find((e) => e.id === equipmentId);
    if (item && !formData.equipment.find((e) => e.name === item.name)) {
      setFormData((prev) => ({
        ...prev,
        equipment: [...prev.equipment, { name: item.name, quantity: 1, unit: item.unit }]
      }));
    }
  };

  const updateEquipmentQty = (index, quantity) => {
    setFormData((prev) => ({
      ...prev,
      equipment: prev.equipment.map((item, i) =>
      i === index ? { ...item, quantity: parseInt(quantity) || 0 } : item
      )
    }));
  };

  const removeEquipment = (index) => {
    setFormData((prev) => ({
      ...prev,
      equipment: prev.equipment.filter((_, i) => i !== index)
    }));
  };

  const handleAddTask = async () => {
    const label = newTaskLabel?.trim();
    if (!label) {
      toast.error('Enter a task name');
      return;
    }
    setAddingTask(true);
    try {
      await tasksService.create({ label });
      setFormData((prev) => ({
        ...prev,
        tasks: [...prev.tasks, { task: label, completed: false, notes: '' }]
      }));
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setNewTaskLabel('');
      setShowAddTaskDialog(false);
      toast.success('Task added');
    } catch (err) {
      toast.error('Failed to add task');
    } finally {
      setAddingTask(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!workReport?.id && !reportId) {
      toast.error('No work report found');
      return;
    }

    await updateReportMutation.mutateAsync({
      tasks_completed: formData.tasks,
      equipment_used: formData.equipment,
      water_flow_reading: formData.water_flow_reading ? parseFloat(formData.water_flow_reading) : null,
      pressure_reading: formData.pressure_reading ? parseFloat(formData.pressure_reading) : null,
      work_notes: formData.work_notes,
      before_photos: formData.before_photos,
      after_photos: formData.after_photos
    });

    toast.success('Progress saved');
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Update work report
      await updateReportMutation.mutateAsync({
        tasks_completed: formData.tasks,
        equipment_used: formData.equipment,
        water_flow_reading: formData.water_flow_reading ? parseFloat(formData.water_flow_reading) : null,
        pressure_reading: formData.pressure_reading ? parseFloat(formData.pressure_reading) : null,
        work_notes: formData.work_notes,
        before_photos: formData.before_photos,
        after_photos: formData.after_photos,
        farmer_signature_url: formData.farmer_signature_url,
        check_out_time: new Date().toISOString(),
        status: 'submitted'
      });

      // Update job status
      await updateJobMutation.mutateAsync({
        status: 'completed',
        actual_end_time: new Date().toISOString()
      });

      toast.success('Job completed and report submitted!');
      navigate(createPageUrl('TechnicianHome'));
    } catch (error) {
      toast.error('Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!job) {
    return (
      <div data-source-location="pages/JobExecution:257:6" data-dynamic-content="false" className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner data-source-location="pages/JobExecution:258:8" data-dynamic-content="false" size="lg" text="Loading..." />
      </div>);

  }

  const completedTasks = formData.tasks.filter((t) => t.completed).length;

  return (
    <div data-source-location="pages/JobExecution:266:4" data-dynamic-content="true" className="pb-32">
      {/* Header */}
      <div data-source-location="pages/JobExecution:268:6" data-dynamic-content="true" className="bg-white border-b px-4 py-3 sticky top-0 z-30">
        <div data-source-location="pages/JobExecution:269:8" data-dynamic-content="true" className="flex items-center gap-3">
          <Button data-source-location="pages/JobExecution:270:10" data-dynamic-content="false" variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft data-source-location="pages/JobExecution:271:12" data-dynamic-content="false" className="w-5 h-5" />
          </Button>
          <div data-source-location="pages/JobExecution:273:10" data-dynamic-content="true" className="flex-1">
            <h1 data-source-location="pages/JobExecution:274:12" data-dynamic-content="false" className="font-semibold text-gray-900">Work Execution</h1>
            <p data-source-location="pages/JobExecution:275:12" data-dynamic-content="true" className="text-sm text-gray-500">#{job.request_number} • {job.client_name}</p>
          </div>
          <Button data-source-location="pages/JobExecution:277:10" data-dynamic-content="false" variant="outline" size="sm" onClick={handleSaveDraft}>
            <Save data-source-location="pages/JobExecution:278:12" data-dynamic-content="false" className="w-4 h-4 mr-1" />
            Save
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <div data-source-location="pages/JobExecution:285:6" data-dynamic-content="true" className="px-4 py-3 bg-gray-50 border-b">
        <div data-source-location="pages/JobExecution:286:8" data-dynamic-content="true" className="flex items-center justify-between mb-2">
          <span data-source-location="pages/JobExecution:287:10" data-dynamic-content="false" className="text-sm font-medium text-gray-700">Progress</span>
          <span data-source-location="pages/JobExecution:288:10" data-dynamic-content="true" className="text-sm text-gray-500">{completedTasks}/{formData.tasks.length} tasks</span>
        </div>
        <div data-source-location="pages/JobExecution:290:8" data-dynamic-content="true" className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div data-source-location="pages/JobExecution:291:10" data-dynamic-content="false"
          className="h-full bg-emerald-500"
          initial={{ width: 0 }}
          animate={{ width: `${completedTasks / formData.tasks.length * 100}%` }}
          transition={{ duration: 0.3 }} />

        </div>
      </div>

      {/* Section Navigation */}
      <div data-source-location="pages/JobExecution:301:6" data-dynamic-content="true" className="flex border-b bg-white sticky top-14 z-20">
        {['tasks', 'photos', 'readings', 'notes'].map((section) =>
        <button data-source-location="pages/JobExecution:303:10" data-dynamic-content="true"
        key={section}
        onClick={() => setActiveSection(section)}
        className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
        activeSection === section ?
        'text-emerald-600 border-b-2 border-emerald-600' :
        'text-gray-500'}`
        }>

            {section}
          </button>
        )}
      </div>

      <div data-source-location="pages/JobExecution:317:6" data-dynamic-content="true" className="p-4 space-y-4">
        {/* Tasks Section */}
        {activeSection === 'tasks' &&
        <motion.div data-source-location="pages/JobExecution:320:10" data-dynamic-content="true"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="space-y-3">

            {formData.tasks.map((task, index) =>
          <Card data-source-location="pages/JobExecution:326:14" data-dynamic-content="true"
          key={index}
          className={`transition-all ${task.completed ? 'bg-emerald-50 border-emerald-200' : ''}`}>

                <CardContent data-source-location="pages/JobExecution:330:16" data-dynamic-content="true" className="p-4">
                  <div data-source-location="pages/JobExecution:331:18" data-dynamic-content="true" className="flex items-start gap-3">
                    <Checkbox data-source-location="pages/JobExecution:332:20" data-dynamic-content="false"
                checked={task.completed}
                onCheckedChange={() => toggleTask(index)}
                className="mt-1 h-5 w-5" />

                    <div data-source-location="pages/JobExecution:337:20" data-dynamic-content="true" className="flex-1">
                      <p data-source-location="pages/JobExecution:338:22" data-dynamic-content="true" className={`font-medium ${task.completed ? 'text-emerald-700 line-through' : 'text-gray-900'}`}>
                        {task.task}
                      </p>
                      {task.completed &&
                  <Input data-source-location="pages/JobExecution:342:24" data-dynamic-content="false"
                  placeholder="Add notes (optional)"
                  value={task.notes}
                  onChange={(e) => {
                    const newTasks = [...formData.tasks];
                    newTasks[index].notes = e.target.value;
                    setFormData((prev) => ({ ...prev, tasks: newTasks }));
                  }}
                  className="mt-2 text-sm" />

                  }
                    </div>
                    {task.completed &&
                <CheckCircle data-source-location="pages/JobExecution:355:22" data-dynamic-content="false" className="w-5 h-5 text-emerald-500" />
                }
                  </div>
                </CardContent>
              </Card>
          )}
            {/* Fixed bottom Add task - only when on Tasks tab */}
            <div className="fixed bottom-28 left-0 right-0 p-4 bg-white border-t z-10 flex justify-center">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => setShowAddTaskDialog(true)}
              >
                <Plus className="w-4 h-4" />
                Add task
              </Button>
            </div>
          </motion.div>
        }

        {/* Photos Section - Before and After in 2 cols */}
        {activeSection === 'photos' &&
        <motion.div data-source-location="pages/JobExecution:366:10" data-dynamic-content="true"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="space-y-4">

            <div className="grid grid-cols-2 gap-4">
            {/* Before Photos */}
            <div data-source-location="pages/JobExecution:372:12" data-dynamic-content="true">
              <Label data-source-location="pages/JobExecution:373:14" data-dynamic-content="false" className="text-base font-semibold mb-3 block">Before Photos</Label>
              <div data-source-location="pages/JobExecution:374:14" data-dynamic-content="true" className="grid grid-cols-2 gap-2">
                {formData.before_photos.map((photo, idx) =>
              <div data-source-location="pages/JobExecution:376:18" data-dynamic-content="true" key={idx} className="relative group aspect-square">
                    <img data-source-location="pages/JobExecution:377:20" data-dynamic-content="false" src={photo} alt={`Before ${idx + 1}`} className="w-full h-full object-cover rounded-lg" />
                    <button data-source-location="pages/JobExecution:378:20" data-dynamic-content="false"
                onClick={() => removePhoto('before', idx)}
                className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">

                      <X data-source-location="pages/JobExecution:382:22" data-dynamic-content="false" className="w-4 h-4" />
                    </button>
                  </div>
              )}
                <button data-source-location="pages/JobExecution:386:16" data-dynamic-content="true"
              onClick={() => {
                setPhotoType('before');
                fileInputRef.current?.click();
              }}
              disabled={uploadingPhoto}
              className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary transition-colors">

                  {uploadingPhoto && photoType === 'before' ?
                <Loader2 data-source-location="pages/JobExecution:395:20" data-dynamic-content="false" className="w-6 h-6 animate-spin text-primary" /> :

                <>
                      <Camera data-source-location="pages/JobExecution:398:22" data-dynamic-content="false" className="w-6 h-6" />
                      <span data-source-location="pages/JobExecution:399:22" data-dynamic-content="false" className="text-xs mt-1">Add</span>
                    </>
                }
                </button>
              </div>
            </div>

            {/* After Photos */}
            <div data-source-location="pages/JobExecution:407:12" data-dynamic-content="true">
              <Label data-source-location="pages/JobExecution:408:14" data-dynamic-content="false" className="text-base font-semibold mb-3 block">After Photos</Label>
              <div data-source-location="pages/JobExecution:409:14" data-dynamic-content="true" className="grid grid-cols-2 gap-2">
                {formData.after_photos.map((photo, idx) =>
              <div data-source-location="pages/JobExecution:411:18" data-dynamic-content="true" key={idx} className="relative group aspect-square">
                    <img data-source-location="pages/JobExecution:412:20" data-dynamic-content="false" src={photo} alt={`After ${idx + 1}`} className="w-full h-full object-cover rounded-lg" />
                    <button data-source-location="pages/JobExecution:413:20" data-dynamic-content="false"
                onClick={() => removePhoto('after', idx)}
                className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">

                      <X data-source-location="pages/JobExecution:417:22" data-dynamic-content="false" className="w-4 h-4" />
                    </button>
                  </div>
              )}
                <button data-source-location="pages/JobExecution:421:16" data-dynamic-content="true"
              onClick={() => {
                setPhotoType('after');
                fileInputRef.current?.click();
              }}
              disabled={uploadingPhoto}
              className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary transition-colors">

                  {uploadingPhoto && photoType === 'after' ?
                <Loader2 data-source-location="pages/JobExecution:430:20" data-dynamic-content="false" className="w-6 h-6 animate-spin text-primary" /> :

                <>
                      <Camera data-source-location="pages/JobExecution:433:22" data-dynamic-content="false" className="w-6 h-6" />
                      <span data-source-location="pages/JobExecution:434:22" data-dynamic-content="false" className="text-xs mt-1">Add</span>
                    </>
                }
                </button>
              </div>
            </div>
            </div>

            <input data-source-location="pages/JobExecution:441:12" data-dynamic-content="false"
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoUpload}
          className="hidden" />

          </motion.div>
        }

        {/* Readings Section */}
        {activeSection === 'readings' &&
        <motion.div data-source-location="pages/JobExecution:454:10" data-dynamic-content="true"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="space-y-4">

            {/* Readings */}
            <Card data-source-location="pages/JobExecution:460:12" data-dynamic-content="true">
              <CardHeader data-source-location="pages/JobExecution:461:14" data-dynamic-content="false" className="pb-2">
                <CardTitle data-source-location="pages/JobExecution:462:16" data-dynamic-content="false" className="text-base flex items-center gap-2">
                  <Gauge data-source-location="pages/JobExecution:463:18" data-dynamic-content="false" className="w-5 h-5 text-blue-500" />
                  System Readings
                </CardTitle>
              </CardHeader>
              <CardContent data-source-location="pages/JobExecution:467:14" data-dynamic-content="true" className="space-y-4">
                <div data-source-location="pages/JobExecution:468:16" data-dynamic-content="true">
                  <Label data-source-location="pages/JobExecution:469:18" data-dynamic-content="false">Water Flow (GPM)</Label>
                  <div data-source-location="pages/JobExecution:470:18" data-dynamic-content="true" className="flex items-center gap-2 mt-1">
                    <Droplets data-source-location="pages/JobExecution:471:20" data-dynamic-content="false" className="w-5 h-5 text-blue-500" />
                    <Input data-source-location="pages/JobExecution:472:20" data-dynamic-content="false"
                  type="number"
                  step="0.1"
                  value={formData.water_flow_reading}
                  onChange={(e) => setFormData((prev) => ({ ...prev, water_flow_reading: e.target.value }))}
                  placeholder="Enter flow rate"
                  className="h-12 text-lg" />

                  </div>
                </div>
                <div data-source-location="pages/JobExecution:482:16" data-dynamic-content="true">
                  <Label data-source-location="pages/JobExecution:483:18" data-dynamic-content="false">Pressure (PSI)</Label>
                  <div data-source-location="pages/JobExecution:484:18" data-dynamic-content="true" className="flex items-center gap-2 mt-1">
                    <Gauge data-source-location="pages/JobExecution:485:20" data-dynamic-content="false" className="w-5 h-5 text-orange-500" />
                    <Input data-source-location="pages/JobExecution:486:20" data-dynamic-content="false"
                  type="number"
                  step="0.1"
                  value={formData.pressure_reading}
                  onChange={(e) => setFormData((prev) => ({ ...prev, pressure_reading: e.target.value }))}
                  placeholder="Enter pressure"
                  className="h-12 text-lg" />

                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Equipment Used */}
            <Card data-source-location="pages/JobExecution:500:12" data-dynamic-content="true">
              <CardHeader data-source-location="pages/JobExecution:501:14" data-dynamic-content="false" className="pb-2">
                <CardTitle data-source-location="pages/JobExecution:502:16" data-dynamic-content="false" className="text-base flex items-center gap-2">
                  <Package data-source-location="pages/JobExecution:503:18" data-dynamic-content="false" className="w-5 h-5 text-purple-500" />
                  Equipment & Parts Used
                </CardTitle>
              </CardHeader>
              <CardContent data-source-location="pages/JobExecution:507:14" data-dynamic-content="true" className="space-y-3">
                <Select data-source-location="pages/JobExecution:508:16" data-dynamic-content="true" onValueChange={addEquipment}>
                  <SelectTrigger data-source-location="pages/JobExecution:509:18" data-dynamic-content="false">
                    <SelectValue data-source-location="pages/JobExecution:510:20" data-dynamic-content="false" placeholder="Add equipment or parts..." />
                  </SelectTrigger>
                  <SelectContent data-source-location="pages/JobExecution:512:18" data-dynamic-content="true">
                    {equipment.map((item) =>
                  <SelectItem data-source-location="pages/JobExecution:514:22" data-dynamic-content="true" key={item.id} value={item.id}>
                        {item.name} ({item.stock_quantity} {item.unit} available)
                      </SelectItem>
                  )}
                  </SelectContent>
                </Select>

                {formData.equipment.map((item, idx) =>
              <div data-source-location="pages/JobExecution:522:18" data-dynamic-content="true" key={idx} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <span data-source-location="pages/JobExecution:523:20" data-dynamic-content="true" className="flex-1 font-medium">{item.name}</span>
                    <Input data-source-location="pages/JobExecution:524:20" data-dynamic-content="false"
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) => updateEquipmentQty(idx, e.target.value)}
                className="w-20 h-9" />

                    <span data-source-location="pages/JobExecution:531:20" data-dynamic-content="true" className="text-gray-500">{item.unit}</span>
                    <Button data-source-location="pages/JobExecution:532:20" data-dynamic-content="false" variant="ghost" size="icon" onClick={() => removeEquipment(idx)}>
                      <Trash2 data-source-location="pages/JobExecution:533:22" data-dynamic-content="false" className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
              )}
              </CardContent>
            </Card>
          </motion.div>
        }

        {/* Notes Section */}
        {activeSection === 'notes' &&
        <motion.div data-source-location="pages/JobExecution:544:10" data-dynamic-content="true"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="space-y-4">

            <Card data-source-location="pages/JobExecution:549:12" data-dynamic-content="true">
              <CardHeader data-source-location="pages/JobExecution:550:14" data-dynamic-content="false" className="pb-2">
                <CardTitle data-source-location="pages/JobExecution:551:16" data-dynamic-content="false" className="text-base flex items-center gap-2">
                  <FileText data-source-location="pages/JobExecution:552:18" data-dynamic-content="false" className="w-5 h-5 text-gray-500" />
                  Work Notes
                </CardTitle>
              </CardHeader>
              <CardContent data-source-location="pages/JobExecution:556:14" data-dynamic-content="true">
                <Textarea data-source-location="pages/JobExecution:557:16" data-dynamic-content="false"
              value={formData.work_notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, work_notes: e.target.value }))}
              placeholder="Describe the work performed, issues found, recommendations..."
              rows={6}
              className="text-base" />

              </CardContent>
            </Card>
          </motion.div>
        }
      </div>

      {/* Add task dialog */}
      <Dialog open={showAddTaskDialog} onOpenChange={setShowAddTaskDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add task</DialogTitle>
            <DialogDescription>Add a task to this job. It will be saved as a default for future jobs.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-task-label">Task name</Label>
              <Input
                id="new-task-label"
                value={newTaskLabel}
                onChange={(e) => setNewTaskLabel(e.target.value)}
                placeholder="e.g. Inspect pump"
                onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAddTaskDialog(false)}>Cancel</Button>
            <Button onClick={handleAddTask} disabled={addingTask || !newTaskLabel?.trim()}>
              {addingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Save to list
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fixed Bottom Action */}
      <div data-source-location="pages/JobExecution:571:6" data-dynamic-content="true" className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t">
        <Button data-source-location="pages/JobExecution:572:8" data-dynamic-content="true"
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full h-14 text-lg bg-primary hover:bg-primary/90 text-primary-foreground">

          {isSubmitting ?
          <>
              <Loader2 data-source-location="pages/JobExecution:579:14" data-dynamic-content="false" className="w-5 h-5 mr-2 animate-spin text-primary-foreground" />
              Submitting...
            </> :

          <>
              <Send data-source-location="pages/JobExecution:584:14" data-dynamic-content="false" className="w-5 h-5 mr-2" />
              Complete & Submit Report
            </>
          }
        </Button>
      </div>
    </div>);

}