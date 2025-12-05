import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Clock, DollarSign, Activity, Pencil, Trash2, UserPlus, Search, Shield, AlertCircle, Eye, Receipt } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { hasManagerAccess, isAdmin, getCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface Employee {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'employee' | 'manager';
  position: string;
  hourlyRate: string;
  branchId: string;
  isActive: boolean;
  blockchainVerified?: boolean;
  blockchainHash?: string;
  verifiedAt?: string;
  createdAt: string;
  // Enhanced fields for Phase 2
  totalHoursWorked?: number;
  totalEarnings?: number;
  performanceRating?: number;
  lastShiftDate?: string;
  shiftCount?: number;
  // Hours tracking fields
  hoursThisMonth?: number;
  shiftsThisMonth?: number;
  // Recurring deductions
  sssLoanDeduction?: string;
  pagibigLoanDeduction?: string;
  cashAdvanceDeduction?: string;
  otherDeductions?: string;
}

interface Branch {
  id: string;
  name: string;
}

interface PayrollEntry {
  id: string;
  userId: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  grossPay: number;
  deductions: number;
  netPay: number;
  status: string;
  createdAt: string;
}

export default function Employees() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Partial<Employee> | null>(null);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [selectedEmployeeDetails, setSelectedEmployeeDetails] = useState<Employee | null>(null);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [employeeToVerify, setEmployeeToVerify] = useState<Employee | null>(null);
  const [deductionsDialogOpen, setDeductionsDialogOpen] = useState(false);
  const [employeeForDeductions, setEmployeeForDeductions] = useState<Employee | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    email: '',
    role: 'employee' as const,
    position: '',
    hourlyRate: '',
    branchId: '',
    isActive: true,
  });

  // Deductions form state
  const [deductionsFormData, setDeductionsFormData] = useState({
    sssLoanDeduction: '0',
    pagibigLoanDeduction: '0',
    cashAdvanceDeduction: '0',
    otherDeductions: '0',
  });

  // Check if user has manager access (manager or admin)
  const managerRole = hasManagerAccess();
  const isAdminRole = isAdmin();
  const currentUser = getCurrentUser();

  // Redirect non-managers
  useEffect(() => {
    if (!managerRole) {
      setLocation('/');
    }
  }, [managerRole, setLocation]);

  // Check if current user can edit hourly rate for the employee being edited
  // Only admin can set/edit manager's hourly rate
  const canEditHourlyRate = () => {
    if (isAdminRole) return true;
    // If editing a manager, only admin can edit their rate
    if (isEditing && currentEmployee?.role === 'manager') return false;
    // If creating a new manager, only admin can set their rate
    if (!isEditing && formData.role === 'manager') return false;
    return true;
  };

  // Fetch employees with hours
  const {
    data: employeesResponse,
    isLoading,
    error: employeesError
  } = useQuery<{ employees: Employee[] }>({
    queryKey: ['/api/hours/all-employees'],
    enabled: managerRole,
  });

  // Fetch branches for the select dropdown
  const {
    data: branchesResponse,
    error: branchesError
  } = useQuery<{ branches: Branch[] }>({
    queryKey: ['/api/branches'],
    enabled: managerRole,
  });

  // Handle errors
  useEffect(() => {
    if (employeesError) {
      console.error('Error fetching employees:', employeesError);
      toast({
        title: 'Error',
        description: 'Failed to load employees',
        variant: 'destructive',
      });
    }
    if (branchesError) {
      console.error('Error fetching branches:', branchesError);
      toast({
        title: 'Error',
        description: 'Failed to load branches',
        variant: 'destructive',
      });
    }
  }, [employeesError, branchesError, toast]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  // Fetch employee performance data
  const { data: performanceData } = useQuery({
    queryKey: ['/api/employees/performance'],
    enabled: managerRole,
  });

  // Ensure we always work with arrays
  const employeesData = employeesResponse?.employees || [];
  const branchesData = branchesResponse?.branches || [];

  // Filter employees based on search and filters
  const filteredEmployees = employeesData.filter((employee: Employee) => {
    const matchesSearch = searchTerm === '' ||
      `${employee.firstName} ${employee.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.position.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && employee.isActive) ||
      (statusFilter === 'inactive' && !employee.isActive);

    const matchesRole = roleFilter === 'all' || employee.role === roleFilter;

    const matchesBranch = branchFilter === 'all' || employee.branchId === branchFilter;

    return matchesSearch && matchesStatus && matchesRole && matchesBranch;
  });

  // Get performance data for an employee
  const getEmployeePerformance = (employeeId: string) => {
    return performanceData?.find((p: any) => p.employeeId === employeeId);
  };

  // Handle bulk operations
  const handleBulkActivate = async () => {
    try {
      await apiRequest('POST', '/api/employees/bulk-activate', {
        employeeIds: selectedEmployees,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      toast({
        title: 'Success',
        description: `${selectedEmployees.length} employees activated successfully`,
      });
      setSelectedEmployees([]);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to activate employees',
        variant: 'destructive',
      });
    }
  };

  const handleBulkDeactivate = async () => {
    try {
      await apiRequest('POST', '/api/employees/bulk-deactivate', {
        employeeIds: selectedEmployees,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      toast({
        title: 'Success',
        description: `${selectedEmployees.length} employees deactivated successfully`,
      });
      setSelectedEmployees([]);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to deactivate employees',
        variant: 'destructive',
      });
    }
  };

  // Create employee mutation
  const createEmployee = useMutation({
    mutationFn: async (employeeData: typeof formData) => {
      const response = await apiRequest('POST', '/api/employees', employeeData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create employee');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      toast({
        title: 'Success',
        description: 'Employee created successfully',
      });
      setIsOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update employee mutation
  const updateEmployee = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Employee> & { id: string }) => {
      const response = await apiRequest('PUT', `/api/employees/${id}`, data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update employee');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      toast({
        title: 'Success',
        description: 'Employee updated successfully',
      });
      setIsOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete employee mutation
  const deleteEmployee = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/employees/${id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete employee');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      toast({
        title: 'Success',
        description: 'Employee deleted successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Verify employee mutation
  const verifyEmployee = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/employees/${id}/verify`, {});
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to verify employee');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      toast({
        title: 'Success',
        description: 'Employee verified on blockchain successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update employee deductions mutation
  const updateDeductions = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; sssLoanDeduction: string; pagibigLoanDeduction: string; cashAdvanceDeduction: string; otherDeductions: string }) => {
      const response = await apiRequest('PUT', `/api/employees/${id}/deductions`, data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update deductions');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      queryClient.invalidateQueries({ queryKey: ['/api/hours/all-employees'] });
      toast({
        title: 'Success',
        description: 'Employee deductions updated successfully',
      });
      setDeductionsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!formData.username || !formData.firstName || !formData.lastName || !formData.email ||
        !formData.position || !formData.hourlyRate || !formData.branchId) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    // Password is required for new employees, optional for editing
    if (!isEditing && !formData.password) {
      toast({
        title: 'Error',
        description: 'Password is required for new employees',
        variant: 'destructive',
      });
      return;
    }

    const employeeData: any = {
      username: formData.username,
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      role: formData.role,
      position: formData.position,
      hourlyRate: formData.hourlyRate, // Keep as string - server expects string
      branchId: formData.branchId,
      isActive: formData.isActive,
    };

    // Only include password if it's provided (for editing, it's optional)
    if (formData.password) {
      employeeData.password = formData.password;
    }

    if (isEditing && currentEmployee?.id) {
      updateEmployee.mutate({ ...employeeData, id: currentEmployee.id });
    } else {
      createEmployee.mutate(employeeData);
    }
  };

  const handleEdit = (employee: Employee) => {
    setCurrentEmployee(employee);
    setFormData({
      username: employee.username,
      password: '', // Don't pre-fill password for security
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      role: employee.role,
      position: employee.position,
      hourlyRate: employee.hourlyRate.toString(),
      branchId: employee.branchId,
      isActive: employee.isActive,
    });
    setIsEditing(true);
    setIsOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this employee?')) {
      deleteEmployee.mutate(id);
    }
  };

  const handleDeductionsClick = (employee: Employee) => {
    setEmployeeForDeductions(employee);
    setDeductionsFormData({
      sssLoanDeduction: employee.sssLoanDeduction || '0',
      pagibigLoanDeduction: employee.pagibigLoanDeduction || '0',
      cashAdvanceDeduction: employee.cashAdvanceDeduction || '0',
      otherDeductions: employee.otherDeductions || '0',
    });
    setDeductionsDialogOpen(true);
  };

  const handleDeductionsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (employeeForDeductions) {
      updateDeductions.mutate({
        id: employeeForDeductions.id,
        ...deductionsFormData,
      });
    }
  };

  const handleDeductionsInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDeductionsFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleVerifyClick = (employee: Employee) => {
    setEmployeeToVerify(employee);
    setVerifyDialogOpen(true);
  };

  const handleVerifyConfirm = () => {
    if (employeeToVerify) {
      verifyEmployee.mutate(employeeToVerify.id);
      setVerifyDialogOpen(false);
      setEmployeeToVerify(null);
    }
  };

  const handleViewDetails = (employee: Employee) => {
    setSelectedEmployeeDetails(employee);
    setViewDetailsOpen(true);
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      firstName: '',
      lastName: '',
      email: '',
      role: 'employee',
      position: '',
      hourlyRate: '',
      branchId: '',
      isActive: true,
    });
    setCurrentEmployee(null);
    setIsEditing(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Employee Management</h2>
          <p className="text-muted-foreground">
            Manage your team members and their details
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {isEditing ? `Edit Employee: ${currentEmployee?.firstName} ${currentEmployee?.lastName}` : 'Add New Employee'}
                </DialogTitle>
                <DialogDescription>
                  {isEditing
                    ? 'Update the employee details below. Leave password blank to keep the current password.'
                    : 'Fill in the details to add a new employee to your team.'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      placeholder="John"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      placeholder="Doe"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="john.doe@example.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    placeholder="johndoe"
                    required
                    disabled={isEditing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">
                    Password {isEditing ? '(leave blank to keep current)' : '*'}
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder={isEditing ? "Leave blank to keep current password" : "••••••••"}
                    required={!isEditing}
                  />
                  {isEditing && (
                    <p className="text-xs text-muted-foreground">
                      Only enter a new password if you want to change it
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="position">Position *</Label>
                    <Input
                      id="position"
                      name="position"
                      value={formData.position}
                      onChange={handleInputChange}
                      placeholder="e.g., Barista, Manager"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hourlyRate">
                      Hourly Rate (₱) *
                      {!canEditHourlyRate() && (
                        <span className="text-xs text-muted-foreground ml-2">(Admin only for managers)</span>
                      )}
                    </Label>
                    <Input
                      id="hourlyRate"
                      name="hourlyRate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.hourlyRate}
                      onChange={handleInputChange}
                      placeholder="15.00"
                      required
                      disabled={!canEditHourlyRate()}
                      className={!canEditHourlyRate() ? "bg-muted cursor-not-allowed" : ""}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="branchId">Branch *</Label>
                    <Select
                      value={formData.branchId}
                      onValueChange={(value) => handleSelectChange('branchId', value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {branchesData.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role *</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value: 'employee' | 'manager') => 
                        handleSelectChange('role', value)
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <input
                    id="isActive"
                    name="isActive"
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={handleInputChange}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <label
                    htmlFor="isActive"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Active Account
                  </label>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createEmployee.isPending || updateEmployee.isPending}>
                  {createEmployee.isPending || updateEmployee.isPending
                    ? (isEditing ? 'Updating...' : 'Adding...')
                    : (isEditing ? 'Update Employee' : 'Add Employee')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filter Bar */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Directory</CardTitle>
          <CardDescription>
            Search and filter employees by various criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
              </SelectContent>
            </Select>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branchesData.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions */}
          {selectedEmployees.length > 0 && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">
                {selectedEmployees.length} employee{selectedEmployees.length > 1 ? 's' : ''} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkActivate}
                className="text-green-600 hover:text-green-700"
              >
                Activate Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDeactivate}
                className="text-red-600 hover:text-red-700"
              >
                Deactivate Selected
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : employeesData.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto h-12 w-12 text-muted-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-12 w-12 mx-auto opacity-40"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3 className="mt-2 text-sm font-medium">No employees found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Get started by adding a new employee.
              </p>
              <div className="mt-6">
                <Button onClick={() => setIsOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Employee
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedEmployees.length === filteredEmployees.length && filteredEmployees.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEmployees(filteredEmployees.map(emp => emp.id));
                          } else {
                            setSelectedEmployees([]);
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Hourly Rate</TableHead>
                    <TableHead>Hours This Month</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Verification</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => {
                    const performance = getEmployeePerformance(employee.id);
                    return (
                      <TableRow key={employee.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedEmployees.includes(employee.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedEmployees([...selectedEmployees, employee.id]);
                              } else {
                                setSelectedEmployees(selectedEmployees.filter(id => id !== employee.id));
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {employee.firstName} {employee.lastName}
                        </TableCell>
                        <TableCell>{employee.email}</TableCell>
                        <TableCell>{employee.position}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            employee.role === 'manager' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {employee.role.charAt(0).toUpperCase() + employee.role.slice(1)}
                          </span>
                        </TableCell>
                        <TableCell>₱{parseFloat(employee.hourlyRate.toString()).toFixed(2)}/hr</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {employee.hoursThisMonth?.toFixed(1) || '0.0'}h
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {employee.shiftsThisMonth || 0} shifts
                          </p>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            employee.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {employee.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Activity className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {performance?.rating ? `${performance.rating}/5.0` : 'N/A'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {employee.blockchainVerified ? (
                              <Badge variant="default" className="bg-green-100 text-green-800">
                                <Shield className="h-3 w-3 mr-1" />
                                Verified
                              </Badge>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleVerifyClick(employee)}
                                disabled={verifyEmployee.isPending}
                                className="text-xs"
                              >
                                <Shield className="h-3 w-3 mr-1" />
                                Verify
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewDetails(employee)}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">View Details</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(employee)}
                              title="Edit Employee"
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeductionsClick(employee)}
                              title="Manage Deductions"
                            >
                              <Receipt className="h-4 w-4" />
                              <span className="sr-only">Deductions</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(employee.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Employee Details Dialog */}
      <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Employee Details</DialogTitle>
            <DialogDescription>
              Complete information for {selectedEmployeeDetails?.firstName} {selectedEmployeeDetails?.lastName}
            </DialogDescription>
          </DialogHeader>

          {selectedEmployeeDetails && (
            <div className="grid gap-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Personal Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">First Name</Label>
                    <p className="text-sm mt-1">{selectedEmployeeDetails.firstName}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Last Name</Label>
                    <p className="text-sm mt-1">{selectedEmployeeDetails.lastName}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                    <p className="text-sm mt-1">{selectedEmployeeDetails.email}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Position</Label>
                    <p className="text-sm mt-1">{selectedEmployeeDetails.position}</p>
                  </div>
                </div>
              </div>

              {/* Account Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Account Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Username</Label>
                    <p className="text-sm mt-1 font-mono bg-muted px-2 py-1 rounded">{selectedEmployeeDetails.username}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Employee ID</Label>
                    <p className="text-sm mt-1 font-mono bg-muted px-2 py-1 rounded text-xs">{selectedEmployeeDetails.id}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Role</Label>
                    <p className="text-sm mt-1">
                      <Badge variant={selectedEmployeeDetails.role === 'manager' ? 'default' : 'secondary'}>
                        {selectedEmployeeDetails.role.charAt(0).toUpperCase() + selectedEmployeeDetails.role.slice(1)}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                    <p className="text-sm mt-1">
                      <Badge variant={selectedEmployeeDetails.isActive ? 'default' : 'destructive'}>
                        {selectedEmployeeDetails.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </p>
                  </div>
                </div>
              </div>

              {/* Employment Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Employment Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Hourly Rate</Label>
                    <p className="text-sm mt-1 font-semibold text-green-600">
                      ₱{parseFloat(selectedEmployeeDetails.hourlyRate.toString()).toFixed(2)}/hr
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Branch ID</Label>
                    <p className="text-sm mt-1 font-mono bg-muted px-2 py-1 rounded text-xs">{selectedEmployeeDetails.branchId}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Created At</Label>
                    <p className="text-sm mt-1">
                      {new Date(selectedEmployeeDetails.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Blockchain Verified</Label>
                    <p className="text-sm mt-1">
                      {selectedEmployeeDetails.blockchainVerified ? (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          <Shield className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Unverified
                        </Badge>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Recurring Deductions */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Recurring Deductions (Per Pay Period)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">SSS Loan</Label>
                    <p className="text-sm mt-1 font-semibold text-red-600">
                      ₱{parseFloat(selectedEmployeeDetails.sssLoanDeduction || '0').toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Pag-IBIG Loan</Label>
                    <p className="text-sm mt-1 font-semibold text-red-600">
                      ₱{parseFloat(selectedEmployeeDetails.pagibigLoanDeduction || '0').toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Cash Advance</Label>
                    <p className="text-sm mt-1 font-semibold text-red-600">
                      ₱{parseFloat(selectedEmployeeDetails.cashAdvanceDeduction || '0').toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Other Deductions</Label>
                    <p className="text-sm mt-1 font-semibold text-red-600">
                      ₱{parseFloat(selectedEmployeeDetails.otherDeductions || '0').toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Security Note */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-amber-900">Security Information</h4>
                    <p className="text-xs text-amber-700 mt-1">
                      Passwords are encrypted and cannot be displayed for security reasons.
                      To reset an employee's password, use the edit function.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify Employee Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Employee on Blockchain</DialogTitle>
            <DialogDescription>
              Are you sure you want to verify {employeeToVerify?.firstName} {employeeToVerify?.lastName} on the blockchain?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-blue-900">Blockchain Verification</h4>
                  <p className="text-xs text-blue-700 mt-1">
                    This will generate a unique cryptographic hash of the employee's information and mark them as verified.
                    This action confirms the employee's identity and credentials have been validated.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setVerifyDialogOpen(false);
                setEmployeeToVerify(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleVerifyConfirm}
              disabled={verifyEmployee.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <Shield className="h-4 w-4 mr-2" />
              {verifyEmployee.isPending ? 'Verifying...' : 'Verify Employee'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deductions Management Dialog */}
      <Dialog open={deductionsDialogOpen} onOpenChange={setDeductionsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleDeductionsSubmit}>
            <DialogHeader>
              <DialogTitle>
                Manage Deductions: {employeeForDeductions?.firstName} {employeeForDeductions?.lastName}
              </DialogTitle>
              <DialogDescription>
                Set recurring deduction amounts per pay period for this employee. These will be automatically applied during payroll processing.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="sssLoanDeduction">SSS Loan Deduction (₱ per pay period)</Label>
                <Input
                  id="sssLoanDeduction"
                  name="sssLoanDeduction"
                  type="number"
                  min="0"
                  step="0.01"
                  value={deductionsFormData.sssLoanDeduction}
                  onChange={handleDeductionsInputChange}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Amount to deduct for SSS loan repayment each pay period
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pagibigLoanDeduction">Pag-IBIG Loan Deduction (₱ per pay period)</Label>
                <Input
                  id="pagibigLoanDeduction"
                  name="pagibigLoanDeduction"
                  type="number"
                  min="0"
                  step="0.01"
                  value={deductionsFormData.pagibigLoanDeduction}
                  onChange={handleDeductionsInputChange}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Amount to deduct for Pag-IBIG loan repayment each pay period
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cashAdvanceDeduction">Cash Advance Deduction (₱ per pay period)</Label>
                <Input
                  id="cashAdvanceDeduction"
                  name="cashAdvanceDeduction"
                  type="number"
                  min="0"
                  step="0.01"
                  value={deductionsFormData.cashAdvanceDeduction}
                  onChange={handleDeductionsInputChange}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Amount to deduct for cash advance repayment each pay period
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="otherDeductions">Other Deductions (₱ per pay period)</Label>
                <Input
                  id="otherDeductions"
                  name="otherDeductions"
                  type="number"
                  min="0"
                  step="0.01"
                  value={deductionsFormData.otherDeductions}
                  onChange={handleDeductionsInputChange}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Any other recurring deductions each pay period
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeductionsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateDeductions.isPending}>
                {updateDeductions.isPending ? 'Saving...' : 'Save Deductions'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
