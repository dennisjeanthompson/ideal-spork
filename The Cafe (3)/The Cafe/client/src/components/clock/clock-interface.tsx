import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, LogIn, LogOut, Coffee, User } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getInitials, formatTime, formatHours } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ClockInterface() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const currentUser = getCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const { data: clockStatus, isLoading } = useQuery({
    queryKey: ["/api/clock/status"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: todayEntries } = useQuery({
    queryKey: ["/api/time-entries", { 
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    }],
  });

  const clockMutation = useMutation({
    mutationFn: (action: { action: string; notes?: string }) =>
      apiRequest("POST", "/api/clock", action),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clock/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      
      const actionText = {
        clock_in: "clocked in",
        clock_out: "clocked out", 
        break_start: "started break",
        break_end: "ended break"
      }[variables.action] || variables.action;
      
      toast({
        title: "Success",
        description: `You have ${actionText}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to perform action",
        variant: "destructive",
      });
    },
  });

  const handleClockAction = (action: string) => {
    clockMutation.mutate({ action });
  };

  const todayHours = todayEntries?.entries?.reduce((total: number, entry: any) => {
    return total + (parseFloat(entry.totalHours || "0"));
  }, 0) || 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="animate-pulse">Loading clock interface...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-center">
          <Clock className="h-6 w-6 text-primary mr-2 pulse-clock" />
          Employee Clock-In/Out
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-6">
        {/* User Info */}
        <div>
          <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
            {currentUser ? (
              <span className="text-primary-foreground text-xl font-medium">
                {getInitials(currentUser.firstName, currentUser.lastName)}
              </span>
            ) : (
              <User className="h-8 w-8 text-primary-foreground" />
            )}
          </div>
          <h4 className="text-xl font-semibold" data-testid="text-welcome-user">
            Welcome, {currentUser?.firstName} {currentUser?.lastName}
          </h4>
          <p className="text-muted-foreground" data-testid="text-user-info">
            {currentUser?.position}
          </p>
        </div>
        
        {/* Current Time */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">Current Time</p>
          <p className="text-2xl font-mono font-bold" data-testid="text-current-time">
            {currentTime.toLocaleTimeString()}
          </p>
        </div>
        
        {/* Clock Actions */}
        <div className="grid grid-cols-2 gap-4">
          {!clockStatus?.isClocked ? (
            <Button
              className="p-6 h-auto bg-accent hover:bg-accent/80"
              onClick={() => handleClockAction("clock_in")}
              disabled={clockMutation.isPending}
              data-testid="button-clock-in"
            >
              <div className="text-center">
                <LogIn className="h-6 w-6 mb-2 mx-auto" />
                <p className="font-medium">Clock In</p>
              </div>
            </Button>
          ) : (
            <>
              {!clockStatus?.onBreak ? (
                <>
                  <Button
                    className="p-6 h-auto bg-chart-2 hover:bg-chart-2/80"
                    onClick={() => handleClockAction("break_start")}
                    disabled={clockMutation.isPending}
                    data-testid="button-break-start"
                  >
                    <div className="text-center">
                      <Coffee className="h-6 w-6 mb-2 mx-auto" />
                      <p className="font-medium">Start Break</p>
                    </div>
                  </Button>
                  <Button
                    className="p-6 h-auto bg-destructive hover:bg-destructive/80"
                    onClick={() => handleClockAction("clock_out")}
                    disabled={clockMutation.isPending}
                    data-testid="button-clock-out"
                  >
                    <div className="text-center">
                      <LogOut className="h-6 w-6 mb-2 mx-auto" />
                      <p className="font-medium">Clock Out</p>
                    </div>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    className="p-6 h-auto bg-accent hover:bg-accent/80"
                    onClick={() => handleClockAction("break_end")}
                    disabled={clockMutation.isPending}
                    data-testid="button-break-end"
                  >
                    <div className="text-center">
                      <Clock className="h-6 w-6 mb-2 mx-auto" />
                      <p className="font-medium">End Break</p>
                    </div>
                  </Button>
                  <Button
                    className="p-6 h-auto bg-destructive hover:bg-destructive/80"
                    onClick={() => handleClockAction("clock_out")}
                    disabled={clockMutation.isPending}
                    data-testid="button-clock-out"
                  >
                    <div className="text-center">
                      <LogOut className="h-6 w-6 mb-2 mx-auto" />
                      <p className="font-medium">Clock Out</p>
                    </div>
                  </Button>
                </>
              )}
            </>
          )}
        </div>
        
        {/* Status Info */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Status:</span>
            <span 
              className={`px-3 py-1 rounded text-sm font-medium ${
                clockStatus?.isClocked 
                  ? clockStatus?.onBreak 
                    ? "bg-chart-2 text-accent-foreground status-break"
                    : "bg-accent text-accent-foreground status-working"
                  : "bg-secondary text-secondary-foreground"
              }`}
              data-testid="text-clock-status"
            >
              {clockStatus?.isClocked 
                ? clockStatus?.onBreak 
                  ? "On Break" 
                  : "Working"
                : "Clocked Out"
              }
            </span>
          </div>
          
          {clockStatus?.currentEntry && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Since:</span>
              <span className="text-sm font-medium" data-testid="text-clock-since">
                {formatTime(
                  clockStatus.onBreak 
                    ? clockStatus.currentEntry.breakStart 
                    : clockStatus.currentEntry.clockIn
                )}
              </span>
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Today's Hours:</span>
            <span className="text-lg font-semibold" data-testid="text-today-hours">
              {formatHours(todayHours)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
