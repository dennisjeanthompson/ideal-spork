import { Router, Request, Response, NextFunction } from 'express';
import { dbStorage } from '../db-storage';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';

const storage = dbStorage;

export const router = Router();

// Auth middleware
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
};

const requireRole = (roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (!roles.includes(req.session.user.role)) {
    return res.status(403).json({ message: "Insufficient permissions" });
  }
  next();
};

// Helper function to filter only completed/past shifts
function filterCompletedShifts(shifts: any[]): any[] {
  const now = new Date();
  return shifts.filter(shift => {
    const shiftEndTime = shift.actualEndTime || shift.endTime;
    const hasEnded = new Date(shiftEndTime) <= now;
    const isCompleted = shift.status === 'completed';
    return hasEnded || isCompleted;
  });
}

// Helper function to calculate hours from shifts
function calculateHoursFromShifts(shifts: any[]): number {
  let totalHours = 0;
  const completedShifts = filterCompletedShifts(shifts);

  for (const shift of completedShifts) {
    // Determine which times to use
    // If both actual times are present, use them
    // If only one actual time is present, use scheduled times (to avoid mismatched pairs)
    // Otherwise use scheduled times
    let startTime, endTime;

    if (shift.actualStartTime && shift.actualEndTime) {
      // Both actual times available - use them
      startTime = shift.actualStartTime;
      endTime = shift.actualEndTime;
    } else {
      // Use scheduled times (don't mix actual and scheduled)
      startTime = shift.startTime;
      endTime = shift.endTime;
    }

    // Validate that we have valid dates
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    // Skip invalid dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.warn(`Invalid shift dates for shift ${shift.id}:`, { startTime, endTime });
      continue;
    }

    const shiftHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

    // Only add positive hours (sanity check - skip shifts with end before start)
    if (shiftHours > 0 && shiftHours < 24) { // Also sanity check for max 24 hours per shift
      totalHours += shiftHours;
    } else if (shiftHours < 0) {
      console.warn(`Skipping shift ${shift.id} with negative hours:`, {
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        hours: shiftHours,
        actualStartTime: shift.actualStartTime ? new Date(shift.actualStartTime).toISOString() : null,
        actualEndTime: shift.actualEndTime ? new Date(shift.actualEndTime).toISOString() : null,
        scheduledStart: new Date(shift.startTime).toISOString(),
        scheduledEnd: new Date(shift.endTime).toISOString()
      });
    }
  }
  return totalHours;
}

// Get employee's own hours summary
router.get('/api/hours/my-summary', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user!.id;
    const now = new Date();

    // This week
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const weekShifts = await storage.getShiftsByUser(userId, weekStart, weekEnd);
    const weekHours = calculateHoursFromShifts(weekShifts);

    // This month
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const monthShifts = await storage.getShiftsByUser(userId, monthStart, monthEnd);
    const monthHours = calculateHoursFromShifts(monthShifts);

    // Today
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);
    const todayShifts = await storage.getShiftsByUser(userId, dayStart, dayEnd);
    const todayHours = calculateHoursFromShifts(todayShifts);

    res.json({
      thisWeek: Number(weekHours.toFixed(2)),
      thisMonth: Number(monthHours.toFixed(2)),
      today: Number(todayHours.toFixed(2)),
      weekShifts: filterCompletedShifts(weekShifts).length,
      monthShifts: filterCompletedShifts(monthShifts).length,
    });
  } catch (error) {
    console.error('Error fetching employee hours summary:', error);
    res.status(500).json({ message: 'Failed to fetch hours summary' });
  }
});

// Get team hours summary (manager only)
router.get('/api/hours/team-summary', requireAuth, requireRole(['manager', 'admin']), async (req, res) => {
  try {
    const branchId = req.session.user!.branchId;
    const now = new Date();

    // This week
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const weekShifts = await storage.getShiftsByBranch(branchId, weekStart, weekEnd);
    const weekHours = calculateHoursFromShifts(weekShifts);

    // This month
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const monthShifts = await storage.getShiftsByBranch(branchId, monthStart, monthEnd);
    const monthHours = calculateHoursFromShifts(monthShifts);

    // Get employee count
    const employees = await storage.getUsersByBranch(branchId);
    const activeEmployees = employees.filter(e => e.isActive && e.role === 'employee');

    res.json({
      thisWeek: Number(weekHours.toFixed(2)),
      thisMonth: Number(monthHours.toFixed(2)),
      employeeCount: activeEmployees.length,
      weekShifts: filterCompletedShifts(weekShifts).length,
      monthShifts: filterCompletedShifts(monthShifts).length,
    });
  } catch (error) {
    console.error('Error fetching team hours summary:', error);
    res.status(500).json({ message: 'Failed to fetch team hours summary' });
  }
});

// Get individual employee hours (manager only)
router.get('/api/hours/employee/:employeeId', requireAuth, requireRole(['manager', 'admin']), async (req, res) => {
  try {
    const { employeeId } = req.params;
    const branchId = req.session.user!.branchId;

    // Verify employee is in the same branch
    const employee = await storage.getUser(employeeId);
    if (!employee || employee.branchId !== branchId) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const now = new Date();

    // This week
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const weekShifts = await storage.getShiftsByUser(employeeId, weekStart, weekEnd);
    const weekHours = calculateHoursFromShifts(weekShifts);

    // This month
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const monthShifts = await storage.getShiftsByUser(employeeId, monthStart, monthEnd);
    const monthHours = calculateHoursFromShifts(monthShifts);

    res.json({
      employeeId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      thisWeek: Number(weekHours.toFixed(2)),
      thisMonth: Number(monthHours.toFixed(2)),
      weekShifts: filterCompletedShifts(weekShifts).length,
      monthShifts: filterCompletedShifts(monthShifts).length,
    });
  } catch (error) {
    console.error('Error fetching employee hours:', error);
    res.status(500).json({ message: 'Failed to fetch employee hours' });
  }
});

// Get hours report with date range filtering (manager only)
router.get('/api/hours/report', requireAuth, requireRole(['manager', 'admin']), async (req, res) => {
  try {
    const branchId = req.session.user!.branchId;
    const { startDate, endDate, employeeId } = req.query;

    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate as string);
      end = new Date(endDate as string);
    } else {
      // Default to current month
      const now = new Date();
      start = startOfMonth(now);
      end = endOfMonth(now);
    }

    // Get all employees in branch
    const allEmployees = await storage.getUsersByBranch(branchId);
    const employees = allEmployees.filter(e => e.isActive);

    // Filter by specific employee if requested
    const targetEmployees = employeeId 
      ? employees.filter(e => e.id === employeeId)
      : employees;

    // Calculate hours for each employee
    const employeeHours = await Promise.all(targetEmployees.map(async (employee) => {
      const shifts = await storage.getShiftsByUser(employee.id, start, end);
      const completedShifts = filterCompletedShifts(shifts);
      const totalHours = calculateHoursFromShifts(shifts);

      // Calculate hours by day (only for completed shifts)
      const hoursByDay: { [key: string]: number } = {};
      for (const shift of completedShifts) {
        const shiftDate = new Date(shift.startTime).toISOString().split('T')[0];

        // Use same logic as calculateHoursFromShifts - don't mix actual and scheduled times
        let startTime, endTime;
        if (shift.actualStartTime && shift.actualEndTime) {
          startTime = shift.actualStartTime;
          endTime = shift.actualEndTime;
        } else {
          startTime = shift.startTime;
          endTime = shift.endTime;
        }

        const hours = (new Date(endTime).getTime() - new Date(startTime).getTime()) / (1000 * 60 * 60);

        if (hours > 0 && hours < 24) {
          if (!hoursByDay[shiftDate]) {
            hoursByDay[shiftDate] = 0;
          }
          hoursByDay[shiftDate] += hours;
        }
      }

      return {
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        position: employee.position,
        hourlyRate: parseFloat(employee.hourlyRate),
        totalHours: Number(totalHours.toFixed(2)),
        totalShifts: completedShifts.length,
        estimatedPay: Number((totalHours * parseFloat(employee.hourlyRate)).toFixed(2)),
        hoursByDay: Object.entries(hoursByDay).map(([date, hours]) => ({
          date,
          hours: Number(hours.toFixed(2)),
        })).sort((a, b) => a.date.localeCompare(b.date)),
      };
    }));

    // Calculate totals
    const totalHours = employeeHours.reduce((sum, emp) => sum + emp.totalHours, 0);
    const totalPay = employeeHours.reduce((sum, emp) => sum + emp.estimatedPay, 0);
    const totalShifts = employeeHours.reduce((sum, emp) => sum + emp.totalShifts, 0);

    res.json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      employees: employeeHours,
      summary: {
        totalHours: Number(totalHours.toFixed(2)),
        totalPay: Number(totalPay.toFixed(2)),
        totalShifts,
        employeeCount: employeeHours.length,
      },
    });
  } catch (error) {
    console.error('Error generating hours report:', error);
    res.status(500).json({ message: 'Failed to generate hours report' });
  }
});

// Get all employees with their current month hours (for employee table)
router.get('/api/hours/all-employees', requireAuth, requireRole(['manager', 'admin']), async (req, res) => {
  try {
    const branchId = req.session.user!.branchId;
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const allEmployees = await storage.getUsersByBranch(branchId);
    
    const employeesWithHours = await Promise.all(allEmployees.map(async (employee) => {
      const shifts = await storage.getShiftsByUser(employee.id, monthStart, monthEnd);
      const completedShifts = filterCompletedShifts(shifts);
      const totalHours = calculateHoursFromShifts(shifts);

      return {
        ...employee,
        hoursThisMonth: Number(totalHours.toFixed(2)),
        shiftsThisMonth: completedShifts.length,
      };
    }));

    res.json({ employees: employeesWithHours });
  } catch (error) {
    console.error('Error fetching employees with hours:', error);
    res.status(500).json({ message: 'Failed to fetch employee hours' });
  }
});

