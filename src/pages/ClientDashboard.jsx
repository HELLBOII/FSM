import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { serviceRequestService } from '@/services';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  FileText,
  Clock,
  CheckCircle,
  Phone,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" text="Loading dashboard..." />
      </div>
    );
  }

  const displayName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Farmer';

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Welcome Header - mobile style like TechnicianHome */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarImage src={user?.user_metadata?.avatar_url} />
            <AvatarFallback className="bg-gradient-to-br from-emerald-100 to-blue-100 text-emerald-700 text-lg">
              {displayName?.charAt(0).toUpperCase() || 'C'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-gray-500 text-sm">Hello,</p>
            <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
          </div>
        </div>
      </div>

      {/* Stats - 3 column gradient cards like technician */}
      <div className="grid grid-cols-3 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 rounded-2xl text-white"
        >
          <FileText className="w-6 h-6 mb-2 opacity-80" />
          <p className="text-3xl font-bold">{stats.total}</p>
          <p className="text-sm opacity-80">Total</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-2xl text-white"
        >
          <Clock className="w-6 h-6 mb-2 opacity-80" />
          <p className="text-3xl font-bold">{stats.active}</p>
          <p className="text-sm opacity-80">Active</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 rounded-2xl text-white"
        >
          <CheckCircle className="w-6 h-6 mb-2 opacity-80" />
          <p className="text-3xl font-bold">{stats.completed}</p>
          <p className="text-sm opacity-80">Completed</p>
        </motion.div>
      </div>

      {/* Active Service Requests - tappable cards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Active Requests</h2>
        {activeRequests.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
              <p className="text-gray-600">No active requests</p>
              <p className="text-sm text-gray-500 mt-1">All your service requests have been completed</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {activeRequests.map((request, idx) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Link to={createPageUrl('JobDetails') + `?id=${request.id}`}>
                  <Card className="hover:shadow-md transition-all active:scale-[0.99]">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-emerald-100 flex items-center justify-center text-xl">
                            {irrigationIcons[request.irrigation_type] || '💧'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-semibold text-gray-900">#{request.request_number}</span>
                              <StatusBadge status={request.status} size="xs" />
                            </div>
                            <p className="text-sm text-gray-500 capitalize">
                              {request.issue_category?.replace(/_/g, ' ')}
                              {request.scheduled_date && ` • ${format(parseISO(request.scheduled_date), 'MMM d')}`}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                      <WorkflowStepper
                        currentStatus={request.status}
                        size="sm"
                        steps={[
                          { key: 'new', label: 'Submitted' },
                          { key: 'scheduled', label: 'Scheduled' },
                          { key: 'in_progress', label: 'Working' },
                          { key: 'completed', label: 'Complete' },
                        ]}
                      />
                      {request.assigned_technician_name && (
                        <p className="text-xs text-gray-500 mt-2">Technician: {request.assigned_technician_name}</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Request History */}
      {recentRequests.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent History</h2>
          <div className="space-y-2">
            {recentRequests.map((request) => (
              <Link key={request.id} to={createPageUrl('JobDetails') + `?id=${request.id}`}>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-lg border">
                      {irrigationIcons[request.irrigation_type] || '💧'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">#{request.request_number}</p>
                      <p className="text-xs text-gray-500 capitalize">
                        {request.issue_category?.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={request.status} size="xs" />
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Contact Support */}
      <Card className="bg-gradient-to-br from-emerald-50 to-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-gray-900 mb-0.5">Need Help?</h3>
              <p className="text-sm text-gray-600">Contact our support team</p>
            </div>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0">
              <Phone className="w-4 h-4 mr-2" />
              Support
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}