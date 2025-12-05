import * as React from "react";
import { addDays, format, isToday, isSameDay, isSameMonth, isBefore, endOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ViewMode = "day" | "week" | "month";

interface CalendarProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDayClick?: (date: Date) => void;
  onAddEvent?: (date: Date) => void;
  viewMode?: ViewMode;
  isManager?: boolean;
  currentUser?: {
    id: string;
    name: string;
    role: string;
  };
}

export type BreakType = 'lunch' | 'coffee' | 'rest' | 'meal' | 'other';

export interface BreakPolicy {
  minShiftLength: number; // in minutes
  breaks: Array<{
    type: BreakType;
    duration: number; // in minutes
    paid: boolean;
    required: boolean;
    minShiftLength: number; // in minutes
    maxShiftLength?: number; // in minutes
  }>;
}

export const DEFAULT_BREAK_POLICIES: BreakPolicy[] = [
  {
    minShiftLength: 0,
    breaks: []
  },
  {
    minShiftLength: 4 * 60, // 4 hours
    breaks: [
      {
        type: 'coffee',
        duration: 15,
        paid: true,
        required: false,
        minShiftLength: 4 * 60
      }
    ]
  },
  {
    minShiftLength: 6 * 60, // 6 hours
    breaks: [
      {
        type: 'lunch',
        duration: 30,
        paid: false,
        required: true,
        minShiftLength: 6 * 60
      },
      {
        type: 'coffee',
        duration: 15,
        paid: true,
        required: false,
        minShiftLength: 4 * 60
      }
    ]
  },
  {
    minShiftLength: 8 * 60, // 8 hours
    breaks: [
      {
        type: 'lunch',
        duration: 30,
        paid: false,
        required: true,
        minShiftLength: 6 * 60
      },
      {
        type: 'meal',
        duration: 30,
        paid: false,
        required: true,
        minShiftLength: 8 * 60
      },
      {
        type: 'coffee',
        duration: 15,
        paid: true,
        required: false,
        minShiftLength: 4 * 60
      }
    ]
  }
];

export interface BreakPolicy {
  minShiftLength: number; // in minutes
  breaks: Array<{
    type: BreakType;
    duration: number; // in minutes
    paid: boolean;
    required: boolean;
    minShiftLength: number; // in minutes
    maxShiftLength?: number; // in minutes
  }>;
}

export interface Break {
  id: string;
  type: BreakType;
  start: Date;
  end: Date;
  paid: boolean;
  required: boolean;
  notes?: string;
  actualStart?: Date;
  actualEnd?: Date;
  status?: 'scheduled' | 'taken' | 'missed' | 'early' | 'late';
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'shift' | 'timeoff' | 'holiday' | 'event';
  status?: 'pending' | 'approved' | 'rejected';
  employeeId?: string;
  employeeName?: string;
  color?: string;
  breaks?: Break[];
  hasUnpaidBreaks?: boolean;
}

export function Calendar({
  events = [],
  onEventClick,
  onDayClick,
  onAddEvent,
  viewMode: initialViewMode = "week",
  isManager = false,
  currentUser,
}: CalendarProps) {
  const [currentDate, setCurrentDate] = React.useState<Date>(new Date());
  const [viewMode, setViewMode] = React.useState<ViewMode>(initialViewMode);
  const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());

  // Navigation functions
  const goToToday = () => setCurrentDate(new Date());
  const goToPrevPeriod = () => {
    if (viewMode === "day") {
      setCurrentDate(addDays(currentDate, -1));
    } else if (viewMode === "week") {
      setCurrentDate(addDays(currentDate, -7));
    } else {
      // month
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() - 1);
      setCurrentDate(newDate);
    }
  };

  const goToNextPeriod = () => {
    if (viewMode === "day") {
      setCurrentDate(addDays(currentDate, 1));
    } else if (viewMode === "week") {
      setCurrentDate(addDays(currentDate, 7));
    } else {
      // month
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() + 1);
      setCurrentDate(newDate);
    }
  };

  // Get days for the current view
  const getDaysInView = () => {
    const days: Date[] = [];
    const startDate = new Date(currentDate);
    
    if (viewMode === "day") {
      days.push(new Date(startDate));
    } else if (viewMode === "week") {
      // Start from Sunday
      const firstDayOfWeek = new Date(startDate);
      firstDayOfWeek.setDate(startDate.getDate() - startDate.getDay());
      
      for (let i = 0; i < 7; i++) {
        days.push(addDays(firstDayOfWeek, i));
      }
    } else {
      // Month view - first day of month
      const firstDay = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const lastDay = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
      
      // Start from Sunday of the week containing the first day of month
      const firstDayOfWeek = new Date(firstDay);
      firstDayOfWeek.setDate(firstDay.getDate() - firstDay.getDay());
      
      // End on Saturday of the week containing the last day of month
      const lastDayOfWeek = new Date(lastDay);
      lastDayOfWeek.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
      
      let currentDay = new Date(firstDayOfWeek);
      while (currentDay <= lastDayOfWeek) {
        days.push(new Date(currentDay));
        currentDay = addDays(currentDay, 1);
      }
    }
    
    return days;
  };

  // Check if an event is an all-day event
  const isAllDayEvent = (start: Date, end: Date) => {
    // If it spans multiple days, it's considered all-day
    if (!isSameDay(start, end)) return true;
    
    // If it's exactly 24 hours, it's considered all-day
    const diff = end.getTime() - start.getTime();
    return diff >= 24 * 60 * 60 * 1000;
  };
  
  // Format time in 12-hour format with AM/PM
  const formatTime = (date: Date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutesStr} ${ampm}`;
  };

  // Get events for a specific day
  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      return (
        (eventStart <= endOfDay(day) && eventEnd >= day) ||
        isSameDay(eventStart, day) ||
        isSameDay(eventEnd, day)
      );
    });
  };

  // Render break within a shift
  const renderBreak = (breakItem: Break, index: number) => {
    const start = breakItem.start instanceof Date ? breakItem.start : new Date(breakItem.start);
    const end = breakItem.end instanceof Date ? breakItem.end : new Date(breakItem.end);
    const duration = (end.getTime() - start.getTime()) / (1000 * 60); // in minutes
    
    return (
      <div 
        key={`break-${index}`}
        className={cn(
          "text-xs p-1 my-0.5 rounded-sm truncate text-left",
          "border-l-4 flex items-center",
          breakItem.paid 
            ? "bg-green-50 text-green-700 border-green-400" 
            : "bg-yellow-50 text-yellow-700 border-yellow-400"
        )}
      >
        <div className="flex-1">
          <div className="flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            <span className="font-medium">
              {formatTime(start)} - {formatTime(end)}
            </span>
            <span className="ml-2 text-xs opacity-70">
              ({Math.floor(duration / 60)}h {duration % 60}m)
            </span>
            {breakItem.paid ? (
              <span className="ml-2 text-[10px] bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full">
                Paid
              </span>
            ) : (
              <span className="ml-2 text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full">
                Unpaid
              </span>
            )}
          </div>
          {breakItem.notes && (
            <div className="text-xs opacity-70 ml-4 mt-0.5 truncate">
              {breakItem.notes}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render event with time and title
  const renderEvent = (event: CalendarEvent) => {
    const start = event.start instanceof Date ? event.start : new Date(event.start);
    const end = event.end instanceof Date ? event.end : new Date(event.end);
    const isAllDay = isAllDayEvent(start, end);
    const isMultiDay = !isSameDay(start, end);
    const hasBreaks = event.breaks && event.breaks.length > 0;
    const isCurrentUserEvent = currentUser && (event.employeeId === currentUser.id || !event.employeeId);

    // Always show breaks for the current user's events, or for managers
    const shouldShowBreaks = hasBreaks && (isManager || isCurrentUserEvent);

    return (
      <div
        key={event.id}
        className={cn(
          "text-xs p-1 rounded cursor-pointer hover:opacity-90 mb-1",
          "flex flex-col",
          {
            "bg-blue-50 text-blue-900 border-l-4 border-blue-500": event.type === 'shift',
            "bg-green-50 text-green-900 border-l-4 border-green-500": event.type === 'timeoff',
            "bg-purple-50 text-purple-900 border-l-4 border-purple-500": event.type === 'holiday',
            "bg-gray-50 text-gray-900 border-l-4 border-gray-500": event.type === 'event',
          }
        )}
        onClick={() => onEventClick?.(event)}
      >
        <div className="font-medium">
          {!isAllDay && (
            <span className="font-normal">
              {formatTime(start)} - {formatTime(end)}
              {hasBreaks && (
                <span className="ml-2 text-xs opacity-70">
                  ({event.breaks?.length} break{event.breaks?.length !== 1 ? 's' : ''})
                </span>
              )}
            </span>
          )}
          <div className="font-medium truncate">{event.title}</div>
        </div>
        {event.employeeName && (
          <div className="text-xs opacity-70 truncate">{event.employeeName}</div>
        )}
        
        {/* Show breaks if any */}
        {shouldShowBreaks && (
          <div className="mt-1 space-y-1">
            {event.breaks?.map((breakItem, index) => renderBreak(breakItem, index))}
          </div>
        )}
      </div>
    );
  };

  const days = getDaysInView();

  return (
    <div className="flex flex-col h-full">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevPeriod}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextPeriod}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold">
            {viewMode === "month"
              ? format(currentDate, "MMMM yyyy")
              : viewMode === "week"
              ? `${format(days[0], "MMM d")} - ${format(days[days.length - 1], "MMM d, yyyy")}`
              : format(currentDate, "MMMM d, yyyy")}
          </h2>
        </div>
        
        <div className="flex space-x-2">
          <Button
            variant={viewMode === "day" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("day")}
          >
            Day
          </Button>
          <Button
            variant={viewMode === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("week")}
          >
            Week
          </Button>
          <Button
            variant={viewMode === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("month")}
          >
            Month
          </Button>
          
          {onAddEvent && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onAddEvent(selectedDate)}
              className="ml-2"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Event
            </Button>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto">
        {viewMode === "month" ? (
          // Month View
          <div className="grid grid-cols-7 gap-px border rounded-lg overflow-hidden bg-muted">
            {/* Day headers */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="bg-background p-2 text-center font-medium">
                {day}
              </div>
            ))}
            
            {/* Calendar cells */}
            {days.map((day, i) => {
              const dayEvents = getEventsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              
              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-24 p-2 bg-background border border-muted",
                    !isCurrentMonth && "text-muted-foreground/50",
                    isToday(day) && "bg-accent/10"
                  )}
                  onClick={() => {
                    setSelectedDate(day);
                    onDayClick?.(day);
                  }}
                >
                  <div className="flex justify-between">
                    <span className={cn("text-sm font-medium", isToday(day) && "font-bold")}>
                      {format(day, "d")}
                    </span>
                    {onAddEvent && isCurrentMonth && (
                      <button
                        className="text-muted-foreground hover:text-foreground h-5 w-5 flex items-center justify-center rounded-full hover:bg-muted"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddEvent(day);
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  
                  <div className="mt-1 space-y-1 max-h-20 overflow-y-auto">
                    {dayEvents.slice(0, 3).map((event) => renderEvent(event))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Week/Day View
          <div className="border rounded-lg overflow-hidden">
            <div className="grid grid-cols-1 divide-y divide-muted">
              {days.map((day, dayIndex) => {
                const dayEvents = getEventsForDay(day);
                const isCurrentDay = isToday(day);
                
                return (
                  <div key={dayIndex} className="min-h-24">
                    <div 
                      className={cn(
                        "p-2 font-medium flex items-center justify-between",
                        isCurrentDay && "bg-accent/10"
                      )}
                      onClick={() => {
                        setSelectedDate(day);
                        onDayClick?.(day);
                      }}
                    >
                      <div className="flex items-center">
                        <span className={cn("w-20", isCurrentDay && "font-bold")}>
                          {format(day, "EEE, MMM d")}
                        </span>
                        {isCurrentDay && (
                          <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                            Today
                          </span>
                        )}
                      </div>
                      {onAddEvent && (
                        <button
                          className="text-muted-foreground hover:text-foreground h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddEvent(day);
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    
                    <div className="p-2 pt-0">
                      {dayEvents.length > 0 ? (
                        <div className="space-y-1">
                          {dayEvents.map((event) => (
                            <div
                              key={event.id}
                              className={cn(
                                "p-2 rounded text-sm cursor-pointer flex justify-between items-center",
                                {
                                  'bg-blue-100 text-blue-800': event.type === 'shift',
                                  'bg-green-100 text-green-800': event.type === 'timeoff' && event.status === 'approved',
                                  'bg-yellow-100 text-yellow-800': event.type === 'timeoff' && event.status === 'pending',
                                  'bg-red-100 text-red-800': event.type === 'timeoff' && event.status === 'rejected',
                                  'bg-purple-100 text-purple-800': event.type === 'holiday',
                                }
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                onEventClick?.(event);
                              }}
                            >
                              <div>
                                <div className="font-medium">{event.title}</div>
                                <div className="text-xs opacity-80">
                                  {format(new Date(event.start), 'h:mm a')} - {format(new Date(event.end), 'h:mm a')}
                                </div>
                              </div>
                              {event.employeeName && (
                                <span className="text-xs bg-white/30 px-2 py-0.5 rounded-full">
                                  {event.employeeName}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground text-center py-2">
                          No events scheduled
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
