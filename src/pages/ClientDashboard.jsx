import React from 'react';
import { serviceRequestService } from '@/services';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  FileText,
  Clock,
  CheckCircle,
  Calendar,
  Phone,
  MapPin,
  ChevronRight,
  Droplets } from
'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import WorkflowStepper from '@/components/ui/WorkflowStepper';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';
import { format, parseISO } from 'date-fns';

const irrigationIcons = {
  drip: '💧',
  sprinkler: '🌊',
  center_pivot: '🔄',
  flood: '🌊',
  micro_sprinkler: '💦',
  subsurface: '🌱'
};

export default function ClientDashboard() {
  const { user } = useAuth();

  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['myRequests'],
    queryFn: () => serviceRequestService.list('created_at', 'desc', 100)
  });

  // Filter requests for this client
  const myRequests = requests.filter((r) =>
  r.client_id === user?.id || r.client_id === user?.client_id
  );

  const stats = {
    total: myRequests.length,
    active: myRequests.filter((r) => ['new', 'scheduled', 'assigned', 'in_progress'].includes(r.status)).length,
    completed: myRequests.filter((r) => ['completed', 'approved', 'closed'].includes(r.status)).length
  };

  const activeRequests = myRequests.filter((r) =>
  ['new', 'scheduled', 'assigned', 'in_progress'].includes(r.status)
  );

  const recentRequests = myRequests.slice(0, 5);

  if (requestsLoading) {
    return (
      <div data-source-location="pages/ClientDashboard:63:6" data-dynamic-content="false" className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner data-source-location="pages/ClientDashboard:64:8" data-dynamic-content="false" size="lg" text="Loading dashboard..." />
      </div>);

  }

  return (
    <div data-source-location="pages/ClientDashboard:70:4" data-dynamic-content="true" className="space-y-6">
      {/* Welcome */}
      <div data-source-location="pages/ClientDashboard:72:6" data-dynamic-content="true">
        <h1 data-source-location="pages/ClientDashboard:73:8" data-dynamic-content="true" className="text-2xl font-bold text-gray-900">Welcome, {user?.full_name?.split(' ')[0] || 'Farmer'}</h1>
        <p data-source-location="pages/ClientDashboard:74:8" data-dynamic-content="false" className="text-gray-500">Track your irrigation service requests</p>
      </div>

      {/* Stats */}
      <div data-source-location="pages/ClientDashboard:78:6" data-dynamic-content="true" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard data-source-location="pages/ClientDashboard:79:8" data-dynamic-content="false"
        title="Total Requests"
        value={stats.total}
        icon={FileText}
        color="blue" />

        <StatCard data-source-location="pages/ClientDashboard:85:8" data-dynamic-content="false"
        title="Active"
        value={stats.active}
        icon={Clock}
        color="orange" />

        <StatCard data-source-location="pages/ClientDashboard:91:8" data-dynamic-content="false"
        title="Completed"
        value={stats.completed}
        icon={CheckCircle}
        color="emerald" />

      </div>

      {/* Active Requests */}
      <Card data-source-location="pages/ClientDashboard:100:6" data-dynamic-content="true">
        <CardHeader data-source-location="pages/ClientDashboard:101:8" data-dynamic-content="false">
          <CardTitle data-source-location="pages/ClientDashboard:102:10" data-dynamic-content="false" className="flex items-center gap-2">
            <Clock data-source-location="pages/ClientDashboard:103:12" data-dynamic-content="false" className="w-5 h-5 text-orange-500" />
            Active Service Requests
          </CardTitle>
        </CardHeader>
        <CardContent data-source-location="pages/ClientDashboard:107:8" data-dynamic-content="true">
          {activeRequests.length === 0 ?
          <EmptyState data-source-location="pages/ClientDashboard:109:12" data-dynamic-content="false"
          icon={CheckCircle}
          title="No active requests"
          description="All your service requests have been completed" /> :


          <div data-source-location="pages/ClientDashboard:115:12" data-dynamic-content="true" className="space-y-4">
              {activeRequests.map((request) =>
            <motion.div data-source-location="pages/ClientDashboard:117:16" data-dynamic-content="true"
            key={request.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 border rounded-xl hover:shadow-md transition-all">

                  <div data-source-location="pages/ClientDashboard:123:18" data-dynamic-content="true" className="flex items-start justify-between mb-4">
                    <div data-source-location="pages/ClientDashboard:124:20" data-dynamic-content="true" className="flex items-center gap-3">
                      <div data-source-location="pages/ClientDashboard:125:22" data-dynamic-content="true" className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-emerald-100 flex items-center justify-center text-xl">
                        {irrigationIcons[request.irrigation_type] || '💧'}
                      </div>
                      <div data-source-location="pages/ClientDashboard:128:22" data-dynamic-content="true">
                        <div data-source-location="pages/ClientDashboard:129:24" data-dynamic-content="true" className="flex items-center gap-2">
                          <span data-source-location="pages/ClientDashboard:130:26" data-dynamic-content="true" className="font-semibold text-gray-900">#{request.request_number}</span>
                          <StatusBadge data-source-location="pages/ClientDashboard:131:26" data-dynamic-content="false" status={request.status} size="xs" />
                        </div>
                        <p data-source-location="pages/ClientDashboard:133:24" data-dynamic-content="true" className="text-sm text-gray-500 capitalize">
                          {request.issue_category?.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                    {request.scheduled_date &&
                <div data-source-location="pages/ClientDashboard:139:22" data-dynamic-content="true" className="text-right">
                        <p data-source-location="pages/ClientDashboard:140:24" data-dynamic-content="false" className="text-sm text-gray-500">Scheduled</p>
                        <p data-source-location="pages/ClientDashboard:141:24" data-dynamic-content="true" className="font-medium text-gray-900">
                          {format(parseISO(request.scheduled_date), 'MMM d')}
                        </p>
                      </div>
                }
                  </div>

                  <WorkflowStepper data-source-location="pages/ClientDashboard:148:18" data-dynamic-content="false"
              currentStatus={request.status}
              size="sm"
              steps={[
              { key: 'new', label: 'Submitted' },
              { key: 'scheduled', label: 'Scheduled' },
              { key: 'in_progress', label: 'Working' },
              { key: 'completed', label: 'Complete' }]
              } />


                  {request.assigned_technician_name &&
              <div data-source-location="pages/ClientDashboard:160:20" data-dynamic-content="true" className="mt-4 pt-4 border-t">
                      <p data-source-location="pages/ClientDashboard:161:22" data-dynamic-content="false" className="text-sm text-gray-500">Assigned Technician</p>
                      <p data-source-location="pages/ClientDashboard:162:22" data-dynamic-content="true" className="font-medium text-gray-900">{request.assigned_technician_name}</p>
                    </div>
              }
                </motion.div>
            )}
            </div>
          }
        </CardContent>
      </Card>

      {/* Recent History */}
      <Card data-source-location="pages/ClientDashboard:173:6" data-dynamic-content="true">
        <CardHeader data-source-location="pages/ClientDashboard:174:8" data-dynamic-content="false">
          <CardTitle data-source-location="pages/ClientDashboard:175:10" data-dynamic-content="false">Request History</CardTitle>
        </CardHeader>
        <CardContent data-source-location="pages/ClientDashboard:177:8" data-dynamic-content="true">
          {recentRequests.length === 0 ?
          <p data-source-location="pages/ClientDashboard:179:12" data-dynamic-content="false" className="text-center text-gray-500 py-8">No requests yet</p> :

          <div data-source-location="pages/ClientDashboard:181:12" data-dynamic-content="true" className="space-y-2">
              {recentRequests.map((request) =>
            <div data-source-location="pages/ClientDashboard:183:16" data-dynamic-content="true"
            key={request.id}
            className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">

                  <div data-source-location="pages/ClientDashboard:187:18" data-dynamic-content="true" className="flex items-center gap-3">
                    <div data-source-location="pages/ClientDashboard:188:20" data-dynamic-content="true" className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg">
                      {irrigationIcons[request.irrigation_type] || '💧'}
                    </div>
                    <div data-source-location="pages/ClientDashboard:191:20" data-dynamic-content="true">
                      <p data-source-location="pages/ClientDashboard:192:22" data-dynamic-content="true" className="font-medium text-gray-900">#{request.request_number}</p>
                      <p data-source-location="pages/ClientDashboard:193:22" data-dynamic-content="true" className="text-sm text-gray-500 capitalize">
                        {request.issue_category?.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                  <div data-source-location="pages/ClientDashboard:198:18" data-dynamic-content="true" className="flex items-center gap-3">
                    <StatusBadge data-source-location="pages/ClientDashboard:199:20" data-dynamic-content="false" status={request.status} size="sm" />
                    <ChevronRight data-source-location="pages/ClientDashboard:200:20" data-dynamic-content="false" className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
            )}
            </div>
          }
        </CardContent>
      </Card>

      {/* Contact Support */}
      <Card data-source-location="pages/ClientDashboard:210:6" data-dynamic-content="false" className="bg-gradient-to-br from-emerald-50 to-blue-50">
        <CardContent data-source-location="pages/ClientDashboard:211:8" data-dynamic-content="false" className="p-6">
          <div data-source-location="pages/ClientDashboard:212:10" data-dynamic-content="false" className="flex items-center justify-between">
            <div data-source-location="pages/ClientDashboard:213:12" data-dynamic-content="false">
              <h3 data-source-location="pages/ClientDashboard:214:14" data-dynamic-content="false" className="font-semibold text-gray-900 mb-1">Need Help?</h3>
              <p data-source-location="pages/ClientDashboard:215:14" data-dynamic-content="false" className="text-sm text-gray-600">Contact our support team for assistance</p>
            </div>
            <Button data-source-location="pages/ClientDashboard:217:12" data-dynamic-content="false" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Phone data-source-location="pages/ClientDashboard:218:14" data-dynamic-content="false" className="w-4 h-4 mr-2" />
              Contact Support
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>);

}