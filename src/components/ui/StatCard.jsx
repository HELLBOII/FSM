import React from 'react';
import { cn } from "@/lib/utils";
import { motion } from 'framer-motion';

export default function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  color = 'emerald',
  className
}) {
  const colorClasses = {
    emerald: { bg: 'bg-emerald-50', icon: 'bg-emerald-500', ring: 'ring-emerald-500/20' },
    blue: { bg: 'bg-blue-50', icon: 'bg-blue-500', ring: 'ring-blue-500/20' },
    orange: { bg: 'bg-orange-50', icon: 'bg-orange-500', ring: 'ring-orange-500/20' },
    red: { bg: 'bg-red-50', icon: 'bg-red-500', ring: 'ring-red-500/20' },
    purple: { bg: 'bg-purple-50', icon: 'bg-purple-500', ring: 'ring-purple-500/20' },
    yellow: { bg: 'bg-yellow-50', icon: 'bg-yellow-500', ring: 'ring-yellow-500/20' },
    cyan: { bg: 'bg-cyan-50', icon: 'bg-cyan-500', ring: 'ring-cyan-500/20' }
  };

  const colors = colorClasses[color] || colorClasses.emerald;

  return (
    <motion.div data-source-location="components/ui/StatCard:27:4" data-dynamic-content="true"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className={cn(
      'relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-gray-100',
      'hover:shadow-md transition-all duration-300',
      className
    )}>

      <div data-source-location="components/ui/StatCard:37:6" data-dynamic-content="true" className="flex items-start justify-between">
        <div data-source-location="components/ui/StatCard:38:8" data-dynamic-content="true" className="space-y-2">
          <p data-source-location="components/ui/StatCard:39:10" data-dynamic-content="true" className="text-sm font-medium text-gray-500">{title}</p>
          <p data-source-location="components/ui/StatCard:40:10" data-dynamic-content="true" className="text-3xl font-bold text-gray-900 tracking-tight">{value}</p>
          {trend &&
          <div data-source-location="components/ui/StatCard:42:12" data-dynamic-content="true" className={cn(
            'flex items-center gap-1 text-sm font-medium',
            trend === 'up' ? 'text-green-600' : 'text-red-600'
          )}>
              <span data-source-location="components/ui/StatCard:46:14" data-dynamic-content="true">{trend === 'up' ? '↑' : '↓'}</span>
              <span data-source-location="components/ui/StatCard:47:14" data-dynamic-content="true">{trendValue}</span>
            </div>
          }
        </div>
        {Icon &&
        <div data-source-location="components/ui/StatCard:52:10" data-dynamic-content="false" className={cn(
          'p-3 rounded-xl ring-4',
          colors.icon,
          colors.ring
        )}>
            <Icon data-source-location="components/ui/StatCard:57:12" data-dynamic-content="false" className="w-6 h-6 text-white" />
          </div>
        }
      </div>
      <div data-source-location="components/ui/StatCard:61:6" data-dynamic-content="false" className={cn(
        'absolute -bottom-8 -right-8 w-32 h-32 rounded-full opacity-10',
        colors.icon
      )} />
    </motion.div>);

}