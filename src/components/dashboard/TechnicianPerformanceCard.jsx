import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function TechnicianPerformanceCard({ technician, jobs = [], reports = [] }) {
  const completedJobs = jobs.filter(j => ['completed', 'approved'].includes(j.status));
  const thisMonthJobs = completedJobs.filter(j => {
    const date = new Date(j.actual_end_time || j.updated_date);
    return date.getMonth() === new Date().getMonth();
  }).length;

  // Calculate metrics
  const avgDuration = reports.length > 0
    ? reports.reduce((sum, r) => {
        if (r.check_in_time && r.check_out_time) {
          const duration = (new Date(r.check_out_time) - new Date(r.check_in_time)) / (1000 * 60 * 60);
          return sum + duration;
        }
        return sum;
      }, 0) / reports.length
    : 0;

  const completionRate = jobs.length > 0
    ? (completedJobs.length / jobs.length) * 100
    : 0;

  const avgRating = technician.rating || 0;

  // Trend comparison (simplified)
  const trend = thisMonthJobs > 5 ? 'up' : thisMonthJobs < 3 ? 'down' : 'stable';

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="w-14 h-14">
            <AvatarFallback className="bg-gradient-to-br from-emerald-100 to-blue-100 text-emerald-700 text-lg">
              {technician.name?.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-gray-900 truncate">{technician.name}</h3>
              <div className="flex items-center gap-1">
                {trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500" />}
                {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
                {trend === 'stable' && <Minus className="w-4 h-4 text-gray-400" />}
              </div>
            </div>
            
            <p className="text-sm text-gray-500 mb-3">{technician.employee_id}</p>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-xs text-gray-500">Total Jobs</p>
                <p className="text-lg font-bold text-gray-900">{technician.jobs_completed || 0}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-xs text-gray-500">This Month</p>
                <p className="text-lg font-bold text-emerald-600">{thisMonthJobs}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Rating</span>
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                  <span className="font-medium">{avgRating.toFixed(1)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Avg Duration</span>
                <span className="font-medium">{avgDuration.toFixed(1)}h</span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Completion Rate</span>
                  <span className="font-medium">{completionRate.toFixed(0)}%</span>
                </div>
                <Progress value={completionRate} className="h-1" />
              </div>
            </div>

            {technician.specializations && technician.specializations.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {technician.specializations.slice(0, 3).map((spec, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {spec}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}