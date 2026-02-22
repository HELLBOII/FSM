import React, { useState, useMemo } from 'react';
import { equipmentService, appSettingsService } from '@/services';
import { useQuery } from '@tanstack/react-query';
import { Package, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';

/** Field keys and labels for technician equipment detail view. Matches EquipmentInventory fields. Exported for admin config. */
export const TECHNICIAN_EQUIPMENT_FIELD_OPTIONS = {
  name: 'Item Name',
  category: 'Category',
  specialization: 'Specialization',
  sku: 'SKU',
  unit: 'Unit',
  stock_quantity: 'Stock',
  min_stock_level: 'Min Stock Level',
  unit_cost: 'Unit Cost',
  sellingcost: 'Billable Cost',
  status: 'Status',
  description: 'Description',
};

function getStockStatus(item) {
  if (item.stock_quantity <= 0) return 'Out of Stock';
  if (item.min_stock_level != null && item.stock_quantity <= item.min_stock_level) return 'Low Stock';
  return 'In Stock';
}

function formatValue(key, value, item) {
  if (key === 'unit_cost' || key === 'sellingcost') {
    return `$${(value != null && value !== '') ? Number(value).toFixed(2) : '0.00'}`;
  }
  if (value === undefined || value === null || value === '') return '—';
  if (key === 'category' && typeof value === 'string') {
    return value.replace(/_/g, ' ');
  }
  if (key === 'specialization') return value;
  if (key === 'status') return getStockStatus(item);
  return String(value);
}

export default function TechnicianEquipment() {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ['equipment', 'technician-list'],
    queryFn: () => equipmentService.list('name', 'asc')
  });

  const { data: enabledFieldKeys = null } = useQuery({
    queryKey: ['appSettings', 'technician_equipment_fields'],
    queryFn: () => appSettingsService.getTechnicianEquipmentFields()
  });

  const fieldLabels = TECHNICIAN_EQUIPMENT_FIELD_OPTIONS;
  // Only show fields that are selected in Settings (Technician Equipment View). If nothing saved yet, show all.
  const fieldsToShow = useMemo(() => {
    if (enabledFieldKeys == null || !Array.isArray(enabledFieldKeys)) {
      return Object.keys(fieldLabels);
    }
    return enabledFieldKeys.filter((k) => fieldLabels[k]);
  }, [enabledFieldKeys]);

  const filteredEquipment = useMemo(() => {
    if (!searchQuery.trim()) return equipment;
    const q = searchQuery.trim().toLowerCase();
    return equipment.filter(
      (item) =>
        item.name?.toLowerCase().includes(q) ||
        item.sku?.toLowerCase().includes(q)
    );
  }, [equipment, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" text="Loading equipment..." />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Equipment</h1>
        <p className="text-sm text-gray-500 mt-1">Equipment and parts — expand for details</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          placeholder="Search by name or SKU..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-11 h-12 rounded-xl bg-gray-50 border-gray-200"
        />
      </div>

      {filteredEquipment.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No items found"
          description={searchQuery ? 'Try a different search' : 'No equipment in inventory'}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Accordion type="single" collapsible className="w-full">
              {filteredEquipment.map((item) => {
                const spec = item.specialization ?? (Array.isArray(item.specializations) && item.specializations[0]) ?? '';
                const displayItem = { ...item, specialization: spec };
                return (
                  <AccordionItem key={item.id} value={item.id}>
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-50/50">
                      <span className="font-medium text-gray-900 text-left">
                        {item.name || 'Unnamed item'}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-0">
                      {fieldsToShow.length === 0 ? (
                        <p className="text-sm text-gray-500">No fields enabled for this view. Ask your admin to choose fields in Settings.</p>
                      ) : (
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          {fieldsToShow
                            .filter((key) => key !== 'name')
                            .map((key) => {
                              const label = fieldLabels[key];
                              if (!label) return null;
                              return (
                                <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                                  <dt className="text-gray-500 font-medium min-w-[120px]">{label}</dt>
                                  <dd className="text-gray-900">
                                    {key === 'status'
                                      ? getStockStatus(item)
                                      : formatValue(key, displayItem[key], item)}
                                  </dd>
                                </div>
                              );
                            })}
                        </dl>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
