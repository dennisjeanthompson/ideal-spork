import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

type TimeOffType = 'vacation' | 'sick' | 'personal' | 'other';
type TimeOffStatus = 'pending' | 'approved' | 'rejected';

interface TimeOffRequestProps {
  onRequestSubmit: (request: {
    startDate: Date;
    endDate: Date;
    type: TimeOffType;
    reason: string;
  }) => Promise<void>;
  timeOffBalance?: {
    vacation: number;
    sick: number;
    personal: number;
  };
}

export function TimeOffRequest({ onRequestSubmit, timeOffBalance }: TimeOffRequestProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [type, setType] = React.useState<TimeOffType>('vacation');
  const [reason, setReason] = React.useState('');
  const [startDate, setStartDate] = React.useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = React.useState<Date | undefined>(new Date());
  const [isAllDay, setIsAllDay] = React.useState(true);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState('');

  // Calculate minimum date (3 days from today)
  const minDate = React.useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    if (endDate < startDate) {
      setError('End date cannot be before start date');
      return;
    }

    // Validate 3-day advance notice
    const startDateCopy = new Date(startDate);
    startDateCopy.setHours(0, 0, 0, 0);
    if (startDateCopy < minDate) {
      setError('Time off requests must be submitted at least 3 days in advance');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      
      await onRequestSubmit({
        startDate,
        endDate,
        type,
        reason,
      });
      
      setSuccess(true);
      // Reset form
      setType('vacation');
      setReason('');
      setStartDate(new Date());
      setEndDate(new Date());
      
      // Reset success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError('Failed to submit time off request. Please try again.');
      console.error('Error submitting time off request:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRemainingDays = () => {
    if (!timeOffBalance) return null;
    
    return (
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="border rounded-lg p-3 text-center">
          <div className="text-sm text-muted-foreground">Vacation</div>
          <div className="text-xl font-bold">{timeOffBalance.vacation} days</div>
        </div>
        <div className="border rounded-lg p-3 text-center">
          <div className="text-sm text-muted-foreground">Sick</div>
          <div className="text-xl font-bold">{timeOffBalance.sick} days</div>
        </div>
        <div className="border rounded-lg p-3 text-center">
          <div className="text-sm text-muted-foreground">Personal</div>
          <div className="text-xl font-bold">{timeOffBalance.personal} days</div>
        </div>
      </div>
    );
  };

  const getStatusIcon = (status: TimeOffStatus) => {
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
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Request Time Off</CardTitle>
      </CardHeader>
      <CardContent>
        {timeOffBalance && getRemainingDays()}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Type</label>
            <Select value={type} onValueChange={(value) => setType(value as TimeOffType)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vacation">Vacation</SelectItem>
                <SelectItem value="sick">Sick Leave</SelectItem>
                <SelectItem value="personal">Personal Day</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Start Date</label>
            <p className="text-xs text-muted-foreground">Must be at least 3 days from today</p>
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
                  onSelect={(date) => {
                    setStartDate(date);
                    if (!endDate || (date && date > endDate)) {
                      setEndDate(date);
                    }
                  }}
                  initialFocus
                  disabled={(date) => date < minDate}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">End Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                  disabled={!startDate}
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
                  disabled={(date) => startDate ? date < startDate : date < minDate}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Reason</label>
            <textarea
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for time off"
              required
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm flex items-center">
              <AlertCircle className="h-4 w-4 mr-2" />
              {error}
            </div>
          )}

          {success && (
            <div className="text-green-500 text-sm flex items-center">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Time off request submitted successfully!
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </form>

        <div className="mt-6">
          <h3 className="font-medium mb-3">Time Off Policy</h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start">
              <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
              <span>Submit requests at least 2 weeks in advance when possible</span>
            </li>
            <li className="flex items-start">
              <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
              <span>Check with your manager for blackout dates</span>
            </li>
            <li className="flex items-start">
              <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
              <span>You'll be notified when your request is approved or denied</span>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
