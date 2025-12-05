import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { hasManagerAccess, getCurrentUser } from "@/lib/auth";
import { getInitials, formatTime, getCurrentWeekRange } from "@/lib/utils";

export default function WeeklyCalendar() {
  const [currentWeek, setCurrentWeek] = useState(getCurrentWeekRange());
  const isManagerRole = hasManagerAccess();
  const currentUser = getCurrentUser();

  const { data: shifts } = useQuery({
    queryKey: [
      isManagerRole ? "/api/shifts/branch" : "/api/shifts",
      {
        startDate: currentWeek.start.toISOString(),
        endDate: currentWeek.end.toISOString(),
      }
    ],
  });

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newStart = new Date(currentWeek.start);
    const newEnd = new Date(currentWeek.end);
    
    if (direction === 'prev') {
      newStart.setDate(newStart.getDate() - 7);
      newEnd.setDate(newEnd.getDate() - 7);
    } else {
      newStart.setDate(newStart.getDate() + 7);
      newEnd.setDate(newEnd.getDate() + 7);
    }
    
    setCurrentWeek({ start: newStart, end: newEnd });
  };

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const formatWeekRange = () => {
    return `${currentWeek.start.toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${currentWeek.end.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  // Group shifts by user
  const shiftsByUser = shifts?.shifts?.reduce((acc: any, shift: any) => {
    const userId = shift.userId;
    if (!acc[userId]) {
      acc[userId] = {
        user: shift.user || currentUser,
        shifts: []
      };
    }
    acc[userId].shifts.push(shift);
    return acc;
  }, {}) || {};

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <CalendarDays className="h-5 w-5 text-primary mr-2" />
            Weekly Schedule
          </CardTitle>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek('prev')}
              data-testid="button-previous-week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium" data-testid="text-current-week">
              {formatWeekRange()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek('next')}
              data-testid="button-next-week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Employee</th>
                {weekDays.map((day) => (
                  <th key={day} className="text-center py-3 px-4 font-medium text-muted-foreground">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(shiftsByUser).length > 0 ? (
                Object.entries(shiftsByUser).map(([userId, userShifts]: [string, any]) => (
                  <tr key={userId} className="border-b border-border" data-testid={`schedule-row-${userId}`}>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                          <span className="text-primary-foreground text-sm font-medium">
                            {getInitials(userShifts.user.firstName, userShifts.user.lastName)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium" data-testid={`employee-name-${userId}`}>
                            {userShifts.user.firstName} {userShifts.user.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground" data-testid={`employee-position-${userId}`}>
                            {userShifts.user.position}
                          </p>
                        </div>
                      </div>
                    </td>
                    {weekDays.map((_, dayIndex) => {
                      const dayDate = new Date(currentWeek.start);
                      dayDate.setDate(dayDate.getDate() + dayIndex);
                      
                      const dayShift = userShifts.shifts.find((shift: any) => {
                        const shiftDate = new Date(shift.startTime);
                        return shiftDate.toDateString() === dayDate.toDateString();
                      });

                      return (
                        <td key={dayIndex} className="text-center py-4 px-4" data-testid={`schedule-cell-${userId}-${dayIndex}`}>
                          {dayShift ? (
                            <div className="bg-accent text-accent-foreground text-xs px-2 py-1 rounded">
                              {formatTime(dayShift.startTime)}-{formatTime(dayShift.endTime)}
                            </div>
                          ) : (
                            <div className="bg-muted text-muted-foreground text-xs px-2 py-1 rounded">
                              OFF
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    No shifts scheduled for this week
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
