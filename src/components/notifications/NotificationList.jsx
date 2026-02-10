import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { CheckCheck, Bell, FileText, ClipboardCheck, AlertCircle, Info } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";

const iconMap = {
  job_assigned: FileText,
  job_updated: FileText,
  report_approved: ClipboardCheck,
  report_rejected: AlertCircle,
  system: Bell,
  info: Info,
};

const colorMap = {
  job_assigned: 'bg-emerald-100 text-emerald-700',
  job_updated: 'bg-blue-100 text-blue-700',
  report_approved: 'bg-green-100 text-green-700',
  report_rejected: 'bg-red-100 text-red-700',
  system: 'bg-gray-100 text-gray-700',
  info: 'bg-blue-100 text-blue-700',
};

export default function NotificationList({ notifications, onMarkAsRead, onMarkAllAsRead, onClose }) {
  const navigate = useNavigate();

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
      onClose();
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="flex flex-col max-h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h3 className="font-semibold text-gray-900">Notifications</h3>
          {unreadCount > 0 && (
            <p className="text-xs text-gray-500">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkAllAsRead}
            className="text-xs"
          >
            <CheckCheck className="w-3 h-3 mr-1" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">No notifications yet</p>
          </div>
        ) : (
          notifications.map((notification) => {
            const Icon = iconMap[notification.type] || Info;
            const colorClass = colorMap[notification.type] || colorMap.info;
            
            return (
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={cn(
                  'w-full p-4 border-b text-left hover:bg-gray-50 transition-colors',
                  !notification.is_read && 'bg-blue-50/50'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', colorClass)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn(
                        'text-sm font-medium text-gray-900',
                        !notification.is_read && 'font-semibold'
                      )}>
                        {notification.title}
                      </p>
                      {!notification.is_read && (
                        <span className="w-2 h-2 bg-emerald-500 rounded-full shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {format(new Date(notification.created_at || notification.created_date), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}