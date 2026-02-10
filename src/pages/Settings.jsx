import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  Settings as SettingsIcon,
  User,
  Bell,
  Shield,
  Database,
  LogOut } from
'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import PageHeader from '@/components/common/PageHeader';

export default function Settings() {
  const { user, logout } = useAuth();

  return (
    <div data-source-location="pages/Settings:25:4" data-dynamic-content="true" className="space-y-6 max-w-2xl">
      <PageHeader data-source-location="pages/Settings:26:6" data-dynamic-content="false"
      title="Settings"
      subtitle="Manage your account and preferences" />


      {/* Profile */}
      <Card data-source-location="pages/Settings:32:6" data-dynamic-content="true">
        <CardHeader data-source-location="pages/Settings:33:8" data-dynamic-content="false">
          <CardTitle data-source-location="pages/Settings:34:10" data-dynamic-content="false" className="flex items-center gap-2">
            <User data-source-location="pages/Settings:35:12" data-dynamic-content="false" className="w-5 h-5" />
            Profile
          </CardTitle>
          <CardDescription data-source-location="pages/Settings:38:10" data-dynamic-content="false">Your account information</CardDescription>
        </CardHeader>
        <CardContent data-source-location="pages/Settings:40:8" data-dynamic-content="true">
          <div data-source-location="pages/Settings:41:10" data-dynamic-content="true" className="flex items-center gap-4">
            <Avatar data-source-location="pages/Settings:42:12" data-dynamic-content="true" className="h-16 w-16">
              <AvatarImage data-source-location="pages/Settings:43:14" data-dynamic-content="false" src={user?.avatar_url} />
              <AvatarFallback data-source-location="pages/Settings:44:14" data-dynamic-content="true" className="bg-emerald-100 text-emerald-700 text-xl">
                {user?.full_name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div data-source-location="pages/Settings:48:12" data-dynamic-content="true">
              <h3 data-source-location="pages/Settings:49:14" data-dynamic-content="true" className="font-semibold text-gray-900">{user?.full_name || 'User'}</h3>
              <p data-source-location="pages/Settings:50:14" data-dynamic-content="true" className="text-gray-500">{user?.email}</p>
              <p data-source-location="pages/Settings:51:14" data-dynamic-content="true" className="text-sm text-gray-400 capitalize mt-1">Role: {user?.user_role || 'User'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card data-source-location="pages/Settings:58:6" data-dynamic-content="false">
        <CardHeader data-source-location="pages/Settings:59:8" data-dynamic-content="false">
          <CardTitle data-source-location="pages/Settings:60:10" data-dynamic-content="false" className="flex items-center gap-2">
            <Bell data-source-location="pages/Settings:61:12" data-dynamic-content="false" className="w-5 h-5" />
            Notifications
          </CardTitle>
          <CardDescription data-source-location="pages/Settings:64:10" data-dynamic-content="false">Configure notification preferences</CardDescription>
        </CardHeader>
        <CardContent data-source-location="pages/Settings:66:8" data-dynamic-content="false" className="space-y-4">
          <div data-source-location="pages/Settings:67:10" data-dynamic-content="false" className="flex items-center justify-between">
            <div data-source-location="pages/Settings:68:12" data-dynamic-content="false">
              <p data-source-location="pages/Settings:69:14" data-dynamic-content="false" className="font-medium">Email Notifications</p>
              <p data-source-location="pages/Settings:70:14" data-dynamic-content="false" className="text-sm text-gray-500">Receive email updates about jobs</p>
            </div>
            <Switch data-source-location="pages/Settings:72:12" data-dynamic-content="false" defaultChecked />
          </div>
          <div data-source-location="pages/Settings:74:10" data-dynamic-content="false" className="flex items-center justify-between">
            <div data-source-location="pages/Settings:75:12" data-dynamic-content="false">
              <p data-source-location="pages/Settings:76:14" data-dynamic-content="false" className="font-medium">SLA Alerts</p>
              <p data-source-location="pages/Settings:77:14" data-dynamic-content="false" className="text-sm text-gray-500">Get notified when SLAs are at risk</p>
            </div>
            <Switch data-source-location="pages/Settings:79:12" data-dynamic-content="false" defaultChecked />
          </div>
          <div data-source-location="pages/Settings:81:10" data-dynamic-content="false" className="flex items-center justify-between">
            <div data-source-location="pages/Settings:82:12" data-dynamic-content="false">
              <p data-source-location="pages/Settings:83:14" data-dynamic-content="false" className="font-medium">Daily Summary</p>
              <p data-source-location="pages/Settings:84:14" data-dynamic-content="false" className="text-sm text-gray-500">Receive daily job summary reports</p>
            </div>
            <Switch data-source-location="pages/Settings:86:12" data-dynamic-content="false" />
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card data-source-location="pages/Settings:92:6" data-dynamic-content="false">
        <CardHeader data-source-location="pages/Settings:93:8" data-dynamic-content="false">
          <CardTitle data-source-location="pages/Settings:94:10" data-dynamic-content="false" className="flex items-center gap-2">
            <Shield data-source-location="pages/Settings:95:12" data-dynamic-content="false" className="w-5 h-5" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent data-source-location="pages/Settings:99:8" data-dynamic-content="false" className="space-y-4">
          <Button data-source-location="pages/Settings:100:10" data-dynamic-content="false" variant="outline" className="w-full justify-start">
            Change Password
          </Button>
          <Button data-source-location="pages/Settings:103:10" data-dynamic-content="false" variant="outline" className="w-full justify-start">
            Two-Factor Authentication
          </Button>
        </CardContent>
      </Card>

      {/* System */}
      <Card data-source-location="pages/Settings:110:6" data-dynamic-content="false">
        <CardHeader data-source-location="pages/Settings:111:8" data-dynamic-content="false">
          <CardTitle data-source-location="pages/Settings:112:10" data-dynamic-content="false" className="flex items-center gap-2">
            <Database data-source-location="pages/Settings:113:12" data-dynamic-content="false" className="w-5 h-5" />
            System
          </CardTitle>
        </CardHeader>
        <CardContent data-source-location="pages/Settings:117:8" data-dynamic-content="false" className="space-y-2">
          <div data-source-location="pages/Settings:118:10" data-dynamic-content="false" className="flex items-center justify-between py-2">
            <span data-source-location="pages/Settings:119:12" data-dynamic-content="false" className="text-gray-600">Version</span>
            <span data-source-location="pages/Settings:120:12" data-dynamic-content="false" className="font-medium">1.0.0</span>
          </div>
          <div data-source-location="pages/Settings:122:10" data-dynamic-content="false" className="flex items-center justify-between py-2">
            <span data-source-location="pages/Settings:123:12" data-dynamic-content="false" className="text-gray-600">Environment</span>
            <span data-source-location="pages/Settings:124:12" data-dynamic-content="false" className="font-medium">Production</span>
          </div>
        </CardContent>
      </Card>

      {/* Logout */}
      <Button data-source-location="pages/Settings:130:6" data-dynamic-content="false"
      variant="outline"
      className="w-full text-red-600 border-red-200 hover:bg-red-50"
      onClick={() => logout()}>

        <LogOut data-source-location="pages/Settings:135:8" data-dynamic-content="false" className="w-4 h-4 mr-2" />
        Log Out
      </Button>
    </div>);

}