import { useState, useEffect } from "react";
import { format, isSameDay, isToday, addDays } from "date-fns";
import { Link } from "wouter";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrentUser, hasManagerAccess } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

interface MiniCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'shift' | 'timeoff' | 'holiday' | 'event';
  employeeName?: string;
}

interface MiniCalendarProps {
  className?: string;
}

export function MiniCalendar({ className }: MiniCalendarProps) {
  const currentUser = getCurrentUser();
  const isManagerRole = hasManagerAccess();
  const [currentDate, setCurrentDate] = useState(new Date());

  // Fetch upcoming shifts for the next 7 days
  const { data: upcomingEvents = [], isLoading } = useQuery({
    queryKey: ['upcoming-shifts', currentUser?.id],
    queryFn: async () => {
      const startDate = new Date();
      const endDate = addDays(startDate, 7);

      const response = await apiRequest('GET', `/api/shifts?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);

      // Convert shifts to mini calendar events
      const events: MiniCalendarEvent[] = (response.shifts || [])
        .filter((shift: any) => {
          // For managers, show all shifts; for employees, show only their shifts
          if (isManagerRole) return true;
          return shift.userId === currentUser?.id;
        })
        .map((shift: any) => ({
          id: shift.id,
          title: `${shift.position} Shift`,
          start: new Date(shift.startTime),
          end: new Date(shift.endTime),
          type: 'shift' as const,
          employeeName: shift.user ? `${shift.user.firstName} ${shift.user.lastName}` : 'Unknown'
        }));

      return events.slice(0, 5); // Show only next 5 events
    },
    enabled: !!currentUser,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // Get next 7 days for the mini calendar
  const next7Days = Array.from({ length: 7 }, (_, i) => addDays(currentDate, i));

  // Get events for each day
  const getEventsForDay = (day: Date) => {
    return upcomingEvents.filter(event =>
      isSameDay(event.start, day) ||
      (event.start <= day && event.end >= day)
    );
  };

  if (isLoading) {
    return (
      <div className={cn("bg-card rounded-lg border p-4", className)}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-3 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-card rounded-lg border", className)}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm flex items-center">
            <CalendarIcon className="h-4 w-4 mr-2" />
            Schedule
          </h3>
          <Link href="/schedule">
            <button className="text-xs text-primary hover:underline">
              View all
            </button>
          </Link>
        </div>
      </div>

      <div className="p-4">
        {/* Mini Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <div key={`day-header-${i}`} className="text-xs text-muted-foreground text-center py-1 font-medium">
              {day}
            </div>
          ))}
          {next7Days.map((day, i) => {
            const dayEvents = getEventsForDay(day);
            const isCurrentDay = isToday(day);

            return (
              <div
                key={i}
                className={cn(
                  "text-xs text-center py-1 min-h-8 flex items-center justify-center rounded-sm relative",
                  isCurrentDay
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-muted"
                )}
              >
                {format(day, 'd')}
                {dayEvents.length > 0 && (
                  <div className={cn(
                    "absolute -top-1 -right-1 w-2 h-2 rounded-full",
                    dayEvents.some(e => e.type === 'shift') ? "bg-blue-500" : "bg-green-500"
                  )} />
                )}
              </div>
            );
          })}
        </div>

        {/* Upcoming Events */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Upcoming
          </h4>

          {upcomingEvents.length > 0 ? (
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {upcomingEvents.map((event) => (
                <Link key={event.id} href="/schedule">
                  <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {event.title}
                      </p>
                      {event.employeeName && isManagerRole && (
                        <p className="text-xs text-muted-foreground truncate">
                          {event.employeeName}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground ml-2">
                      <Clock className="h-3 w-3 mr-1" />
                      {format(event.start, 'MMM d')}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <CalendarIcon className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                No upcoming shifts
              </p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-4 pt-3 border-t border-border">
          <Link href="/schedule">
            <button className="w-full text-sm bg-primary/10 hover:bg-primary/20 text-primary rounded-md py-2 px-3 transition-colors">
              Open Schedule
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
