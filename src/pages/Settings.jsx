import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import PageHeader from '@/components/common/PageHeader';
import { appSettingsService } from '@/services';
import { TECHNICIAN_EQUIPMENT_FIELD_OPTIONS } from '@/pages/TechnicianEquipment';
import { toast } from 'sonner';

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userRole = user?.user_metadata?.user_role || user?.user_role;
  const isAdminOrSupervisor = userRole === 'admin' || userRole === 'supervisor';

  const { data: savedFieldKeys = null } = useQuery({
    queryKey: ['appSettings', 'technician_equipment_fields'],
    queryFn: () => appSettingsService.getTechnicianEquipmentFields(),
    enabled: isAdminOrSupervisor,
  });

  const [selectedFields, setSelectedFields] = useState(() => Object.keys(TECHNICIAN_EQUIPMENT_FIELD_OPTIONS));

  useEffect(() => {
    if (savedFieldKeys && Array.isArray(savedFieldKeys)) {
      setSelectedFields(savedFieldKeys);
    } else if (savedFieldKeys === null && isAdminOrSupervisor) {
      setSelectedFields(Object.keys(TECHNICIAN_EQUIPMENT_FIELD_OPTIONS));
    }
  }, [savedFieldKeys, isAdminOrSupervisor]);

  const saveMutation = useMutation({
    mutationFn: (keys) => appSettingsService.setTechnicianEquipmentFields(keys),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appSettings', 'technician_equipment_fields'] });
      toast.success('Technician equipment display saved');
    },
    onError: (err) => toast.error(err.message || 'Failed to save'),
  });

  const toggleField = (key) => {
    setSelectedFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const selectAll = () => setSelectedFields(Object.keys(TECHNICIAN_EQUIPMENT_FIELD_OPTIONS));
  const clearAll = () => setSelectedFields([]);

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Settings"
        subtitle="Technician equipment view options"
      />

      {isAdminOrSupervisor ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Technician Equipment View
            </CardTitle>
            <CardDescription>
              Choose which fields technicians can see on the Equipment page. If none are selected and you save, technicians will see all fields.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 mb-2">
              <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                Select all
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={clearAll}>
                Clear all
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(TECHNICIAN_EQUIPMENT_FIELD_OPTIONS).map(([key, label]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Switch
                    id={`teq-${key}`}
                    checked={selectedFields.includes(key)}
                    onCheckedChange={() => toggleField(key)}
                  />
                  <label htmlFor={`teq-${key}`} className="text-sm font-medium cursor-pointer">
                    {label}
                  </label>
                </div>
              ))}
            </div>
            <Button
              onClick={() => saveMutation.mutate(selectedFields)}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving...' : 'Save for technicians'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            You do not have access to change these settings.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
