import React, { useState, useMemo } from 'react';
import { equipmentService, specializationsService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Search,
  Plus,
  AlertTriangle,
  Edit,
  MoreVertical,
  Filter,
  ChevronLeft,
  ChevronRight } from
'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator } from
"@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle } from
"@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from '@/components/common/PageHeader';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';
import { toast } from 'sonner';

const categories = [
{ value: 'pipes', label: 'Pipes & Tubing' },
{ value: 'valves', label: 'Valves' },
{ value: 'fittings', label: 'Fittings' },
{ value: 'filters', label: 'Filters' },
{ value: 'pumps', label: 'Pumps' },
{ value: 'controllers', label: 'Controllers' },
{ value: 'sensors', label: 'Sensors' },
{ value: 'tools', label: 'Tools' },
{ value: 'chemicals', label: 'Chemicals' },
{ value: 'other', label: 'Other' }];


export default function EquipmentInventory() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showForm, setShowForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showAddSpecializationDialog, setShowAddSpecializationDialog] = useState(false);
  const [newSpecialization, setNewSpecialization] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    specialization: '',
    sku: '',
    unit: '',
    stock_quantity: '',
    min_stock_level: '',
    unit_cost: '',
    sellingcost: '',
    description: ''
  });

  const { data: equipmentResult, isLoading } = useQuery({
    queryKey: ['equipment', page, pageSize, searchQuery, categoryFilter],
    queryFn: () => equipmentService.listPaginated({
      page,
      pageSize,
      search: searchQuery,
      category: categoryFilter,
      orderBy: 'created_at',
      orderDirection: 'desc'
    })
  });

  const { data: counts, isLoading: countsLoading } = useQuery({
    queryKey: ['equipment-counts'],
    queryFn: () => equipmentService.getCounts()
  });

  const equipment = equipmentResult?.data ?? [];
  const totalCount = equipmentResult?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const lowStockCount = counts?.lowStockCount ?? 0;
  const outOfStockCount = counts?.outOfStockCount ?? 0;

  const { data: dbSpecializations = [] } = useQuery({
    queryKey: ['specializations'],
    queryFn: () => specializationsService.list()
  });

  const availableSpecializations = useMemo(() => {
    const dbNames = (dbSpecializations || []).map((s) => s.specializations).filter(Boolean);
    const equipmentSpecs = (equipment || []).flatMap((e) => e.specializations || []);
    return [...new Set([...dbNames, ...equipmentSpecs])].sort();
  }, [dbSpecializations, equipment]);

  const createSpecializationMutation = useMutation({
    mutationFn: (data) => specializationsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specializations'] });
      setNewSpecialization('');
      setShowAddSpecializationDialog(false);
      toast.success('Specialization added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add specialization: ' + error.message);
    }
  });

  const handleAddSpecialization = async () => {
    const name = newSpecialization.trim();
    if (!name || availableSpecializations.includes(name)) return;
    try {
      const existing = await specializationsService.getByName(name);
      if (existing) {
        toast.error('This specialization already exists');
        return;
      }
    } catch (err) {
      if (err?.code !== 'PGRST116') throw err;
    }
    await createSpecializationMutation.mutateAsync({ specializations: name });
  };

  const createMutation = useMutation({
    mutationFn: (data) => equipmentService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-counts'] });
      resetForm();
      toast.success('Item added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add item: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => equipmentService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-counts'] });
      resetForm();
      toast.success('Item updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update item: ' + error.message);
    }
  });

  const resetForm = () => {
    setShowForm(false);
    setSelectedItem(null);
    setShowAddSpecializationDialog(false);
    setNewSpecialization('');
    setFormData({
      name: '',
      category: '',
      specialization: '',
      sku: '',
      unit: '',
      stock_quantity: '',
      min_stock_level: '',
      unit_cost: '',
      sellingcost: '',
      description: ''
    });
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    const spec = item.specialization || (Array.isArray(item.specializations) && item.specializations[0]) || '';
    setFormData({
      name: item.name || '',
      category: item.category || '',
      specialization: spec,
      sku: item.sku || '',
      unit: item.unit || '',
      stock_quantity: item.stock_quantity?.toString() || '',
      min_stock_level: item.min_stock_level?.toString() || '',
      unit_cost: item.unit_cost?.toString() || '',
      sellingcost: item.sellingcost?.toString() || '',
      description: item.description || ''
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      specialization: formData.specialization || null,
      stock_quantity: formData.stock_quantity ? parseFloat(formData.stock_quantity) : 0,
      min_stock_level: formData.min_stock_level ? parseFloat(formData.min_stock_level) : 0,
      unit_cost: formData.unit_cost ? parseFloat(formData.unit_cost) : 0,
      sellingcost: formData.sellingcost ? parseFloat(formData.sellingcost) : 0,
      status: formData.stock_quantity <= 0 ? 'out_of_stock' :
      formData.stock_quantity <= formData.min_stock_level ? 'low_stock' : 'in_stock'
    };
    if (selectedItem) {
      await updateMutation.mutateAsync({ id: selectedItem.id, data: submitData });
    } else {
      await createMutation.mutateAsync(submitData);
    }
  };

  const getStockStatus = (item) => {
    if (item.stock_quantity <= 0) return 'out_of_stock';
    if (item.stock_quantity <= (item.min_stock_level || 0)) return 'low_stock';
    return 'in_stock';
  };

  const goToPage = (p) => {
    setPage(Math.max(1, Math.min(p, totalPages)));
  };

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleCategoryChange = (value) => {
    setCategoryFilter(value);
    setPage(1);
  };

  if (isLoading) {
    return (
      <div data-source-location="pages/EquipmentInventory:167:6" data-dynamic-content="false" className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner data-source-location="pages/EquipmentInventory:168:8" data-dynamic-content="false" size="lg" text="Loading inventory..." />
      </div>);

  }

  return (
    <div data-source-location="pages/EquipmentInventory:174:4" data-dynamic-content="true" className="space-y-6">
      <PageHeader
        title="Equipment & Parts"
        subtitle={countsLoading ? 'Loading...' : `${counts?.total ?? 0} items in inventory`}
        action={() => setShowForm(true)}
        actionLabel="Add Item"
        actionIcon={Plus}
      >
        {(lowStockCount > 0 || outOfStockCount > 0) && (
          <div className="flex flex-wrap gap-3 items-center">
            {outOfStockCount > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium text-red-700">
                  {outOfStockCount} items out of stock
                </span>
              </div>
            )}
            {lowStockCount > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium text-yellow-700">
                  {lowStockCount} items low in stock
                </span>
              </div>
            )}
          </div>
        )}
      </PageHeader>

      {/* Filters */}
      <div data-source-location="pages/EquipmentInventory:206:6" data-dynamic-content="true" className="flex flex-col sm:flex-row gap-4">
        <div data-source-location="pages/EquipmentInventory:207:8" data-dynamic-content="true" className="relative flex-1">
          <Search data-source-location="pages/EquipmentInventory:208:10" data-dynamic-content="false" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input data-source-location="pages/EquipmentInventory:209:10" data-dynamic-content="false"
          placeholder="Search by name or SKU..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10" />

        </div>
        <Select data-source-location="pages/EquipmentInventory:216:8" data-dynamic-content="true" value={categoryFilter} onValueChange={handleCategoryChange}>
          <SelectTrigger data-source-location="pages/EquipmentInventory:217:10" data-dynamic-content="false" className="w-[180px]">
            <SelectValue data-source-location="pages/EquipmentInventory:218:12" data-dynamic-content="false" />
          </SelectTrigger>
          <SelectContent data-source-location="pages/EquipmentInventory:220:10" data-dynamic-content="true">
            <SelectItem data-source-location="pages/EquipmentInventory:221:12" data-dynamic-content="false" value="all">All Categories</SelectItem>
            {categories.map((cat) =>
            <SelectItem data-source-location="pages/EquipmentInventory:223:14" data-dynamic-content="true" key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Equipment Table */}
      {!isLoading && equipment.length === 0 ?
      <EmptyState data-source-location="pages/EquipmentInventory:231:8" data-dynamic-content="false"
      icon={Package}
      title="No items found"
      description="Add equipment and parts to your inventory"
      action={() => setShowForm(true)}
      actionLabel="Add Item" /> :


      <Card data-source-location="pages/EquipmentInventory:239:8" data-dynamic-content="true">
          <div data-source-location="pages/EquipmentInventory:240:10" data-dynamic-content="true" className="overflow-x-auto">
            <table data-source-location="pages/EquipmentInventory:241:12" data-dynamic-content="true" className="w-full">
              <thead data-source-location="pages/EquipmentInventory:242:14" data-dynamic-content="false" className="bg-gray-50 border-b">
                <tr data-source-location="pages/EquipmentInventory:243:16" data-dynamic-content="false">
                  <th data-source-location="pages/EquipmentInventory:244:18" data-dynamic-content="false" className="text-left px-4 py-3 text-sm font-medium text-gray-600">Item</th>
                  <th data-source-location="pages/EquipmentInventory:244:18" data-dynamic-content="false" className="text-left px-4 py-3 text-sm font-medium text-gray-600">Specialization</th>
                  <th data-source-location="pages/EquipmentInventory:245:18" data-dynamic-content="false" className="text-left px-4 py-3 text-sm font-medium text-gray-600">SKU</th>
                  <th data-source-location="pages/EquipmentInventory:247:18" data-dynamic-content="false" className="text-left px-4 py-3 text-sm font-medium text-gray-600">Stock</th>
                  <th data-source-location="pages/EquipmentInventory:248:18" data-dynamic-content="false" className="text-left px-4 py-3 text-sm font-medium text-gray-600">Unit Cost</th>
                  <th data-source-location="pages/EquipmentInventory:248:18" data-dynamic-content="false" className="text-left px-4 py-3 text-sm font-medium text-gray-600">Billable Cost</th>
                  <th data-source-location="pages/EquipmentInventory:249:18" data-dynamic-content="false" className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  <th data-source-location="pages/EquipmentInventory:250:18" data-dynamic-content="false" className="text-left px-4 py-3 text-sm font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody data-source-location="pages/EquipmentInventory:253:14" data-dynamic-content="true" className="divide-y">
                {equipment.map((item) => {
                const status = getStockStatus(item);
                return (
                  <motion.tr data-source-location="pages/EquipmentInventory:257:20" data-dynamic-content="true"
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}>

                      <td data-source-location="pages/EquipmentInventory:263:22" data-dynamic-content="true" className="px-4 py-3">
                        <div>
                          <p data-source-location="pages/EquipmentInventory:265:26" data-dynamic-content="true" className="font-medium text-gray-900">{item.name}</p>
                          {item.category && (
                            <Badge className="mt-1 bg-primary text-primary-foreground text-xs capitalize">
                              {item.category.replace(/_/g, ' ')}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td data-source-location="pages/EquipmentInventory:271:22" data-dynamic-content="true" className="px-4 py-3">
                        {item.specialization || (Array.isArray(item.specializations) && item.specializations[0]) ? (
                          <Badge className="bg-primary text-primary-foreground text-xs">
                            {item.specialization || item.specializations[0]}
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>
                      <td data-source-location="pages/EquipmentInventory:271:22" data-dynamic-content="true" className="px-4 py-3 text-sm text-gray-600">{item.sku || '-'}</td>
                      <td data-source-location="pages/EquipmentInventory:277:22" data-dynamic-content="true" className="px-4 py-3">
                        <span data-source-location="pages/EquipmentInventory:278:24" data-dynamic-content="true" className={`font-medium ${
                      status === 'out_of_stock' ? 'text-red-600' :
                      status === 'low_stock' ? 'text-yellow-600' : 'text-gray-900'}`
                      }>
                          {item.stock_quantity} {item.unit}
                        </span>
                        {item.min_stock_level &&
                      <p data-source-location="pages/EquipmentInventory:285:26" data-dynamic-content="true" className="text-xs text-gray-500">Min: {item.min_stock_level}</p>
                      }
                      </td>
                      <td data-source-location="pages/EquipmentInventory:288:22" data-dynamic-content="true" className="px-4 py-3 text-sm text-gray-600">
                        ${item.unit_cost?.toFixed(2) || '0.00'}
                      </td>
                      <td data-source-location="pages/EquipmentInventory:288:22" data-dynamic-content="true" className="px-4 py-3 text-sm text-gray-600">
                        ${item.sellingcost?.toFixed(2) || '0.00'}
                      </td>
                      <td data-source-location="pages/EquipmentInventory:291:22" data-dynamic-content="true" className="px-4 py-3">
                        <Badge data-source-location="pages/EquipmentInventory:292:24" data-dynamic-content="true" className={`
                          ${status === 'out_of_stock' ? 'bg-red-100 text-red-700' :
                      status === 'low_stock' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'}
                          pointer-events-none
                        `}>
                          {status === 'out_of_stock' ? 'Out of Stock' :
                        status === 'low_stock' ? 'Low Stock' : 'In Stock'}
                        </Badge>
                      </td>
                      <td data-source-location="pages/EquipmentInventory:301:22" data-dynamic-content="true" className="px-4 py-3">
                        <DropdownMenu data-source-location="pages/EquipmentInventory:302:24" data-dynamic-content="true">
                          <DropdownMenuTrigger data-source-location="pages/EquipmentInventory:303:26" data-dynamic-content="false" asChild>
                            <Button data-source-location="pages/EquipmentInventory:304:28" data-dynamic-content="false" variant="ghost" size="icon">
                              <MoreVertical data-source-location="pages/EquipmentInventory:305:30" data-dynamic-content="false" className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent data-source-location="pages/EquipmentInventory:308:26" data-dynamic-content="true" align="end">
                            <DropdownMenuItem data-source-location="pages/EquipmentInventory:309:28" data-dynamic-content="false" onClick={() => handleEdit(item)}>
                              <Edit data-source-location="pages/EquipmentInventory:310:30" data-dynamic-content="false" className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </motion.tr>);

              })}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {totalCount > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t bg-gray-50/50">
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount}
                </span>
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-normal whitespace-nowrap">Rows per page</Label>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => {
                      setPageSize(Number(v));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[70px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1 || isLoading}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <span className="text-sm text-gray-600 px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages || isLoading}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      }

      {/* Form Dialog */}
      <Dialog data-source-location="pages/EquipmentInventory:326:6" data-dynamic-content="true" open={showForm} onOpenChange={(open) => {if (!open) resetForm();}}>
        <DialogContent data-source-location="pages/EquipmentInventory:327:8" data-dynamic-content="true" className="max-w-md">
          <DialogHeader data-source-location="pages/EquipmentInventory:328:10" data-dynamic-content="true">
            <DialogTitle data-source-location="pages/EquipmentInventory:329:12" data-dynamic-content="true">
              {selectedItem ? 'Edit Item' : 'Add Item'}
            </DialogTitle>
            <DialogDescription data-source-location="pages/EquipmentInventory:332:12" data-dynamic-content="true">
              {selectedItem ? 'Update inventory item' : 'Add new equipment or parts'}
            </DialogDescription>
          </DialogHeader>

          <form data-source-location="pages/EquipmentInventory:337:10" data-dynamic-content="true" onSubmit={handleSubmit} className="space-y-4">
            <div data-source-location="pages/EquipmentInventory:338:12" data-dynamic-content="true">
              <Label data-source-location="pages/EquipmentInventory:339:14" data-dynamic-content="false">Item Name</Label>
              <Input data-source-location="pages/EquipmentInventory:340:14" data-dynamic-content="false"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="PVC Pipe 2 inch"
              required />

            </div>

            <div data-source-location="pages/EquipmentInventory:346:12" data-dynamic-content="true">
              <Label data-source-location="pages/EquipmentInventory:347:14" data-dynamic-content="false">Specialization</Label>
              <Select
                value={formData.specialization || ''}
                modal={false}
                onValueChange={(v) => {
                  if (v === '__add_new__') {
                    setShowAddSpecializationDialog(true);
                  } else {
                    setFormData((prev) => ({ ...prev, specialization: v || '' }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select specialization..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {availableSpecializations.map((spec) => (
                    <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                  ))}
                  <SelectSeparator />
                  <SelectItem value="__add_new__" className="text-primary font-medium">
                    <Plus className="w-4 h-4 inline mr-2" />
                    Add new Specialization
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div data-source-location="pages/EquipmentInventory:348:12" data-dynamic-content="true" className="grid grid-cols-2 gap-4">
              <div data-source-location="pages/EquipmentInventory:349:14" data-dynamic-content="true">
                <Label data-source-location="pages/EquipmentInventory:350:16" data-dynamic-content="false">SKU</Label>
                <Input data-source-location="pages/EquipmentInventory:351:16" data-dynamic-content="false"
                value={formData.sku}
                onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
                placeholder="PVC-2IN-001" />

              </div>
              <div data-source-location="pages/EquipmentInventory:357:14" data-dynamic-content="true">
                <Label data-source-location="pages/EquipmentInventory:358:16" data-dynamic-content="false">Category</Label>
                <Select data-source-location="pages/EquipmentInventory:359:16" data-dynamic-content="true"
                value={formData.category}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, category: v }))}>

                  <SelectTrigger data-source-location="pages/EquipmentInventory:363:18" data-dynamic-content="false">
                    <SelectValue data-source-location="pages/EquipmentInventory:364:20" data-dynamic-content="false" placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent data-source-location="pages/EquipmentInventory:366:18" data-dynamic-content="true">
                    {categories.map((cat) =>
                    <SelectItem data-source-location="pages/EquipmentInventory:368:22" data-dynamic-content="true" key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div data-source-location="pages/EquipmentInventory:375:12" data-dynamic-content="true" className="grid grid-cols-3 gap-4">
              <div data-source-location="pages/EquipmentInventory:376:14" data-dynamic-content="true">
                <Label data-source-location="pages/EquipmentInventory:377:16" data-dynamic-content="false">Stock Qty</Label>
                <Input data-source-location="pages/EquipmentInventory:378:16" data-dynamic-content="false"
                type="number"
                value={formData.stock_quantity}
                onChange={(e) => setFormData((prev) => ({ ...prev, stock_quantity: e.target.value }))}
                placeholder="100" />

              </div>
              <div data-source-location="pages/EquipmentInventory:385:14" data-dynamic-content="true">
                <Label data-source-location="pages/EquipmentInventory:386:16" data-dynamic-content="false">Min Level</Label>
                <Input data-source-location="pages/EquipmentInventory:387:16" data-dynamic-content="false"
                type="number"
                value={formData.min_stock_level}
                onChange={(e) => setFormData((prev) => ({ ...prev, min_stock_level: e.target.value }))}
                placeholder="10" />

              </div>
              <div data-source-location="pages/EquipmentInventory:394:14" data-dynamic-content="true">
                <Label data-source-location="pages/EquipmentInventory:395:16" data-dynamic-content="false">Unit</Label>
                <Input data-source-location="pages/EquipmentInventory:396:16" data-dynamic-content="false"
                value={formData.unit}
                onChange={(e) => setFormData((prev) => ({ ...prev, unit: e.target.value }))}
                placeholder="pcs"
                required />

              </div>
            </div>

            <div data-source-location="pages/EquipmentInventory:405:12" data-dynamic-content="true" className="grid grid-cols-2 gap-4">
              <div data-source-location="pages/EquipmentInventory:405:14" data-dynamic-content="true">
                <Label data-source-location="pages/EquipmentInventory:406:16" data-dynamic-content="false">Unit Cost ($)</Label>
                <Input data-source-location="pages/EquipmentInventory:407:16" data-dynamic-content="false"
                type="number"
                step="0.01"
                value={formData.unit_cost}
                onChange={(e) => setFormData((prev) => ({ ...prev, unit_cost: e.target.value }))}
                placeholder="5.99" />
              </div>
              <div data-source-location="pages/EquipmentInventory:405:14" data-dynamic-content="true">
                <Label data-source-location="pages/EquipmentInventory:406:16" data-dynamic-content="false">Billable Cost ($)</Label>
                <Input data-source-location="pages/EquipmentInventory:407:16" data-dynamic-content="false"
                type="number"
                step="0.01"
                value={formData.sellingcost}
                onChange={(e) => setFormData((prev) => ({ ...prev, sellingcost: e.target.value }))}
                placeholder="7.99" />
              </div>
            </div>

            <div data-source-location="pages/EquipmentInventory:416:12" data-dynamic-content="true">
              <Label data-source-location="pages/EquipmentInventory:417:14" data-dynamic-content="false">Description</Label>
              <Textarea data-source-location="pages/EquipmentInventory:418:14" data-dynamic-content="false"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Item description..."
              rows={2} />

            </div>

            <div data-source-location="pages/EquipmentInventory:426:12" data-dynamic-content="true" className="flex gap-3 pt-4">
              <Button data-source-location="pages/EquipmentInventory:427:14" data-dynamic-content="false" type="button" variant="outline" className="flex-1" onClick={resetForm}>
                Cancel
              </Button>
              <Button data-source-location="pages/EquipmentInventory:430:14" data-dynamic-content="true"
              type="submit"
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={createMutation.isPending || updateMutation.isPending}>

                {selectedItem ? 'Update' : 'Add'} Item
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add New Specialization Dialog */}
      <Dialog open={showAddSpecializationDialog} onOpenChange={setShowAddSpecializationDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Specialization</DialogTitle>
            <DialogDescription>
              Add a new specialization type to the available options
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Specialization Name</Label>
              <Input
                value={newSpecialization}
                onChange={(e) => setNewSpecialization(e.target.value)}
                placeholder="e.g., Smart Controller Setup"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSpecialization();
                  }
                }}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowAddSpecializationDialog(false);
                  setNewSpecialization('');
                }}
                disabled={createSpecializationMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={handleAddSpecialization}
                disabled={!newSpecialization.trim() || availableSpecializations.includes(newSpecialization.trim()) || createSpecializationMutation.isPending}
              >
                {createSpecializationMutation.isPending ? 'Adding...' : 'Add Specialization'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>);

}
