import * as React from "react";
import { format, addMinutes, parseISO, isAfter, isBefore } from "date-fns";
import { X, Clock, User, AlertCircle, CheckCircle2, XCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/utils";
import { CalendarEvent, Break } from "./calendar";
import { Switch } from "@/components/ui/switch";
import { BreakManager } from "./break-manager";

type EventType = 'shift' | 'timeoff' | 'holiday' | 'event';
type EventStatus = 'pending' | 'approved' | 'rejected';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: Omit<CalendarEvent, 'id'>) => void;
  event?: CalendarEvent | null;
  isManager: boolean;
  employees?: Array<{ id: string; name: string }>;
}

export function EventModal({
  isOpen,
  onClose,
  onSave,
  event,
  isManager,
  employees = [],
}: EventModalProps) {
  const [title, setTitle] = React.useState(event?.title || '');
  const [type, setType] = React.useState<EventType>(event?.type || 'shift');
  const [status, setStatus] = React.useState<EventStatus>(event?.status || 'pending');
  const [startDate, setStartDate] = React.useState<Date>(event ? new Date(event.start) : new Date());
  const [endDate, setEndDate] = React.useState<Date>(event ? new Date(event.end) : new Date());
  const [startTime, setStartTime] = React.useState<string>(
    event ? format(new Date(event.start), 'HH:mm') : '09:00'
  );
  const [endTime, setEndTime] = React.useState<string>(
    event ? format(new Date(event.end), 'HH:mm') : '17:00'
  );
  const [description, setDescription] = React.useState(event?.title || '');
  const [employeeId, setEmployeeId] = React.useState(event?.employeeId || '');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [timeError, setTimeError] = React.useState<string | null>(null);
  
  // Break management
  const [breaks, setBreaks] = React.useState<Break[]>(
    event?.breaks?.map(b => ({
      ...b,
      start: new Date(b.start),
      end: new Date(b.end),
      actualStart: b.actualStart ? new Date(b.actualStart) : undefined,
      actualEnd: b.actualEnd ? new Date(b.actualEnd) : undefined
    })) || []
  );

  // Update breaks when event changes
  React.useEffect(() => {
    if (event?.breaks) {
      setBreaks(event.breaks.map(b => ({
        ...b,
        start: new Date(b.start),
        end: new Date(b.end),
        actualStart: b.actualStart ? new Date(b.actualStart) : undefined,
        actualEnd: b.actualEnd ? new Date(b.actualEnd) : undefined
      })));
    }
  }, [event?.breaks]);

  // Handle break changes
  const handleBreaksChange = (updatedBreaks: Break[]) => {
    setBreaks(updatedBreaks);
  };

  // Calculate total break time in minutes
  const totalBreakTime = React.useMemo(() => {
    return breaks.reduce((total, b) => {
      const start = b.start instanceof Date ? b.start : new Date(b.start);
      const end = b.end instanceof Date ? b.end : new Date(b.end);
      return total + (end.getTime() - start.getTime()) / (1000 * 60);
    }, 0);
  }, [breaks]);

  React.useEffect(() => {
    if (event) {
      setTitle(event.title);
      setType(event.type);
      setStatus(event.status || 'pending');
      setStartDate(new Date(event.start));
      setEndDate(new Date(event.end));
      setStartTime(format(new Date(event.start), 'HH:mm'));
      setEndTime(format(new Date(event.end), 'HH:mm'));
      setDescription(event.title);
      setEmployeeId(event.employeeId || '');
    } else {
      // Reset form for new event
      setTitle('');
      setType('shift');
      setStatus('pending');
      const now = new Date();
      setStartDate(now);
      setEndDate(now);
      setStartTime('09:00');
      setEndTime('17:00');
      setDescription('');
      setEmployeeId('');
    }
  }, [event, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate required fields
      if (!title.trim()) {
        console.error('Title is required');
        setIsSubmitting(false);
        return;
      }

      if (isManager && !employeeId) {
        console.error('Employee is required for managers');
        setIsSubmitting(false);
        return;
      }

      const [startHours, startMinutes] = startTime.split(':').map(Number);
      const [endHours, endMinutes] = endTime.split(':').map(Number);

      const eventStart = new Date(startDate);
      eventStart.setHours(startHours, startMinutes, 0, 0);

      const eventEnd = new Date(endDate);
      eventEnd.setHours(endHours, endMinutes, 0, 0);

      // Validate: end time must be after start time (or it's a cross-midnight shift)
      // For same-day shifts, if end time equals start time, it's invalid
      if (startDate.toDateString() === endDate.toDateString() && startTime === endTime) {
        setTimeError('End time cannot be the same as start time');
        setIsSubmitting(false);
        return;
      }

      // If end time is before start time and it's the same day, it's a cross-midnight shift
      // Adjust to next day automatically
      if (eventEnd <= eventStart && startDate.getTime() === endDate.getTime()) {
        eventEnd.setDate(eventEnd.getDate() + 1);
      }

      // Clear any previous time error
      setTimeError(null);

      // Process breaks to ensure they have proper Date objects
      const processedBreaks = breaks.map(breakItem => {
        // Create a new break object with proper types
        const processedBreak: Omit<Break, 'start' | 'end' | 'actualStart' | 'actualEnd'> & {
          start: Date;
          end: Date;
          actualStart?: Date;
          actualEnd?: Date;
        } = {
          ...breakItem,
          start: breakItem.start instanceof Date ? breakItem.start : new Date(breakItem.start),
          end: breakItem.end instanceof Date ? breakItem.end : new Date(breakItem.end),
          actualStart: breakItem.actualStart ?
            (breakItem.actualStart instanceof Date ? breakItem.actualStart : new Date(breakItem.actualStart)) :
            undefined,
          actualEnd: breakItem.actualEnd ?
            (breakItem.actualEnd instanceof Date ? breakItem.actualEnd : new Date(breakItem.actualEnd)) :
            undefined
        };

        return processedBreak as Break;
      });

      // Create the event with properly typed breaks
      const newEvent: Omit<CalendarEvent, 'id'> = {
        title,
        type,
        status: type === 'timeoff' ? status : undefined,
        start: eventStart.toISOString(),
        breaks: processedBreaks.map(b => ({
          ...b,
          start: b.start.toISOString(),
          end: b.end.toISOString(),
          actualStart: b.actualStart?.toISOString(),
          actualEnd: b.actualEnd?.toISOString()
        })) as Break[],
        hasUnpaidBreaks: breaks.some(b => !b.paid),
        end: eventEnd.toISOString(),
        employeeId: isManager && employeeId ? employeeId : undefined,
        employeeName: isManager && employeeId
          ? employees.find(e => e.id === employeeId)?.name
          : 'Me',
      };

      await onSave(newEvent);
      onClose();
    } catch (error) {
      console.error('Error saving event:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const getStatusIcon = () => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">
            {event ? 'Edit Event' : 'Add New Event'}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Time</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  setTimeError(null); // Clear error when user changes time
                }}
                required
              />
            </div>
          </div>

          {/* Time validation error */}
          {timeError && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-2 rounded">
              <AlertCircle className="h-4 w-4" />
              <span>{timeError}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label>Event Type</Label>
            <Select
              value={type}
              onValueChange={(value) => setType(value as EventType)}
              disabled={!!event}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select event type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shift">Shift</SelectItem>
                <SelectItem value="timeoff">Time Off</SelectItem>
                {isManager && <SelectItem value="holiday">Holiday</SelectItem>}
                <SelectItem value="event">Event</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === 'timeoff' && (
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex items-center space-x-2">
                {getStatusIcon()}
                <span className="capitalize">{status}</span>
              </div>
            </div>
          )}

          {isManager && employees.length > 0 && (
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select
                value={employeeId}
                onValueChange={setEmployeeId}
                disabled={!!event}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add event details"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Event'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
