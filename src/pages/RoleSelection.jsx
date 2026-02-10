import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Droplets,
  Shield,
  Eye,
  Wrench,
  Leaf,
  ChevronRight,
  Loader2 } from
'lucide-react';

const roles = [
{
  id: 'admin',
  title: 'Administrator',
  description: 'Full system access - manage requests, scheduling, technicians, and reports',
  icon: Shield,
  color: 'emerald',
  redirect: 'AdminDashboard'
},
{
  id: 'supervisor',
  title: 'Supervisor',
  description: 'Review and approve work reports, monitor field operations',
  icon: Eye,
  color: 'blue',
  redirect: 'AdminDashboard'
},
{
  id: 'technician',
  title: 'Field Technician',
  description: 'View assigned jobs, navigate to sites, execute and report work',
  icon: Wrench,
  color: 'orange',
  redirect: 'TechnicianHome'
},
{
  id: 'client',
  title: 'Farmer / Client',
  description: 'View service requests and appointment status',
  icon: Leaf,
  color: 'green',
  redirect: 'ClientDashboard'
}];


const colorClasses = {
  emerald: {
    bg: 'bg-primary/10',
    border: 'border-primary/30 hover:border-primary/50',
    icon: 'bg-primary/10 text-primary',
    selected: 'ring-2 ring-primary border-primary'
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200 hover:border-blue-400',
    icon: 'bg-blue-100 text-blue-600',
    selected: 'ring-2 ring-blue-500 border-blue-500'
  },
  orange: {
    bg: 'bg-orange-50',
    border: 'border-orange-200 hover:border-orange-400',
    icon: 'bg-orange-100 text-orange-600',
    selected: 'ring-2 ring-orange-500 border-orange-500'
  },
  green: {
    bg: 'bg-green-50',
    border: 'border-green-200 hover:border-green-400',
    icon: 'bg-green-100 text-green-600',
    selected: 'ring-2 ring-green-500 border-green-500'
  }
};

export default function RoleSelection() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState(null);

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    }
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (role) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');
      // Update user metadata with role
      const { error } = await supabase.auth.updateUser({
        data: { user_role: role }
      });
      if (error) throw error;
      return { ...user, user_role: role };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    }
  });

  // If user already has a role, redirect
  useEffect(() => {
    if (user?.user_role) {
      const role = roles.find((r) => r.id === user.user_role);
      if (role) {
        navigate(createPageUrl(role.redirect));
      }
    }
  }, [user, navigate]);

  const handleContinue = async () => {
    if (!selectedRole) return;

    await updateRoleMutation.mutateAsync(selectedRole);
    const role = roles.find((r) => r.id === selectedRole);
    navigate(createPageUrl(role.redirect));
  };

  if (userLoading) {
    return (
      <div data-source-location="pages/RoleSelection:118:6" data-dynamic-content="false" className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-white to-blue-50">
        <Loader2 data-source-location="pages/RoleSelection:119:8" data-dynamic-content="false" className="w-8 h-8 animate-spin text-primary" />
      </div>);

  }

  return (
    <div data-source-location="pages/RoleSelection:125:4" data-dynamic-content="true" className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-blue-50 flex flex-col">
      {/* Header */}
      <header data-source-location="pages/RoleSelection:127:6" data-dynamic-content="false" className="p-6">
        <div data-source-location="pages/RoleSelection:128:8" data-dynamic-content="false" className="flex items-center gap-3">
          <div data-source-location="pages/RoleSelection:129:10" data-dynamic-content="false" className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/20">
            <Droplets data-source-location="pages/RoleSelection:130:12" data-dynamic-content="false" className="w-7 h-7 text-white" />
          </div>
          <div data-source-location="pages/RoleSelection:132:10" data-dynamic-content="false">
            <h1 data-source-location="pages/RoleSelection:133:12" data-dynamic-content="false" className="text-2xl font-bold text-gray-900">IrriServe</h1>
            <p data-source-location="pages/RoleSelection:134:12" data-dynamic-content="false" className="text-sm text-gray-500">Field Service Management</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main data-source-location="pages/RoleSelection:140:6" data-dynamic-content="true" className="flex-1 flex items-center justify-center p-6">
        <motion.div data-source-location="pages/RoleSelection:141:8" data-dynamic-content="true"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl">

          <div data-source-location="pages/RoleSelection:146:10" data-dynamic-content="false" className="text-center mb-8">
            <h2 data-source-location="pages/RoleSelection:147:12" data-dynamic-content="false" className="text-3xl font-bold text-gray-900 mb-2">Welcome Back!</h2>
            <p data-source-location="pages/RoleSelection:148:12" data-dynamic-content="false" className="text-gray-600">Select your role to continue to the dashboard</p>
          </div>

          <div data-source-location="pages/RoleSelection:151:10" data-dynamic-content="true" className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {roles.map((role, index) => {
              const colors = colorClasses[role.color];
              const isSelected = selectedRole === role.id;

              return (
                <motion.div data-source-location="pages/RoleSelection:157:16" data-dynamic-content="true"
                key={role.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}>

                  <Card data-source-location="pages/RoleSelection:163:18" data-dynamic-content="true"
                  className={`cursor-pointer transition-all duration-300 ${colors.border} ${isSelected ? colors.selected : ''}`}
                  onClick={() => setSelectedRole(role.id)}>

                    <CardContent data-source-location="pages/RoleSelection:167:20" data-dynamic-content="true" className="p-6">
                      <div data-source-location="pages/RoleSelection:168:22" data-dynamic-content="true" className="flex items-start gap-4">
                        <div data-source-location="pages/RoleSelection:169:24" data-dynamic-content="false" className={`w-12 h-12 rounded-xl ${colors.icon} flex items-center justify-center flex-shrink-0`}>
                          <role.icon data-source-location="pages/RoleSelection:170:26" data-dynamic-content="false" className="w-6 h-6" />
                        </div>
                        <div data-source-location="pages/RoleSelection:172:24" data-dynamic-content="true" className="flex-1">
                          <h3 data-source-location="pages/RoleSelection:173:26" data-dynamic-content="true" className="font-semibold text-gray-900 mb-1">{role.title}</h3>
                          <p data-source-location="pages/RoleSelection:174:26" data-dynamic-content="true" className="text-sm text-gray-500">{role.description}</p>
                        </div>
                        {isSelected &&
                        <div data-source-location="pages/RoleSelection:177:26" data-dynamic-content="false" className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                            <ChevronRight data-source-location="pages/RoleSelection:178:28" data-dynamic-content="false" className="w-4 h-4 text-white" />
                          </div>
                        }
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>);

            })}
          </div>

          <div data-source-location="pages/RoleSelection:189:10" data-dynamic-content="true" className="flex justify-center">
            <Button data-source-location="pages/RoleSelection:190:12" data-dynamic-content="true"
            onClick={handleContinue}
            disabled={!selectedRole || updateRoleMutation.isPending}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg">

              {updateRoleMutation.isPending ?
              <Loader2 data-source-location="pages/RoleSelection:196:16" data-dynamic-content="false" className="w-5 h-5 mr-2 animate-spin text-primary-foreground" /> :
              null}
              Continue to Dashboard
              <ChevronRight data-source-location="pages/RoleSelection:199:14" data-dynamic-content="false" className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer data-source-location="pages/RoleSelection:206:6" data-dynamic-content="false" className="p-6 text-center text-sm text-gray-500">
        <p data-source-location="pages/RoleSelection:207:8" data-dynamic-content="false">© 2024 IrriServe. Irrigation Field Service Management System</p>
      </footer>
    </div>);

}