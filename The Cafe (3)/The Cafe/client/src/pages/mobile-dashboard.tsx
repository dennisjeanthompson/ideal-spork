import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, DollarSign, ArrowRightLeft, Bell, User, LogOut, FileText } from "lucide-react";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { getCurrentUser, getAuthState } from "@/lib/auth";
import { useLocation } from "wouter";
import MobileHeader from "@/components/layout/mobile-header";
import MobileBottomNav from "@/components/layout/mobile-bottom-nav";
import QuickActionButton from "@/components/ui/quick-action-button";

interface Shift {
  id: string;
  startTime: string;
  endTime: string;
  position: string;
  status: string;
  break?: {
    startTime: string;
    endTime: string;
  };
}

interface PayrollEntry {
  id: string;
  totalHours: number | string;
  grossPay: number | string;
  netPay: number | string;
  status: string;
  createdAt: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export default function MobileDashboard() {
  const currentUser = getCurrentUser();
  const { isAuthenticated, user } = getAuthState();
  const [, setLocation] = useLocation();

  // Wait for authentication to load
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // This component is only accessible on mobile server, so all users are employees

  // Fetch upcoming shifts
  const { data: shiftsData } = useQuery({
    queryKey: ['mobile-shifts', currentUser?.id],
    queryFn: async () => {
      const today = new Date();
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const response = await apiRequest(
        'GET',
        `/api/shifts?startDate=${today.toISOString()}&endDate=${nextWeek.toISOString()}`
      );
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch recent payroll
  const { data: payrollData } = useQuery({
    queryKey: ['mobile-payroll'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/payroll');
      return response.json();
    },
  });

  // Fetch hours summary
  const { data: hoursSummary } = useQuery({
    queryKey: ['hours-summary'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/hours/my-summary');
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch notifications
  const { data: notificationsData } = useQuery({
    queryKey: ['mobile-notifications'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/notifications');
      return response.json();
    },
  });

  const shifts: Shift[] = shiftsData?.shifts || [];
  const upcomingShifts = shifts.slice(0, 3);
  const payrollEntries: PayrollEntry[] = payrollData?.entries || [];
  const latestPayroll = payrollEntries[0];
  const notifications: Notification[] = notificationsData?.notifications || [];
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getShiftTimeLabel = (shift: Shift) => {
    const start = parseISO(shift.startTime);
    if (isToday(start)) return "Today";
    if (isTomorrow(start)) return "Tomorrow";
    return format(start, "MMM d");
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <MobileHeader
        title={`Hello, ${currentUser?.firstName}!`}
        subtitle={format(new Date(), "EEEE, MMMM d")}
        showBack={false}
        showMenu={false}
        notificationCount={unreadCount}
        onNotificationClick={() => setLocation('/mobile-notifications')}
      />

      {/* Main Content */}
      <div className="p-4 space-y-6">
        {/* Quick Actions */}
        <div>
          <h3 className="font-semibold text-lg mb-3">Quick Actions</h3>
          <div className="grid grid-cols-3 gap-3">
            <QuickActionButton
              icon={Calendar}
              label="Schedule"
              onClick={() => setLocation('/mobile-schedule')}
              variant="default"
            />
            <QuickActionButton
              icon={ArrowRightLeft}
              label="Trade"
              onClick={() => setLocation('/mobile-shift-trading')}
              variant="default"
            />
            <QuickActionButton
              icon={FileText}
              label="Time Off"
              onClick={() => setLocation('/mobile-time-off')}
              variant="default"
            />
          </div>
        </div>

        {/* Quick Stats */}
        <div>
          <h3 className="font-semibold text-lg mb-3">Overview</h3>
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">This Week</p>
                </div>
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{shifts.length}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Shifts</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <p className="text-xs text-green-700 dark:text-green-300 font-medium">Last Pay</p>
                </div>
                <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                  {latestPayroll
                    ? `₱${parseFloat(String(latestPayroll.netPay)).toFixed(0)}`
                    : '₱0'}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">Net Amount</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Hours Summary */}
        <div>
          <h3 className="font-semibold text-lg mb-3">Your Hours</h3>
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <p className="text-xs text-purple-700 dark:text-purple-300 font-medium">This Week</p>
                </div>
                <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                  {hoursSummary?.thisWeek?.toFixed(1) || '0.0'}
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Hours Worked</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  <p className="text-xs text-orange-700 dark:text-orange-300 font-medium">This Month</p>
                </div>
                <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">
                  {hoursSummary?.thisMonth?.toFixed(1) || '0.0'}
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Hours Worked</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Upcoming Shifts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Upcoming Shifts</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.href = '/schedule'}
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingShifts.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No upcoming shifts</p>
              </div>
            ) : (
              upcomingShifts.map((shift) => {
                const start = parseISO(shift.startTime);
                const end = parseISO(shift.endTime);
                const isNow = isToday(start);

                return (
                  <div
                    key={shift.id}
                    className={`p-4 rounded-lg border-2 ${
                      isNow
                        ? 'border-primary bg-primary/5'
                        : 'border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={isNow ? 'default' : 'secondary'}>
                            {getShiftTimeLabel(shift)}
                          </Badge>
                          <Badge variant="outline">{shift.position}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(start, 'EEEE, MMM d')}
                        </p>
                      </div>
                      {isNow && (
                        <Badge className="bg-green-600">Active</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-lg font-semibold">
                      <Clock className="h-4 w-4 text-primary" />
                      <span>
                        {format(start, 'h:mm a')} - {format(end, 'h:mm a')}
                      </span>
                    </div>
                    {shift.break && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Break: {format(parseISO(shift.break.startTime), 'h:mm a')} -{' '}
                        {format(parseISO(shift.break.endTime), 'h:mm a')}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recent Notifications */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {unreadCount}
                  </Badge>
                )}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.href = '/notifications'}
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {notifications.slice(0, 3).length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              notifications.slice(0, 3).map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border ${
                    !notification.isRead
                      ? 'bg-primary/5 border-primary'
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {!notification.isRead && (
                      <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{notification.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(parseISO(notification.createdAt), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Latest Payroll */}
        {latestPayroll && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Latest Payroll</CardTitle>
              <CardDescription>
                {format(parseISO(latestPayroll.createdAt), 'MMMM d, yyyy')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Hours Worked</span>
                  <span className="font-semibold">
                    {parseFloat(String(latestPayroll.totalHours)).toFixed(1)}h
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Gross Pay</span>
                  <span className="font-semibold">
                    ₱{parseFloat(String(latestPayroll.grossPay)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-medium">Net Pay</span>
                  <span className="text-xl font-bold text-green-600">
                    ₱{parseFloat(String(latestPayroll.netPay)).toFixed(2)}
                  </span>
                </div>
                <Badge
                  variant={
                    latestPayroll.status === 'paid' ? 'default' : 'secondary'
                  }
                  className="w-full justify-center"
                >
                  {latestPayroll.status}
                </Badge>
              </div>
              <Button
                className="w-full mt-4"
                variant="outline"
                onClick={() => window.location.href = '/payroll'}
              >
                View Full History
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <MobileBottomNav notificationCount={unreadCount} />
    </div>
  );
}
