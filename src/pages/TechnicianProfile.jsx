import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { technicianService, serviceRequestService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  User,
  Phone,
  Mail,
  Award,
  Star,
  CheckCircle,
  Settings,
  LogOut,
  ChevronRight,
  Bell,
  Moon,
  Wifi,
  WifiOff,
  Shield,
  HelpCircle,
  Loader2 } from
'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { toast } from 'sonner';

export default function TechnicianProfile() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(true);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { user, isLoading: userLoading } = useAuth();

  const { data: technician } = useQuery({
    queryKey: ['technician', user?.id],
    queryFn: () => technicianService.getByUserId(user?.id),
    enabled: !!user?.id
  });

  const { data: requests = [] } = useQuery({
    queryKey: ['technicianJobs', technician?.id],
    queryFn: () => technician?.id ? serviceRequestService.getByTechnicianId(technician.id) : [],
    enabled: !!technician?.id
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status) => technicianService.update(technician?.id, { availability_status: status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technician', user?.id] });
      toast.success('Status updated');
    }
  });

  // Calculate stats
  const myJobs = requests.filter((r) => r.assigned_technician_id === technician?.id);
  const completedJobs = myJobs.filter((r) => ['completed', 'approved', 'closed'].includes(r.status)).length;
  const thisMonthJobs = myJobs.filter((r) => {
    if (!r.created_date) return false;
    const date = new Date(r.created_date);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;

  const { logout } = useAuth();
  const handleLogout = () => {
    setShowLogoutDialog(true);
  };

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout(false); // Don't redirect automatically
      // Navigate to login page
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout. Please try again.');
      setIsLoggingOut(false);
    }
  };

  const handleStatusChange = (status) => {
    updateStatusMutation.mutate(status);
  };

  if (userLoading) {
    return (
      <div data-source-location="pages/TechnicianProfile:81:6" data-dynamic-content="false" className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner data-source-location="pages/TechnicianProfile:82:8" data-dynamic-content="false" size="lg" text="Loading profile..." />
      </div>);

  }

  return (
    <div data-source-location="pages/TechnicianProfile:88:4" data-dynamic-content="true" className="p-4 space-y-6 pb-24">
      {/* Profile Header */}
      <motion.div data-source-location="pages/TechnicianProfile:90:6" data-dynamic-content="true"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-emerald-500 to-blue-600 rounded-2xl p-6 text-white">

        <div data-source-location="pages/TechnicianProfile:95:8" data-dynamic-content="true" className="flex items-center gap-4 mb-4">
          <Avatar data-source-location="pages/TechnicianProfile:96:10" data-dynamic-content="true" className="h-20 w-20 border-4 border-white/30">
            <AvatarImage data-source-location="pages/TechnicianProfile:97:12" data-dynamic-content="false" src={user?.avatar_url} />
            <AvatarFallback data-source-location="pages/TechnicianProfile:98:12" data-dynamic-content="true" className="bg-white/20 text-white text-2xl">
              {user?.email?.charAt(0).toUpperCase() || 'T'}
            </AvatarFallback>
          </Avatar>
          <div data-source-location="pages/TechnicianProfile:102:10" data-dynamic-content="true">
            <h1 data-source-location="pages/TechnicianProfile:103:12" data-dynamic-content="true" className="text-2xl font-bold">{user?.full_name || 'Technician'}</h1>
            <p data-source-location="pages/TechnicianProfile:104:12" data-dynamic-content="true" className="text-white/80">{user?.email || technician?.email || 'Field Technician'}</p>
            <div data-source-location="pages/TechnicianProfile:105:12" data-dynamic-content="true" className="mt-2">
              <StatusBadge data-source-location="pages/TechnicianProfile:106:14" data-dynamic-content="false" status={technician?.availability_status || 'offline'} size="sm" />
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div data-source-location="pages/TechnicianProfile:112:8" data-dynamic-content="true" className="grid grid-cols-3 gap-4">
          <div data-source-location="pages/TechnicianProfile:113:10" data-dynamic-content="true" className="text-center p-3 bg-white/10 rounded-xl">
            <p data-source-location="pages/TechnicianProfile:114:12" data-dynamic-content="true" className="text-2xl font-bold">{completedJobs}</p>
            <p data-source-location="pages/TechnicianProfile:115:12" data-dynamic-content="false" className="text-sm text-white/80">Completed</p>
          </div>
          <div data-source-location="pages/TechnicianProfile:117:10" data-dynamic-content="true" className="text-center p-3 bg-white/10 rounded-xl">
            <p data-source-location="pages/TechnicianProfile:118:12" data-dynamic-content="true" className="text-2xl font-bold">{thisMonthJobs}</p>
            <p data-source-location="pages/TechnicianProfile:119:12" data-dynamic-content="false" className="text-sm text-white/80">This Month</p>
          </div>
          <div data-source-location="pages/TechnicianProfile:121:10" data-dynamic-content="true" className="text-center p-3 bg-white/10 rounded-xl">
            <div data-source-location="pages/TechnicianProfile:122:12" data-dynamic-content="true" className="flex items-center justify-center gap-1 text-2xl font-bold">
              {technician?.rating?.toFixed(1) || '-'}
              <Star data-source-location="pages/TechnicianProfile:124:14" data-dynamic-content="false" className="w-5 h-5 fill-yellow-400 text-yellow-400" />
            </div>
            <p data-source-location="pages/TechnicianProfile:126:12" data-dynamic-content="false" className="text-sm text-white/80">Rating</p>
          </div>
        </div>
      </motion.div>

      {/* Status Toggle */}
      <Card data-source-location="pages/TechnicianProfile:132:6" data-dynamic-content="true">
        <CardHeader data-source-location="pages/TechnicianProfile:133:8" data-dynamic-content="false" className="pb-2">
          <CardTitle data-source-location="pages/TechnicianProfile:134:10" data-dynamic-content="false" className="text-base">Availability Status</CardTitle>
        </CardHeader>
        <CardContent data-source-location="pages/TechnicianProfile:136:8" data-dynamic-content="true">
          <div data-source-location="pages/TechnicianProfile:137:10" data-dynamic-content="true" className="grid grid-cols-2 gap-2">
            {[
            { status: 'available', label: 'Available', color: 'bg-green-100 text-green-700 border-green-300' },
            { status: 'on_job', label: 'On Job', color: 'bg-blue-100 text-blue-700 border-blue-300' },
            { status: 'break', label: 'On Break', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
            { status: 'offline', label: 'Offline', color: 'bg-gray-100 text-gray-700 border-gray-300' }].
            map((item) =>
            <button data-source-location="pages/TechnicianProfile:144:14" data-dynamic-content="true"
            key={item.status}
            onClick={() => handleStatusChange(item.status)}
            disabled={updateStatusMutation.isPending}
            className={`p-3 rounded-xl border-2 transition-all ${
            technician?.availability_status === item.status ?
            `${item.color} border-current` :
            'bg-gray-50 border-transparent hover:bg-gray-100'}`
            }>

                <span data-source-location="pages/TechnicianProfile:154:16" data-dynamic-content="true" className="font-medium">{item.label}</span>
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card data-source-location="pages/TechnicianProfile:162:6" data-dynamic-content="true">
        <CardHeader data-source-location="pages/TechnicianProfile:163:8" data-dynamic-content="false" className="pb-2">
          <CardTitle data-source-location="pages/TechnicianProfile:164:10" data-dynamic-content="false" className="text-base">Contact Information</CardTitle>
        </CardHeader>
        <CardContent data-source-location="pages/TechnicianProfile:166:8" data-dynamic-content="true" className="space-y-3">
          <div data-source-location="pages/TechnicianProfile:167:10" data-dynamic-content="true" className="flex items-center gap-3 py-2">
            <div data-source-location="pages/TechnicianProfile:168:12" data-dynamic-content="false" className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Phone data-source-location="pages/TechnicianProfile:169:14" data-dynamic-content="false" className="w-5 h-5 text-emerald-600" />
            </div>
            <div data-source-location="pages/TechnicianProfile:171:12" data-dynamic-content="true">
              <p data-source-location="pages/TechnicianProfile:172:14" data-dynamic-content="false" className="text-sm text-gray-500">Phone</p>
              <p data-source-location="pages/TechnicianProfile:173:14" data-dynamic-content="true" className="font-medium">{technician?.phone || user?.phone || 'Not set'}</p>
            </div>
          </div>
          <div data-source-location="pages/TechnicianProfile:176:10" data-dynamic-content="true" className="flex items-center gap-3 py-2">
            <div data-source-location="pages/TechnicianProfile:177:12" data-dynamic-content="false" className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Mail data-source-location="pages/TechnicianProfile:178:14" data-dynamic-content="false" className="w-5 h-5 text-blue-600" />
            </div>
            <div data-source-location="pages/TechnicianProfile:180:12" data-dynamic-content="true">
              <p data-source-location="pages/TechnicianProfile:181:14" data-dynamic-content="false" className="text-sm text-gray-500">Email</p>
              <p data-source-location="pages/TechnicianProfile:182:14" data-dynamic-content="true" className="font-medium">{user?.email || 'Not set'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Specializations */}
      {technician?.specializations?.length > 0 &&
      <Card data-source-location="pages/TechnicianProfile:190:8" data-dynamic-content="true">
          <CardHeader data-source-location="pages/TechnicianProfile:191:10" data-dynamic-content="false" className="pb-2">
            <CardTitle data-source-location="pages/TechnicianProfile:192:12" data-dynamic-content="false" className="text-base flex items-center gap-2">
              <Award data-source-location="pages/TechnicianProfile:193:14" data-dynamic-content="false" className="w-5 h-5 text-purple-500" />
              Specializations
            </CardTitle>
          </CardHeader>
          <CardContent data-source-location="pages/TechnicianProfile:197:10" data-dynamic-content="true">
            <div data-source-location="pages/TechnicianProfile:198:12" data-dynamic-content="true" className="flex flex-wrap gap-2">
              {technician.specializations.map((spec, idx) =>
            <Badge data-source-location="pages/TechnicianProfile:200:16" data-dynamic-content="true" key={idx} variant="default" className="py-1.5 px-3 bg-primary text-primary-foreground">
                  {spec}
                </Badge>
            )}
            </div>
          </CardContent>
        </Card>
      }

      {/* Settings */}
      <Card data-source-location="pages/TechnicianProfile:210:6" data-dynamic-content="true">
        <CardHeader data-source-location="pages/TechnicianProfile:211:8" data-dynamic-content="false" className="pb-2">
          <CardTitle data-source-location="pages/TechnicianProfile:212:10" data-dynamic-content="false" className="text-base">Settings</CardTitle>
        </CardHeader>
        <CardContent data-source-location="pages/TechnicianProfile:214:8" data-dynamic-content="true" className="space-y-1">
          <div data-source-location="pages/TechnicianProfile:215:10" data-dynamic-content="true" className="flex items-center justify-between py-3">
            <div data-source-location="pages/TechnicianProfile:216:12" data-dynamic-content="false" className="flex items-center gap-3">
              <Bell data-source-location="pages/TechnicianProfile:217:14" data-dynamic-content="false" className="w-5 h-5 text-gray-400" />
              <span data-source-location="pages/TechnicianProfile:218:14" data-dynamic-content="false">Push Notifications</span>
            </div>
            <Switch data-source-location="pages/TechnicianProfile:220:12" data-dynamic-content="false" checked={notifications} onCheckedChange={setNotifications} />
          </div>
          <div data-source-location="pages/TechnicianProfile:222:10" data-dynamic-content="false" className="flex items-center justify-between py-3 border-t">
            <div data-source-location="pages/TechnicianProfile:223:12" data-dynamic-content="false" className="flex items-center gap-3">
              <HelpCircle data-source-location="pages/TechnicianProfile:224:14" data-dynamic-content="false" className="w-5 h-5 text-gray-400" />
              <span data-source-location="pages/TechnicianProfile:225:14" data-dynamic-content="false">Help & Support</span>
            </div>
            <ChevronRight data-source-location="pages/TechnicianProfile:227:12" data-dynamic-content="false" className="w-5 h-5 text-gray-400" />
          </div>
        </CardContent>
      </Card>

      {/* Logout */}
      <Button data-source-location="pages/TechnicianProfile:233:6" data-dynamic-content="false"
      variant="outline"
      className="w-full h-12 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
      onClick={handleLogout}
      disabled={isLoggingOut}>

        {isLoggingOut ? (
          <Loader2 className="w-5 h-5 mr-2 animate-spin text-red-600" />
        ) : (
          <LogOut className="w-5 h-5 mr-2 text-red-600" />
        )}
        <span className="text-red-600">Log Out</span>
      </Button>

      <a
        href="https://robertsqi.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-center text-sm text-primary underline underline-offset-2 hover:opacity-90 block"
      >
        Powered by Roberts Quality Irrigation LLC
      </a>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to logout? You will need to sign in again to access your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoggingOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLogout}
              disabled={isLoggingOut}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoggingOut ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Logging out...
                </>
              ) : (
                'Logout'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);

}