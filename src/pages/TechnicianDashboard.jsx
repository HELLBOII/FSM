import React, { useState } from 'react';
import { technicianService, serviceRequestService, workReportService, technicianGoalService } from '@/services';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  Clock,
  Star,
  CheckCircle,
  Target,
  Award,
  Zap,
  Calendar,
  BarChart3,
  LineChart as LineChartIcon,
  Inbox } from
'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { startOfMonth, endOfMonth, format, subMonths } from 'date-fns';

export default function TechnicianDashboard() {
  const { user } = useAuth();

  const { data: technician, isLoading: isLoadingTechnician, error: technicianError } = useQuery({
    queryKey: ['technician', user?.id],
    queryFn: async () => {
      try {
        return await technicianService.getByUserId(user?.id);
      } catch (error) {
        // If technician not found, return null instead of throwing
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }
    },
    enabled: !!user?.id,
    retry: false
  });

  const { data: jobs = [], isLoading: isLoadingJobs } = useQuery({
    queryKey: ['technicianJobs', technician?.id],
    queryFn: () => technician?.id ? serviceRequestService.getByTechnicianId(technician.id) : [],
    enabled: !!technician?.id
  });

  const { data: reports = [], isLoading: isLoadingReports } = useQuery({
    queryKey: ['technicianReports', technician?.id],
    queryFn: () => technician?.id ? workReportService.getByTechnicianId(technician.id) : [],
    enabled: !!technician?.id
  });

  const { data: goals = [], isLoading: isLoadingGoals } = useQuery({
    queryKey: ['technicianGoals', technician?.id],
    queryFn: () => technician?.id ? technicianGoalService.getActiveGoals(technician.id) : [],
    enabled: !!technician?.id
  });

  // Calculate metrics
  const completedJobs = jobs.filter((j) => ['completed', 'approved', 'closed'].includes(j.status));
  const activeJobs = jobs.filter((j) => ['assigned', 'in_progress'].includes(j.status));
  const avgRating = technician?.rating || 0;
  // Calculate total jobs from actual jobs array, fallback to technician.jobs_completed
  const totalJobs = jobs.length > 0 ? jobs.length : (technician?.jobs_completed || 0);

  // This month stats - count all jobs completed this month
  const thisMonthStart = startOfMonth(new Date());
  const thisMonthEnd = endOfMonth(new Date());
  const thisMonthJobs = jobs.filter((j) => {
    // Check if job was completed this month
    if (['completed', 'approved', 'closed'].includes(j.status)) {
      if (!j.actual_end_time && !j.updated_date && !j.completed_date && !j.created_date) return false;
      try {
        const completedDate = new Date(j.actual_end_time || j.completed_date || j.updated_date || j.created_date);
        if (isNaN(completedDate)) return false;
        return completedDate >= thisMonthStart && completedDate <= thisMonthEnd;
      } catch (e) {
        return false;
      }
    }
    // Also count jobs created this month
    if (j.created_date) {
      try {
        const createdDate = new Date(j.created_date);
        if (isNaN(createdDate)) return false;
        return createdDate >= thisMonthStart && createdDate <= thisMonthEnd;
      } catch (e) {
        return false;
      }
    }
    return false;
  }).length;

  // Calculate average duration
  const jobsWithDuration = reports.filter((r) => {
    try {
      return r.check_in_time && r.check_out_time && 
             !isNaN(new Date(r.check_out_time)) && 
             !isNaN(new Date(r.check_in_time));
    } catch (e) {
      return false;
    }
  });
  const avgDuration = jobsWithDuration.length > 0 ?
  jobsWithDuration.reduce((sum, r) => {
    try {
      const duration = (new Date(r.check_out_time) - new Date(r.check_in_time)) / (1000 * 60 * 60);
      return sum + (isNaN(duration) ? 0 : duration);
    } catch (e) {
      return sum;
    }
  }, 0) / jobsWithDuration.length :
  0;

  // Last 6 months data
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(new Date(), 5 - i);
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const monthJobs = completedJobs.filter((j) => {
      if (!j.actual_end_time && !j.updated_date && !j.completed_date) return false;
      try {
        const date = new Date(j.actual_end_time || j.completed_date || j.updated_date);
        return !isNaN(date) && date >= monthStart && date <= monthEnd;
      } catch (e) {
        return false;
      }
    });
    return {
      month: format(month, 'MMM'),
      jobs: monthJobs.length
    };
  });

  // Skill utilization
  const skillData = technician?.specializations?.map((skill) => {
    const count = jobs.filter((j) =>
    j.irrigation_type?.toLowerCase().includes(skill.toLowerCase()) ||
    j.issue_category?.toLowerCase().includes(skill.toLowerCase())
    ).length;
    return { skill, count };
  }) || [];

  // Show loading while any data is loading
  if (isLoadingTechnician || isLoadingJobs || isLoadingReports || isLoadingGoals || !user?.id) {
    return (
      <div data-source-location="pages/TechnicianDashboard:107:6" data-dynamic-content="false" className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner data-source-location="pages/TechnicianDashboard:108:8" data-dynamic-content="false" size="lg" text="Loading dashboard..." />
      </div>);
  }

  // If technician doesn't exist after loading, show message
  if (!technician) {
    return (
      <div data-source-location="pages/TechnicianDashboard:107:6" data-dynamic-content="false" className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Technician profile not found</p>
          <p className="text-gray-400 text-sm mt-2">Please contact your administrator</p>
        </div>
      </div>);
  }

  return (
    <div data-source-location="pages/TechnicianDashboard:114:4" data-dynamic-content="true" className="p-4 space-y-4 pb-24">
      {/* Header */}
      <div data-source-location="pages/TechnicianDashboard:116:6" data-dynamic-content="true" className="flex items-center justify-between">
        <div data-source-location="pages/TechnicianDashboard:117:8" data-dynamic-content="false">
          <h1 data-source-location="pages/TechnicianDashboard:118:10" data-dynamic-content="false" className="text-2xl font-bold text-gray-900">My Performance</h1>
          <p data-source-location="pages/TechnicianDashboard:119:10" data-dynamic-content="false" className="text-sm text-gray-500">Track your progress and goals</p>
        </div>
        <div data-source-location="pages/TechnicianDashboard:121:8" data-dynamic-content="true" className="text-right">
          <div data-source-location="pages/TechnicianDashboard:122:10" data-dynamic-content="true" className="flex items-center gap-1 text-yellow-500">
            <Star data-source-location="pages/TechnicianDashboard:123:12" data-dynamic-content="false" className="w-5 h-5 fill-current" />
            <span data-source-location="pages/TechnicianDashboard:124:12" data-dynamic-content="true" className="text-xl font-bold">{avgRating.toFixed(1)}</span>
          </div>
          <p data-source-location="pages/TechnicianDashboard:126:10" data-dynamic-content="false" className="text-xs text-gray-500">Rating</p>
        </div>
      </div>

      {/* Key Metrics */}
      <div data-source-location="pages/TechnicianDashboard:131:6" data-dynamic-content="true" className="grid grid-cols-2 gap-3">
        <Card data-source-location="pages/TechnicianDashboard:132:8" data-dynamic-content="true" className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent data-source-location="pages/TechnicianDashboard:133:10" data-dynamic-content="true" className="p-4">
            <div data-source-location="pages/TechnicianDashboard:134:12" data-dynamic-content="false" className="flex items-center justify-between mb-2">
              <CheckCircle data-source-location="pages/TechnicianDashboard:135:14" data-dynamic-content="false" className="w-8 h-8" />
              <TrendingUp data-source-location="pages/TechnicianDashboard:136:14" data-dynamic-content="false" className="w-5 h-5" />
            </div>
            <p data-source-location="pages/TechnicianDashboard:138:12" data-dynamic-content="true" className="text-3xl font-bold">{totalJobs}</p>
            <p data-source-location="pages/TechnicianDashboard:139:12" data-dynamic-content="false" className="text-sm text-emerald-100">Total Jobs</p>
          </CardContent>
        </Card>

        <Card data-source-location="pages/TechnicianDashboard:143:8" data-dynamic-content="true" className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent data-source-location="pages/TechnicianDashboard:144:10" data-dynamic-content="true" className="p-4">
            <div data-source-location="pages/TechnicianDashboard:145:12" data-dynamic-content="false" className="flex items-center justify-between mb-2">
              <Calendar data-source-location="pages/TechnicianDashboard:146:14" data-dynamic-content="false" className="w-8 h-8" />
              <Zap data-source-location="pages/TechnicianDashboard:147:14" data-dynamic-content="false" className="w-5 h-5" />
            </div>
            <p data-source-location="pages/TechnicianDashboard:149:12" data-dynamic-content="true" className="text-3xl font-bold">{thisMonthJobs}</p>
            <p data-source-location="pages/TechnicianDashboard:150:12" data-dynamic-content="false" className="text-sm text-blue-100">This Month</p>
          </CardContent>
        </Card>

        <Card data-source-location="pages/TechnicianDashboard:154:8" data-dynamic-content="true" className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent data-source-location="pages/TechnicianDashboard:155:10" data-dynamic-content="true" className="p-4">
            <div data-source-location="pages/TechnicianDashboard:156:12" data-dynamic-content="false" className="flex items-center justify-between mb-2">
              <Clock data-source-location="pages/TechnicianDashboard:157:14" data-dynamic-content="false" className="w-8 h-8" />
            </div>
            <p data-source-location="pages/TechnicianDashboard:159:12" data-dynamic-content="true" className="text-3xl font-bold">{avgDuration.toFixed(1)}h</p>
            <p data-source-location="pages/TechnicianDashboard:160:12" data-dynamic-content="false" className="text-sm text-purple-100">Avg Duration</p>
          </CardContent>
        </Card>

        <Card data-source-location="pages/TechnicianDashboard:164:8" data-dynamic-content="true" className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <CardContent data-source-location="pages/TechnicianDashboard:165:10" data-dynamic-content="true" className="p-4">
            <div data-source-location="pages/TechnicianDashboard:166:12" data-dynamic-content="false" className="flex items-center justify-between mb-2">
              <Target data-source-location="pages/TechnicianDashboard:167:14" data-dynamic-content="false" className="w-8 h-8" />
            </div>
            <p data-source-location="pages/TechnicianDashboard:169:12" data-dynamic-content="true" className="text-3xl font-bold">{activeJobs.length}</p>
            <p data-source-location="pages/TechnicianDashboard:170:12" data-dynamic-content="false" className="text-sm text-orange-100">Active Jobs</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Trend */}
      <Card data-source-location="pages/TechnicianDashboard:176:6" data-dynamic-content="true">
        <CardHeader data-source-location="pages/TechnicianDashboard:177:8" data-dynamic-content="false">
          <CardTitle data-source-location="pages/TechnicianDashboard:178:10" data-dynamic-content="false" className="text-base">Jobs Completed (Last 6 Months)</CardTitle>
        </CardHeader>
        <CardContent data-source-location="pages/TechnicianDashboard:180:8" data-dynamic-content="true">
          {monthlyData.some(d => d.jobs > 0) ? (
            <ResponsiveContainer data-source-location="pages/TechnicianDashboard:181:10" data-dynamic-content="true" width="100%" height={200}>
              <LineChart data-source-location="pages/TechnicianDashboard:182:12" data-dynamic-content="false" data={monthlyData}>
                <CartesianGrid data-source-location="pages/TechnicianDashboard:183:14" data-dynamic-content="false" strokeDasharray="3 3" />
                <XAxis data-source-location="pages/TechnicianDashboard:184:14" data-dynamic-content="false" dataKey="month" />
                <YAxis data-source-location="pages/TechnicianDashboard:185:14" data-dynamic-content="false" />
                <Tooltip data-source-location="pages/TechnicianDashboard:186:14" data-dynamic-content="false" />
                <Line data-source-location="pages/TechnicianDashboard:187:14" data-dynamic-content="false" type="monotone" dataKey="jobs" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[200px] text-gray-400">
              <LineChartIcon className="w-12 h-12 mb-3 text-primary" />
              <p className="text-sm font-medium">No data found</p>
              <p className="text-xs text-gray-400 mt-1">Complete jobs to see your performance trend</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skill Utilization */}
      <Card data-source-location="pages/TechnicianDashboard:195:8" data-dynamic-content="true">
        <CardHeader data-source-location="pages/TechnicianDashboard:196:10" data-dynamic-content="false">
          <CardTitle data-source-location="pages/TechnicianDashboard:197:12" data-dynamic-content="false" className="text-base">Skill Utilization</CardTitle>
        </CardHeader>
        <CardContent data-source-location="pages/TechnicianDashboard:199:10" data-dynamic-content="true">
          {skillData.length > 0 && skillData.some(s => s.count > 0) ? (
            <ResponsiveContainer data-source-location="pages/TechnicianDashboard:200:12" data-dynamic-content="true" width="100%" height={200}>
              <BarChart data-source-location="pages/TechnicianDashboard:201:14" data-dynamic-content="false" data={skillData}>
                <CartesianGrid data-source-location="pages/TechnicianDashboard:202:16" data-dynamic-content="false" strokeDasharray="3 3" />
                <XAxis data-source-location="pages/TechnicianDashboard:203:16" data-dynamic-content="false" dataKey="skill" />
                <YAxis data-source-location="pages/TechnicianDashboard:204:16" data-dynamic-content="false" />
                <Tooltip data-source-location="pages/TechnicianDashboard:205:16" data-dynamic-content="false" />
                <Bar data-source-location="pages/TechnicianDashboard:206:16" data-dynamic-content="false" dataKey="count" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[200px] text-gray-400">
              <BarChart3 className="w-12 h-12 mb-3 text-primary" />
              <p className="text-sm font-medium">No data found</p>
              <p className="text-xs text-gray-400 mt-1">Complete jobs to see skill utilization</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Personal Goals */}
      <Card data-source-location="pages/TechnicianDashboard:214:6" data-dynamic-content="true">
        <CardHeader data-source-location="pages/TechnicianDashboard:215:8" data-dynamic-content="false" className="flex flex-row items-center justify-between">
          <CardTitle data-source-location="pages/TechnicianDashboard:216:10" data-dynamic-content="false" className="text-base flex items-center gap-2">
            <Award data-source-location="pages/TechnicianDashboard:217:12" data-dynamic-content="false" className="w-5 h-5 text-yellow-500" />
            My Goals
          </CardTitle>
          <Button data-source-location="pages/TechnicianDashboard:220:10" data-dynamic-content="false" size="sm" variant="outline">Add Goal</Button>
        </CardHeader>
        <CardContent data-source-location="pages/TechnicianDashboard:222:8" data-dynamic-content="true" className="space-y-3">
          {goals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Target className="w-12 h-12 mb-3 text-primary" />
              <p className="text-sm font-medium">No data found</p>
              <p className="text-xs text-gray-400 mt-1">Set goals to track your progress</p>
            </div>
          ) : (
            goals.map((goal) => {
              const progress = Math.min(goal.current_value / goal.target_value * 100, 100);
              return (
                <div data-source-location="pages/TechnicianDashboard:229:16" data-dynamic-content="true" key={goal.id} className="space-y-2">
                    <div data-source-location="pages/TechnicianDashboard:230:18" data-dynamic-content="true" className="flex items-center justify-between">
                      <p data-source-location="pages/TechnicianDashboard:231:20" data-dynamic-content="true" className="font-medium text-gray-900">{goal.title}</p>
                      <span data-source-location="pages/TechnicianDashboard:232:20" data-dynamic-content="true" className="text-sm text-gray-500">
                        {goal.current_value} / {goal.target_value}
                      </span>
                    </div>
                    <Progress data-source-location="pages/TechnicianDashboard:236:18" data-dynamic-content="false" value={progress} className="h-2" />
                    <p data-source-location="pages/TechnicianDashboard:237:18" data-dynamic-content="true" className="text-xs text-gray-500 capitalize">{goal.period} goal</p>
                  </div>);
            })
          )}
        </CardContent>
      </Card>
    </div>);

}