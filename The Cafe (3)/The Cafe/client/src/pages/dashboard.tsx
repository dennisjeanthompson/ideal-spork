import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hasManagerAccess, getCurrentUser } from "@/lib/auth";
import EmployeeStatus from "@/components/dashboard/employee-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Dashboard() {
  const isManagerRole = hasManagerAccess();
  const currentUser = getCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: approvals } = useQuery({
    queryKey: ["/api/approvals"],
    enabled: isManagerRole,
  });

  const { data: timeOffResponse } = useQuery({
    queryKey: ["/api/time-off-requests"],
    enabled: isManagerRole,
  });

  const { data: shifts } = useQuery({
    queryKey: ["/api/shifts/branch"],
    enabled: isManagerRole,
  });

  // Fetch employee's own shifts
  const { data: employeeShifts } = useQuery({
    queryKey: ["/api/shifts"],
    enabled: !isManagerRole,
  });

  const todayShifts = isManagerRole
    ? (shifts?.shifts?.filter((shift: any) => {
        const shiftDate = new Date(shift.startTime);
        const today = new Date();
        return shiftDate.toDateString() === today.toDateString();
      }) || [])
    : (employeeShifts?.shifts?.filter((shift: any) => {
        const shiftDate = new Date(shift.startTime);
        const today = new Date();
        return shiftDate.toDateString() === today.toDateString();
      }) || []);

  // Get pending time-off requests
  const pendingTimeOffRequests = (timeOffResponse?.requests || []).filter(
    (request: any) => request.status === 'pending'
  );

  // Approve time-off request mutation
  const approveTimeOffMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await apiRequest('PUT', `/api/time-off-requests/${requestId}/approve`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Time off request approved",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/time-off-requests"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve request",
        variant: "destructive",
      });
    },
  });

  // Reject time-off request mutation
  const rejectTimeOffMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await apiRequest('PUT', `/api/time-off-requests/${requestId}/reject`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Time off request rejected",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/time-off-requests"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject request",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="p-6 space-y-6">
      {isManagerRole ? (
        <>
          {/* Manager Dashboard */}
          <div>
            <h2 className="text-2xl font-bold text-foreground">Manager Dashboard</h2>
            <p className="text-muted-foreground">Overview of today's operations</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EmployeeStatus />

            {/* Today's Schedule */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CalendarDays className="h-5 w-5 text-primary mr-2" />
                  Today's Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {todayShifts.length > 0 ? (
                    todayShifts.map((shift: any) => (
                      <div
                        key={shift.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg"
                        data-testid={`shift-${shift.id}`}
                      >
                        <div>
                          <p className="font-medium">{shift.user?.firstName} {shift.user?.lastName}</p>
                          <p className="text-sm text-muted-foreground">{shift.position}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            {new Date(shift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                            {new Date(shift.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <span className="text-xs px-2 py-1 bg-accent text-accent-foreground rounded">
                            {shift.status}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No shifts scheduled for today</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* Pending Approvals */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-primary mr-2" />
                  Pending Approvals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Time Off Requests */}
                  {pendingTimeOffRequests.length > 0 && pendingTimeOffRequests.map((request: any) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                      data-testid={`time-off-${request.id}`}
                    >
                      <div className="flex items-center space-x-4">
                        <CalendarDays className="h-5 w-5 text-chart-2" />
                        <div>
                          <p className="font-medium">{request.user?.firstName} {request.user?.lastName}</p>
                          <p className="text-sm text-muted-foreground">
                            Time Off Request ({request.type}) - {format(new Date(request.startDate), "MMM d")} to {format(new Date(request.endDate), "MMM d, yyyy")}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">{request.reason}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => approveTimeOffMutation.mutate(request.id)}
                          disabled={approveTimeOffMutation.isPending}
                          data-testid={`button-approve-${request.id}`}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => rejectTimeOffMutation.mutate(request.id)}
                          disabled={rejectTimeOffMutation.isPending}
                          data-testid={`button-deny-${request.id}`}
                        >
                          Deny
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Other Approvals */}
                  {approvals?.approvals?.length > 0 && approvals.approvals.map((approval: any) => (
                    <div
                      key={approval.id}
                      className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                      data-testid={`approval-${approval.id}`}
                    >
                      <div className="flex items-center space-x-4">
                        <CheckCircle className="h-5 w-5 text-chart-2" />
                        <div>
                          <p className="font-medium">{approval.requestedBy?.firstName} {approval.requestedBy?.lastName}</p>
                          <p className="text-sm text-muted-foreground">{approval.type.replace('_', ' ')}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="default"
                          data-testid={`button-approve-${approval.id}`}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          data-testid={`button-deny-${approval.id}`}
                        >
                          Deny
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* No pending items */}
                  {pendingTimeOffRequests.length === 0 && (!approvals?.approvals || approvals.approvals.length === 0) && (
                    <p className="text-muted-foreground text-center py-4">No pending approvals</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <>
          {/* Employee Dashboard */}
          <div>
            <h2 className="text-2xl font-bold text-foreground">Employee Dashboard</h2>
            <p className="text-muted-foreground">Quick access to your schedule and other features</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CalendarDays className="h-5 w-5 text-primary mr-2" />
                Your Upcoming Shifts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {todayShifts.length > 0 ? (
                  todayShifts.map((shift: any) => (
                    <div
                      key={shift.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{shift.position}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(shift.startTime).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {new Date(shift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                          {new Date(shift.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <span className="text-xs px-2 py-1 bg-accent text-accent-foreground rounded">
                          {shift.status}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No shifts scheduled for today. Check the Schedule page for upcoming shifts.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
