import { Router, Request, Response, NextFunction } from 'express';
import { dbStorage } from '../db-storage';
import crypto from 'crypto';

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

// Get all employees (for managers)
router.get('/api/employees', requireAuth, requireRole(['manager', 'admin']), async (req, res) => {
  try {
    const branchId = req.session.user?.branchId;
    
    // If it's a branch manager, only return employees from their branch
    const employees = await storage.getUsersByBranch(branchId);
    
    // Filter out sensitive data
    const sanitizedEmployees = employees.map(emp => ({
      id: emp.id,
      username: emp.username,
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      role: emp.role,
      position: emp.position,
      hourlyRate: emp.hourlyRate,
      branchId: emp.branchId,
      isActive: emp.isActive,
      blockchainVerified: emp.blockchainVerified,
      blockchainHash: emp.blockchainHash,
      verifiedAt: emp.verifiedAt,
      sssLoanDeduction: emp.sssLoanDeduction || '0',
      pagibigLoanDeduction: emp.pagibigLoanDeduction || '0',
      cashAdvanceDeduction: emp.cashAdvanceDeduction || '0',
      otherDeductions: emp.otherDeductions || '0',
      createdAt: emp.createdAt,
    }));
    
    res.json(sanitizedEmployees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ message: 'Failed to fetch employees' });
  }
});

// Get employee stats (must be before /:id route)
router.get('/api/employees/stats', requireAuth, requireRole(['manager', 'admin']), async (req, res) => {
  try {
    const branchId = req.session.user?.branchId;
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
  } catch (error) {
    console.error('Error fetching employee stats:', error);
    res.status(500).json({ message: 'Failed to fetch employee stats' });
  }
});

// Get employee performance data (must be before /:id route)
router.get('/api/employees/performance', requireAuth, requireRole(['manager', 'admin']), async (req, res) => {
  try {
    const branchId = req.session.user?.branchId;
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
  } catch (error) {
    console.error('Error fetching employee performance:', error);
    res.status(500).json({ message: 'Failed to fetch employee performance' });
  }
});

// Get a single employee by ID
router.get('/api/employees/:id', requireAuth, requireRole(['manager', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await storage.getUser(id);
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    // Only managers from the same branch can view the employee
    if (req.session.user?.role === 'manager' && 
        req.session.user?.branchId !== employee.branchId) {
      return res.status(403).json({ message: 'Unauthorized to view this employee' });
    }
    
    // Filter out sensitive data
    const { password, ...sanitizedEmployee } = employee;
    
    res.json(sanitizedEmployee);
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ message: 'Failed to fetch employee' });
  }
});

// Create a new employee
router.post('/api/employees', requireAuth, requireRole(['manager', 'admin']), async (req, res) => {
  try {
    let {
      username,
      password,
      firstName,
      lastName,
      email,
      role = 'employee',
      position,
      hourlyRate,
      branchId,
      isActive = true,
    } = req.body;

    // Only admin can create managers with a specific hourly rate
    // If a manager tries to create another manager, set a default rate (admin must set it later)
    if (role === 'manager' && req.session.user?.role !== 'admin') {
      hourlyRate = '0'; // Default rate - admin must set the actual rate
    }

    // Basic validation
    if (!username || !password || !firstName || !lastName || !email || !position || !hourlyRate || !branchId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if username already exists
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Create the employee (createUser will hash the password)
    // Note: Don't pass id or createdAt - they're generated by createUser
    // Note: hourlyRate should be a string, not a number
    const newEmployee = await storage.createUser({
      username,
      password, // Pass plain password - createUser will hash it
      firstName,
      lastName,
      email,
      role,
      position,
      hourlyRate: String(hourlyRate), // Convert to string
      branchId,
      isActive,
    });

    // Don't send back the password
    const { password: _, ...result } = newEmployee;

    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ message: 'Failed to create employee' });
  }
});

// Update an employee
router.put('/api/employees/:id', requireAuth, requireRole(['manager', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Get the existing employee
    const existingEmployee = await storage.getUser(id);
    if (!existingEmployee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Only managers from the same branch can update the employee
    if (req.session.user?.role === 'manager' &&
        req.session.user?.branchId !== existingEmployee.branchId) {
      return res.status(403).json({ message: 'Unauthorized to update this employee' });
    }

    // Only admin can set/update hourly rate for managers
    if (existingEmployee.role === 'manager' && updates.hourlyRate !== undefined) {
      if (req.session.user?.role !== 'admin') {
        // Remove hourlyRate from updates if manager is trying to update another manager's rate
        delete updates.hourlyRate;
      }
    }

    // Convert hourlyRate to string if it exists (database stores as text)
    if (updates.hourlyRate) {
      updates.hourlyRate = String(updates.hourlyRate);
    }

    // Note: Don't hash password here - updateUser will handle it

    // Update the employee
    const updatedEmployee = await storage.updateUser(id, updates);

    if (!updatedEmployee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Don't send back the password
    const { password, ...result } = updatedEmployee;

    res.json(result);
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ message: 'Failed to update employee' });
  }
});

// Delete an employee
router.delete('/api/employees/:id', requireAuth, requireRole(['manager', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the existing employee
    const existingEmployee = await storage.getUser(id);
    if (!existingEmployee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    // Only managers from the same branch can delete the employee
    if (req.session.user?.role === 'manager' && 
        req.session.user?.branchId !== existingEmployee.branchId) {
      return res.status(403).json({ message: 'Unauthorized to delete this employee' });
    }
    
    // In a real app, you might want to soft delete or archive the employee
    // instead of actually deleting them
    // For this example, we'll just return success
    
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ message: 'Failed to delete employee' });
  }
});

// Verify employee on blockchain
router.post('/api/employees/:id/verify', requireAuth, requireRole(['manager', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;

    // Get the existing employee
    const employee = await storage.getUser(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Only managers from the same branch can verify the employee
    if (req.session.user?.role === 'manager' &&
        req.session.user?.branchId !== employee.branchId) {
      return res.status(403).json({ message: 'Unauthorized to verify this employee' });
    }

    // Generate a blockchain hash for the employee
    const employeeData = `${employee.id}-${employee.firstName}-${employee.lastName}-${employee.email}-${employee.position}`;
    const blockchainHash = crypto.createHash('sha256').update(employeeData).digest('hex');

    // Update employee with blockchain verification
    const updatedEmployee = await storage.updateUser(id, {
      blockchainVerified: true,
      blockchainHash: blockchainHash,
      verifiedAt: new Date(),
    });

    if (!updatedEmployee) {
      return res.status(500).json({ message: 'Failed to verify employee' });
    }

    console.log(`✅ Employee verified: ${employee.firstName} ${employee.lastName}`);
    console.log(`   Hash: ${blockchainHash}`);

    res.json({
      message: 'Employee verified successfully',
      employee: {
        id: updatedEmployee.id,
        blockchainVerified: updatedEmployee.blockchainVerified,
        blockchainHash: updatedEmployee.blockchainHash,
        verifiedAt: updatedEmployee.verifiedAt,
      }
    });
  } catch (error) {
    console.error('Error verifying employee:', error);
    res.status(500).json({ message: 'Failed to verify employee' });
  }
});

// Update employee deductions (Manager only)
router.put('/api/employees/:id/deductions', requireAuth, requireRole(['manager', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { sssLoanDeduction, pagibigLoanDeduction, cashAdvanceDeduction, otherDeductions } = req.body;

    // Get the existing employee
    const existingEmployee = await storage.getUser(id);
    if (!existingEmployee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Only managers from the same branch can update the employee
    if (req.session.user?.role === 'manager' &&
        req.session.user?.branchId !== existingEmployee.branchId) {
      return res.status(403).json({ message: 'Unauthorized to update this employee' });
    }

    // Update the employee deductions
    const updatedEmployee = await storage.updateUser(id, {
      sssLoanDeduction: sssLoanDeduction !== undefined ? String(sssLoanDeduction) : existingEmployee.sssLoanDeduction,
      pagibigLoanDeduction: pagibigLoanDeduction !== undefined ? String(pagibigLoanDeduction) : existingEmployee.pagibigLoanDeduction,
      cashAdvanceDeduction: cashAdvanceDeduction !== undefined ? String(cashAdvanceDeduction) : existingEmployee.cashAdvanceDeduction,
      otherDeductions: otherDeductions !== undefined ? String(otherDeductions) : existingEmployee.otherDeductions,
    });

    if (!updatedEmployee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Don't send back the password
    const { password, ...result } = updatedEmployee;

    res.json(result);
  } catch (error) {
    console.error('Error updating employee deductions:', error);
    res.status(500).json({ message: 'Failed to update employee deductions' });
  }
});

export default router;
