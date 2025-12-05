import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowRightLeft, Clock, AlertTriangle, Hand, Calendar, CheckCircle, XCircle } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { getCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import MobileHeader from "@/components/layout/mobile-header";
import MobileBottomNav from "@/components/layout/mobile-bottom-nav";

export default function MobileShiftDrop() {
  const currentUser = getCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"my-shifts" | "available" | "requests">("my-shifts");
  const [isDropDialogOpen, setIsDropDialogOpen] = useState(false);
  const [isWarningDialogOpen, setIsWarningDialogOpen] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [reason, setReason] = useState("");
  const [urgency, setUrgency] = useState<"low" | "normal" | "urgent">("normal");

  // Fetch my upcoming shifts
  const { data: myShiftsData, isLoading: loadingShifts } = useQuery({
    queryKey: ['mobile-my-shifts-for-drop'],
    queryFn: async () => {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const response = await apiRequest('GET', `/api/shifts?startDate=${now.toISOString()}&endDate=${futureDate.toISOString()}`);
      return response.json();
    },
  });

  // Fetch available shifts for pickup
  const { data: availableData, isLoading: loadingAvailable } = useQuery({
    queryKey: ['mobile-available-shifts'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/shift-drop-requests/available');
      return response.json();
    },
  });

  // Fetch my drop requests
  const { data: myRequestsData, isLoading: loadingRequests } = useQuery({
    queryKey: ['mobile-my-drop-requests'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/shift-drop-requests/my');
      return response.json();
    },
  });

  // Submit drop request
  const submitDropMutation = useMutation({
    mutationFn: async (data: { shiftId: string; reason: string; urgency: string }) => {
      const response = await apiRequest('POST', '/api/shift-drop-requests', {
        ...data,
        userId: currentUser?.id,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mobile-my-shifts-for-drop'] });
      queryClient.invalidateQueries({ queryKey: ['mobile-my-drop-requests'] });
      toast({ title: "Request Submitted", description: "Your shift drop request has been sent to management." });
      setIsDropDialogOpen(false);
      setIsWarningDialogOpen(false);
      setReason("");
      setSelectedShiftId("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to submit request", variant: "destructive" });
    },
  });

  // Pickup shift
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
      queryClient.invalidateQueries({ queryKey: ['mobile-available-shifts'] });
      queryClient.invalidateQueries({ queryKey: ['mobile-my-shifts-for-drop'] });
      toast({ title: "Shift Picked Up!", description: "This shift has been added to your schedule." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to pick up shift", variant: "destructive" });
    },
  });

  const myShifts = myShiftsData?.shifts || [];
  const availableShifts = availableData?.requests || [];
  const myRequests = myRequestsData?.requests || [];

  const canDropShift = (shift: any) => {
    const shiftDate = new Date(shift.startTime);
    const now = new Date();
    const daysUntilShift = differenceInDays(shiftDate, now);
    return daysUntilShift >= 3;
  };

  const handleDropClick = (shiftId: string) => {
    setSelectedShiftId(shiftId);
    setIsDropDialogOpen(true);
  };

  const handleSubmitDrop = () => {
    if (!reason.trim()) {
      toast({ title: "Error", description: "Please provide a reason", variant: "destructive" });
      return;
    }
    setIsDropDialogOpen(false);
    setIsWarningDialogOpen(true);
  };

  const confirmDrop = () => {
    submitDropMutation.mutate({ shiftId: selectedShiftId, reason, urgency });
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: any; label: string }> = {
      pending: { variant: "secondary", label: "Pending" },
      approved: { variant: "default", label: "Available" },
      rejected: { variant: "destructive", label: "Rejected" },
      picked_up: { variant: "outline", label: "Picked Up" },
      cancelled: { variant: "outline", label: "Cancelled" },
    };
    const { variant, label } = config[status] || { variant: "secondary", label: status };
    return <Badge variant={variant}>{label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <MobileHeader
        title="Shift Drop"
        subtitle="Request to drop or pick up shifts"
        showBack={true}
      />

      <div className="p-4 space-y-4">
        {/* Alert */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            You can only request to drop shifts that are at least 3 days away.
          </AlertDescription>
        </Alert>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("my-shifts")}
            className={`flex-1 py-2 px-2 rounded-md text-sm font-medium transition-all ${
              activeTab === "my-shifts" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            My Shifts
          </button>
          <button
            onClick={() => setActiveTab("available")}
            className={`flex-1 py-2 px-2 rounded-md text-sm font-medium transition-all ${
              activeTab === "available" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            Available ({availableShifts.length})
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            className={`flex-1 py-2 px-2 rounded-md text-sm font-medium transition-all ${
              activeTab === "requests" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            My Requests
          </button>
        </div>

        {/* My Shifts Tab */}
        {activeTab === "my-shifts" && (
          <div className="space-y-3">
            {loadingShifts ? (
              <div className="text-center py-8 text-muted-foreground">Loading shifts...</div>
            ) : myShifts.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <Calendar className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">No upcoming shifts</p>
                </CardContent>
              </Card>
            ) : (
              myShifts.map((shift: any) => {
                const canDrop = canDropShift(shift);
                const daysUntil = differenceInDays(new Date(shift.startTime), new Date());
                return (
                  <Card key={shift.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold">{shift.position || "Shift"}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(parseISO(shift.startTime), "EEE, MMM d")}
                          </p>
                        </div>
                        <Badge variant={canDrop ? "outline" : "secondary"}>
                          {daysUntil} days away
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm mb-3">
                        <Clock className="h-4 w-4" />
                        {format(parseISO(shift.startTime), "h:mm a")} - {format(parseISO(shift.endTime), "h:mm a")}
                      </div>
                      <Button
                        className="w-full"
                        variant={canDrop ? "default" : "secondary"}
                        disabled={!canDrop}
                        onClick={() => handleDropClick(shift.id)}
                      >
                        {canDrop ? "Request to Drop" : "Cannot Drop (< 3 days)"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* Available Shifts Tab */}
        {activeTab === "available" && (
          <div className="space-y-3">
            {loadingAvailable ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : availableShifts.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <Hand className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">No available shifts to pick up</p>
                </CardContent>
              </Card>
            ) : (
              availableShifts.map((request: any) => (
                <Card key={request.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold">{request.shift?.position || "Shift"}</p>
                        <p className="text-sm text-muted-foreground">
                          {request.shift && format(parseISO(request.shift.startTime), "EEE, MMM d")}
                        </p>
                      </div>
                      <Badge variant="outline">{request.user?.firstName}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm mb-3">
                      <Clock className="h-4 w-4" />
                      {request.shift && (
                        <>
                          {format(parseISO(request.shift.startTime), "h:mm a")} - {format(parseISO(request.shift.endTime), "h:mm a")}
                        </>
                      )}
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => pickupMutation.mutate(request.id)}
                      disabled={pickupMutation.isPending}
                    >
                      <Hand className="h-4 w-4 mr-2" />
                      Pick Up This Shift
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* My Requests Tab */}
        {activeTab === "requests" && (
          <div className="space-y-3">
            {loadingRequests ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : myRequests.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <ArrowRightLeft className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">No drop requests yet</p>
                </CardContent>
              </Card>
            ) : (
              myRequests.map((request: any) => (
                <Card key={request.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold">{request.shift?.position || "Shift"}</p>
                        <p className="text-sm text-muted-foreground">
                          {request.shift && format(parseISO(request.shift.startTime), "EEE, MMM d")}
                        </p>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">Reason: {request.reason}</p>
                    {request.managerNotes && (
                      <p className="text-sm text-muted-foreground">Manager notes: {request.managerNotes}</p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      {/* Drop Request Dialog */}
      <Dialog open={isDropDialogOpen} onOpenChange={setIsDropDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request to Drop Shift</DialogTitle>
            <DialogDescription>Please provide a reason for dropping this shift.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason (Required)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why do you need to drop this shift?"
              />
            </div>
            <div className="space-y-2">
              <Label>Urgency</Label>
              <Select value={urgency} onValueChange={(v: any) => setUrgency(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDropDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitDrop}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Warning Dialog */}
      <Dialog open={isWarningDialogOpen} onOpenChange={setIsWarningDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Warning
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">
              If no one picks up this shift, management may reassign it or require you to work.
            </p>
            <p className="mt-4 font-medium">Are you sure you want to continue?</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWarningDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmDrop} disabled={submitDropMutation.isPending}>
              {submitDropMutation.isPending ? "Submitting..." : "Yes, Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MobileBottomNav />
    </div>
  );
}

