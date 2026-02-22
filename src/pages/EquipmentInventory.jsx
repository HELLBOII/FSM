import React, { useState } from 'react';
import { equipmentService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Search,
  Plus,
  AlertTriangle,
  Edit,
  MoreVertical,
  Filter } from
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
  SelectValue } from
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
  const [showForm, setShowForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    sku: '',
    unit: '',
    stock_quantity: '',
    min_stock_level: '',
    unit_cost: '',
    sellingcost: '',
    description: ''
  });

  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ['equipment'],
    queryFn: () => equipmentService.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => equipmentService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
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
    setFormData({
      name: '',
      category: '',
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
    setFormData({
      name: item.name || '',
      category: item.category || '',
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

  const filteredEquipment = equipment.filter((item) => {
    const matchesSearch = !searchQuery ||
    item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const lowStockCount = equipment.filter((e) =>
  e.stock_quantity <= (e.min_stock_level || 0) && e.stock_quantity > 0
  ).length;
  const outOfStockCount = equipment.filter((e) => e.stock_quantity <= 0).length;

  if (isLoading) {
    return (
      <div data-source-location="pages/EquipmentInventory:167:6" data-dynamic-content="false" className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner data-source-location="pages/EquipmentInventory:168:8" data-dynamic-content="false" size="lg" text="Loading inventory..." />
      </div>);

  }

  return (
    <div data-source-location="pages/EquipmentInventory:174:4" data-dynamic-content="true" className="space-y-6">
      <PageHeader data-source-location="pages/EquipmentInventory:175:6" data-dynamic-content="false"
      title="Equipment & Parts"
      subtitle={`${equipment.length} items in inventory`}
      action={() => setShowForm(true)}
      actionLabel="Add Item"
      actionIcon={Plus} />


      {/* Alerts */}
      {(lowStockCount > 0 || outOfStockCount > 0) &&
      <div data-source-location="pages/EquipmentInventory:185:8" data-dynamic-content="true" className="flex flex-wrap gap-3">
          {outOfStockCount > 0 &&
        <div data-source-location="pages/EquipmentInventory:187:12" data-dynamic-content="true" className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle data-source-location="pages/EquipmentInventory:188:14" data-dynamic-content="false" className="w-4 h-4 text-red-500" />
              <span data-source-location="pages/EquipmentInventory:189:14" data-dynamic-content="true" className="text-sm font-medium text-red-700">
                {outOfStockCount} items out of stock
              </span>
            </div>
        }
          {lowStockCount > 0 &&
        <div data-source-location="pages/EquipmentInventory:195:12" data-dynamic-content="true" className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle data-source-location="pages/EquipmentInventory:196:14" data-dynamic-content="false" className="w-4 h-4 text-yellow-500" />
              <span data-source-location="pages/EquipmentInventory:197:14" data-dynamic-content="true" className="text-sm font-medium text-yellow-700">
                {lowStockCount} items low in stock
              </span>
            </div>
        }
        </div>
      }

      {/* Filters */}
      <div data-source-location="pages/EquipmentInventory:206:6" data-dynamic-content="true" className="flex flex-col sm:flex-row gap-4">
        <div data-source-location="pages/EquipmentInventory:207:8" data-dynamic-content="true" className="relative flex-1">
          <Search data-source-location="pages/EquipmentInventory:208:10" data-dynamic-content="false" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input data-source-location="pages/EquipmentInventory:209:10" data-dynamic-content="false"
          placeholder="Search by name or SKU..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10" />

        </div>
        <Select data-source-location="pages/EquipmentInventory:216:8" data-dynamic-content="true" value={categoryFilter} onValueChange={setCategoryFilter}>
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
      {filteredEquipment.length === 0 ?
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
                  <th data-source-location="pages/EquipmentInventory:245:18" data-dynamic-content="false" className="text-left px-4 py-3 text-sm font-medium text-gray-600">SKU</th>
                  <th data-source-location="pages/EquipmentInventory:246:18" data-dynamic-content="false" className="text-left px-4 py-3 text-sm font-medium text-gray-600">Category</th>
                  <th data-source-location="pages/EquipmentInventory:247:18" data-dynamic-content="false" className="text-left px-4 py-3 text-sm font-medium text-gray-600">Stock</th>
                  <th data-source-location="pages/EquipmentInventory:248:18" data-dynamic-content="false" className="text-left px-4 py-3 text-sm font-medium text-gray-600">Unit Cost</th>
                  <th data-source-location="pages/EquipmentInventory:248:18" data-dynamic-content="false" className="text-left px-4 py-3 text-sm font-medium text-gray-600">Billable Cost</th>
                  <th data-source-location="pages/EquipmentInventory:249:18" data-dynamic-content="false" className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  <th data-source-location="pages/EquipmentInventory:250:18" data-dynamic-content="false" className="text-left px-4 py-3 text-sm font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody data-source-location="pages/EquipmentInventory:253:14" data-dynamic-content="true" className="divide-y">
                {filteredEquipment.map((item) => {
                const status = getStockStatus(item);
                return (
                  <motion.tr data-source-location="pages/EquipmentInventory:257:20" data-dynamic-content="true"
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}>

                      <td data-source-location="pages/EquipmentInventory:263:22" data-dynamic-content="true" className="px-4 py-3">
                        <div data-source-location="pages/EquipmentInventory:264:24" data-dynamic-content="true">
                          <p data-source-location="pages/EquipmentInventory:265:26" data-dynamic-content="true" className="font-medium text-gray-900">{item.name}</p>
                          {item.description &&
                        <p data-source-location="pages/EquipmentInventory:267:28" data-dynamic-content="true" className="text-xs text-gray-500 truncate max-w-[200px]">{item.description}</p>
                        }
                        </div>
                      </td>
                      <td data-source-location="pages/EquipmentInventory:271:22" data-dynamic-content="true" className="px-4 py-3 text-sm text-gray-600">{item.sku || '-'}</td>
                      <td data-source-location="pages/EquipmentInventory:272:22" data-dynamic-content="true" className="px-4 py-3">
                        <Badge data-source-location="pages/EquipmentInventory:273:24" data-dynamic-content="true" className="bg-primary text-primary-foreground capitalize">
                          {item.category?.replace(/_/g, ' ')}
                        </Badge>
                      </td>
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
    </div>);

}