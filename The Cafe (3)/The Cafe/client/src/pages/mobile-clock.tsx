import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, LogIn, LogOut, Coffee, Play, User } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { getCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import MobileHeader from "@/components/layout/mobile-header";
import MobileBottomNav from "@/components/layout/mobile-bottom-nav";

interface ClockStatus {
  isClocked: boolean;
  onBreak: boolean;
  clockInTime?: string;
  breakStartTime?: string;
  currentShift?: {
    id: string;
    position: string;
    startTime: string;
    endTime: string;
  };
}

export default function MobileClock() {
  const currentUser = getCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [elapsedTime, setElapsedTime] = useState(0);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch clock status
  const { data: clockStatus, isLoading } = useQuery<ClockStatus>({
    queryKey: ['clock-status', currentUser?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/clock/status');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Calculate elapsed time
  useEffect(() => {
    if (clockStatus?.isClocked && clockStatus.clockInTime) {
      const clockInTime = new Date(clockStatus.clockInTime);
      const updateElapsed = () => {
        const now = new Date();
        const diff = Math.floor((now.getTime() - clockInTime.getTime()) / 1000);
        setElapsedTime(diff);
      };
      updateElapsed();
      const timer = setInterval(updateElapsed, 1000);
      return () => clearInterval(timer);
    }
  }, [clockStatus]);

  // Clock mutation
  const clockMutation = useMutation({
    mutationFn: (action: { action: string; notes?: string }) =>
      apiRequest("POST", "/api/clock", action),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clock-status'] });
      
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

  const formatElapsedTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName || !lastName) return "?";
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Clock className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <MobileHeader
        title="Clock In/Out"
        subtitle={format(currentTime, "EEEE, MMMM d, yyyy")}
        showBack={false}
        showMenu={false}
      />

      <div className="p-4 space-y-6">
        {/* Current Time Display */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6 text-center">
            <Clock className="h-12 w-12 text-primary mx-auto mb-4" />
            <div className="text-5xl font-bold text-foreground mb-2">
              {format(currentTime, "HH:mm:ss")}
            </div>
            <div className="text-sm text-muted-foreground">
              {format(currentTime, "EEEE, MMMM d, yyyy")}
            </div>
          </CardContent>
        </Card>

        {/* User Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground text-xl font-medium">
                  {getInitials(currentUser?.firstName, currentUser?.lastName)}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">
                  {currentUser?.firstName} {currentUser?.lastName}
                </h3>
                <p className="text-sm text-muted-foreground">{currentUser?.position}</p>
                {clockStatus?.currentShift && (
                  <Badge variant="outline" className="mt-1">
                    Shift: {format(new Date(clockStatus.currentShift.startTime), "h:mm a")} - {format(new Date(clockStatus.currentShift.endTime), "h:mm a")}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Card */}
        {clockStatus?.isClocked && (
          <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="font-semibold text-green-700 dark:text-green-400">
                  {clockStatus.onBreak ? "On Break" : "Clocked In"}
                </span>
              </div>
              <div className="text-3xl font-bold text-green-700 dark:text-green-400 mb-1">
                {formatElapsedTime(elapsedTime)}
              </div>
              <div className="text-sm text-green-600 dark:text-green-500">
                Since {clockStatus.clockInTime ? format(new Date(clockStatus.clockInTime), "h:mm a") : "N/A"}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Clock Actions */}
        <div className="grid grid-cols-2 gap-4">
          {!clockStatus?.isClocked ? (
            <Button
              className="h-32 text-lg font-semibold bg-green-600 hover:bg-green-700 col-span-2"
              onClick={() => handleClockAction("clock_in")}
              disabled={clockMutation.isPending}
            >
              <div className="text-center">
                <LogIn className="h-10 w-10 mb-2 mx-auto" />
                <p>Clock In</p>
              </div>
            </Button>
          ) : (
            <>
              {!clockStatus?.onBreak ? (
                <>
                  <Button
                    className="h-32 text-lg font-semibold bg-yellow-600 hover:bg-yellow-700"
                    onClick={() => handleClockAction("break_start")}
                    disabled={clockMutation.isPending}
                  >
                    <div className="text-center">
                      <Coffee className="h-10 w-10 mb-2 mx-auto" />
                      <p>Start Break</p>
                    </div>
                  </Button>
                  <Button
                    className="h-32 text-lg font-semibold bg-red-600 hover:bg-red-700"
                    onClick={() => handleClockAction("clock_out")}
                    disabled={clockMutation.isPending}
                  >
                    <div className="text-center">
                      <LogOut className="h-10 w-10 mb-2 mx-auto" />
                      <p>Clock Out</p>
                    </div>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    className="h-32 text-lg font-semibold bg-blue-600 hover:bg-blue-700 col-span-2"
                    onClick={() => handleClockAction("break_end")}
                    disabled={clockMutation.isPending}
                  >
                    <div className="text-center">
                      <Play className="h-10 w-10 mb-2 mx-auto" />
                      <p>End Break</p>
                    </div>
                  </Button>
                </>
              )}
            </>
          )}
        </div>

        {/* Today's Summary */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Today's Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">
                  {formatElapsedTime(elapsedTime).split(':')[0]}h
                </div>
                <div className="text-xs text-muted-foreground">Hours Worked</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {clockStatus?.onBreak ? "Yes" : "No"}
                </div>
                <div className="text-xs text-muted-foreground">On Break</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <MobileBottomNav />
    </div>
  );
}

