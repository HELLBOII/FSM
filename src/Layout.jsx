import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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
import NotificationBell from '@/components/notifications/NotificationBell';
import OfflineIndicator from '@/components/offline/OfflineIndicator';
import {
  LayoutDashboard,
  FileText,
  Calendar,
  MapPin,
  ClipboardCheck,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Menu,
  Droplets,
  ChevronRight,
  Wrench,
  Package,
  UserCircle,
  Home,
  CheckSquare,
  Navigation,
  Loader2 } from
'lucide-react';

// Web navigation items for Admin/Supervisor
const webNavItems = [
{ name: 'Dashboard', icon: LayoutDashboard, page: 'AdminDashboard' },
{ name: 'Service Requests', icon: FileText, page: 'ServiceRequests' },
{ name: 'Calendar', icon: Calendar, page: 'Calendar' },
{ name: 'Live Tracking', icon: MapPin, page: 'LiveTracking' },
{ name: 'Work Reports', icon: ClipboardCheck, page: 'WorkReports' },
{ name: 'Reports', icon: BarChart3, page: 'Reports' },
{ divider: true },
{ name: 'Technicians', icon: Users, page: 'Technicians' },
{ name: 'Clients', icon: UserCircle, page: 'Clients' },
{ name: 'Equipment', icon: Package, page: 'EquipmentInventory' }];


// Mobile navigation for Technicians
const mobileNavItems = [
{ name: 'Dashboard', icon: LayoutDashboard, page: 'TechnicianDashboard' },
{ name: 'My Jobs', icon: Wrench, page: 'TechnicianJobs' },
{ name: 'Map', icon: Navigation, page: 'TechnicianNavigation' },
{ name: 'Profile', icon: UserCircle, page: 'TechnicianProfile' }];


// Pages that should use mobile layout
const mobilePages = ['TechnicianDashboard', 'TechnicianHome', 'TechnicianJobs', 'TechnicianNavigation', 'TechnicianProfile', 'JobDetails', 'JobExecution'];

// Pages that should have no layout
const noLayoutPages = ['Login', 'RoleSelection'];

export default function Layout({ children, currentPageName }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { user, logout } = useAuth();

  const isMobilePage = mobilePages.includes(currentPageName);
  const isNoLayout = noLayoutPages.includes(currentPageName);
  const userRole = user?.user_role || 'admin';

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
      setIsLoggingOut(false);
      setShowLogoutDialog(false);
    }
  };

  // No layout for role selection page
  if (isNoLayout) {
    return <>{children}</>;
  }

  // Mobile layout for technicians
  if (isMobilePage) {
    return (
      <div data-source-location="Layout:90:6" data-dynamic-content="true" className="min-h-screen bg-gray-50 flex flex-col">
        <OfflineIndicator data-source-location="Layout:91:8" data-dynamic-content="false" />
        
        {/* Mobile Header */}
        <header data-source-location="Layout:94:8" data-dynamic-content="false" className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
          <div data-source-location="Layout:95:10" data-dynamic-content="false" className="flex items-center gap-2">
            {/* <div data-source-location="Layout:96:12" data-dynamic-content="false" className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Droplets data-source-location="Layout:97:14" data-dynamic-content="false" className="w-5 h-5 text-white" />
            </div> */}
            <img src="/images/logohalf.png" alt="Techsigaram" className="w-14 h-14" />
            <div data-source-location="Layout:99:12" data-dynamic-content="false">
              <span data-source-location="Layout:100:14" data-dynamic-content="false" className="font-bold text-xl text-gray-900">TECHSIGARAM</span>
              <p data-source-location="Layout:101:14" data-dynamic-content="false" className="text-xs text-gray-500">Field Service Management</p>
            </div>
          </div>
          <div data-source-location="Layout:101:10" data-dynamic-content="false" className="flex items-center gap-2">
            <NotificationBell data-source-location="Layout:102:12" data-dynamic-content="false" />
          </div>
        </header>

        {/* Content */}
        <main data-source-location="Layout:107:8" data-dynamic-content="true" className="flex-1 overflow-auto pb-20">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav data-source-location="Layout:112:8" data-dynamic-content="true" className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-2 z-50">
          <div data-source-location="Layout:113:10" data-dynamic-content="true" className="flex justify-around items-center max-w-md mx-auto">
            {mobileNavItems.map((item) => {
              const isActive = currentPageName === item.page;
              return (
                <Link data-source-location="Layout:117:16" data-dynamic-content="true"
                key={item.page}
                to={createPageUrl(item.page)}
                className={cn(
                  'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all',
                  isActive ?
                  'bg-primary/10 text-primary' :
                  'text-gray-500 hover:text-gray-900'
                )}>

                  <item.icon data-source-location="Layout:127:18" data-dynamic-content="false" className={cn('w-6 h-6', isActive && 'text-primary')} />
                  <span data-source-location="Layout:128:18" data-dynamic-content="true" className="text-xs font-medium">{item.name}</span>
                </Link>);

            })}
          </div>
        </nav>
      </div>);

  }

  // Web layout for Admin/Supervisor
  return (
    <div data-source-location="Layout:140:4" data-dynamic-content="true" className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <aside data-source-location="Layout:142:6" data-dynamic-content="true" className="hidden lg:flex w-72 flex-col bg-white border-r border-primary/20 fixed inset-y-0 z-30">
        {/* Logo */}
        <div data-source-location="Layout:144:8" data-dynamic-content="true" className="p-6 border-b border-primary/20">
          <Link data-source-location="Layout:145:10" data-dynamic-content="false" to={createPageUrl('AdminDashboard')} className="flex items-center">
            <img src="/images/logohalf.png" alt="Techsigaram" className="w-14 h-14" />
            {/* <div data-source-location="Layout:146:12" data-dynamic-content="false" className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <Droplets data-source-location="Layout:147:14" data-dynamic-content="false" className="w-6 h-6 text-white" />
            </div> */}
            <div data-source-location="Layout:149:12" data-dynamic-content="false">
              <span data-source-location="Layout:150:14" data-dynamic-content="false" className="font-bold text-xl text-gray-900">TECHSIGARAM</span>
              <p data-source-location="Layout:151:14" data-dynamic-content="false" className="text-xs text-gray-500">Field Service Management</p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav data-source-location="Layout:157:8" data-dynamic-content="true" className="flex-1 p-4 space-y-1 overflow-y-auto">
          {webNavItems.map((item, index) => {
            if (item.divider) {
              return <div data-source-location="Layout:160:21" data-dynamic-content="false" key={index} className="h-px bg-primary/20 my-4" />;
            }
            const isActive = currentPageName === item.page;
            return (
              <Link data-source-location="Layout:164:14" data-dynamic-content="true"
              key={item.page}
              to={createPageUrl(item.page)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group',
                isActive ?
                'bg-primary/10 text-primary font-medium' :
                'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}>

                <item.icon data-source-location="Layout:174:16" data-dynamic-content="false" className={cn(
                  'w-5 h-5 transition-colors',
                  isActive ? 'text-primary' : 'text-gray-400 group-hover:text-gray-600'
                )} />
                <span data-source-location="Layout:178:16" data-dynamic-content="true">{item.name}</span>
                {isActive &&
                <ChevronRight data-source-location="Layout:180:18" data-dynamic-content="false" className="w-4 h-4 ml-auto text-primary" />
                }
              </Link>);

          })}
        </nav>

        {/* User Section */}
        <div data-source-location="Layout:188:8" data-dynamic-content="true" className="p-4 border-t border-primary/20">
          <DropdownMenu data-source-location="Layout:189:10" data-dynamic-content="true">
            <DropdownMenuTrigger data-source-location="Layout:190:12" data-dynamic-content="true" asChild>
              <button data-source-location="Layout:191:14" data-dynamic-content="true" className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
                <Avatar data-source-location="Layout:192:16" data-dynamic-content="true" className="h-9 w-9">
                  <AvatarImage data-source-location="Layout:193:18" data-dynamic-content="false" src={user?.avatar_url} />
                  <AvatarFallback data-source-location="Layout:194:18" data-dynamic-content="true" className="bg-primary/10 text-primary">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div data-source-location="Layout:198:16" data-dynamic-content="true" className="flex-1 text-left">
                  <p data-source-location="Layout:199:18" data-dynamic-content="true" className="text-sm font-medium text-gray-900 truncate">
                    {user?.email || 'User'}
                  </p>
                  <p data-source-location="Layout:202:18" data-dynamic-content="true" className="text-xs text-gray-500 capitalize">{userRole}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent data-source-location="Layout:206:12" data-dynamic-content="true" align="end" className="w-56">
              <DropdownMenuLabel data-source-location="Layout:207:14" data-dynamic-content="false">My Account</DropdownMenuLabel>
              <DropdownMenuSeparator data-source-location="Layout:208:14" data-dynamic-content="false" />
              <DropdownMenuItem data-source-location="Layout:216:14" data-dynamic-content="false"
              onClick={handleLogout}
              className="text-red-600"
              disabled={isLoggingOut}>

                {isLoggingOut ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <LogOut data-source-location="Layout:220:16" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                )}
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Mobile Header + Sidebar */}
      <div data-source-location="Layout:229:6" data-dynamic-content="true" className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-40">
        <div data-source-location="Layout:230:8" data-dynamic-content="true" className="flex items-center justify-between px-4 py-3">
          <Sheet data-source-location="Layout:231:10" data-dynamic-content="true" open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger data-source-location="Layout:232:12" data-dynamic-content="false" asChild>
              <Button data-source-location="Layout:233:14" data-dynamic-content="false" variant="ghost" size="icon">
                <Menu data-source-location="Layout:234:16" data-dynamic-content="false" className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent data-source-location="Layout:237:12" data-dynamic-content="true" side="left" className="w-72 p-0">
              <div data-source-location="Layout:238:14" data-dynamic-content="false" className="p-6 border-b border-primary/20">
                <div data-source-location="Layout:239:16" data-dynamic-content="false" className="flex items-center gap-3">
                  <img src="/images/logohalf.png" alt="Techsigaram" className="w-14 h-14" />
                  <div data-source-location="Layout:240:18" data-dynamic-content="false">
                    <span data-source-location="Layout:241:20" data-dynamic-content="false" className="font-bold text-xl text-gray-900">TECHSIGARAM</span>
                    <p data-source-location="Layout:242:20" data-dynamic-content="false" className="text-xs text-gray-500">Field Service Management</p>
                  </div>
                </div>
              </div>
              <nav data-source-location="Layout:246:14" data-dynamic-content="true" className="p-4 space-y-1">
                {webNavItems.map((item, index) => {
                  if (item.divider) {
                    return <div data-source-location="Layout:249:27" data-dynamic-content="false" key={index} className="h-px bg-primary/20 my-4" />;
                  }
                  const isActive = currentPageName === item.page;
                  return (
                    <Link data-source-location="Layout:253:20" data-dynamic-content="true"
                    key={item.page}
                    to={createPageUrl(item.page)}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl transition-all',
                      isActive ?
                      'bg-primary/10 text-primary font-medium' :
                      'text-gray-600 hover:bg-gray-50'
                    )}>

                      <item.icon data-source-location="Layout:264:22" data-dynamic-content="false" className={cn(
                        'w-5 h-5',
                        isActive ? 'text-primary' : 'text-gray-400'
                      )} />
                      <span data-source-location="Layout:268:22" data-dynamic-content="true">{item.name}</span>
                    </Link>);

                })}
              </nav>
            </SheetContent>
          </Sheet>

          <Link data-source-location="Layout:276:10" data-dynamic-content="false" to={createPageUrl('AdminDashboard')} className="flex items-center gap-2">
            <img src="/images/logohalf.png" alt="Techsigaram" className="w-14 h-14" />
            <div data-source-location="Layout:277:12" data-dynamic-content="false">
              <span data-source-location="Layout:278:14" data-dynamic-content="false" className="font-bold text-xl text-gray-900">TECHSIGARAM</span>
              <p data-source-location="Layout:279:14" data-dynamic-content="false" className="text-xs text-gray-500">Field Service Management</p>
            </div>
          </Link>

          <div data-source-location="Layout:283:10" data-dynamic-content="true" className="flex items-center gap-2">
            <NotificationBell data-source-location="Layout:284:12" data-dynamic-content="false" />
            <DropdownMenu data-source-location="Layout:285:12" data-dynamic-content="true">
              <DropdownMenuTrigger data-source-location="Layout:286:14" data-dynamic-content="true" asChild>
                <Button data-source-location="Layout:287:16" data-dynamic-content="true" variant="ghost" size="icon">
                  <Avatar data-source-location="Layout:288:18" data-dynamic-content="true" className="h-8 w-8">
                    <AvatarImage data-source-location="Layout:289:20" data-dynamic-content="false" src={user?.avatar_url} />
                    <AvatarFallback data-source-location="Layout:290:20" data-dynamic-content="true" className="bg-primary/10 text-primary text-sm">
                      {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent data-source-location="Layout:296:14" data-dynamic-content="true" align="end">
                <DropdownMenuLabel data-source-location="Layout:297:16" data-dynamic-content="true">{user?.email || 'User'}</DropdownMenuLabel>
                <DropdownMenuSeparator data-source-location="Layout:298:16" data-dynamic-content="false" />
                <DropdownMenuItem data-source-location="Layout:299:16" data-dynamic-content="false" onClick={handleLogout} className="text-red-600" disabled={isLoggingOut}>
                  {isLoggingOut ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <LogOut data-source-location="Layout:300:18" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                  )}
                  {isLoggingOut ? 'Logging out...' : 'Logout'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main data-source-location="Layout:310:6" data-dynamic-content="true" className="flex-1 lg:ml-72 pt-16 lg:pt-0">
        <div data-source-location="Layout:311:8" data-dynamic-content="true" className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>

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