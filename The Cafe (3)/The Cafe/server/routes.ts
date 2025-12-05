import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session, { Session } from "express-session";
import cors from "cors";
import { dbStorage } from "./db-storage";
import { insertShiftSchema, insertShiftTradeSchema, insertTimeOffRequestSchema, insertShiftDropRequestSchema } from '@shared/schema';
import { z } from "zod";
import { blockchainService } from "./services/blockchain";
import { registerBranchesRoutes } from "./routes/branches";
import { router as employeeRoutes } from "./routes/employees";
import { router as hoursRoutes } from "./routes/hours";
import bcrypt from "bcrypt";
import { format } from "date-fns";
import crypto from "crypto";
import { validateShiftTimes, calculatePeriodPay } from "./payroll-utils";

// Use database storage instead of in-memory storage
const storage = dbStorage;

// Type for authenticated user
interface AuthUser {
  id: string;
  username: string;
  role: string;
  branchId: string;
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Extend Express Session type
declare module 'express-session' {
  interface SessionData {
    user?: AuthUser;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Type for authenticated requests
  interface AuthenticatedRequest extends Request {
    session: Session & {
      user: AuthUser;
    };
  }

  // Type guard for authenticated requests
  const isAuthenticated = (req: Request): req is AuthenticatedRequest => {
    return !!(req.session && req.session.user);
  };

  // Get authenticated user with type safety
  const getAuthenticatedUser = (req: Request): AuthUser | null => {
    return isAuthenticated(req) ? req.session.user : null;
  };

  // Authentication middleware
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    // Attach user to request object for easier access
    req.user = user;
    next();
  };

  // Role-based access control middleware
  const requireRole = (roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    if (!roles.includes(user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    
    // Attach user to request object for easier access
    req.user = user;
    next();
  };

  // Enable CORS
  app.use(cors({
    // Allow the requesting origin in development; adjust for production as needed
    origin: (origin, callback) => {
      // Allow requests with no origin like mobile apps or curl requests
      if (!origin) return callback(null, true);

      // In dev, allow localhost origins
      if (origin.startsWith('http://localhost:')) return callback(null, true);

      // Allow local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
      const localNetworkPattern = /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}):\d+$/;
      if (localNetworkPattern.test(origin)) return callback(null, true);

      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  }));

  // Session configuration
  app.use(session({
    secret: process.env.SESSION_SECRET || 'default-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Setup check endpoint (no auth required)
  app.get("/api/setup/status", async (req: Request, res: Response) => {
    try {
      const isComplete = await storage.isSetupComplete();
      res.json({ isSetupComplete: isComplete });
    } catch (error) {
      console.error('Setup status check error:', error);
      res.status(500).json({ message: 'Failed to check setup status' });
    }
  });

  // Setup endpoint (no auth required, only works if setup not complete)
  app.post("/api/setup", async (req: Request, res: Response) => {
    try {
      // Check if setup is already complete
      const isComplete = await storage.isSetupComplete();
      if (isComplete) {
        return res.status(400).json({ message: 'Setup already completed' });
      }

      const { branch, manager } = z.object({
        branch: z.object({
          name: z.string().min(1),
          address: z.string().min(1),
          phone: z.string().optional(),
        }),
        manager: z.object({
          username: z.string().min(1),
          password: z.string().min(6),
          firstName: z.string().min(1),
          lastName: z.string().min(1),
          email: z.string().email(),
          hourlyRate: z.string(),
        }),
      }).parse(req.body);

      // Create branch
      const createdBranch = await storage.createBranch({
        name: branch.name,
        address: branch.address,
        phone: branch.phone || null,
        isActive: true,
      });

      // Create manager user with blockchain verification
      const managerData = `${manager.username}-${manager.firstName}-${manager.lastName}-${manager.email}`;
      const blockchainHash = crypto.createHash('sha256').update(managerData).digest('hex');

      const createdManager = await storage.createUser({
        username: manager.username,
        password: manager.password,
        firstName: manager.firstName,
        lastName: manager.lastName,
        email: manager.email,
        role: 'manager',
        position: 'Store Manager',
        hourlyRate: manager.hourlyRate,
        branchId: createdBranch.id,
        isActive: true,
        blockchainVerified: true,
        blockchainHash: blockchainHash,
        verifiedAt: new Date(),
      });

      // Mark setup as complete
      await storage.markSetupComplete();

      console.log('✅ Setup completed successfully');
      console.log(`   Branch: ${createdBranch.name}`);
      console.log(`   Manager: ${createdManager.firstName} ${createdManager.lastName} (${createdManager.username})`);

      res.json({
        message: 'Setup completed successfully',
        branch: createdBranch,
        manager: {
          id: createdManager.id,
          username: createdManager.username,
          firstName: createdManager.firstName,
          lastName: createdManager.lastName,
          email: createdManager.email,
        }
      });
    } catch (error) {
      console.error('Setup error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid setup data', errors: error.errors });
      }
      res.status(500).json({ message: 'Setup failed' });
    }
  });

  // Simple health check endpoint
  app.get("/api/health", (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      port: process.env.PORT || '5000',
      timestamp: new Date().toISOString()
    });
  });

  // Debug endpoint to check user password hash (REMOVE IN PRODUCTION)
  app.get("/api/debug/user/:username", async (req: Request, res: Response) => {
    try {
      const { username } = req.params;
      const user = await storage.getUserByUsername(username);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        username: user.username,
        passwordHashPrefix: user.password.substring(0, 20),
        passwordHashLength: user.password.length,
        isBcryptHash: user.password.startsWith('$2b$') || user.password.startsWith('$2a$'),
        createdAt: user.createdAt,
      });
    } catch (error) {
      console.error('Debug error:', error);
      res.status(500).json({ message: 'Error' });
    }
  });

  // Debug endpoint to test password comparison (REMOVE IN PRODUCTION)
  app.post("/api/debug/test-password", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isValid = await bcrypt.compare(password, user.password);

      res.json({
        username: user.username,
        passwordProvided: password,
        passwordProvidedLength: password.length,
        storedHashPrefix: user.password.substring(0, 20),
        storedHashLength: user.password.length,
        isBcryptHash: user.password.startsWith('$2b$') || user.password.startsWith('$2a$'),
        isPasswordValid: isValid,
      });
    } catch (error) {
      console.error('Debug error:', error);
      res.status(500).json({ message: 'Error' });
    }
  });

  // Auth routes
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      }).parse(req.body);

      console.log('Login attempt for username:', username);
      console.log('Password provided (length):', password.length);

      const user = await storage.getUserByUsername(username);
      if (!user) {
        console.log('User not found:', username);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      console.log('User found:', user.username);
      console.log('Stored password hash:', user.password.substring(0, 20) + '...');
      console.log('Is bcrypt hash:', user.password.startsWith('$2b$') || user.password.startsWith('$2a$'));

      // Compare password with bcrypt
      const isPasswordValid = await bcrypt.compare(password, user.password);
      console.log('Password valid:', isPasswordValid);

      if (!isPasswordValid) {
        console.log('Invalid password for user:', username);
        console.log('Trying to compare:', password, 'with hash:', user.password.substring(0, 30));
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Set session user
      const authUser: AuthUser = {
        id: user.id,
        username: user.username,
        role: user.role,
        branchId: user.branchId
      };

      req.session.user = authUser;

      // Save the session
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ message: 'Failed to save session' });
        }

        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;
        res.json({
          user: userWithoutPassword
        });
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(400).json({
        message: error instanceof Error ? error.message : "Invalid request data"
      });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ message: 'Failed to log out' });
      }
      
      // Clear the session cookie
      res.clearCookie('connect.sid');
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      res.json({ 
        user: userWithoutPassword 
      });
    } catch (error) {
      console.error('Error in /api/auth/me:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  });

  // Shifts routes
  app.get("/api/shifts", requireAuth, async (req, res) => {
    const { startDate, endDate, userId: queryUserId } = req.query;
    const currentUser = req.user!;

    // If querying for another user, require manager role
    const targetUserId = queryUserId as string || currentUser.id;
    if (targetUserId !== currentUser.id && currentUser.role !== "manager") {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    console.log('Fetching shifts for user:', targetUserId, 'startDate:', startDate, 'endDate:', endDate);

    const shifts = await storage.getShiftsByUser(
      targetUserId,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    console.log('Found shifts:', shifts.length);

    res.json({ shifts });
  });

  app.get("/api/shifts/branch", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    const { startDate, endDate } = req.query;
    const branchId = req.user!.branchId;

    const shifts = await storage.getShiftsByBranch(
      branchId,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    // Get user details for each shift and filter out inactive employees
    const shiftsWithUsers = await Promise.all(
      shifts.map(async (shift) => {
        const user = await storage.getUser(shift.userId);
        return { ...shift, user };
      })
    );

    // Filter out shifts for inactive employees
    const activeShifts = shiftsWithUsers.filter(shift => shift.user?.isActive);

    res.json({ shifts: activeShifts });
  });

  app.post("/api/shifts", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    try {
      console.log('Creating shift with data:', req.body);
      const shiftData = insertShiftSchema.parse(req.body);

      // Validate shift times - end time must be after start time
      const timeError = validateShiftTimes(shiftData.startTime, shiftData.endTime);
      if (timeError) {
        return res.status(400).json({ message: timeError });
      }

      const shift = await storage.createShift(shiftData);
      res.json({ shift });
    } catch (error: any) {
      console.error('Shift creation error:', error);
      if (error.errors) {
        // Zod validation error
        res.status(400).json({
          message: "Invalid shift data",
          errors: error.errors
        });
      } else {
        res.status(400).json({
          message: error.message || "Invalid shift data"
        });
      }
    }
  });

  app.put("/api/shifts/:id", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = insertShiftSchema.partial().parse(req.body);

      // If both times are provided, validate them
      if (updateData.startTime && updateData.endTime) {
        const timeError = validateShiftTimes(updateData.startTime, updateData.endTime);
        if (timeError) {
          return res.status(400).json({ message: timeError });
        }
      }

      const shift = await storage.updateShift(id, updateData);

      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }

      res.json({ shift });
    } catch (error) {
      res.status(400).json({ message: "Invalid shift data" });
    }
  });

  // Manager clock in for employee
  app.post("/api/shifts/:id/clock-in", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    try {
      const { id } = req.params;
      const shift = await storage.getShift(id);

      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }

      // Update shift with actual start time
      const updatedShift = await storage.updateShift(id, {
        actualStartTime: new Date(),
        status: 'in-progress'
      });

      // Get employee details
      const employee = await storage.getUser(shift.userId);

      // Create notification for employee
      await storage.createNotification({
        userId: shift.userId,
        type: 'schedule',
        title: 'Clocked In',
        message: `You have been clocked in for your shift at ${format(new Date(), "h:mm a")}`,
        data: JSON.stringify({
          shiftId: id,
          action: 'clock-in'
        })
      } as any);

      res.json({
        message: "Employee clocked in successfully",
        shift: updatedShift
      });
    } catch (error: any) {
      console.error('Clock in error:', error);
      res.status(500).json({
        message: error.message || "Failed to clock in employee"
      });
    }
  });

  // Manager clock out for employee
  app.post("/api/shifts/:id/clock-out", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    try {
      const { id } = req.params;
      const shift = await storage.getShift(id);

      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }

      // Update shift with actual end time and mark as completed
      const updatedShift = await storage.updateShift(id, {
        actualEndTime: new Date(),
        status: 'completed'
      });

      // Create notification for employee
      await storage.createNotification({
        userId: shift.userId,
        type: 'schedule',
        title: 'Clocked Out',
        message: `You have been clocked out from your shift at ${format(new Date(), "h:mm a")}`,
        data: JSON.stringify({
          shiftId: id,
          action: 'clock-out'
        })
      } as any);

      res.json({
        message: "Employee clocked out successfully",
        shift: updatedShift
      });
    } catch (error: any) {
      console.error('Clock out error:', error);
      res.status(500).json({
        message: error.message || "Failed to clock out employee"
      });
    }
  });
  // Employee statistics route
  app.get("/api/employees/stats", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    const branchId = req.user!.branchId;
    const users = await storage.getUsersByBranch(branchId);

    // Calculate statistics
    const totalEmployees = users.length;
    const activeEmployees = users.filter(user => user.isActive).length;

    // Calculate total hours this month from shifts
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    let totalHoursThisMonth = 0;
    for (const user of users) {
      const shifts = await storage.getShiftsByUser(user.id, monthStart, monthEnd);
      for (const shift of shifts) {
        const hours = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60);
        totalHoursThisMonth += hours;
      }
    }

    // Calculate total payroll this month from payroll entries
    let totalPayrollThisMonth = 0;
    for (const user of users) {
      const entries = await storage.getPayrollEntriesByUser(user.id);
      for (const entry of entries) {
        const entryDate = new Date(entry.createdAt);
        if (entryDate >= monthStart && entryDate <= monthEnd) {
          totalPayrollThisMonth += parseFloat(entry.grossPay);
        }
      }
    }

    // Calculate average performance (simplified - based on completed shifts vs scheduled)
    let totalPerformanceScore = 0;
    let employeesWithShifts = 0;
    for (const user of users) {
      const shifts = await storage.getShiftsByUser(user.id, monthStart, monthEnd);
      if (shifts.length > 0) {
        const completedShifts = shifts.filter(s => s.status === 'completed').length;
        const performanceScore = (completedShifts / shifts.length) * 5; // Scale to 0-5
        totalPerformanceScore += performanceScore;
        employeesWithShifts++;
      }
    }
    const averagePerformance = employeesWithShifts > 0
      ? Number((totalPerformanceScore / employeesWithShifts).toFixed(1))
      : 0;

    res.json({
      totalEmployees,
      activeEmployees,
      totalHoursThisMonth: Number(totalHoursThisMonth.toFixed(2)),
      totalPayrollThisMonth: Number(totalPayrollThisMonth.toFixed(2)),
      averagePerformance,
    });
  });

  // Employee performance data
  app.get("/api/employees/performance", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    const branchId = req.user!.branchId;
    const users = await storage.getUsersByBranch(branchId);

    // Calculate real performance data from shifts
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const performanceData = await Promise.all(users.map(async (user) => {
      const shifts = await storage.getShiftsByUser(user.id, monthStart, monthEnd);

      // Calculate hours this month
      let hoursThisMonth = 0;
      for (const shift of shifts) {
        const hours = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60);
        hoursThisMonth += hours;
      }

      // Calculate rating based on completed shifts vs scheduled
      const completedShifts = shifts.filter(s => s.status === 'completed').length;
      const missedShifts = shifts.filter(s => s.status === 'missed').length;
      const totalShifts = shifts.length;

      let rating = 5.0;
      if (totalShifts > 0) {
        // Deduct points for missed shifts
        rating = 5.0 - (missedShifts / totalShifts) * 2;
        // Bonus for perfect attendance
        if (completedShifts === totalShifts && totalShifts > 0) {
          rating = 5.0;
        }
        rating = Math.max(0, Math.min(5, rating)); // Clamp between 0 and 5
      }

      return {
        employeeId: user.id,
        employeeName: `${user.firstName} ${user.lastName}`,
        rating: Number(rating.toFixed(1)),
        hoursThisMonth: Number(hoursThisMonth.toFixed(2)),
        shiftsThisMonth: totalShifts,
      };
    }));

    res.json(performanceData);
  });

  // Bulk activate employees
  app.post("/api/employees/bulk-activate", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    const { employeeIds } = req.body;

    if (!Array.isArray(employeeIds)) {
      return res.status(400).json({ message: "employeeIds must be an array" });
    }

    const updatedEmployees = [];
    for (const id of employeeIds) {
      const employee = await storage.updateUser(id, { isActive: true });
      if (employee) {
        updatedEmployees.push(employee);
      }
    }

    res.json({
      message: `${updatedEmployees.length} employees activated successfully`,
      updatedCount: updatedEmployees.length
    });
  });

  // Bulk deactivate employees
  app.post("/api/employees/bulk-deactivate", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    const { employeeIds } = req.body;

    if (!Array.isArray(employeeIds)) {
      return res.status(400).json({ message: "employeeIds must be an array" });
    }

    const updatedEmployees = [];
    for (const id of employeeIds) {
      const employee = await storage.updateUser(id, { isActive: false });
      if (employee) {
        updatedEmployees.push(employee);
      }
    }

    res.json({
      message: `${updatedEmployees.length} employees deactivated successfully`,
      updatedCount: updatedEmployees.length
    });
  });

  // Register employee routes (after specific /api/employees/* routes to avoid conflicts)
  app.use(employeeRoutes);

  // Register hours tracking routes
  app.use(hoursRoutes);

  // Payroll routes
  app.get("/api/payroll", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    const entries = await storage.getPayrollEntriesByUser(userId);
    res.json({ entries });
  });

  // Get all payroll periods (Manager only)
  app.get("/api/payroll/periods", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    const branchId = req.user!.branchId;
    const periods = await storage.getPayrollPeriodsByBranch(branchId);
    res.json({ periods });
  });

  // Get current payroll period
  app.get("/api/payroll/periods/current", requireAuth, async (req, res) => {
    const branchId = req.user!.branchId;
    const period = await storage.getCurrentPayrollPeriod(branchId);
    res.json({ period });
  });

  // Create payroll period (Manager only)
  app.post("/api/payroll/periods", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    try {
      const { startDate, endDate } = req.body;
      const branchId = req.user!.branchId;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start date and end date are required" });
      }

      const period = await storage.createPayrollPeriod({
        branchId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'open'
      });

      res.json({ period });
    } catch (error: any) {
      console.error('Create payroll period error:', error);
      res.status(500).json({ 
        message: error.message || "Failed to create payroll period" 
      });
    }
  });

  // Process payroll for a period (Manager only)
  app.post("/api/payroll/periods/:id/process", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    // Track created entries for rollback on failure
    const createdEntryIds: string[] = [];

    try {
      const { id } = req.params;
      const branchId = req.user!.branchId;

      // Get the payroll period
      const period = await storage.getPayrollPeriod(id);
      if (!period) {
        return res.status(404).json({ message: "Payroll period not found" });
      }

      if (period.status !== 'open') {
        return res.status(400).json({ message: "Payroll period is not open" });
      }

      // Get all employees in the branch
      const employees = await storage.getUsersByBranch(branchId);
      const payrollEntries = [];
      let totalHours = 0;
      let totalPay = 0;

      // Get holidays in the period for pay calculation
      const periodHolidays = await storage.getHolidays(
        new Date(period.startDate),
        new Date(period.endDate)
      );

      for (const employee of employees) {
        if (!employee.isActive) continue;

        // Get shifts for this employee in the period
        const shifts = await storage.getShiftsByUser(
          employee.id,
          new Date(period.startDate),
          new Date(period.endDate)
        );

        if (shifts.length === 0) continue;

        // Calculate pay using DOLE-compliant calculations
        // - Holiday pay rates (Regular 200%, Special 130%)
        // - Night differential (+10% for 10PM-6AM)
        // - Rest day premiums
        const hourlyRate = parseFloat(employee.hourlyRate);
        const payCalculation = calculatePeriodPay(shifts, hourlyRate, periodHolidays, 0); // 0 = Sunday as rest day

        // Calculate total hours from breakdown
        let employeeTotalHours = 0;
        let regularHours = 0;
        let nightDiffHours = 0;

        for (const day of payCalculation.breakdown) {
          regularHours += day.regularHours;
          nightDiffHours += day.nightDiffHours;
          employeeTotalHours += day.regularHours;
        }

        const basicPay = payCalculation.basicPay;
        const holidayPay = payCalculation.holidayPay;
        const nightDiffPay = payCalculation.nightDiffPay;
        const restDayPay = payCalculation.restDayPay;
        const grossPay = payCalculation.totalGrossPay;

        // Get deduction settings for the branch
        const deductionSettings = await storage.getDeductionSettings(branchId);
        const settings = deductionSettings || {
          deductSSS: true,
          deductPhilHealth: false,
          deductPagibig: false,
          deductWithholdingTax: false
        };

        // Calculate monthly salary for deduction calculations
        // Assuming 4.33 weeks per month average
        const weeksInPeriod = Math.ceil(
          (new Date(period.endDate).getTime() - new Date(period.startDate).getTime()) /
          (7 * 24 * 60 * 60 * 1000)
        );
        const monthlyBasicSalary = (basicPay / weeksInPeriod) * 4.33;

        // Import deduction calculator
        const { calculateAllDeductions } = await import('./utils/deductions');
        const deductionBreakdown = await calculateAllDeductions(monthlyBasicSalary, settings);

        // Calculate total deductions
        const sssContribution = deductionBreakdown.sssContribution;
        const philHealthContribution = deductionBreakdown.philHealthContribution;
        const pagibigContribution = deductionBreakdown.pagibigContribution;
        const withholdingTax = deductionBreakdown.withholdingTax;

        // Get recurring deductions from employee record
        const sssLoan = parseFloat(employee.sssLoanDeduction || '0');
        const pagibigLoan = parseFloat(employee.pagibigLoanDeduction || '0');
        const advances = parseFloat(employee.cashAdvanceDeduction || '0');
        const otherDeductions = parseFloat(employee.otherDeductions || '0');

        const totalDeductions =
          sssContribution +
          philHealthContribution +
          pagibigContribution +
          withholdingTax +
          sssLoan +
          pagibigLoan +
          advances +
          otherDeductions;

        const netPay = grossPay - totalDeductions;

        // Create payroll entry with detailed breakdown
        const entry = await storage.createPayrollEntry({
          userId: employee.id,
          payrollPeriodId: id,
          totalHours: employeeTotalHours.toString(),
          regularHours: regularHours.toString(),
          overtimeHours: "0", // No overtime tracking
          nightDiffHours: nightDiffHours.toString(),
          basicPay: basicPay.toString(),
          holidayPay: holidayPay.toString(),
          overtimePay: "0", // No overtime pay
          nightDiffPay: nightDiffPay.toString(),
          restDayPay: restDayPay.toString(),
          grossPay: grossPay.toString(),
          sssContribution: sssContribution.toString(),
          sssLoan: sssLoan.toString(),
          philHealthContribution: philHealthContribution.toString(),
          pagibigContribution: pagibigContribution.toString(),
          pagibigLoan: pagibigLoan.toString(),
          withholdingTax: withholdingTax.toString(),
          advances: advances.toString(),
          otherDeductions: otherDeductions.toString(),
          totalDeductions: totalDeductions.toString(),
          deductions: totalDeductions.toString(), // For backward compatibility
          netPay: netPay.toString(),
          status: 'pending'
        });

        payrollEntries.push(entry);
        createdEntryIds.push(entry.id);
        totalHours += employeeTotalHours;
        totalPay += grossPay;

        // Create notification for employee
        await storage.createNotification({
          userId: employee.id,
          type: 'payroll',
          title: 'Payroll Slip Available',
          message: `Your payroll slip for ${format(new Date(period.startDate), "MMM d")} - ${format(new Date(period.endDate), "MMM d, yyyy")} is now available. Net Pay: ₱${netPay.toFixed(2)}`,
          data: JSON.stringify({
            entryId: entry.id,
            periodId: id,
            netPay: netPay.toFixed(2)
          })
        } as any);
      }

      // Update the period status
      await storage.updatePayrollPeriod(id, {
        status: 'closed',
        totalHours: totalHours.toString(),
        totalPay: totalPay.toString()
      });

      res.json({
        message: `Payroll processed successfully for ${payrollEntries.length} employees`,
        entriesCreated: payrollEntries.length,
        totalHours: totalHours.toFixed(2),
        totalPay: totalPay.toFixed(2)
      });
    } catch (error: any) {
      console.error('Process payroll error:', error);

      // Rollback: Delete any created payroll entries
      if (createdEntryIds.length > 0) {
        console.log(`Rolling back ${createdEntryIds.length} payroll entries...`);
        for (const entryId of createdEntryIds) {
          try {
            await storage.deletePayrollEntry(entryId);
          } catch (deleteError) {
            console.error(`Failed to rollback entry ${entryId}:`, deleteError);
          }
        }
        console.log('Rollback complete');
      }

      res.status(500).json({
        message: error.message || "Failed to process payroll. All changes have been rolled back."
      });
    }
  });

  // Get all payroll entries for a branch (Manager only)
  app.get("/api/payroll/entries/branch", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    try {
      const branchId = req.user!.branchId;
      const { periodId } = req.query;

      // Get all active employees in the branch
      const allEmployees = await storage.getUsersByBranch(branchId);
      const employees = allEmployees.filter(emp => emp.isActive);

      let allEntries = [];
      for (const employee of employees) {
        const entries = await storage.getPayrollEntriesByUser(
          employee.id,
          periodId as string
        );

        // Add employee details to each entry
        const entriesWithUser = entries.map(entry => ({
          ...entry,
          employee: {
            id: employee.id,
            firstName: employee.firstName,
            lastName: employee.lastName,
            position: employee.position,
            email: employee.email
          }
        }));

        allEntries.push(...entriesWithUser);
      }

      res.json({ entries: allEntries });
    } catch (error: any) {
      console.error('Get branch payroll entries error:', error);
      res.status(500).json({ 
        message: error.message || "Failed to get payroll entries" 
      });
    }
  });

  // Approve payroll entry (Manager only)
  app.put("/api/payroll/entries/:id/approve", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    try {
      const { id } = req.params;
      
      const entry = await storage.updatePayrollEntry(id, { status: 'approved' });
      
      if (!entry) {
        return res.status(404).json({ message: "Payroll entry not found" });
      }

      res.json({ entry });
    } catch (error: any) {
      console.error('Approve payroll entry error:', error);
      res.status(500).json({ 
        message: error.message || "Failed to approve payroll entry" 
      });
    }
  });

  // Mark payroll entry as paid (Manager only)
  app.put("/api/payroll/entries/:id/paid", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    try {
      const { id } = req.params;
      
      const entry = await storage.updatePayrollEntry(id, { status: 'paid' });
      
      if (!entry) {
        return res.status(404).json({ message: "Payroll entry not found" });
      }

      res.json({ entry });
    } catch (error: any) {
      console.error('Mark payroll as paid error:', error);
      res.status(500).json({ 
        message: error.message || "Failed to mark payroll as paid" 
      });
    }
  });

  // Payslip generation route
  app.get("/api/payroll/payslip/:entryId", requireAuth, async (req, res) => {
    const { entryId } = req.params;
    const userId = req.user!.id;

    // Get payroll entry
    const entries = await storage.getPayrollEntriesByUser(userId);
    const entry = entries.find(e => e.id === entryId);

    if (!entry) {
      return res.status(404).json({ message: "Payroll entry not found" });
    }

    // Get user details
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get the payroll period for date range
    const period = await storage.getPayrollPeriod(entry.payrollPeriodId);

    // Generate payslip data with detailed deductions
    const payslipData = {
      employeeName: `${user.firstName} ${user.lastName}`,
      employeeId: user.id,
      position: user.position,
      period: entry.createdAt,
      periodStart: period?.startDate,
      periodEnd: period?.endDate,
      regularHours: entry.regularHours,
      overtimeHours: entry.overtimeHours,
      nightDiffHours: (entry as any).nightDiffHours || 0,
      totalHours: entry.totalHours,
      hourlyRate: user.hourlyRate,
      // Pay breakdown
      basicPay: entry.basicPay || entry.grossPay,
      holidayPay: entry.holidayPay || 0,
      overtimePay: entry.overtimePay || 0,
      nightDiffPay: (entry as any).nightDiffPay || 0,
      restDayPay: (entry as any).restDayPay || 0,
      grossPay: entry.grossPay,
      // Detailed deductions
      sssContribution: entry.sssContribution || 0,
      sssLoan: entry.sssLoan || 0,
      philHealthContribution: entry.philHealthContribution || 0,
      pagibigContribution: entry.pagibigContribution || 0,
      pagibigLoan: entry.pagibigLoan || 0,
      withholdingTax: entry.withholdingTax || 0,
      advances: entry.advances || 0,
      otherDeductions: entry.otherDeductions || 0,
      totalDeductions: entry.totalDeductions || entry.deductions || 0,
      deductions: entry.deductions,
      netPay: entry.netPay,
      status: entry.status,
    };

    res.json({ payslip: payslipData });
  });

  // Manager view employee payslip
  app.get("/api/payroll/entries/:entryId/payslip", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    try {
      const { entryId } = req.params;
      const branchId = req.user!.branchId;

      // Get payroll entry
      const entry = await storage.getPayrollEntry(entryId);
      if (!entry) {
        return res.status(404).json({ message: "Payroll entry not found" });
      }

      // Get employee details
      const employee = await storage.getUser(entry.userId);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      // Verify employee is in the same branch
      if (employee.branchId !== branchId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Get the payroll period
      const period = await storage.getPayrollPeriod(entry.payrollPeriodId);

      // Generate payslip data with detailed deductions (no overtime)
      const payslipData = {
        employeeName: `${employee.firstName} ${employee.lastName}`,
        employeeId: employee.id,
        email: employee.email,
        position: employee.position,
        period: entry.createdAt,
        periodStart: period?.startDate,
        periodEnd: period?.endDate,
        regularHours: entry.regularHours,
        nightDiffHours: (entry as any).nightDiffHours || 0,
        totalHours: entry.totalHours,
        hourlyRate: employee.hourlyRate,
        // Pay breakdown (no overtime)
        basicPay: entry.basicPay || entry.grossPay,
        holidayPay: entry.holidayPay || 0,
        nightDiffPay: (entry as any).nightDiffPay || 0,
        restDayPay: (entry as any).restDayPay || 0,
        grossPay: entry.grossPay,
        // Detailed deductions
        sssContribution: entry.sssContribution || 0,
        sssLoan: entry.sssLoan || 0,
        philHealthContribution: entry.philHealthContribution || 0,
        pagibigContribution: entry.pagibigContribution || 0,
        pagibigLoan: entry.pagibigLoan || 0,
        withholdingTax: entry.withholdingTax || 0,
        advances: entry.advances || 0,
        otherDeductions: entry.otherDeductions || 0,
        totalDeductions: entry.totalDeductions || entry.deductions || 0,
        deductions: entry.deductions,
        netPay: entry.netPay,
        status: entry.status,
        // Blockchain verification
        blockchainHash: entry.blockchainHash,
        blockNumber: entry.blockNumber,
        transactionHash: entry.transactionHash,
        verified: entry.verified,
      };

      res.json({ payslip: payslipData });
    } catch (error: any) {
      console.error('Get employee payslip error:', error);
      res.status(500).json({
        message: error.message || "Failed to get payslip"
      });
    }
  });

  // Manager send payslip to employee
  app.post("/api/payroll/entries/:entryId/send", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    try {
      const { entryId } = req.params;
      const branchId = req.user!.branchId;

      // Get payroll entry
      const entry = await storage.getPayrollEntry(entryId);
      if (!entry) {
        return res.status(404).json({ message: "Payroll entry not found" });
      }

      // Get employee details
      const employee = await storage.getUser(entry.userId);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      // Verify employee is in the same branch
      if (employee.branchId !== branchId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Create notification for employee
      await storage.createNotification({
        userId: entry.userId,
        type: 'payroll',
        title: 'Payslip Sent',
        message: `Your payslip has been sent by your manager. Net Pay: ₱${parseFloat(entry.netPay).toFixed(2)}`,
        data: JSON.stringify({
          entryId: entry.id,
          netPay: entry.netPay
        })
      } as any);

      res.json({
        message: "Payslip sent to employee successfully"
      });
    } catch (error: any) {
      console.error('Send payslip error:', error);
      res.status(500).json({
        message: error.message || "Failed to send payslip"
      });
    }
  });

  // ============================================
  // HOLIDAY MANAGEMENT ENDPOINTS
  // ============================================

  // Get all holidays (optionally filtered by date range)
  app.get("/api/holidays", requireAuth, async (req, res) => {
    try {
      const { startDate, endDate, year } = req.query;

      let holidaysList;
      if (year) {
        holidaysList = await storage.getHolidaysByYear(parseInt(year as string));
      } else if (startDate && endDate) {
        holidaysList = await storage.getHolidays(
          new Date(startDate as string),
          new Date(endDate as string)
        );
      } else {
        holidaysList = await storage.getHolidays();
      }

      res.json({ holidays: holidaysList });
    } catch (error: any) {
      console.error('Get holidays error:', error);
      res.status(500).json({ message: error.message || "Failed to get holidays" });
    }
  });

  // Create a new holiday (Admin/Manager only)
  app.post("/api/holidays", requireAuth, requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const { name, date, type, year, isRecurring } = req.body;

      if (!name || !date || !type || !year) {
        return res.status(400).json({ message: "Missing required fields: name, date, type, year" });
      }

      const holiday = await storage.createHoliday({
        name,
        date: new Date(date),
        type,
        year,
        isRecurring: isRecurring || false
      });

      res.json({ holiday });
    } catch (error: any) {
      console.error('Create holiday error:', error);
      res.status(500).json({ message: error.message || "Failed to create holiday" });
    }
  });

  // Update a holiday (Admin/Manager only)
  app.put("/api/holidays/:id", requireAuth, requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, date, type, year, isRecurring } = req.body;

      const updateData: any = {};
      if (name) updateData.name = name;
      if (date) updateData.date = new Date(date);
      if (type) updateData.type = type;
      if (year) updateData.year = year;
      if (isRecurring !== undefined) updateData.isRecurring = isRecurring;

      const holiday = await storage.updateHoliday(id, updateData);

      if (!holiday) {
        return res.status(404).json({ message: "Holiday not found" });
      }

      res.json({ holiday });
    } catch (error: any) {
      console.error('Update holiday error:', error);
      res.status(500).json({ message: error.message || "Failed to update holiday" });
    }
  });

  // Delete a holiday (Admin/Manager only)
  app.delete("/api/holidays/:id", requireAuth, requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteHoliday(id);
      res.json({ message: "Holiday deleted successfully" });
    } catch (error: any) {
      console.error('Delete holiday error:', error);
      res.status(500).json({ message: error.message || "Failed to delete holiday" });
    }
  });

  // ============================================
  // PAYROLL ARCHIVING ENDPOINTS
  // ============================================

  // Get archived payroll periods
  app.get("/api/payroll/archived", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    try {
      const branchId = req.user!.branchId;
      const archivedPeriods = await storage.getArchivedPayrollPeriods(branchId);
      res.json({ archivedPeriods });
    } catch (error: any) {
      console.error('Get archived payroll error:', error);
      res.status(500).json({ message: error.message || "Failed to get archived payroll" });
    }
  });

  // Archive a payroll period
  app.post("/api/payroll/periods/:id/archive", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // Get all entries for this period
      const entries = await storage.getPayrollEntriesByPeriod(id);
      const entriesSnapshot = JSON.stringify(entries);

      const archived = await storage.archivePayrollPeriod(id, userId, entriesSnapshot);

      res.json({
        message: "Payroll period archived successfully",
        archived
      });
    } catch (error: any) {
      console.error('Archive payroll error:', error);
      res.status(500).json({ message: error.message || "Failed to archive payroll period" });
    }
  });

  // Get a specific archived period with entries
  app.get("/api/payroll/archived/:id", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    try {
      const { id } = req.params;
      const archived = await storage.getArchivedPayrollPeriod(id);

      if (!archived) {
        return res.status(404).json({ message: "Archived period not found" });
      }

      // Parse the entries snapshot
      const entries = JSON.parse(archived.entriesSnapshot || '[]');

      res.json({
        archived,
        entries
      });
    } catch (error: any) {
      console.error('Get archived period error:', error);
      res.status(500).json({ message: error.message || "Failed to get archived period" });
    }
  });

  app.get("/api/shift-trades/available", requireAuth, async (req, res) => {
    const branchId = req.user!.branchId;
    const trades = await storage.getAvailableShiftTrades(branchId);
    
    // Get shift and user details
    const tradesWithDetails = await Promise.all(
      trades.map(async (trade) => {
        const shift = await storage.getShift(trade.shiftId);
        const fromUser = await storage.getUser(trade.fromUserId);
        return { ...trade, shift, fromUser };
      })
    );
    
    res.json({ trades: tradesWithDetails });
  });

  app.post("/api/shift-trades", requireAuth, async (req, res) => {
    try {
      const tradeData = insertShiftTradeSchema.parse(req.body);

      // Get the shift to validate the 3-day rule
      const shift = await storage.getShift(tradeData.shiftId);
      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }

      // Validate 3-day advance notice requirement
      const shiftDate = new Date(shift.startTime);
      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      if (shiftDate < threeDaysFromNow) {
        return res.status(400).json({
          message: "Shift trade requests must be submitted at least 3 days before the shift. You cannot trade shifts that are less than 3 days away."
        });
      }

      const trade = await storage.createShiftTrade({
        ...tradeData,
        fromUserId: req.user!.id,
      });

      res.json({ trade });
    } catch (error) {
      res.status(400).json({ message: "Invalid trade data" });
    }
  });

  app.put("/api/shift-trades/:id/take", requireAuth, async (req, res) => {
    const { id } = req.params;
    const userId = req.user!.id;

    const trade = await storage.updateShiftTrade(id, {
      toUserId: userId,
      status: "pending", // Still needs manager approval
    });

    if (!trade) {
      return res.status(404).json({ message: "Trade not found" });
    }

    res.json({ trade });
  });

  // ============================================
  // SHIFT DROP REQUEST ROUTES
  // ============================================

  // Get all shift drop requests (manager/admin view)
  app.get("/api/shift-drop-requests", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    try {
      const branchId = req.user!.branchId;
      const { status } = req.query;

      let requests;
      if (status === 'pending') {
        requests = await storage.getPendingShiftDropRequests(branchId);
      } else if (status === 'available') {
        requests = await storage.getAvailableShiftsForPickup(branchId);
      } else {
        requests = await storage.getAllShiftDropRequests(branchId);
      }

      // Check for approved shifts that haven't been picked up after 48 hours
      // and send escalation notifications to managers
      const now = new Date();
      const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      for (const request of requests) {
        if (request.status === 'approved' &&
            !request.pickedUpBy &&
            !request.escalationSent &&
            request.resolvedAt &&
            new Date(request.resolvedAt) < fortyEightHoursAgo) {

          // Mark as escalated
          await storage.updateShiftDropRequest(request.id, {
            escalationSent: true,
            escalatedAt: now,
          });

          // Get shift details for the notification
          const shift = await storage.getShift(request.shiftId);
          const employee = await storage.getUser(request.userId);

          // Notify all managers in the branch
          const managers = await storage.getUsersByBranch(branchId);
          for (const manager of managers.filter(u => u.role === 'manager' || u.role === 'admin')) {
            await storage.createNotification({
              userId: manager.id,
              type: 'shift_unfilled_alert',
              title: '⚠️ Unfilled Shift Alert',
              message: `The shift on ${format(new Date(shift!.startTime), 'MMM d, yyyy')} (dropped by ${employee?.firstName} ${employee?.lastName}) has not been picked up for 48 hours. Please take action.`,
              data: JSON.stringify({ requestId: request.id, shiftId: request.shiftId }),
            });
          }
        }
      }

      // Get shift and user details for each request
      const requestsWithDetails = await Promise.all(
        requests.map(async (request) => {
          const shift = await storage.getShift(request.shiftId);
          const user = await storage.getUser(request.userId);
          const resolvedByUser = request.resolvedBy ? await storage.getUser(request.resolvedBy) : null;
          const pickedUpByUser = request.pickedUpBy ? await storage.getUser(request.pickedUpBy) : null;
          return {
            ...request,
            shift,
            user,
            resolvedByUser,
            pickedUpByUser
          };
        })
      );

      res.json({ requests: requestsWithDetails });
    } catch (error: any) {
      console.error('Get shift drop requests error:', error);
      res.status(500).json({ message: error.message || "Failed to get shift drop requests" });
    }
  });

  // Get my shift drop requests (employee view)
  app.get("/api/shift-drop-requests/my", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const requests = await storage.getShiftDropRequestsByUser(userId);

      // Get shift details for each request
      const requestsWithDetails = await Promise.all(
        requests.map(async (request) => {
          const shift = await storage.getShift(request.shiftId);
          return { ...request, shift };
        })
      );

      res.json({ requests: requestsWithDetails });
    } catch (error: any) {
      console.error('Get my shift drop requests error:', error);
      res.status(500).json({ message: error.message || "Failed to get shift drop requests" });
    }
  });

  // Get available shifts for pickup (employee view)
  app.get("/api/shift-drop-requests/available", requireAuth, async (req, res) => {
    try {
      const branchId = req.user!.branchId;
      const userId = req.user!.id;
      const requests = await storage.getAvailableShiftsForPickup(branchId);

      // Filter out the user's own requests and get details
      const requestsWithDetails = await Promise.all(
        requests
          .filter(request => request.userId !== userId) // Don't show own shifts
          .map(async (request) => {
            const shift = await storage.getShift(request.shiftId);
            const user = await storage.getUser(request.userId);
            return { ...request, shift, user };
          })
      );

      res.json({ requests: requestsWithDetails });
    } catch (error: any) {
      console.error('Get available shifts error:', error);
      res.status(500).json({ message: error.message || "Failed to get available shifts" });
    }
  });

  // Create shift drop request (employee)
  app.post("/api/shift-drop-requests", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { shiftId, reason, urgency } = req.body;

      // Validate input
      if (!shiftId || !reason) {
        return res.status(400).json({ message: "Shift ID and reason are required" });
      }

      // Get the shift
      const shift = await storage.getShift(shiftId);
      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }

      // Verify the shift belongs to this user
      if (shift.userId !== userId) {
        return res.status(403).json({ message: "You can only request to drop your own shifts" });
      }

      // Check if shift is at least 3 days away
      const shiftDate = new Date(shift.startTime);
      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      if (shiftDate < threeDaysFromNow) {
        return res.status(400).json({
          message: "Cannot request to drop a shift less than 3 days before the scheduled time"
        });
      }

      // Check if there's already a pending/approved drop request for this shift
      const existingRequest = await storage.getShiftDropRequestByShift(shiftId);
      if (existingRequest) {
        return res.status(400).json({
          message: "There is already a pending or approved drop request for this shift"
        });
      }

      // Create the drop request
      const request = await storage.createShiftDropRequest({
        shiftId,
        userId,
        reason,
        urgency: urgency || 'normal',
      });

      // Notify managers
      const managers = await storage.getUsersByBranch(req.user!.branchId);
      const user = await storage.getUser(userId);
      for (const manager of managers.filter(u => u.role === 'manager' || u.role === 'admin')) {
        await storage.createNotification({
          userId: manager.id,
          type: 'shift_drop_request',
          title: 'New Shift Drop Request',
          message: `${user?.firstName} ${user?.lastName} has requested to drop their shift on ${format(shiftDate, 'MMM d, yyyy')}`,
          data: JSON.stringify({ requestId: request.id, shiftId }),
        });
      }

      res.json({ request });
    } catch (error: any) {
      console.error('Create shift drop request error:', error);
      res.status(500).json({ message: error.message || "Failed to create shift drop request" });
    }
  });

  // Approve shift drop request (manager/admin)
  app.put("/api/shift-drop-requests/:id/approve", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    try {
      const { id } = req.params;
      const { managerNotes } = req.body;
      const managerId = req.user!.id;

      const request = await storage.getShiftDropRequest(id);
      if (!request) {
        return res.status(404).json({ message: "Drop request not found" });
      }

      if (request.status !== 'pending') {
        return res.status(400).json({ message: "This request has already been processed" });
      }

      // Update the request
      const updatedRequest = await storage.updateShiftDropRequest(id, {
        status: 'approved',
        resolvedBy: managerId,
        resolvedAt: new Date(),
        managerNotes: managerNotes || null,
      });

      // Notify the employee
      const shift = await storage.getShift(request.shiftId);
      await storage.createNotification({
        userId: request.userId,
        type: 'shift_drop_approved',
        title: 'Shift Drop Request Approved',
        message: `Your request to drop the shift on ${format(new Date(shift!.startTime), 'MMM d, yyyy')} has been approved. The shift is now available for pickup.`,
        data: JSON.stringify({ requestId: id, shiftId: request.shiftId }),
      });

      // Notify all eligible employees that a shift is available
      const employees = await storage.getUsersByBranch(req.user!.branchId);
      for (const employee of employees.filter(u => u.id !== request.userId && u.role === 'employee')) {
        await storage.createNotification({
          userId: employee.id,
          type: 'shift_available',
          title: 'Shift Available for Pickup',
          message: `A shift on ${format(new Date(shift!.startTime), 'MMM d, yyyy')} is now available for pickup.`,
          data: JSON.stringify({ requestId: id, shiftId: request.shiftId }),
        });
      }

      res.json({ request: updatedRequest });
    } catch (error: any) {
      console.error('Approve shift drop request error:', error);
      res.status(500).json({ message: error.message || "Failed to approve shift drop request" });
    }
  });

  // Reject shift drop request (manager/admin)
  app.put("/api/shift-drop-requests/:id/reject", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    try {
      const { id } = req.params;
      const { managerNotes } = req.body;
      const managerId = req.user!.id;

      const request = await storage.getShiftDropRequest(id);
      if (!request) {
        return res.status(404).json({ message: "Drop request not found" });
      }

      if (request.status !== 'pending') {
        return res.status(400).json({ message: "This request has already been processed" });
      }

      // Update the request
      const updatedRequest = await storage.updateShiftDropRequest(id, {
        status: 'rejected',
        resolvedBy: managerId,
        resolvedAt: new Date(),
        managerNotes: managerNotes || null,
      });

      // Notify the employee
      const shift = await storage.getShift(request.shiftId);
      await storage.createNotification({
        userId: request.userId,
        type: 'shift_drop_rejected',
        title: 'Shift Drop Request Rejected',
        message: `Your request to drop the shift on ${format(new Date(shift!.startTime), 'MMM d, yyyy')} has been rejected. You are still required to work this shift.${managerNotes ? ` Manager notes: ${managerNotes}` : ''}`,
        data: JSON.stringify({ requestId: id, shiftId: request.shiftId }),
      });

      res.json({ request: updatedRequest });
    } catch (error: any) {
      console.error('Reject shift drop request error:', error);
      res.status(500).json({ message: error.message || "Failed to reject shift drop request" });
    }
  });

  // Cancel shift drop request (employee can cancel their own pending request)
  app.put("/api/shift-drop-requests/:id/cancel", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const request = await storage.getShiftDropRequest(id);
      if (!request) {
        return res.status(404).json({ message: "Drop request not found" });
      }

      // Only the owner or manager/admin can cancel
      if (request.userId !== userId && userRole === 'employee') {
        return res.status(403).json({ message: "You can only cancel your own requests" });
      }

      if (request.status !== 'pending' && request.status !== 'approved') {
        return res.status(400).json({ message: "This request cannot be cancelled" });
      }

      // Update the request
      const updatedRequest = await storage.updateShiftDropRequest(id, {
        status: 'cancelled',
        resolvedBy: userId,
        resolvedAt: new Date(),
      });

      res.json({ request: updatedRequest });
    } catch (error: any) {
      console.error('Cancel shift drop request error:', error);
      res.status(500).json({ message: error.message || "Failed to cancel shift drop request" });
    }
  });

  // Pickup an available shift (employee)
  app.put("/api/shift-drop-requests/:id/pickup", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const request = await storage.getShiftDropRequest(id);
      if (!request) {
        return res.status(404).json({ message: "Drop request not found" });
      }

      if (request.status !== 'approved') {
        return res.status(400).json({ message: "This shift is not available for pickup" });
      }

      if (request.pickedUpBy) {
        return res.status(400).json({ message: "This shift has already been picked up" });
      }

      if (request.userId === userId) {
        return res.status(400).json({ message: "You cannot pick up your own dropped shift" });
      }

      // Update the drop request
      const updatedRequest = await storage.updateShiftDropRequest(id, {
        status: 'picked_up',
        pickedUpBy: userId,
        pickedUpAt: new Date(),
      });

      // Reassign the shift to the new employee
      await storage.updateShift(request.shiftId, {
        userId: userId,
      });

      // Notify the original employee
      const shift = await storage.getShift(request.shiftId);
      const newEmployee = await storage.getUser(userId);
      await storage.createNotification({
        userId: request.userId,
        type: 'shift_picked_up',
        title: 'Your Dropped Shift Was Picked Up',
        message: `${newEmployee?.firstName} ${newEmployee?.lastName} has picked up your shift on ${format(new Date(shift!.startTime), 'MMM d, yyyy')}.`,
        data: JSON.stringify({ requestId: id, shiftId: request.shiftId }),
      });

      // Notify managers
      const managers = await storage.getUsersByBranch(req.user!.branchId);
      for (const manager of managers.filter(u => u.role === 'manager' || u.role === 'admin')) {
        await storage.createNotification({
          userId: manager.id,
          type: 'shift_picked_up',
          title: 'Shift Picked Up',
          message: `${newEmployee?.firstName} ${newEmployee?.lastName} has picked up the available shift on ${format(new Date(shift!.startTime), 'MMM d, yyyy')}.`,
          data: JSON.stringify({ requestId: id, shiftId: request.shiftId }),
        });
      }

      res.json({ request: updatedRequest });
    } catch (error: any) {
      console.error('Pickup shift error:', error);
      res.status(500).json({ message: error.message || "Failed to pickup shift" });
    }
  });

  // Manager assign shift to employee (override)
  app.put("/api/shift-drop-requests/:id/assign", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    try {
      const { id } = req.params;
      const { employeeId, managerNotes } = req.body;
      const managerId = req.user!.id;

      if (!employeeId) {
        return res.status(400).json({ message: "Employee ID is required" });
      }

      const request = await storage.getShiftDropRequest(id);
      if (!request) {
        return res.status(404).json({ message: "Drop request not found" });
      }

      if (request.status !== 'approved') {
        return res.status(400).json({ message: "Can only assign shifts that are approved for pickup" });
      }

      // Update the drop request
      const updatedRequest = await storage.updateShiftDropRequest(id, {
        status: 'picked_up',
        pickedUpBy: employeeId,
        pickedUpAt: new Date(),
        managerNotes: managerNotes || 'Assigned by manager',
      });

      // Reassign the shift
      await storage.updateShift(request.shiftId, {
        userId: employeeId,
      });

      // Notify the assigned employee
      const shift = await storage.getShift(request.shiftId);
      await storage.createNotification({
        userId: employeeId,
        type: 'shift_assigned',
        title: 'Shift Assigned to You',
        message: `A manager has assigned you a shift on ${format(new Date(shift!.startTime), 'MMM d, yyyy')}.`,
        data: JSON.stringify({ requestId: id, shiftId: request.shiftId }),
      });

      // Notify the original employee
      const assignedEmployee = await storage.getUser(employeeId);
      await storage.createNotification({
        userId: request.userId,
        type: 'shift_reassigned',
        title: 'Your Dropped Shift Was Reassigned',
        message: `Your shift on ${format(new Date(shift!.startTime), 'MMM d, yyyy')} has been assigned to ${assignedEmployee?.firstName} ${assignedEmployee?.lastName}.`,
        data: JSON.stringify({ requestId: id, shiftId: request.shiftId }),
      });

      res.json({ request: updatedRequest });
    } catch (error: any) {
      console.error('Assign shift error:', error);
      res.status(500).json({ message: error.message || "Failed to assign shift" });
    }
  });

  // Force original employee to work (deny drop after approval)
  app.put("/api/shift-drop-requests/:id/force-work", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    try {
      const { id } = req.params;
      const { managerNotes } = req.body;
      const managerId = req.user!.id;

      const request = await storage.getShiftDropRequest(id);
      if (!request) {
        return res.status(404).json({ message: "Drop request not found" });
      }

      if (request.status !== 'approved') {
        return res.status(400).json({ message: "Can only force work on approved drop requests" });
      }

      if (request.pickedUpBy) {
        return res.status(400).json({ message: "This shift has already been picked up" });
      }

      // Update the drop request back to rejected
      const updatedRequest = await storage.updateShiftDropRequest(id, {
        status: 'rejected',
        resolvedBy: managerId,
        resolvedAt: new Date(),
        managerNotes: managerNotes || 'Manager required original employee to work',
      });

      // Notify the employee
      const shift = await storage.getShift(request.shiftId);
      await storage.createNotification({
        userId: request.userId,
        type: 'shift_force_work',
        title: 'You Are Required to Work Your Shift',
        message: `Management has required you to work your shift on ${format(new Date(shift!.startTime), 'MMM d, yyyy')} as no one picked it up.${managerNotes ? ` Notes: ${managerNotes}` : ''}`,
        data: JSON.stringify({ requestId: id, shiftId: request.shiftId }),
      });

      res.json({ request: updatedRequest });
    } catch (error: any) {
      console.error('Force work error:', error);
      res.status(500).json({ message: error.message || "Failed to force work" });
    }
  });

  // Mark shift as cancelled/business closed (manager/admin)
  app.put("/api/shift-drop-requests/:id/mark-closed", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    try {
      const { id } = req.params;
      const { managerNotes } = req.body;

      const request = await storage.getShiftDropRequest(id);
      if (!request) {
        return res.status(404).json({ message: "Drop request not found" });
      }

      // Update the shift status to cancelled
      await storage.updateShift(request.shiftId, {
        status: 'cancelled',
      });

      // Update the drop request
      const updatedRequest = await storage.updateShiftDropRequest(id, {
        status: 'cancelled',
        managerNotes: managerNotes || 'Shift cancelled - business closed',
      });

      // Notify the original employee
      const shift = await storage.getShift(request.shiftId);
      await storage.createNotification({
        userId: request.userId,
        type: 'shift_cancelled',
        title: 'Shift Cancelled',
        message: `The shift on ${format(new Date(shift!.startTime), 'MMM d, yyyy')} has been cancelled.${managerNotes ? ` Notes: ${managerNotes}` : ''}`,
        data: JSON.stringify({ requestId: id, shiftId: request.shiftId }),
      });

      res.json({ request: updatedRequest });
    } catch (error: any) {
      console.error('Mark closed error:', error);
      res.status(500).json({ message: error.message || "Failed to mark shift as closed" });
    }
  });

  // Get unfilled shifts needing escalation (for manager alerts)
  app.get("/api/shift-drop-requests/escalation", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    try {
      const branchId = req.user!.branchId;
      const requests = await storage.getUnfilledShiftsNeedingEscalation(branchId, 24);

      // Get shift and user details
      const requestsWithDetails = await Promise.all(
        requests.map(async (request) => {
          const shift = await storage.getShift(request.shiftId);
          const user = await storage.getUser(request.userId);
          return { ...request, shift, user };
        })
      );

      res.json({ requests: requestsWithDetails });
    } catch (error: any) {
      console.error('Get escalation requests error:', error);
      res.status(500).json({ message: error.message || "Failed to get escalation requests" });
    }
  });

  // Admin Deduction Rates Routes (Admin only)
  app.get("/api/admin/deduction-rates", requireAuth, requireRole(["admin"]), async (req, res) => {
    try {
      const rates = await storage.getAllDeductionRates();
      res.json({ rates });
    } catch (error: any) {
      console.error('Get deduction rates error:', error);
      res.status(500).json({ message: error.message || "Failed to get deduction rates" });
    }
  });

  app.post("/api/admin/deduction-rates", requireAuth, requireRole(["admin"]), async (req, res) => {
    try {
      const { type, minSalary, maxSalary, employeeRate, employeeContribution, description } = req.body;

      const rate = await storage.createDeductionRate({
        type,
        minSalary,
        maxSalary: maxSalary || null,
        employeeRate: employeeRate || null,
        employeeContribution: employeeContribution || null,
        description: description || null,
        isActive: true,
      });

      res.json({ rate });
    } catch (error: any) {
      console.error('Create deduction rate error:', error);
      res.status(500).json({ message: error.message || "Failed to create deduction rate" });
    }
  });

  app.put("/api/admin/deduction-rates/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
    try {
      const { id } = req.params;
      const { type, minSalary, maxSalary, employeeRate, employeeContribution, description } = req.body;

      const rate = await storage.updateDeductionRate(id, {
        type,
        minSalary,
        maxSalary: maxSalary || null,
        employeeRate: employeeRate || null,
        employeeContribution: employeeContribution || null,
        description: description || null,
      });

      if (!rate) {
        return res.status(404).json({ message: "Deduction rate not found" });
      }

      res.json({ rate });
    } catch (error: any) {
      console.error('Update deduction rate error:', error);
      res.status(500).json({ message: error.message || "Failed to update deduction rate" });
    }
  });

  app.delete("/api/admin/deduction-rates/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteDeductionRate(id);

      if (!success) {
        return res.status(404).json({ message: "Deduction rate not found" });
      }

      res.json({ message: "Deduction rate deleted successfully" });
    } catch (error: any) {
      console.error('Delete deduction rate error:', error);
      res.status(500).json({ message: error.message || "Failed to delete deduction rate" });
    }
  });

  // Deduction Settings Routes (Manager only)
  app.get("/api/deduction-settings", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    try {
      const branchId = req.user!.branchId;
      let settings = await storage.getDeductionSettings(branchId);

      // If no settings exist, create default settings
      if (!settings) {
        settings = await storage.createDeductionSettings({
          branchId,
          deductSSS: true,
          deductPhilHealth: false,
          deductPagibig: false,
          deductWithholdingTax: false,
        });
      }

      res.json({ settings });
    } catch (error: any) {
      console.error('Get deduction settings error:', error);
      res.status(500).json({ message: error.message || "Failed to get deduction settings" });
    }
  });

  app.put("/api/deduction-settings/:id", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    try {
      const { id } = req.params;
      const { deductSSS, deductPhilHealth, deductPagibig, deductWithholdingTax } = req.body;

      const settings = await storage.updateDeductionSettings(id, {
        deductSSS,
        deductPhilHealth,
        deductPagibig,
        deductWithholdingTax,
      });

      if (!settings) {
        return res.status(404).json({ message: "Deduction settings not found" });
      }

      res.json({ settings });
    } catch (error: any) {
      console.error('Update deduction settings error:', error);
      res.status(500).json({ message: error.message || "Failed to update deduction settings" });
    }
  });

  // Manager approval routes
  app.get("/api/approvals", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    const branchId = req.user!.branchId;
    const approvals = await storage.getPendingApprovals(branchId);

    // Get user details for each approval
    const approvalsWithUsers = await Promise.all(
      approvals.map(async (approval) => {
        const requestedBy = await storage.getUser(approval.requestedBy);
        return { ...approval, requestedBy };
      })
    );

    res.json({ approvals: approvalsWithUsers });
  });

  app.put("/api/approvals/:id", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    const { id } = req.params;
    const { status, reason } = req.body;
    
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    
    const approval = await storage.updateApproval(id, {
      status,
      reason,
      approvedBy: req.user!.id,
    });
    
    if (!approval) {
      return res.status(404).json({ message: "Approval not found" });
    }
    
    res.json({ approval });
  });

  // Register branches routes
  registerBranchesRoutes(app);

  // Reports API endpoints
  app.get("/api/reports/payroll", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    const branchId = req.user!.branchId;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const users = await storage.getUsersByBranch(branchId);
    let totalPayroll = 0;

    for (const user of users) {
      const entries = await storage.getPayrollEntriesByUser(user.id);
      for (const entry of entries) {
        const entryDate = new Date(entry.createdAt);
        if (entryDate >= monthStart && entryDate <= monthEnd) {
          totalPayroll += parseFloat(entry.grossPay);
        }
      }
    }

    res.json({ totalPayroll: Number(totalPayroll.toFixed(2)) });
  });

  app.get("/api/reports/attendance", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    const branchId = req.user!.branchId;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const users = await storage.getUsersByBranch(branchId);
    let totalHours = 0;

    for (const user of users) {
      const shifts = await storage.getShiftsByUser(user.id, monthStart, monthEnd);
      for (const shift of shifts) {
        const hours = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60);
        totalHours += hours;
      }
    }

    res.json({ totalHours: Number(totalHours.toFixed(2)) });
  });

  app.get("/api/reports/shifts", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    const branchId = req.user!.branchId;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const shifts = await storage.getShiftsByBranch(branchId, monthStart, monthEnd);

    res.json({
      totalShifts: shifts.length,
      completedShifts: shifts.filter(s => s.status === 'completed').length,
      missedShifts: shifts.filter(s => s.status === 'missed').length,
      cancelledShifts: shifts.filter(s => s.status === 'cancelled').length,
    });
  });

  app.get("/api/reports/employees", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    const branchId = req.user!.branchId;
    const users = await storage.getUsersByBranch(branchId);

    res.json({
      activeCount: users.filter(u => u.isActive).length,
      totalCount: users.length,
      inactiveCount: users.filter(u => !u.isActive).length,
    });
  });

  // Dashboard stats routes
  app.get("/api/dashboard/stats", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    const branchId = req.user!.branchId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's shifts for the branch
    const todayShifts = await storage.getShiftsByBranch(branchId, today, tomorrow);

    // Calculate clocked in employees - shifts with status 'in-progress'
    const clockedIn = todayShifts.filter(shift => shift.status === 'in-progress').length;

    // Calculate employees on break (for now, we'll use 0 as we don't have break tracking yet)
    const onBreak = 0;

    // Calculate late arrivals - shifts that started more than 15 minutes after scheduled start time
    const late = todayShifts.filter(shift => {
      const scheduledStart = new Date(shift.startTime);
      const actualStart = shift.actualStartTime ? new Date(shift.actualStartTime) : null;
      if (!actualStart) return false;
      const diffMinutes = (actualStart.getTime() - scheduledStart.getTime()) / (1000 * 60);
      return diffMinutes > 15;
    }).length;

    // Calculate revenue from completed shifts (simplified - based on hours worked)
    // In a real system, this would come from a sales/revenue table
    const completedShifts = todayShifts.filter(shift => shift.status === 'completed');
    let revenue = 0;
    for (const shift of completedShifts) {
      const user = await storage.getUser(shift.userId);
      if (user) {
        const hours = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60);
        // Estimate revenue as 3x labor cost (typical cafe margin)
        revenue += hours * parseFloat(user.hourlyRate) * 3;
      }
    }

    console.log('Sending dashboard stats:', {
      clockedIn,
      onBreak,
      late,
      revenue,
      todayShiftsCount: todayShifts.length
    });

    res.json({
      stats: {
        clockedIn,
        onBreak,
        late,
        revenue: Number(revenue.toFixed(2))
      }
    });
  });

  // Dashboard employee status route
  app.get("/api/dashboard/employee-status", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    const branchId = req.user!.branchId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all active employees in the branch
    const allEmployees = await storage.getUsersByBranch(branchId);
    const employees = allEmployees.filter(user => user.isActive);

    // Get today's shifts for the branch
    const todayShifts = await storage.getShiftsByBranch(branchId, today, tomorrow);

    // Build employee status list
    const employeeStatus = await Promise.all(
      employees.map(async (user) => {
        // Find today's shift for this employee
        const todayShift = todayShifts.find(shift => shift.userId === user.id);

        let status = 'Off Duty';
        let statusInfo = '';

        if (todayShift) {
          if (todayShift.status === 'in-progress') {
            status = 'Clocked In';
            statusInfo = `Since ${format(new Date(todayShift.actualStartTime!), "h:mm a")}`;
          } else if (todayShift.status === 'completed') {
            status = 'Completed';
            statusInfo = `Worked ${format(new Date(todayShift.actualStartTime!), "h:mm a")} - ${format(new Date(todayShift.actualEndTime!), "h:mm a")}`;
          } else if (todayShift.status === 'scheduled') {
            status = 'Scheduled';
            statusInfo = `${format(new Date(todayShift.startTime), "h:mm a")} - ${format(new Date(todayShift.endTime), "h:mm a")}`;
          }
        }

        return {
          user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            position: user.position,
          },
          status,
          statusInfo,
        };
      })
    );

    res.json({ employeeStatus });
  });

  // Time off request routes
  app.get("/api/time-off-requests", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const branchId = req.user!.branchId;

    let requests;

    // Managers get all requests from their branch, employees get only their own
    if (userRole === 'manager') {
      // Get all employees in the branch
      const employees = await storage.getUsersByBranch(branchId);
      const employeeIds = employees.map(emp => emp.id);

      // Get all requests from branch employees
      const allRequests = await Promise.all(
        employeeIds.map(empId => storage.getTimeOffRequestsByUser(empId))
      );
      requests = allRequests.flat();
    } else {
      requests = await storage.getTimeOffRequestsByUser(userId);
    }

    // Get user details for each request
    const requestsWithUsers = await Promise.all(
      requests.map(async (request) => {
        const user = await storage.getUser(request.userId);
        return { ...request, user };
      })
    );

    res.json({ requests: requestsWithUsers });
  });

  // Employee analytics endpoint
  app.get("/api/employee/performance", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get last 6 months of data
    const monthlyData = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);

      // Get shifts for this month
      const shifts = await storage.getShiftsByUser(userId, monthStart, monthEnd);

      // Calculate hours
      let hours = 0;
      for (const shift of shifts) {
        const shiftHours = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60);
        hours += shiftHours;
      }

      // Calculate estimated sales (3x labor cost)
      const sales = hours * parseFloat(user.hourlyRate) * 3;

      monthlyData.push({
        name: monthDate.toLocaleDateString('en-US', { month: 'short' }),
        hours: Number(hours.toFixed(2)),
        sales: Number(sales.toFixed(2)),
      });
    }

    // Get current month stats
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const currentMonthShifts = await storage.getShiftsByUser(userId, currentMonthStart, currentMonthEnd);

    let currentMonthHours = 0;
    for (const shift of currentMonthShifts) {
      const shiftHours = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60);
      currentMonthHours += shiftHours;
    }

    const completedShifts = currentMonthShifts.filter(s => s.status === 'completed').length;
    const totalShifts = currentMonthShifts.length;
    const completionRate = totalShifts > 0 ? (completedShifts / totalShifts) * 100 : 0;

    res.json({
      monthlyData,
      currentMonth: {
        hours: Number(currentMonthHours.toFixed(2)),
        sales: Number((currentMonthHours * parseFloat(user.hourlyRate) * 3).toFixed(2)),
        shiftsCompleted: completedShifts,
        totalShifts: totalShifts,
        completionRate: Number(completionRate.toFixed(1)),
      }
    });
  });

  // Time off balance endpoint
  app.get("/api/time-off-balance", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    const requests = await storage.getTimeOffRequestsByUser(userId);

    // Calculate used days for each type this year
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);

    let vacationUsed = 0;
    let sickUsed = 0;
    let personalUsed = 0;

    for (const request of requests) {
      if (request.status === 'approved') {
        const startDate = new Date(request.startDate);
        const endDate = new Date(request.endDate);

        // Only count requests in current year
        if (startDate >= yearStart && startDate <= yearEnd) {
          // Calculate days (inclusive)
          const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

          if (request.type === 'vacation') {
            vacationUsed += days;
          } else if (request.type === 'sick') {
            sickUsed += days;
          } else if (request.type === 'personal') {
            personalUsed += days;
          }
        }
      }
    }

    // Standard allowances (can be customized per employee in the future)
    const vacationAllowance = 15; // 15 days per year
    const sickAllowance = 10; // 10 days per year
    const personalAllowance = 5; // 5 days per year

    res.json({
      vacation: vacationAllowance - vacationUsed,
      sick: sickAllowance - sickUsed,
      personal: personalAllowance - personalUsed,
      used: {
        vacation: vacationUsed,
        sick: sickUsed,
        personal: personalUsed,
      },
      allowance: {
        vacation: vacationAllowance,
        sick: sickAllowance,
        personal: personalAllowance,
      }
    });
  });

  app.post("/api/time-off-requests", requireAuth, async (req, res) => {
    try {
      console.log('Creating time off request with data:', req.body);
      const requestData = insertTimeOffRequestSchema.parse(req.body);

      // Validate 3-day advance notice requirement
      const startDate = new Date(requestData.startDate);
      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      // Reset time components for date comparison
      startDate.setHours(0, 0, 0, 0);
      threeDaysFromNow.setHours(0, 0, 0, 0);

      if (startDate < threeDaysFromNow) {
        return res.status(400).json({
          message: "Time off requests must be submitted at least 3 days in advance. Please select a start date that is at least 3 days from today."
        });
      }

      const request = await storage.createTimeOffRequest({
        ...requestData,
        userId: req.user!.id,
      });

      // Get the employee who made the request
      const employee = await storage.getUser(req.user!.id);

      // Get all managers in the branch to notify them
      const branchUsers = await storage.getUsersByBranch(req.user!.branchId);
      const managers = branchUsers.filter(user => user.role === 'manager');

      // Create notifications for all managers
      for (const manager of managers) {
        await storage.createNotification({
          userId: manager.id,
          type: 'schedule',
          title: 'New Time Off Request',
          message: `${employee?.firstName} ${employee?.lastName} has requested time off from ${format(new Date(request.startDate), "MMM d")} to ${format(new Date(request.endDate), "MMM d, yyyy")} (${requestData.type})`,
          data: JSON.stringify({
            requestId: request.id,
            employeeId: req.user!.id,
            type: requestData.type,
            startDate: request.startDate,
            endDate: request.endDate
          })
        } as any);
      }

      res.json({ request });
    } catch (error: any) {
      console.error('Time off request creation error:', error);
      if (error.errors) {
        // Zod validation error
        res.status(400).json({
          message: "Invalid time off request data",
          errors: error.errors
        });
      } else {
        res.status(400).json({
          message: error.message || "Invalid time off request data"
        });
      }
    }
  });

  app.put("/api/time-off-requests/:id/approve", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    const { id } = req.params;
    const request = await storage.updateTimeOffRequest(id, {
      status: "approved",
      approvedBy: req.user!.id,
    });

    if (!request) {
      return res.status(404).json({ message: "Time off request not found" });
    }

    // Create notification for employee
    await storage.createNotification({
      userId: request.userId,
      type: 'schedule',
      title: 'Time Off Request Approved',
      message: `Your time off request from ${format(new Date(request.startDate), "MMM d")} to ${format(new Date(request.endDate), "MMM d, yyyy")} has been approved`,
      data: JSON.stringify({
        requestId: request.id,
        status: 'approved'
      })
    } as any);

    res.json({ request });
  });

  app.put("/api/time-off-requests/:id/reject", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    const { id } = req.params;
    const request = await storage.updateTimeOffRequest(id, {
      status: "rejected",
      approvedBy: req.user!.id,
    });

    if (!request) {
      return res.status(404).json({ message: "Time off request not found" });
    }

    // Create notification for employee
    await storage.createNotification({
      userId: request.userId,
      type: 'schedule',
      title: 'Time Off Request Rejected',
      message: `Your time off request from ${format(new Date(request.startDate), "MMM d")} to ${format(new Date(request.endDate), "MMM d, yyyy")} has been rejected`,
      data: JSON.stringify({
        requestId: request.id,
        status: 'rejected'
      })
    } as any);

    res.json({ request });
  });

  // Notification routes
  app.get("/api/notifications", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    const notifications = await storage.getNotificationsByUser(userId);

    res.json({ notifications });
  });

  app.put("/api/notifications/:id/read", requireAuth, async (req, res) => {
    const { id } = req.params;
    const userId = req.user!.id;

    const notification = await storage.updateNotification(id, { isRead: true });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({ notification });
  });

  app.put("/api/notifications/read-all", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    await storage.markAllNotificationsAsRead(userId);

    res.json({ message: "All notifications marked as read" });
  });

  app.delete("/api/notifications/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const userId = req.user!.id;

    const deleted = await storage.deleteNotification(id, userId);

    if (!deleted) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({ message: "Notification deleted successfully" });
  });

  // Blockchain payroll record storage
  app.post("/api/blockchain/payroll/store", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    try {
      const { payrollEntryId } = req.body;

      if (!payrollEntryId) {
        return res.status(400).json({ message: "Payroll entry ID is required" });
      }

      // Get payroll entry details
      const userId = req.user!.id;
      const entries = await storage.getPayrollEntriesByUser(userId);
      const entry = entries.find(e => e.id === payrollEntryId);

      if (!entry) {
        return res.status(404).json({ message: "Payroll entry not found" });
      }

      // Get user details
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prepare blockchain record
      const blockchainRecord = {
        id: entry.id,
        employeeId: user.id,
        employeeName: `${user.firstName} ${user.lastName}`,
        periodStart: entry.createdAt.toISOString(),
        periodEnd: entry.createdAt.toISOString(),
        totalHours: parseFloat(entry.totalHours),
        regularHours: parseFloat(entry.regularHours),
        overtimeHours: parseFloat(entry.overtimeHours || "0"),
        hourlyRate: parseFloat(user.hourlyRate),
        grossPay: parseFloat(entry.grossPay),
        deductions: parseFloat(entry.deductions || "0"),
        netPay: parseFloat(entry.netPay),
      };

      // Store on blockchain
      const result = await blockchainService.storePayrollRecord(blockchainRecord);

      // Update database with blockchain details
      await storage.updatePayrollEntry(payrollEntryId, {
        blockchainHash: result.blockchainHash,
        blockNumber: result.blockNumber,
        transactionHash: result.transactionHash,
        verified: true,
      });

      res.json({
        message: "Payroll record stored on blockchain successfully",
        blockchainRecord: result,
      });
    } catch (error: any) {
      console.error('Blockchain storage error:', error);
      res.status(500).json({
        message: error.message || "Failed to store payroll record on blockchain"
      });
    }
  });

  // Blockchain record verification
  app.post("/api/blockchain/payroll/verify", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    try {
      const { payrollEntryId } = req.body;

      if (!payrollEntryId) {
        return res.status(400).json({ message: "Payroll entry ID is required" });
      }

      // Get payroll entry
      const userId = req.user!.id;
      const entries = await storage.getPayrollEntriesByUser(userId);
      const entry = entries.find(e => e.id === payrollEntryId);

      if (!entry) {
        return res.status(404).json({ message: "Payroll entry not found" });
      }

      if (!entry.blockchainHash) {
        return res.status(400).json({ message: "Payroll entry not stored on blockchain" });
      }

      // Verify against blockchain
      const verification = await blockchainService.verifyPayrollRecord(payrollEntryId, entry.blockchainHash);

      res.json({
        message: "Payroll record verification completed",
        verification,
      });
    } catch (error: any) {
      console.error('Blockchain verification error:', error);
      res.status(500).json({
        message: error.message || "Failed to verify payroll record"
      });
    }
  });

  // Get blockchain record details
  app.get("/api/blockchain/record/:transactionHash", requireAuth, async (req, res) => {
    try {
      const { transactionHash } = req.params;

      const record = await blockchainService.getBlockchainRecord(transactionHash);

      res.json({ record });
    } catch (error: any) {
      console.error('Blockchain record lookup error:', error);
      res.status(500).json({
        message: error.message || "Failed to get blockchain record"
      });
    }
  });

  // Batch blockchain storage for multiple payroll records
  app.post("/api/blockchain/payroll/batch-store", requireAuth, requireRole(["manager", "admin"]), async (req, res) => {
    try {
      const { payrollEntryIds } = req.body;

      if (!Array.isArray(payrollEntryIds)) {
        return res.status(400).json({ message: "payrollEntryIds must be an array" });
      }

      const userId = req.user!.id;
      const entries = await storage.getPayrollEntriesByUser(userId);
      const selectedEntries = entries.filter(e => payrollEntryIds.includes(e.id));

      if (selectedEntries.length === 0) {
        return res.status(404).json({ message: "No valid payroll entries found" });
      }

      // Get user details for all entries
      const users = await Promise.all(
        selectedEntries.map(async (entry) => await storage.getUser(entry.userId))
      );

      // Prepare blockchain records
      const blockchainRecords = selectedEntries.map((entry, index) => {
        const user = users[index];
        if (!user) throw new Error(`User not found for entry ${entry.id}`);

        return {
          id: entry.id,
          employeeId: user.id,
          employeeName: `${user.firstName} ${user.lastName}`,
          periodStart: entry.createdAt.toISOString(),
          periodEnd: entry.createdAt.toISOString(),
          totalHours: parseFloat(entry.totalHours),
          regularHours: parseFloat(entry.regularHours),
          overtimeHours: parseFloat(entry.overtimeHours || "0"),
          hourlyRate: parseFloat(user.hourlyRate),
          grossPay: parseFloat(entry.grossPay),
          deductions: parseFloat(entry.deductions || "0"),
          netPay: parseFloat(entry.netPay),
        };
      });

      // Batch store on blockchain
      const results = await blockchainService.batchStorePayrollRecords(blockchainRecords);

      // Update database with blockchain details
      for (const result of results) {
        await storage.updatePayrollEntry(result.id, {
          blockchainHash: result.blockchainHash,
          blockNumber: result.blockNumber,
          transactionHash: result.transactionHash,
          verified: true,
        });
      }

      res.json({
        message: `${results.length} payroll records stored on blockchain successfully`,
        storedCount: results.length,
        results,
      });
    } catch (error: any) {
      console.error('Batch blockchain storage error:', error);
      res.status(500).json({
        message: error.message || "Failed to store payroll records on blockchain"
      });
    }
  });

  // Create and start the server
  const httpServer = createServer(app);

  return httpServer;
}
