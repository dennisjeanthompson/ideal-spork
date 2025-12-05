/**
 * Philippine Payroll Calculation Utilities
 * Implements DOLE-compliant payroll calculations including:
 * - Holiday pay (Regular, Special Non-Working, Special Working)
 * - Night differential (10PM-6AM = +10%)
 * - Rest day premiums
 * - Cross-midnight shift splitting
 */

import { Holiday, Shift } from "@shared/schema";

// Philippine Holiday Types and their pay rates
export const HOLIDAY_RATES = {
  regular: {
    notWorked: 1.0,    // Paid holiday - 100% of daily wage
    worked: 2.0,       // 200% of daily wage
    restDay: 2.6,      // 260% on rest day
  },
  special_non_working: {
    notWorked: 0,      // No work, no pay
    worked: 1.3,       // 130% of daily wage
    restDay: 1.5,      // 150% on rest day
  },
  special_working: {
    notWorked: 1.0,    // Normal day - 100%
    worked: 1.0,       // Normal rate
    restDay: 1.3,      // 130% on rest day
  },
  normal: {
    notWorked: 0,      // No pay for not working
    worked: 1.0,       // 100% normal rate
    restDay: 1.3,      // 130% on rest day
  }
};

// Night Differential: 10% premium for hours between 10PM-6AM
export const NIGHT_DIFF_START = 22; // 10 PM
export const NIGHT_DIFF_END = 6;    // 6 AM
export const NIGHT_DIFF_RATE = 0.10; // 10% additional

export interface ShiftHourBreakdown {
  regularHours: number;
  nightDiffHours: number;
  holidayType: 'regular' | 'special_non_working' | 'special_working' | 'normal';
  isRestDay: boolean;
  date: Date;
}

export interface PayCalculation {
  basicPay: number;
  holidayPay: number;
  nightDiffPay: number;
  restDayPay: number;
  totalGrossPay: number;
  breakdown: ShiftHourBreakdown[];
}

/**
 * Check if a given hour falls within night differential window (10PM-6AM)
 */
export function isNightDiffHour(hour: number): boolean {
  return hour >= NIGHT_DIFF_START || hour < NIGHT_DIFF_END;
}

/**
 * Calculate how many hours in a shift fall within night differential window
 */
export function calculateNightDiffHours(startTime: Date, endTime: Date): number {
  let nightHours = 0;
  const current = new Date(startTime);

  while (current < endTime) {
    const hour = current.getHours();
    if (isNightDiffHour(hour)) {
      nightHours += 1;
    }
    current.setHours(current.getHours() + 1);
  }

  // Handle partial hours at the end
  const remainingMinutes = (endTime.getTime() - current.getTime() + 3600000) % 3600000;
  if (remainingMinutes > 0 && isNightDiffHour(endTime.getHours())) {
    nightHours += remainingMinutes / 3600000;
  }

  return Math.max(0, nightHours);
}

/**
 * Get holiday type for a specific date
 */
export function getHolidayType(date: Date, holidays: Holiday[]): 'regular' | 'special_non_working' | 'special_working' | 'normal' {
  const dateStr = date.toISOString().split('T')[0];

  for (const holiday of holidays) {
    const holidayDate = new Date(holiday.date).toISOString().split('T')[0];
    if (dateStr === holidayDate) {
      return holiday.type as 'regular' | 'special_non_working' | 'special_working';
    }
  }

  return 'normal';
}

/**
 * Split a cross-midnight shift into separate date segments
 * Required for proper holiday pay calculation when shift crosses midnight
 */
export function splitCrossMidnightShift(startTime: Date, endTime: Date): { start: Date; end: Date; date: Date }[] {
  const segments: { start: Date; end: Date; date: Date }[] = [];
  const current = new Date(startTime);

  while (current < endTime) {
    const segmentStart = new Date(current);
    const nextMidnight = new Date(current);
    nextMidnight.setDate(nextMidnight.getDate() + 1);
    nextMidnight.setHours(0, 0, 0, 0);

    const segmentEnd = nextMidnight < endTime ? nextMidnight : new Date(endTime);

    segments.push({
      start: segmentStart,
      end: segmentEnd,
      date: new Date(segmentStart.getFullYear(), segmentStart.getMonth(), segmentStart.getDate())
    });

    current.setTime(nextMidnight.getTime());
  }

  return segments;
}

/**
 * Calculate hours for a single segment
 */
export function calculateSegmentHours(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

/**
 * Check if a date is the employee's rest day
 * Default rest day is Sunday (0), can be configured per employee
 */
export function isRestDay(date: Date, restDay: number = 0): boolean {
  return date.getDay() === restDay;
}

/**
 * Calculate daily hours breakdown
 * All hours are regular hours (no overtime tracking)
 */
export function calculateDailyHoursBreakdown(
  shifts: { startTime: Date | string; endTime: Date | string; actualStartTime?: Date | string | null; actualEndTime?: Date | string | null }[],
  holidays: Holiday[],
  restDay: number = 0
): Map<string, ShiftHourBreakdown> {
  const dailyBreakdown = new Map<string, ShiftHourBreakdown>();

  for (const shift of shifts) {
    const startTime = new Date(shift.actualStartTime || shift.startTime);
    const endTime = new Date(shift.actualEndTime || shift.endTime);

    // Split cross-midnight shifts
    const segments = splitCrossMidnightShift(startTime, endTime);

    for (const segment of segments) {
      const dateKey = segment.date.toISOString().split('T')[0];
      const segmentHours = calculateSegmentHours(segment.start, segment.end);
      const nightDiffHours = calculateNightDiffHours(segment.start, segment.end);
      const holidayType = getHolidayType(segment.date, holidays);
      const isRest = isRestDay(segment.date, restDay);

      if (!dailyBreakdown.has(dateKey)) {
        dailyBreakdown.set(dateKey, {
          regularHours: 0,
          nightDiffHours: 0,
          holidayType,
          isRestDay: isRest,
          date: segment.date
        });
      }

      const existing = dailyBreakdown.get(dateKey)!;

      // All hours are regular hours (no overtime)
      existing.regularHours += segmentHours;
      existing.nightDiffHours += nightDiffHours;
    }
  }

  return dailyBreakdown;
}

/**
 * Calculate pay for all shifts in a period
 */
export function calculatePeriodPay(
  shifts: { startTime: Date | string; endTime: Date | string; actualStartTime?: Date | string | null; actualEndTime?: Date | string | null }[],
  hourlyRate: number,
  holidays: Holiday[],
  restDay: number = 0
): PayCalculation {
  const dailyBreakdown = calculateDailyHoursBreakdown(shifts, holidays, restDay);

  let basicPay = 0;
  let holidayPay = 0;
  let nightDiffPay = 0;
  let restDayPay = 0;
  const breakdown: ShiftHourBreakdown[] = [];

  for (const [, dayData] of dailyBreakdown) {
    breakdown.push(dayData);
    const rates = HOLIDAY_RATES[dayData.holidayType];

    let regularRate = rates.worked;

    // Apply rest day premium if applicable
    if (dayData.isRestDay) {
      regularRate = rates.restDay;
    }

    // Calculate base pay for regular hours
    const regularPay = dayData.regularHours * hourlyRate * regularRate;

    // Night differential is calculated on top of the applicable rate
    const nightDiffBase = (dayData.nightDiffHours * hourlyRate * regularRate);
    const nightDiff = nightDiffBase * NIGHT_DIFF_RATE;

    // Categorize the pay
    if (dayData.holidayType !== 'normal') {
      // Holiday worked - extra pay goes to holidayPay
      holidayPay += (regularPay - (dayData.regularHours * hourlyRate));
      basicPay += dayData.regularHours * hourlyRate;
    } else if (dayData.isRestDay) {
      // Rest day - extra pay goes to restDayPay
      restDayPay += (regularPay - (dayData.regularHours * hourlyRate));
      basicPay += dayData.regularHours * hourlyRate;
    } else {
      basicPay += regularPay;
    }

    nightDiffPay += nightDiff;
  }

  return {
    basicPay: Math.round(basicPay * 100) / 100,
    holidayPay: Math.round(holidayPay * 100) / 100,
    nightDiffPay: Math.round(nightDiffPay * 100) / 100,
    restDayPay: Math.round(restDayPay * 100) / 100,
    totalGrossPay: Math.round((basicPay + holidayPay + nightDiffPay + restDayPay) * 100) / 100,
    breakdown
  };
}

/**
 * Validate shift times - end time must be after start time
 * Returns error message if invalid, null if valid
 */
export function validateShiftTimes(startTime: Date | string, endTime: Date | string): string | null {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime())) {
    return "Invalid start time";
  }

  if (isNaN(end.getTime())) {
    return "Invalid end time";
  }

  if (end <= start) {
    return "End time must be after start time";
  }

  // Maximum shift duration of 24 hours
  const hoursWorked = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  if (hoursWorked > 24) {
    return "Shift cannot exceed 24 hours";
  }

  return null;
}

/**
 * Get 2025 Philippine holidays
 */
export function get2025PhilippineHolidays(): { name: string; date: Date; type: 'regular' | 'special_non_working' | 'special_working'; year: number }[] {
  return [
    // Regular Holidays (200% if worked)
    { name: "New Year's Day", date: new Date(2025, 0, 1), type: 'regular', year: 2025 },
    { name: "Eid ul-Fitr", date: new Date(2025, 3, 1), type: 'regular', year: 2025 },
    { name: "Araw ng Kagitingan", date: new Date(2025, 3, 9), type: 'regular', year: 2025 },
    { name: "Maundy Thursday", date: new Date(2025, 3, 17), type: 'regular', year: 2025 },
    { name: "Good Friday", date: new Date(2025, 3, 18), type: 'regular', year: 2025 },
    { name: "Labor Day", date: new Date(2025, 4, 1), type: 'regular', year: 2025 },
    { name: "Independence Day", date: new Date(2025, 5, 12), type: 'regular', year: 2025 },
    { name: "National Heroes Day", date: new Date(2025, 7, 25), type: 'regular', year: 2025 },
    { name: "Bonifacio Day", date: new Date(2025, 10, 30), type: 'regular', year: 2025 },
    { name: "Christmas Day", date: new Date(2025, 11, 25), type: 'regular', year: 2025 },
    { name: "Rizal Day", date: new Date(2025, 11, 30), type: 'regular', year: 2025 },

    // Special Non-Working Days (130% if worked, no pay if not)
    { name: "Chinese New Year", date: new Date(2025, 0, 29), type: 'special_non_working', year: 2025 },
    { name: "Black Saturday", date: new Date(2025, 3, 19), type: 'special_non_working', year: 2025 },
    { name: "Ninoy Aquino Day", date: new Date(2025, 7, 21), type: 'special_non_working', year: 2025 },
    { name: "All Saints' Day Eve", date: new Date(2025, 9, 31), type: 'special_non_working', year: 2025 },
    { name: "All Saints' Day", date: new Date(2025, 10, 1), type: 'special_non_working', year: 2025 },
    { name: "Feast of the Immaculate Conception", date: new Date(2025, 11, 8), type: 'special_non_working', year: 2025 },
    { name: "Christmas Eve", date: new Date(2025, 11, 24), type: 'special_non_working', year: 2025 },
    { name: "Last Day of the Year", date: new Date(2025, 11, 31), type: 'special_non_working', year: 2025 },

    // Eid ul-Adha (estimated)
    { name: "Eid ul-Adha", date: new Date(2025, 5, 7), type: 'regular', year: 2025 },
  ];
}