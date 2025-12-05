import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Plus, Pencil, Trash2, DollarSign } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DeductionRate {
  id: string;
  type: string;
  minSalary: string;
  maxSalary: string | null;
  employeeRate: string | null;
  employeeContribution: string | null;
  description: string | null;
  isActive: boolean;
}

export default function AdminDeductionRates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<DeductionRate | null>(null);
  const [formData, setFormData] = useState({
    type: "sss",
    minSalary: "",
    maxSalary: "",
    employeeRate: "",
    employeeContribution: "",
    description: "",
  });

  const { data: ratesData, isLoading } = useQuery({
    queryKey: ["/api/admin/deduction-rates"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/admin/deduction-rates", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deduction-rates"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Deduction rate created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create deduction rate",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PUT", `/api/admin/deduction-rates/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deduction-rates"] });
      setIsDialogOpen(false);
      setEditingRate(null);
      resetForm();
      toast({
        title: "Success",
        description: "Deduction rate updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update deduction rate",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/deduction-rates/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deduction-rates"] });
      toast({
        title: "Success",
        description: "Deduction rate deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete deduction rate",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      type: "sss",
      minSalary: "",
      maxSalary: "",
      employeeRate: "",
      employeeContribution: "",
      description: "",
    });
  };

  const handleEdit = (rate: DeductionRate) => {
    setEditingRate(rate);
    setFormData({
      type: rate.type,
      minSalary: rate.minSalary,
      maxSalary: rate.maxSalary || "",
      employeeRate: rate.employeeRate || "",
      employeeContribution: rate.employeeContribution || "",
      description: rate.description || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingRate) {
      updateMutation.mutate({ id: editingRate.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this deduction rate?")) {
      deleteMutation.mutate(id);
    }
  };

  const groupedRates = ratesData?.rates?.reduce((acc: any, rate: DeductionRate) => {
    if (!acc[rate.type]) acc[rate.type] = [];
    acc[rate.type].push(rate);
    return acc;
  }, {}) || {};

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="h-6 w-6" />
            Deduction Rates Management
          </h2>
          <p className="text-muted-foreground">
            Configure Philippine government contribution tables and tax brackets (Admin Only)
          </p>
        </div>
        <Button onClick={() => { setEditingRate(null); resetForm(); setIsDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Rate
        </Button>
      </div>

      {Object.entries(groupedRates).map(([type, rates]: [string, any]) => (
        <Card key={type}>
          <CardHeader>
            <CardTitle className="capitalize">{type} Contribution Table</CardTitle>
            <CardDescription>
              {type === 'sss' && 'Social Security System employee contribution brackets'}
              {type === 'philhealth' && 'Philippine Health Insurance Corporation rates'}
              {type === 'pagibig' && 'Home Development Mutual Fund (Pag-IBIG) rates'}
              {type === 'tax' && 'Bureau of Internal Revenue withholding tax brackets'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Min Salary</TableHead>
                  <TableHead>Max Salary</TableHead>
                  <TableHead>Rate (%)</TableHead>
                  <TableHead>Fixed Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((rate: DeductionRate) => (
                  <TableRow key={rate.id}>
                    <TableCell>₱{parseFloat(rate.minSalary).toFixed(2)}</TableCell>
                    <TableCell>{rate.maxSalary ? `₱${parseFloat(rate.maxSalary).toFixed(2)}` : 'Unlimited'}</TableCell>
                    <TableCell>{rate.employeeRate ? `${rate.employeeRate}%` : '-'}</TableCell>
                    <TableCell>{rate.employeeContribution ? `₱${parseFloat(rate.employeeContribution).toFixed(2)}` : '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{rate.description}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(rate)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(rate.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRate ? 'Edit' : 'Add'} Deduction Rate</DialogTitle>
            <DialogDescription>
              Configure the deduction rate bracket for Philippine contributions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="type">Type</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sss">SSS</SelectItem>
                  <SelectItem value="philhealth">PhilHealth</SelectItem>
                  <SelectItem value="pagibig">Pag-IBIG</SelectItem>
                  <SelectItem value="tax">Withholding Tax</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="minSalary">Minimum Salary (₱)</Label>
              <Input
                id="minSalary"
                type="number"
                step="0.01"
                value={formData.minSalary}
                onChange={(e) => setFormData({ ...formData, minSalary: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="maxSalary">Maximum Salary (₱) - Leave empty for unlimited</Label>
              <Input
                id="maxSalary"
                type="number"
                step="0.01"
                value={formData.maxSalary}
                onChange={(e) => setFormData({ ...formData, maxSalary: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="employeeRate">Employee Rate (%) - For percentage-based</Label>
              <Input
                id="employeeRate"
                type="number"
                step="0.01"
                value={formData.employeeRate}
                onChange={(e) => setFormData({ ...formData, employeeRate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="employeeContribution">Fixed Contribution (₱) - For fixed amount</Label>
              <Input
                id="employeeContribution"
                type="number"
                step="0.01"
                value={formData.employeeContribution}
                onChange={(e) => setFormData({ ...formData, employeeContribution: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

