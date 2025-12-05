import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, Plus, Calendar, Clock, AlertTriangle, CheckCircle, XCircle, Hand, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { hasManagerAccess, getCurrentUser } from "@/lib/auth";

export default function ShiftTrading() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = getCurrentUser();
  const isManagerOrAdmin = hasManagerAccess();

  const [isDropDialogOpen, setIsDropDialogOpen] = useState(false);
  const [isWarningDialogOpen, setIsWarningDialogOpen] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [reason, setReason] = useState("");
  const [urgency, setUrgency] = useState<"low" | "normal" | "urgent">("normal");

  // Manager-specific state
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [managerNotes, setManagerNotes] = useState("");
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isForceWorkDialogOpen, setIsForceWorkDialogOpen] = useState(false);
  const [isMarkClosedDialogOpen, setIsMarkClosedDialogOpen] = useState(false);

  // Fetch available shifts for pickup
  const { data: availableShifts } = useQuery({
    queryKey: ["/api/shift-drop-requests/available"],
  });

  // Fetch my drop requests
  const { data: myDropRequests } = useQuery({
    queryKey: ["/api/shift-drop-requests/my"],
  });

  // Fetch pending drop requests (manager view)
  const { data: pendingRequests } = useQuery({
    queryKey: ["/api/shift-drop-requests", "pending"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/shift-drop-requests?status=pending');
      return response.json();
    },
    enabled: isManagerOrAdmin,
  });

  // Fetch all drop requests (manager view)
  const { data: allRequests } = useQuery({
    queryKey: ["/api/shift-drop-requests", "all"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/shift-drop-requests');
      return response.json();
    },
    enabled: isManagerOrAdmin,
  });

  // Fetch employees for assignment
  const { data: employeesData } = useQuery({
    queryKey: ['employees-for-assign'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/employees');
      return response.json();
    },
    enabled: isManagerOrAdmin && isAssignDialogOpen,
  });

  // Employees data is an array
  const employees = Array.isArray(employeesData) ? employeesData : [];

  // Fetch user's upcoming shifts for drop request
  const { data: myShifts, isLoading: shiftsLoading } = useQuery({
    queryKey: ["my-shifts-for-drop"],
    queryFn: async () => {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 1);
      futureDate.setHours(23, 59, 59, 999);
      const response = await apiRequest('GET', `/api/shifts?startDate=${now.toISOString()}&endDate=${futureDate.toISOString()}`);
      const data = await response.json();
      return data;
    },
    enabled: isDropDialogOpen,
  });

  // Create shift drop request mutation
  const dropRequestMutation = useMutation({
    mutationFn: async (data: { shiftId: string; reason: string; urgency: string }) => {
      const response = await apiRequest('POST', '/api/shift-drop-requests', data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-drop-requests/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shift-drop-requests/available"] });
      toast({
        title: "Request Submitted",
        description: "Your shift drop request has been sent to management for approval.",
      });
      setIsDropDialogOpen(false);
      setIsWarningDialogOpen(false);
      setSelectedShiftId("");
      setReason("");
      setUrgency("normal");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit drop request",
        variant: "destructive",
      });
    },
  });

  // Pickup shift mutation
  const pickupMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await apiRequest('PUT', `/api/shift-drop-requests/${requestId}/pickup`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-drop-requests/available"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({
        title: "Shift Picked Up",
        description: "You have successfully picked up this shift.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to pick up shift",
        variant: "destructive",
      });
    },
  });

  // Cancel drop request mutation
  const cancelMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await apiRequest('PUT', `/api/shift-drop-requests/${requestId}/cancel`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-drop-requests/my"] });
      toast({
        title: "Request Cancelled",
        description: "Your shift drop request has been cancelled.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel request",
        variant: "destructive",
      });
    },
  });

  // Manager: Approve drop request
  const approveMutation = useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes: string }) => {
      const response = await apiRequest('PUT', `/api/shift-drop-requests/${requestId}/approve`, { managerNotes: notes });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-drop-requests"] });
      toast({ title: "Request Approved", description: "The shift is now available for pickup." });
      setIsApproveDialogOpen(false);
      setSelectedRequest(null);
      setManagerNotes("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to approve request", variant: "destructive" });
    },
  });

  // Manager: Reject drop request
  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes: string }) => {
      const response = await apiRequest('PUT', `/api/shift-drop-requests/${requestId}/reject`, { managerNotes: notes });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-drop-requests"] });
      toast({ title: "Request Rejected", description: "The employee must work their shift." });
      setIsRejectDialogOpen(false);
      setSelectedRequest(null);
      setManagerNotes("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to reject request", variant: "destructive" });
    },
  });

  // Manager: Assign shift to employee
  const assignMutation = useMutation({
    mutationFn: async ({ requestId, employeeId, notes }: { requestId: string; employeeId: string; notes: string }) => {
      const response = await apiRequest('PUT', `/api/shift-drop-requests/${requestId}/assign`, { employeeId, managerNotes: notes });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-drop-requests"] });
      toast({ title: "Shift Assigned", description: "The shift has been assigned to the selected employee." });
      setIsAssignDialogOpen(false);
      setSelectedRequest(null);
      setManagerNotes("");
      setAssignEmployeeId("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to assign shift", variant: "destructive" });
    },
  });

  // Manager: Force original employee to work
  const forceWorkMutation = useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes: string }) => {
      const response = await apiRequest('PUT', `/api/shift-drop-requests/${requestId}/force-work`, { managerNotes: notes });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-drop-requests"] });
      toast({ title: "Employee Required to Work", description: "The original employee must work this shift." });
      setIsForceWorkDialogOpen(false);
      setSelectedRequest(null);
      setManagerNotes("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to force work", variant: "destructive" });
    },
  });

  // Manager: Mark shift as closed/cancelled
  const markClosedMutation = useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes: string }) => {
      const response = await apiRequest('PUT', `/api/shift-drop-requests/${requestId}/mark-closed`, { managerNotes: notes });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-drop-requests"] });
      toast({ title: "Shift Cancelled", description: "The shift has been marked as cancelled." });
      setIsMarkClosedDialogOpen(false);
      setSelectedRequest(null);
      setManagerNotes("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to mark as closed", variant: "destructive" });
    },
  });

  const handleOpenDropDialog = () => {
    setIsDropDialogOpen(true);
  };

  const handleProceedWithWarning = () => {
    if (!selectedShiftId || !reason.trim()) {
      toast({
        title: "Error",
        description: "Please select a shift and provide a reason",
        variant: "destructive",
      });
      return;
    }
    setIsWarningDialogOpen(true);
  };

  const handleConfirmDrop = () => {
    dropRequestMutation.mutate({ shiftId: selectedShiftId, reason, urgency });
  };

  // Filter shifts that are at least 3 days away and not already requested
  const eligibleShifts = (myShifts?.shifts || []).filter((shift: any) => {
    const shiftDate = new Date(shift.startTime);
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // Check if already has a pending/approved drop request
    const hasRequest = myDropRequests?.requests?.some(
      (req: any) => req.shiftId === shift.id && (req.status === 'pending' || req.status === 'approved')
    );

    return shiftDate >= threeDaysFromNow && !hasRequest;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Pending Approval</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Available for Pickup</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-100 text-red-800">Rejected</Badge>;
      case 'picked_up':
        return <Badge variant="outline" className="bg-green-100 text-green-800">Picked Up</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Shift Drop Requests</h2>
          <p className="text-muted-foreground">Request to drop shifts and pick up available shifts</p>
        </div>

        <Button data-testid="button-drop-shift" onClick={handleOpenDropDialog}>
          <Hand className="h-4 w-4 mr-2" />
          Request to Drop Shift
        </Button>
      </div>

      {/* Info Alert */}
      <Alert className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>How Shift Drop Requests Work</AlertTitle>
        <AlertDescription>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
            <li>You can only request to drop shifts that are at least 3 days away</li>
            <li>Your request will be sent to management for approval</li>
            <li>If approved, the shift becomes available for other employees to pick up</li>
            <li>If no one picks up the shift, management may require you to work it</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Drop Shift Request Dialog */}
      <Dialog open={isDropDialogOpen} onOpenChange={setIsDropDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request to Drop Shift</DialogTitle>
            <DialogDescription>
              Select a shift you want to drop and provide a reason. Your request will be reviewed by management.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Shift (must be 3+ days away)</Label>
              {shiftsLoading ? (
                <div className="p-4 text-center text-muted-foreground">Loading shifts...</div>
              ) : (
                <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a shift to drop" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleShifts.length > 0 ? (
                      eligibleShifts.map((shift: any) => (
                        <SelectItem key={shift.id} value={shift.id}>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>{format(new Date(shift.startTime), "MMM d, yyyy")}</span>
                            <Clock className="h-4 w-4 ml-2" />
                            <span>{format(new Date(shift.startTime), "h:mm a")} - {format(new Date(shift.endTime), "h:mm a")}</span>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>No eligible shifts (must be 3+ days away)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Urgency</Label>
              <Select value={urgency} onValueChange={(v) => setUrgency(v as "low" | "normal" | "urgent")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason for Dropping (Required)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please explain why you need to drop this shift..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDropDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleProceedWithWarning} disabled={!selectedShiftId || !reason.trim()}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Warning Confirmation Dialog */}
      <Dialog open={isWarningDialogOpen} onOpenChange={setIsWarningDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Important Warning
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">
              If no one picks up this shift, management may reassign it or require you to work.
            </p>
            <p className="mt-4 font-medium">Are you sure you want to continue?</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWarningDialogOpen(false)}>
              Go Back
            </Button>
            <Button
              onClick={handleConfirmDrop}
              disabled={dropRequestMutation.isPending}
              variant="destructive"
            >
              {dropRequestMutation.isPending ? "Submitting..." : "Yes, Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manager Dialogs */}
      {isManagerOrAdmin && (
        <>
          {/* Approve Dialog */}
          <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Approve Drop Request</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p>Approve this shift drop request? The shift will become available for other employees to pick up.</p>
                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Textarea value={managerNotes} onChange={(e) => setManagerNotes(e.target.value)} placeholder="Add any notes..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => approveMutation.mutate({ requestId: selectedRequest?.id, notes: managerNotes })} disabled={approveMutation.isPending}>
                  {approveMutation.isPending ? "Approving..." : "Approve"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Reject Dialog */}
          <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reject Drop Request</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p>Reject this shift drop request? The employee will be required to work their shift.</p>
                <div className="space-y-2">
                  <Label>Reason (Optional)</Label>
                  <Textarea value={managerNotes} onChange={(e) => setManagerNotes(e.target.value)} placeholder="Explain why the request is rejected..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={() => rejectMutation.mutate({ requestId: selectedRequest?.id, notes: managerNotes })} disabled={rejectMutation.isPending}>
                  {rejectMutation.isPending ? "Rejecting..." : "Reject"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Assign Dialog */}
          <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Shift to Employee</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Select Employee</Label>
                  <Select value={assignEmployeeId} onValueChange={setAssignEmployeeId}>
                    <SelectTrigger><SelectValue placeholder="Select an employee" /></SelectTrigger>
                    <SelectContent>
                      {employees
                        .filter((e: any) => e.id !== selectedRequest?.userId && e.role !== 'admin')
                        .map((emp: any) => (
                          <SelectItem key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Textarea value={managerNotes} onChange={(e) => setManagerNotes(e.target.value)} placeholder="Add any notes..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => assignMutation.mutate({ requestId: selectedRequest?.id, employeeId: assignEmployeeId, notes: managerNotes })} disabled={assignMutation.isPending || !assignEmployeeId}>
                  {assignMutation.isPending ? "Assigning..." : "Assign Shift"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Force Work Dialog */}
          <Dialog open={isForceWorkDialogOpen} onOpenChange={setIsForceWorkDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Require Employee to Work</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p>Require the original employee to work this shift? This will revoke the approved drop request.</p>
                <div className="space-y-2">
                  <Label>Reason (Optional)</Label>
                  <Textarea value={managerNotes} onChange={(e) => setManagerNotes(e.target.value)} placeholder="Explain why..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsForceWorkDialogOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={() => forceWorkMutation.mutate({ requestId: selectedRequest?.id, notes: managerNotes })} disabled={forceWorkMutation.isPending}>
                  {forceWorkMutation.isPending ? "Processing..." : "Require Work"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Mark Closed Dialog */}
          <Dialog open={isMarkClosedDialogOpen} onOpenChange={setIsMarkClosedDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancel Shift (Business Closed)</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p>Mark this shift as cancelled? Use this if the business is closed or the shift is no longer needed.</p>
                <div className="space-y-2">
                  <Label>Reason (Optional)</Label>
                  <Textarea value={managerNotes} onChange={(e) => setManagerNotes(e.target.value)} placeholder="e.g., Business closed for holiday..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsMarkClosedDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => markClosedMutation.mutate({ requestId: selectedRequest?.id, notes: managerNotes })} disabled={markClosedMutation.isPending}>
                  {markClosedMutation.isPending ? "Processing..." : "Mark as Cancelled"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Manager Section - Pending Requests */}
      {isManagerOrAdmin && pendingRequests?.requests?.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center text-amber-800">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Pending Drop Requests ({pendingRequests.requests.length})
            </CardTitle>
            <CardDescription>Review and approve or reject employee shift drop requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingRequests.requests.map((request: any) => (
                <div key={request.id} className="border rounded-lg p-4 bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{request.user?.firstName} {request.user?.lastName}</span>
                      <span className="text-muted-foreground ml-2">wants to drop:</span>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {request.shift && format(new Date(request.shift.startTime), "EEEE, MMM d, yyyy")}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {request.shift && format(new Date(request.shift.startTime), "h:mm a")} - {request.shift && format(new Date(request.shift.endTime), "h:mm a")}
                    </div>
                  </div>
                  <p className="text-sm"><span className="font-medium">Reason:</span> {request.reason}</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { setSelectedRequest(request); setIsApproveDialogOpen(true); }}>
                      <CheckCircle className="h-4 w-4 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => { setSelectedRequest(request); setIsRejectDialogOpen(true); }}>
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manager Section - Unfilled Approved Shifts */}
      {isManagerOrAdmin && allRequests?.requests?.filter((r: any) => r.status === 'approved' && !r.pickedUpBy).length > 0 && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center text-blue-800">
              <Hand className="h-5 w-5 mr-2" />
              Unfilled Shifts ({allRequests.requests.filter((r: any) => r.status === 'approved' && !r.pickedUpBy).length})
            </CardTitle>
            <CardDescription>Approved drop requests waiting for pickup - take action if needed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {allRequests.requests.filter((r: any) => r.status === 'approved' && !r.pickedUpBy).map((request: any) => (
                <div key={request.id} className="border rounded-lg p-4 bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">Originally: {request.user?.firstName} {request.user?.lastName}</span>
                    </div>
                    <Badge variant="outline" className="bg-blue-100 text-blue-800">Awaiting Pickup</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {request.shift && format(new Date(request.shift.startTime), "EEEE, MMM d, yyyy")}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {request.shift && format(new Date(request.shift.startTime), "h:mm a")} - {request.shift && format(new Date(request.shift.endTime), "h:mm a")}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => { setSelectedRequest(request); setIsAssignDialogOpen(true); }}>
                      <User className="h-4 w-4 mr-1" /> Assign to Employee
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setSelectedRequest(request); setIsForceWorkDialogOpen(true); }}>
                      Force Original to Work
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setSelectedRequest(request); setIsMarkClosedDialogOpen(true); }}>
                      Mark as Cancelled
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Available Shifts for Pickup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Hand className="h-5 w-5 text-green-600 mr-2" />
              Available Shifts for Pickup
            </CardTitle>
            <CardDescription>Shifts that other employees have dropped</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {availableShifts?.requests?.length > 0 ? (
                availableShifts.requests.map((request: any) => (
                  <div key={request.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {request.shift && format(new Date(request.shift.startTime), "EEEE, MMM d, yyyy")}
                        </span>
                      </div>
                      <Badge variant="outline" className="bg-green-100 text-green-800">Available</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {request.shift && format(new Date(request.shift.startTime), "h:mm a")} - {request.shift && format(new Date(request.shift.endTime), "h:mm a")}
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        Originally: {request.user?.firstName} {request.user?.lastName}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => pickupMutation.mutate(request.id)}
                      disabled={pickupMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {pickupMutation.isPending ? "Picking up..." : "Pick Up This Shift"}
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No shifts available for pickup
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* My Drop Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ArrowRightLeft className="h-5 w-5 text-primary mr-2" />
              My Drop Requests
            </CardTitle>
            <CardDescription>Track the status of your shift drop requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {myDropRequests?.requests?.length > 0 ? (
                myDropRequests.requests.map((request: any) => (
                  <div key={request.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {request.shift && format(new Date(request.shift.startTime), "EEEE, MMM d, yyyy")}
                        </span>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {request.shift && format(new Date(request.shift.startTime), "h:mm a")} - {request.shift && format(new Date(request.shift.endTime), "h:mm a")}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Reason:</span> {request.reason}
                    </p>
                    {request.managerNotes && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Manager Notes:</span> {request.managerNotes}
                      </p>
                    )}
                    {(request.status === 'pending' || request.status === 'approved') && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => cancelMutation.mutate(request.id)}
                        disabled={cancelMutation.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        {cancelMutation.isPending ? "Cancelling..." : "Cancel Request"}
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  You haven't submitted any drop requests
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
