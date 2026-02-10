import React, { useState, useRef } from 'react';
import { serviceRequestService, technicianService, workReportService } from '@/services';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar as CalendarIcon,
  Download,
  Filter,
  Droplets,
  MapPin,
  Wrench,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  FileText,
  Image } from
'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from '@/components/common/PageHeader';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  Area,
  AreaChart } from
'recharts';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isWithinInterval } from 'date-fns';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from 'sonner';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Reports() {
  // Initialize with current month start and end dates
  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());
  
  const [startDate, setStartDate] = useState(currentMonthStart);
  const [endDate, setEndDate] = useState(currentMonthEnd);
  const [filterStartDate, setFilterStartDate] = useState(currentMonthStart);
  const [filterEndDate, setFilterEndDate] = useState(currentMonthEnd);
  const [activeTab, setActiveTab] = useState('overview');

  // Refs for chart exports
  const trendChartRef = useRef(null);
  const statusChartRef = useRef(null);
  const typeChartRef = useRef(null);
  const issueChartRef = useRef(null);
  const techChartRef = useRef(null);

  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['serviceRequests'],
    queryFn: () => serviceRequestService.list('created_at', 'desc', 500)
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => technicianService.list()
  });

  const { data: workReports = [] } = useQuery({
    queryKey: ['workReports'],
    queryFn: () => workReportService.list('created_at', 'desc', 500)
  });

  // Handle filter button click
  const handleFilter = () => {
    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return;
    }
    if (startDate > endDate) {
      toast.error('Start date cannot be after end date');
      return;
    }
    setFilterStartDate(startDate);
    setFilterEndDate(endDate);
    toast.success('Filter applied');
  };

  // Filter by date range (using filter state, not input state)
  const filterStart = new Date(filterStartDate);
  filterStart.setHours(0, 0, 0, 0);
  const filterEnd = new Date(filterEndDate);
  filterEnd.setHours(23, 59, 59, 999);

  const filteredRequests = requests.filter((r) => {
    if (!r.created_date && !r.created_at) return false;
    try {
      const date = r.created_date ? parseISO(r.created_date) : parseISO(r.created_at);
      return isWithinInterval(date, { start: filterStart, end: filterEnd });
    } catch (error) {
      console.warn('Invalid date format for request:', r.id, r.created_date, r.created_at);
      return false;
    }
  });

  // Calculate metrics
  const totalRequests = filteredRequests.length;
  const completedRequests = filteredRequests.filter((r) => ['completed', 'approved', 'closed'].includes(r.status)).length;
  const slaBreached = filteredRequests.filter((r) => r.is_sla_breached).length;
  const avgResponseTime = '2.4 hrs'; // Placeholder

  // Requests by status - include all statuses to show complete picture
  const allStatusCounts = {
    'new': filteredRequests.filter((r) => r.status === 'new').length,
    'scheduled': filteredRequests.filter((r) => r.status === 'scheduled').length,
    'assigned': filteredRequests.filter((r) => r.status === 'assigned').length,
    'in_progress': filteredRequests.filter((r) => r.status === 'in_progress').length,
    'completed': filteredRequests.filter((r) => r.status === 'completed').length,
    'approved': filteredRequests.filter((r) => r.status === 'approved').length,
    'closed': filteredRequests.filter((r) => r.status === 'closed').length,
    'rework': filteredRequests.filter((r) => r.status === 'rework').length
  };

  const requestsByStatus = [
    { name: 'New', value: allStatusCounts['new'] },
    { name: 'Scheduled', value: allStatusCounts['scheduled'] },
    { name: 'Assigned', value: allStatusCounts['assigned'] },
    { name: 'In Progress', value: allStatusCounts['in_progress'] },
    { name: 'Completed', value: allStatusCounts['completed'] },
    { name: 'Approved', value: allStatusCounts['approved'] },
    { name: 'Closed', value: allStatusCounts['closed'] },
    { name: 'Rework', value: allStatusCounts['rework'] }
  ].filter((s) => s.value > 0);

  // Requests by irrigation type
  const requestsByType = [
  { name: 'Drip', value: filteredRequests.filter((r) => r.irrigation_type === 'drip').length },
  { name: 'Sprinkler', value: filteredRequests.filter((r) => r.irrigation_type === 'sprinkler').length },
  { name: 'Center Pivot', value: filteredRequests.filter((r) => r.irrigation_type === 'center_pivot').length },
  { name: 'Flood', value: filteredRequests.filter((r) => r.irrigation_type === 'flood').length },
  { name: 'Micro Sprinkler', value: filteredRequests.filter((r) => r.irrigation_type === 'micro_sprinkler').length }].
  filter((t) => t.value > 0);

  // Requests by issue category
  const requestsByIssue = [
  { name: 'Leak Repair', value: filteredRequests.filter((r) => r.issue_category === 'leak_repair').length },
  { name: 'Maintenance', value: filteredRequests.filter((r) => r.issue_category === 'maintenance').length },
  { name: 'Pump Issue', value: filteredRequests.filter((r) => r.issue_category === 'pump_issue').length },
  { name: 'Valve Replace', value: filteredRequests.filter((r) => r.issue_category === 'valve_replacement').length },
  { name: 'Pipe Repair', value: filteredRequests.filter((r) => r.issue_category === 'pipe_repair').length },
  { name: 'Filter Clean', value: filteredRequests.filter((r) => r.issue_category === 'filter_cleaning').length }].
  filter((i) => i.value > 0).sort((a, b) => b.value - a.value);

  // Daily trend data - use filter dates
  const days = eachDayOfInterval({ start: filterStartDate, end: filterEndDate });
  const dailyTrend = days.map((day) => {
    const dayRequests = filteredRequests.filter((r) => {
      if (!r.created_date && !r.created_at) return false;
      const requestDate = r.created_date ? parseISO(r.created_date) : parseISO(r.created_at);
      return format(requestDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
    });
    return {
      date: format(day, 'MMM d'),
      requests: dayRequests.length,
      completed: dayRequests.filter((r) => ['completed', 'approved', 'closed'].includes(r.status)).length
    };
  });

  // Technician performance
  const techPerformance = technicians.map((tech) => {
    const techJobs = filteredRequests.filter((r) => r.assigned_technician_id === tech.id);
    const completed = techJobs.filter((r) => ['completed', 'approved', 'closed'].includes(r.status)).length;
    return {
      name: tech.name?.split(' ')[0] || 'Unknown',
      jobs: techJobs.length,
      completed,
      rating: tech.rating || 0
    };
  }).filter((t) => t.jobs > 0).sort((a, b) => b.completed - a.completed).slice(0, 8);

  // Export functions
  const exportToExcel = (data, filename) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `${filename}.xlsx`);
    toast.success('Excel file downloaded');
  };

  const exportToCSV = (data, filename) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    toast.success('CSV file downloaded');
  };

  const exportChartToImage = async (chartRef, filename, format = 'png') => {
    if (!chartRef.current) return;
    try {
      const canvas = await html2canvas(chartRef.current, { backgroundColor: '#ffffff' });
      const url = canvas.toDataURL(`image/${format}`);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.${format}`;
      a.click();
      toast.success(`${format.toUpperCase()} image downloaded`);
    } catch (error) {
      toast.error('Failed to export image');
    }
  };

  const exportChartToPDF = async (chartRef, filename) => {
    if (!chartRef.current) return;
    try {
      const canvas = await html2canvas(chartRef.current, { backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const imgWidth = 280;
      const imgHeight = canvas.height * imgWidth / canvas.width;
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
      pdf.save(`${filename}.pdf`);
      toast.success('PDF downloaded');
    } catch (error) {
      toast.error('Failed to export PDF');
    }
  };

  const handleExport = (type, data, chartRef, filename) => {
    switch (type) {
      case 'xlsx':
        exportToExcel(data, filename);
        break;
      case 'csv':
        exportToCSV(data, filename);
        break;
      case 'pdf':
        exportChartToPDF(chartRef, filename);
        break;
      case 'png':
      case 'jpg':
      case 'jpeg':
        exportChartToImage(chartRef, filename, type);
        break;
    }
  };

  if (requestsLoading) {
    return (
      <div data-source-location="pages/Reports:239:6" data-dynamic-content="false" className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner data-source-location="pages/Reports:240:8" data-dynamic-content="false" size="lg" text="Loading reports..." />
      </div>);

  }

  return (
    <div data-source-location="pages/Reports:246:4" data-dynamic-content="true" className="space-y-6">
      <PageHeader data-source-location="pages/Reports:247:6" data-dynamic-content="false"
      title="Reports & Analytics"
      subtitle="Field service performance insights" />


      {/* Date Filter */}
      <div data-source-location="pages/Reports:253:6" data-dynamic-content="true" className="flex flex-col sm:flex-row gap-4 items-end justify-end">
        <div data-source-location="pages/Reports:256:12" data-dynamic-content="true" className="flex gap-4">
          <div data-source-location="pages/Reports:257:14" data-dynamic-content="true" className="flex flex-col space-y-2">
            <Label data-source-location="pages/Reports:258:16" data-dynamic-content="false" className="text-sm font-medium">Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  data-empty={!startDate}
                  className={cn(
                    "w-[280px] justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar 
                  mode="single" 
                  selected={startDate} 
                  onSelect={(date) => {
                    setStartDate(date);
                    if (date && endDate && date > endDate) {
                      setEndDate(date);
                    }
                  }}
                  disabled={(date) => date > new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div data-source-location="pages/Reports:267:14" data-dynamic-content="true" className="flex flex-col space-y-2">
            <Label data-source-location="pages/Reports:268:16" data-dynamic-content="false" className="text-sm font-medium">End Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  data-empty={!endDate}
                  className={cn(
                    "w-[280px] justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar 
                  mode="single" 
                  selected={endDate} 
                  onSelect={(date) => {
                    setEndDate(date);
                    if (date && startDate && date < startDate) {
                      setStartDate(date);
                    }
                  }}
                  disabled={(date) => date > new Date() || (startDate && date < startDate)}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div data-source-location="pages/Reports:279:12" data-dynamic-content="true" className="flex gap-2">
          <Button 
            data-source-location="pages/Reports:289:14" 
            data-dynamic-content="false" 
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={handleFilter}
          >
            <Filter data-source-location="pages/Reports:290:16" data-dynamic-content="false" className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div data-source-location="pages/Reports:299:6" data-dynamic-content="true" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div data-source-location="pages/Reports:300:8" data-dynamic-content="true" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card data-source-location="pages/Reports:301:10" data-dynamic-content="true" className="border-l-4 border-l-blue-500 h-full">
            <CardContent data-source-location="pages/Reports:302:12" data-dynamic-content="true" className="p-4">
              <div data-source-location="pages/Reports:303:14" data-dynamic-content="true" className="flex items-center justify-between">
                <div data-source-location="pages/Reports:304:16" data-dynamic-content="true" className="flex-1">
                  <p data-source-location="pages/Reports:305:18" data-dynamic-content="false" className="text-sm text-gray-500">Total Requests</p>
                  <p data-source-location="pages/Reports:306:18" data-dynamic-content="true" className="text-3xl font-bold text-gray-900">{totalRequests}</p>
                  <p data-source-location="pages/Reports:306:18" data-dynamic-content="true" className="text-xs text-gray-400 mt-1 h-4">&nbsp;</p>
                </div>
                <div data-source-location="pages/Reports:308:16" data-dynamic-content="false" className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <BarChart3 data-source-location="pages/Reports:309:18" data-dynamic-content="false" className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div data-source-location="pages/Reports:316:8" data-dynamic-content="true" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card data-source-location="pages/Reports:317:10" data-dynamic-content="true" className="border-l-4 border-l-emerald-500 h-full">
            <CardContent data-source-location="pages/Reports:318:12" data-dynamic-content="true" className="p-4">
              <div data-source-location="pages/Reports:319:14" data-dynamic-content="true" className="flex items-center justify-between">
                <div data-source-location="pages/Reports:320:16" data-dynamic-content="true" className="flex-1">
                  <p data-source-location="pages/Reports:321:18" data-dynamic-content="false" className="text-sm text-gray-500">Completed</p>
                  <p data-source-location="pages/Reports:322:18" data-dynamic-content="true" className="text-3xl font-bold text-gray-900">{completedRequests}</p>
                  <p data-source-location="pages/Reports:323:18" data-dynamic-content="true" className="text-xs text-emerald-600 mt-1 h-4">
                    {totalRequests > 0 ? Math.round(completedRequests / totalRequests * 100) : 0}% completion rate
                  </p>
                </div>
                <div data-source-location="pages/Reports:327:16" data-dynamic-content="false" className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle data-source-location="pages/Reports:328:18" data-dynamic-content="false" className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div data-source-location="pages/Reports:335:8" data-dynamic-content="true" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card data-source-location="pages/Reports:336:10" data-dynamic-content="true" className="border-l-4 border-l-red-500 h-full">
            <CardContent data-source-location="pages/Reports:337:12" data-dynamic-content="true" className="p-4">
              <div data-source-location="pages/Reports:338:14" data-dynamic-content="true" className="flex items-center justify-between">
                <div data-source-location="pages/Reports:339:16" data-dynamic-content="true" className="flex-1">
                  <p data-source-location="pages/Reports:340:18" data-dynamic-content="false" className="text-sm text-gray-500">SLA Breached</p>
                  <p data-source-location="pages/Reports:341:18" data-dynamic-content="true" className="text-3xl font-bold text-gray-900">{slaBreached}</p>
                  <p data-source-location="pages/Reports:342:18" data-dynamic-content="true" className="text-xs text-red-600 mt-1 h-4">
                    {totalRequests > 0 ? Math.round(slaBreached / totalRequests * 100) : 0}% breach rate
                  </p>
                </div>
                <div data-source-location="pages/Reports:346:16" data-dynamic-content="false" className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle data-source-location="pages/Reports:347:18" data-dynamic-content="false" className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div data-source-location="pages/Reports:354:8" data-dynamic-content="true" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card data-source-location="pages/Reports:355:10" data-dynamic-content="true" className="border-l-4 border-l-purple-500 h-full">
            <CardContent data-source-location="pages/Reports:356:12" data-dynamic-content="true" className="p-4">
              <div data-source-location="pages/Reports:357:14" data-dynamic-content="true" className="flex items-center justify-between">
                <div data-source-location="pages/Reports:358:16" data-dynamic-content="true" className="flex-1">
                  <p data-source-location="pages/Reports:359:18" data-dynamic-content="false" className="text-sm text-gray-500">Avg Response</p>
                  <p data-source-location="pages/Reports:360:18" data-dynamic-content="true" className="text-3xl font-bold text-gray-900">{avgResponseTime}</p>
                  <p data-source-location="pages/Reports:360:18" data-dynamic-content="true" className="text-xs text-gray-400 mt-1 h-4">&nbsp;</p>
                </div>
                <div data-source-location="pages/Reports:362:16" data-dynamic-content="false" className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Clock data-source-location="pages/Reports:363:18" data-dynamic-content="false" className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts */}
      <div data-source-location="pages/Reports:372:6" data-dynamic-content="true" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Chart */}
        <Card data-source-location="pages/Reports:374:8" data-dynamic-content="true" className="lg:col-span-2">
          <CardHeader data-source-location="pages/Reports:375:10" data-dynamic-content="true">
            <div data-source-location="pages/Reports:376:12" data-dynamic-content="true" className="flex items-center justify-between">
              <CardTitle data-source-location="pages/Reports:377:14" data-dynamic-content="false" className="flex items-center gap-2">
                <TrendingUp data-source-location="pages/Reports:378:16" data-dynamic-content="false" className="w-5 h-5 text-emerald-600" />
                Request Trend
              </CardTitle>
              {(dailyTrend.length > 0 && !dailyTrend.every(d => d.requests === 0 && d.completed === 0)) &&
              <DropdownMenu data-source-location="pages/Reports:381:14" data-dynamic-content="true">
                <DropdownMenuTrigger data-source-location="pages/Reports:382:16" data-dynamic-content="false" asChild>
                  <Button data-source-location="pages/Reports:383:18" data-dynamic-content="false" variant="outline" size="sm">
                    <Download data-source-location="pages/Reports:384:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent data-source-location="pages/Reports:388:16" data-dynamic-content="true">
                  <DropdownMenuItem data-source-location="pages/Reports:389:18" data-dynamic-content="false" onClick={() => handleExport('xlsx', dailyTrend, trendChartRef, 'request-trend')}>
                    <FileSpreadsheet data-source-location="pages/Reports:390:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as XLSX
                  </DropdownMenuItem>
                  <DropdownMenuItem data-source-location="pages/Reports:393:18" data-dynamic-content="false" onClick={() => handleExport('csv', dailyTrend, trendChartRef, 'request-trend')}>
                    <FileText data-source-location="pages/Reports:394:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem data-source-location="pages/Reports:397:18" data-dynamic-content="false" onClick={() => handleExport('pdf', dailyTrend, trendChartRef, 'request-trend')}>
                    <FileText data-source-location="pages/Reports:398:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem data-source-location="pages/Reports:401:18" data-dynamic-content="false" onClick={() => handleExport('png', dailyTrend, trendChartRef, 'request-trend')}>
                    <Image data-source-location="pages/Reports:402:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as PNG
                  </DropdownMenuItem>
                  <DropdownMenuItem data-source-location="pages/Reports:405:18" data-dynamic-content="false" onClick={() => handleExport('jpg', dailyTrend, trendChartRef, 'request-trend')}>
                    <Image data-source-location="pages/Reports:406:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as JPG
                  </DropdownMenuItem>
                  <DropdownMenuItem data-source-location="pages/Reports:409:18" data-dynamic-content="false" onClick={() => handleExport('jpeg', dailyTrend, trendChartRef, 'request-trend')}>
                    <Image data-source-location="pages/Reports:410:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as JPEG
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              }
            </div>
          </CardHeader>
          <CardContent data-source-location="pages/Reports:417:10" data-dynamic-content="true">
            <div data-source-location="pages/Reports:418:12" data-dynamic-content="true" className="h-[300px]" ref={trendChartRef}>
              {dailyTrend.length === 0 || dailyTrend.every(d => d.requests === 0 && d.completed === 0) ?
                <div className="flex items-center justify-center h-full text-primary">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 mx-auto mb-2 text-primary" />
                    <p className="text-sm font-medium text-primary">No data found</p>
                    <p className="text-xs text-primary/70 mt-1">No requests in the selected date range</p>
                  </div>
                </div> :
                <ResponsiveContainer data-source-location="pages/Reports:419:14" data-dynamic-content="true" width="100%" height="100%">
                  <AreaChart data-source-location="pages/Reports:420:16" data-dynamic-content="true" data={dailyTrend}>
                    <defs data-source-location="pages/Reports:421:18" data-dynamic-content="false">
                      <linearGradient data-source-location="pages/Reports:422:20" data-dynamic-content="false" id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                        <stop data-source-location="pages/Reports:423:22" data-dynamic-content="false" offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop data-source-location="pages/Reports:424:22" data-dynamic-content="false" offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient data-source-location="pages/Reports:426:20" data-dynamic-content="false" id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                        <stop data-source-location="pages/Reports:427:22" data-dynamic-content="false" offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop data-source-location="pages/Reports:428:22" data-dynamic-content="false" offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid data-source-location="pages/Reports:431:18" data-dynamic-content="false" strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis data-source-location="pages/Reports:432:18" data-dynamic-content="false" dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis data-source-location="pages/Reports:433:18" data-dynamic-content="false" tick={{ fontSize: 12 }} />
                    <Tooltip data-source-location="pages/Reports:434:18" data-dynamic-content="false" />
                    <Legend data-source-location="pages/Reports:435:18" data-dynamic-content="false" />
                    <Area data-source-location="pages/Reports:436:18" data-dynamic-content="false" type="monotone" dataKey="requests" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRequests)" name="Requests" />
                    <Area data-source-location="pages/Reports:437:18" data-dynamic-content="false" type="monotone" dataKey="completed" stroke="#10b981" fillOpacity={1} fill="url(#colorCompleted)" name="Completed" />
                  </AreaChart>
                </ResponsiveContainer>
              }
            </div>
          </CardContent>
        </Card>

        {/* Requests by Status */}
        <Card data-source-location="pages/Reports:445:8" data-dynamic-content="true">
          <CardHeader data-source-location="pages/Reports:446:10" data-dynamic-content="true">
            <div data-source-location="pages/Reports:447:12" data-dynamic-content="true" className="flex items-center justify-between">
              <CardTitle data-source-location="pages/Reports:448:14" data-dynamic-content="false">Requests by Status</CardTitle>
              {requestsByStatus.length > 0 &&
              <DropdownMenu data-source-location="pages/Reports:449:14" data-dynamic-content="true">
                <DropdownMenuTrigger data-source-location="pages/Reports:450:16" data-dynamic-content="false" asChild>
                  <Button data-source-location="pages/Reports:451:18" data-dynamic-content="false" variant="outline" size="sm">
                    <Download data-source-location="pages/Reports:452:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent data-source-location="pages/Reports:455:16" data-dynamic-content="true">
                  <DropdownMenuItem data-source-location="pages/Reports:456:18" data-dynamic-content="false" onClick={() => handleExport('xlsx', requestsByStatus, statusChartRef, 'requests-by-status')}>
                    <FileSpreadsheet data-source-location="pages/Reports:457:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as XLSX
                  </DropdownMenuItem>
                  <DropdownMenuItem data-source-location="pages/Reports:460:18" data-dynamic-content="false" onClick={() => handleExport('csv', requestsByStatus, statusChartRef, 'requests-by-status')}>
                    <FileText data-source-location="pages/Reports:461:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem data-source-location="pages/Reports:464:18" data-dynamic-content="false" onClick={() => handleExport('pdf', requestsByStatus, statusChartRef, 'requests-by-status')}>
                    <FileText data-source-location="pages/Reports:465:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem data-source-location="pages/Reports:468:18" data-dynamic-content="false" onClick={() => handleExport('png', requestsByStatus, statusChartRef, 'requests-by-status')}>
                    <Image data-source-location="pages/Reports:469:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as PNG
                  </DropdownMenuItem>
                  <DropdownMenuItem data-source-location="pages/Reports:472:18" data-dynamic-content="false" onClick={() => handleExport('jpg', requestsByStatus, statusChartRef, 'requests-by-status')}>
                    <Image data-source-location="pages/Reports:473:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as JPG
                  </DropdownMenuItem>
                  <DropdownMenuItem data-source-location="pages/Reports:476:18" data-dynamic-content="false" onClick={() => handleExport('jpeg', requestsByStatus, statusChartRef, 'requests-by-status')}>
                    <Image data-source-location="pages/Reports:477:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as JPEG
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              }
            </div>
          </CardHeader>
          <CardContent data-source-location="pages/Reports:484:10" data-dynamic-content="true">
            <div data-source-location="pages/Reports:485:12" data-dynamic-content="true" className="h-[280px]" ref={statusChartRef}>
              {requestsByStatus.length === 0 ?
                <div className="flex items-center justify-center h-full text-primary">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 mx-auto mb-2 text-primary" />
                    <p className="text-sm font-medium text-primary">No data found</p>
                    <p className="text-xs text-primary/70 mt-1">No requests by status in the selected date range</p>
                  </div>
                </div> :
                <ResponsiveContainer data-source-location="pages/Reports:486:14" data-dynamic-content="true" width="100%" height="100%">
                  <PieChart data-source-location="pages/Reports:487:16" data-dynamic-content="true" margin={{ top: 0, right: 0, bottom: 50, left: 0 }}>
                    <Pie 
                      data-source-location="pages/Reports:488:18" 
                      data-dynamic-content="true"
                      data={requestsByStatus}
                      cx="50%"
                      cy="40%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {requestsByStatus.map((entry, index) => (
                        <Cell 
                          data-source-location="pages/Reports:499:22" 
                          data-dynamic-content="false" 
                          key={`cell-${index}`} 
                          fill={COLORS[index % COLORS.length]} 
                        />
                      ))}
                    </Pie>
                    <Tooltip data-source-location="pages/Reports:502:18" data-dynamic-content="false" />
                    <Legend 
                      data-source-location="pages/Reports:502:18" 
                      data-dynamic-content="false"
                      verticalAlign="bottom"
                      height={36}
                      wrapperStyle={{ paddingTop: '20px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              }
            </div>
          </CardContent>
        </Card>

        {/* Requests by Irrigation Type */}
        <Card data-source-location="pages/Reports:510:8" data-dynamic-content="true">
          <CardHeader data-source-location="pages/Reports:511:10" data-dynamic-content="true">
            <div data-source-location="pages/Reports:512:12" data-dynamic-content="true" className="flex items-center justify-between">
              <CardTitle data-source-location="pages/Reports:513:14" data-dynamic-content="false" className="flex items-center gap-2">
                <Droplets data-source-location="pages/Reports:514:16" data-dynamic-content="false" className="w-5 h-5 text-blue-500" />
                By Irrigation Type
              </CardTitle>
              {requestsByType.length > 0 &&
              <DropdownMenu data-source-location="pages/Reports:517:14" data-dynamic-content="true">
                <DropdownMenuTrigger data-source-location="pages/Reports:518:16" data-dynamic-content="false" asChild>
                  <Button data-source-location="pages/Reports:519:18" data-dynamic-content="false" variant="outline" size="sm">
                    <Download data-source-location="pages/Reports:520:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent data-source-location="pages/Reports:523:16" data-dynamic-content="true">
                  <DropdownMenuItem data-source-location="pages/Reports:524:18" data-dynamic-content="false" onClick={() => handleExport('xlsx', requestsByType, typeChartRef, 'requests-by-type')}>
                    <FileSpreadsheet data-source-location="pages/Reports:525:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as XLSX
                  </DropdownMenuItem>
                  <DropdownMenuItem data-source-location="pages/Reports:528:18" data-dynamic-content="false" onClick={() => handleExport('csv', requestsByType, typeChartRef, 'requests-by-type')}>
                    <FileText data-source-location="pages/Reports:529:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem data-source-location="pages/Reports:532:18" data-dynamic-content="false" onClick={() => handleExport('pdf', requestsByType, typeChartRef, 'requests-by-type')}>
                    <FileText data-source-location="pages/Reports:533:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem data-source-location="pages/Reports:536:18" data-dynamic-content="false" onClick={() => handleExport('png', requestsByType, typeChartRef, 'requests-by-type')}>
                    <Image data-source-location="pages/Reports:537:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as PNG
                  </DropdownMenuItem>
                  <DropdownMenuItem data-source-location="pages/Reports:540:18" data-dynamic-content="false" onClick={() => handleExport('jpg', requestsByType, typeChartRef, 'requests-by-type')}>
                    <Image data-source-location="pages/Reports:541:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as JPG
                  </DropdownMenuItem>
                  <DropdownMenuItem data-source-location="pages/Reports:544:18" data-dynamic-content="false" onClick={() => handleExport('jpeg', requestsByType, typeChartRef, 'requests-by-type')}>
                    <Image data-source-location="pages/Reports:545:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as JPEG
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              }
            </div>
          </CardHeader>
          <CardContent data-source-location="pages/Reports:552:10" data-dynamic-content="true">
            <div data-source-location="pages/Reports:553:12" data-dynamic-content="true" className="h-[280px]" ref={typeChartRef}>
              {requestsByType.length === 0 ?
                <div className="flex items-center justify-center h-full text-primary">
                  <div className="text-center">
                    <Droplets className="w-12 h-12 mx-auto mb-2 text-primary" />
                    <p className="text-sm font-medium text-primary">No data found</p>
                    <p className="text-xs text-primary/70 mt-1">No requests by irrigation type in the selected date range</p>
                  </div>
                </div> :
                <ResponsiveContainer data-source-location="pages/Reports:554:14" data-dynamic-content="true" width="100%" height="100%">
                  <BarChart data-source-location="pages/Reports:555:16" data-dynamic-content="true" data={requestsByType} layout="vertical">
                    <CartesianGrid data-source-location="pages/Reports:556:18" data-dynamic-content="false" strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis data-source-location="pages/Reports:557:18" data-dynamic-content="false" type="number" tick={{ fontSize: 12 }} />
                    <YAxis data-source-location="pages/Reports:558:18" data-dynamic-content="false" type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                    <Tooltip data-source-location="pages/Reports:559:18" data-dynamic-content="false" />
                    <Bar data-source-location="pages/Reports:560:18" data-dynamic-content="false" dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              }
            </div>
          </CardContent>
        </Card>

        {/* Top Issues */}
        <Card data-source-location="pages/Reports:568:8" data-dynamic-content="true">
          <CardHeader data-source-location="pages/Reports:569:10" data-dynamic-content="true">
            <div data-source-location="pages/Reports:570:12" data-dynamic-content="true" className="flex items-center justify-between">
              <CardTitle data-source-location="pages/Reports:571:14" data-dynamic-content="false" className="flex items-center gap-2">
                <Wrench data-source-location="pages/Reports:572:16" data-dynamic-content="false" className="w-5 h-5 text-orange-500" />
                Top Issue Categories
              </CardTitle>
              {requestsByIssue.length > 0 &&
              <DropdownMenu data-source-location="pages/Reports:575:14" data-dynamic-content="true">
                <DropdownMenuTrigger data-source-location="pages/Reports:576:16" data-dynamic-content="false" asChild>
                  <Button data-source-location="pages/Reports:577:18" data-dynamic-content="false" variant="outline" size="sm">
                    <Download data-source-location="pages/Reports:578:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent data-source-location="pages/Reports:581:16" data-dynamic-content="true">
                  <DropdownMenuItem data-source-location="pages/Reports:582:18" data-dynamic-content="false" onClick={() => handleExport('xlsx', requestsByIssue, issueChartRef, 'requests-by-issue')}>
                    <FileSpreadsheet data-source-location="pages/Reports:583:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as XLSX
                  </DropdownMenuItem>
                  <DropdownMenuItem data-source-location="pages/Reports:586:18" data-dynamic-content="false" onClick={() => handleExport('csv', requestsByIssue, issueChartRef, 'requests-by-issue')}>
                    <FileText data-source-location="pages/Reports:587:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem data-source-location="pages/Reports:590:18" data-dynamic-content="false" onClick={() => handleExport('pdf', requestsByIssue, issueChartRef, 'requests-by-issue')}>
                    <FileText data-source-location="pages/Reports:591:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem data-source-location="pages/Reports:594:18" data-dynamic-content="false" onClick={() => handleExport('png', requestsByIssue, issueChartRef, 'requests-by-issue')}>
                    <Image data-source-location="pages/Reports:595:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as PNG
                  </DropdownMenuItem>
                  <DropdownMenuItem data-source-location="pages/Reports:598:18" data-dynamic-content="false" onClick={() => handleExport('jpg', requestsByIssue, issueChartRef, 'requests-by-issue')}>
                    <Image data-source-location="pages/Reports:599:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as JPG
                  </DropdownMenuItem>
                  <DropdownMenuItem data-source-location="pages/Reports:602:18" data-dynamic-content="false" onClick={() => handleExport('jpeg', requestsByIssue, issueChartRef, 'requests-by-issue')}>
                    <Image data-source-location="pages/Reports:603:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as JPEG
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              }
            </div>
          </CardHeader>
          <CardContent data-source-location="pages/Reports:610:10" data-dynamic-content="true">
            <div data-source-location="pages/Reports:611:12" data-dynamic-content="true" className="h-[280px]" ref={issueChartRef}>
              {requestsByIssue.length === 0 ?
                <div className="flex items-center justify-center h-full text-primary">
                  <div className="text-center">
                    <Wrench className="w-12 h-12 mx-auto mb-2 text-primary" />
                    <p className="text-sm font-medium text-primary">No data found</p>
                    <p className="text-xs text-primary/70 mt-1">No requests by issue category in the selected date range</p>
                  </div>
                </div> :
                <ResponsiveContainer data-source-location="pages/Reports:612:14" data-dynamic-content="true" width="100%" height="100%">
                  <BarChart data-source-location="pages/Reports:613:16" data-dynamic-content="true" data={requestsByIssue}>
                    <CartesianGrid data-source-location="pages/Reports:614:18" data-dynamic-content="false" strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis data-source-location="pages/Reports:615:18" data-dynamic-content="false" dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                    <YAxis data-source-location="pages/Reports:616:18" data-dynamic-content="false" tick={{ fontSize: 12 }} />
                    <Tooltip data-source-location="pages/Reports:617:18" data-dynamic-content="false" />
                    <Bar data-source-location="pages/Reports:618:18" data-dynamic-content="false" dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              }
            </div>
          </CardContent>
        </Card>

        {/* Technician Performance */}
        <Card data-source-location="pages/Reports:626:8" data-dynamic-content="true">
          <CardHeader data-source-location="pages/Reports:627:10" data-dynamic-content="true">
            <div data-source-location="pages/Reports:628:12" data-dynamic-content="true" className="flex items-center justify-between">
              <CardTitle data-source-location="pages/Reports:629:14" data-dynamic-content="false" className="flex items-center gap-2">
                <Users data-source-location="pages/Reports:630:16" data-dynamic-content="false" className="w-5 h-5 text-purple-500" />
                Technician Performance
              </CardTitle>
              {techPerformance.length > 0 &&
              <DropdownMenu data-source-location="pages/Reports:633:14" data-dynamic-content="true">
                <DropdownMenuTrigger data-source-location="pages/Reports:634:16" data-dynamic-content="false" asChild>
                  <Button data-source-location="pages/Reports:635:18" data-dynamic-content="false" variant="outline" size="sm">
                    <Download data-source-location="pages/Reports:636:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent data-source-location="pages/Reports:639:16" data-dynamic-content="true">
                  <DropdownMenuItem data-source-location="pages/Reports:640:18" data-dynamic-content="false" onClick={() => handleExport('xlsx', techPerformance, techChartRef, 'technician-performance')}>
                    <FileSpreadsheet data-source-location="pages/Reports:641:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as XLSX
                  </DropdownMenuItem>
                  <DropdownMenuItem data-source-location="pages/Reports:644:18" data-dynamic-content="false" onClick={() => handleExport('csv', techPerformance, techChartRef, 'technician-performance')}>
                    <FileText data-source-location="pages/Reports:645:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem data-source-location="pages/Reports:648:18" data-dynamic-content="false" onClick={() => handleExport('pdf', techPerformance, techChartRef, 'technician-performance')}>
                    <FileText data-source-location="pages/Reports:649:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem data-source-location="pages/Reports:652:18" data-dynamic-content="false" onClick={() => handleExport('png', techPerformance, techChartRef, 'technician-performance')}>
                    <Image data-source-location="pages/Reports:653:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as PNG
                  </DropdownMenuItem>
                  <DropdownMenuItem data-source-location="pages/Reports:656:18" data-dynamic-content="false" onClick={() => handleExport('jpg', techPerformance, techChartRef, 'technician-performance')}>
                    <Image data-source-location="pages/Reports:657:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as JPG
                  </DropdownMenuItem>
                  <DropdownMenuItem data-source-location="pages/Reports:660:18" data-dynamic-content="false" onClick={() => handleExport('jpeg', techPerformance, techChartRef, 'technician-performance')}>
                    <Image data-source-location="pages/Reports:661:20" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                    Export as JPEG
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              }
            </div>
          </CardHeader>
          <CardContent data-source-location="pages/Reports:668:10" data-dynamic-content="true">
            <div data-source-location="pages/Reports:669:12" data-dynamic-content="true" className="h-[280px]" ref={techChartRef}>
              {techPerformance.length === 0 ?
                <div className="flex items-center justify-center h-full text-primary">
                  <div className="text-center">
                    <Users className="w-12 h-12 mx-auto mb-2 text-primary" />
                    <p className="text-sm font-medium text-primary">No data found</p>
                    <p className="text-xs text-primary/70 mt-1">No technician performance data in the selected date range</p>
                  </div>
                </div> :
                <ResponsiveContainer data-source-location="pages/Reports:670:14" data-dynamic-content="true" width="100%" height="100%">
                  <BarChart data-source-location="pages/Reports:671:16" data-dynamic-content="true" data={techPerformance}>
                    <CartesianGrid data-source-location="pages/Reports:672:18" data-dynamic-content="false" strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis data-source-location="pages/Reports:673:18" data-dynamic-content="false" dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis data-source-location="pages/Reports:674:18" data-dynamic-content="false" tick={{ fontSize: 12 }} />
                    <Tooltip data-source-location="pages/Reports:675:18" data-dynamic-content="false" />
                    <Legend data-source-location="pages/Reports:676:18" data-dynamic-content="false" />
                    <Bar data-source-location="pages/Reports:677:18" data-dynamic-content="false" dataKey="jobs" fill="#8b5cf6" name="Assigned" radius={[4, 4, 0, 0]} />
                    <Bar data-source-location="pages/Reports:678:18" data-dynamic-content="false" dataKey="completed" fill="#10b981" name="Completed" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              }
            </div>
          </CardContent>
        </Card>
      </div>
    </div>);

}