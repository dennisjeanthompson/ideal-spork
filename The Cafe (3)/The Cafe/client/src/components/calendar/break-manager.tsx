import * as React from "react";
import { Clock, Coffee, Utensils, UtensilsCrossed, Plus, X, AlertCircle, CheckCircle2, Bed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { format, addMinutes, isBefore, isAfter, differenceInMinutes } from "date-fns";
import { Break, BreakType, DEFAULT_BREAK_POLICIES, BreakPolicy } from "./calendar";

interface BreakManagerProps {
  shiftStart: Date;
  shiftEnd: Date;
  breaks: Break[];
  onChange: (breaks: Break[]) => void;
  onPolicyChange?: (policy: BreakPolicy) => void;
  isManager?: boolean;
}

export function BreakManager({ 
  shiftStart, 
  shiftEnd, 
  breaks = [], 
  onChange,
  isManager = false 
}: BreakManagerProps) {
  const [selectedBreakType, setSelectedBreakType] = React.useState<BreakType>('lunch');
  const [breakDuration, setBreakDuration] = React.useState(30);
  const [isPaid, setIsPaid] = React.useState(false);
  const [breakTime, setBreakTime] = React.useState('12:00');

  // Calculate shift length in minutes
  const shiftLength = React.useMemo(() => {
    return (shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60);
  }, [shiftStart, shiftEnd]);

  // Get applicable break policies based on shift length
  const applicablePolicies = React.useMemo(() => {
    return DEFAULT_BREAK_POLICIES
      .filter(policy => shiftLength >= policy.minShiftLength)
      .sort((a, b) => b.minShiftLength - a.minShiftLength)[0]?.breaks || [];
  }, [shiftLength]);

  // Suggest breaks based on shift length and policies
  const suggestedBreaks = React.useMemo(() => {
    return applicablePolicies.filter(
      policy => !breaks.some(b => b.type === policy.type)
    );
  }, [applicablePolicies, breaks]);

  // Add a new break
  const addBreak = () => {
    const [hours, minutes] = breakTime.split(':').map(Number);
    const breakStart = new Date(shiftStart);
    breakStart.setHours(hours, minutes, 0, 0);
    
    const breakEnd = new Date(breakStart);
    breakEnd.setMinutes(breakEnd.getMinutes() + breakDuration);

    // Set default notes based on break type
    const breakNotes: Record<BreakType, string> = {
      coffee: 'Coffee break',
      lunch: 'Lunch break',
      meal: 'Meal break',
      rest: 'Rest break',
      other: 'Break'
    };

    const newBreak: Break = {
      id: `break-${Date.now()}`,
      type: selectedBreakType,
      start: breakStart,
      end: breakEnd,
      paid: isPaid,
      required: selectedBreakType === 'lunch' || selectedBreakType === 'meal',
      status: 'scheduled',
      notes: breakNotes[selectedBreakType] || 'Break'
    };

    onChange([...breaks, newBreak]);
  };

  // Remove a break
  const removeBreak = (id: string) => {
    onChange(breaks.filter(b => b.id !== id));
  };

  // Update break time
  const updateBreakTime = (id: string, field: 'start' | 'end', value: Date) => {
    onChange(breaks.map(b => 
      b.id === id ? { ...b, [field]: value } : b
    ));
  };

  // Toggle break paid status
  const togglePaid = (id: string) => {
    onChange(breaks.map(b => 
      b.id === id ? { ...b, paid: !b.paid } : b
    ));
  };

  // Get break icon based on type
  const getBreakIcon = (type: BreakType) => {
    switch (type) {
      case 'coffee':
        return <Coffee className="h-4 w-4 text-amber-600" />;
      case 'lunch':
        return <Utensils className="h-4 w-4 text-red-500" />;
      case 'meal':
        return <UtensilsCrossed className="h-4 w-4 text-purple-600" />;
      case 'rest':
        return <Bed className="h-4 w-4 text-blue-600" />;
      case 'other':
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  // Get break label based on type
  const getBreakLabel = (type: BreakType) => {
    const labels: Record<BreakType, string> = {
      coffee: 'Coffee Break',
      lunch: 'Lunch Break',
      meal: 'Meal Break',
      rest: 'Rest Break',
      other: 'Break'
    };
    return labels[type] || 'Break';
  };

  // Get break color based on type
  const getBreakColor = (type: BreakType, paid: boolean) => {
    const baseColors = {
      coffee: {
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        border: 'border-amber-200',
        paid: 'bg-amber-100 text-amber-800',
        unpaid: 'bg-amber-50 text-amber-700'
      },
      lunch: {
        bg: 'bg-red-50',
        text: 'text-red-800',
        border: 'border-red-200',
        paid: 'bg-red-100 text-red-800',
        unpaid: 'bg-red-50 text-red-700'
      },
      meal: {
        bg: 'bg-purple-50',
        text: 'text-purple-800',
        border: 'border-purple-200',
        paid: 'bg-purple-100 text-purple-800',
        unpaid: 'bg-purple-50 text-purple-700'
      },
      rest: {
        bg: 'bg-blue-50',
        text: 'text-blue-800',
        border: 'border-blue-200',
        paid: 'bg-blue-100 text-blue-800',
        unpaid: 'bg-blue-50 text-blue-700'
      },
      other: {
        bg: 'bg-gray-50',
        text: 'text-gray-800',
        border: 'border-gray-200',
        paid: 'bg-gray-100 text-gray-800',
        unpaid: 'bg-gray-50 text-gray-700'
      }
    };

    const colorSet = baseColors[type] || baseColors.other;
    return {
      container: `${colorSet.bg} ${colorSet.text} ${colorSet.border} border-l-4`,
      badge: paid ? colorSet.paid : colorSet.unpaid,
      icon: colorSet.text
    };
  };

  // Format time for display
  const formatTime = (date: Date) => {
    return format(date, 'h:mm a');
  };

  // Calculate break duration in minutes
  const calculateDuration = (start: Date, end: Date) => {
    return differenceInMinutes(end, start);
  };

  // Check if break is within shift
  const isWithinShift = (breakItem: Break) => {
    return (
      isAfter(breakItem.start, shiftStart) && 
      isBefore(breakItem.end, shiftEnd)
    );
  };

  return (
    <div className="space-y-4">
      {/* Break Policies */}
      {isManager && applicablePolicies.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-sm text-blue-800 mb-2 flex items-center">
            <AlertCircle className="h-4 w-4 mr-2" />
            Recommended Breaks for {Math.floor(shiftLength / 60)}h {shiftLength % 60}m Shift
          </h4>
          <ul className="text-sm text-blue-700 space-y-1">
            {applicablePolicies.map((policy, i) => (
              <li key={i} className="flex items-center">
                <CheckCircle2 className="h-3 w-3 mr-2 text-green-500" />
                {policy.duration}min {policy.type} break
                {policy.paid ? ' (paid)' : ' (unpaid)'}
                {policy.required && ' (required)'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested Breaks */}
      {suggestedBreaks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Suggested Breaks</h4>
          <div className="flex flex-wrap gap-2">
            {suggestedBreaks.map((policy, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setSelectedBreakType(policy.type);
                  setBreakDuration(policy.duration);
                  setIsPaid(!!policy.paid);
                  addBreak();
                }}
              >
                {getBreakIcon(policy.type)}
                <span className="ml-1">
                  Add {policy.duration}min {policy.type}
                </span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Break List */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Scheduled Breaks</h4>
        {breaks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No breaks scheduled</p>
        ) : (
          <div className="space-y-2">
            {breaks.map((breakItem) => (
              <div 
                key={breakItem.id}
                className={`flex items-center justify-between p-3 rounded-lg ${getBreakColor(breakItem.type, breakItem.paid).container} transition-colors`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${getBreakColor(breakItem.type, breakItem.paid).badge} bg-opacity-50`}>
                    <span className={getBreakColor(breakItem.type, breakItem.paid).icon}>
                      {getBreakIcon(breakItem.type)}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium">{getBreakLabel(breakItem.type)}</div>
                    <div className="text-xs opacity-80">
                      {formatTime(breakItem.start)} - {formatTime(breakItem.end)} 
                      <span className="ml-1">
                        ({calculateDuration(breakItem.start, breakItem.end)} min)
                      </span>
                    </div>
                    {breakItem.notes && breakItem.notes !== getBreakLabel(breakItem.type) && (
                      <div className="text-xs opacity-70 mt-1">{breakItem.notes}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {isManager && (
                    <div className="flex items-center space-x-1">
                      <span className="text-xs">{breakItem.paid ? 'Paid' : 'Unpaid'}</span>
                      <Switch
                        checked={breakItem.paid}
                        onCheckedChange={() => togglePaid(breakItem.id)}
                        className="h-4 w-8"
                      />
                    </div>
                  )}
                  {!isWithinShift(breakItem) && (
                    <span className="text-xs text-red-500 flex items-center">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Outside shift
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => removeBreak(breakItem.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Break Form */}
      <div className="border-t pt-4 mt-4">
        <h4 className="text-sm font-medium mb-3">Add Custom Break</h4>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-3">
            <Label htmlFor="break-type" className="text-xs">Type</Label>
            <Select 
              value={selectedBreakType}
              onValueChange={(value: BreakType) => setSelectedBreakType(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select break type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lunch">Lunch</SelectItem>
                <SelectItem value="coffee">Coffee Break</SelectItem>
                <SelectItem value="meal">Meal Break</SelectItem>
                <SelectItem value="rest">Rest Break</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="md:col-span-2">
            <Label htmlFor="break-time" className="text-xs">Start Time</Label>
            <Input 
              id="break-time"
              type="time"
              value={breakTime}
              onChange={(e) => setBreakTime(e.target.value)}
              className="w-full"
            />
          </div>
          
          <div className="md:col-span-2">
            <Label htmlFor="break-duration" className="text-xs">Duration (min)</Label>
            <Input 
              id="break-duration"
              type="number"
              min="5"
              max="120"
              step="5"
              value={breakDuration}
              onChange={(e) => setBreakDuration(Number(e.target.value))}
              className="w-full"
            />
          </div>
          
          <div className="md:col-span-2 flex items-end">
            <div className="flex items-center space-x-2 h-10">
              <Switch 
                id="break-paid" 
                checked={isPaid}
                onCheckedChange={setIsPaid}
              />
              <Label htmlFor="break-paid" className="text-xs">Paid Break</Label>
            </div>
          </div>
          
          <div className="md:col-span-3 flex items-end">
            <Button 
              type="button" 
              variant="outline" 
              className="w-full"
              onClick={addBreak}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Break
            </Button>
          </div>
        </div>
      </div>

      {/* Compliance Summary */}
      {isManager && breaks.length > 0 && (
        <div className="mt-6 pt-4 border-t">
          <h4 className="text-sm font-medium mb-2">Break Compliance</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="text-green-800 text-sm font-medium">Total Break Time</div>
              <div className="text-2xl font-bold text-green-700">
                {breaks.reduce((total, b) => total + calculateDuration(b.start, b.end), 0)} min
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-blue-800 text-sm font-medium">Paid Breaks</div>
              <div className="text-2xl font-bold text-blue-700">
                {breaks.filter(b => b.paid).length} of {breaks.length}
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="text-yellow-800 text-sm font-medium">Compliance Status</div>
              <div className="text-lg font-bold text-yellow-700">
                {breaks.some(b => !isWithinShift(b)) ? 'Needs Review' : 'Compliant'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
