import { sql as sqlite, dbPath } from './db';
import * as readline from 'readline';
import * as fs from 'fs';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

/**
 * Prompt user for database choice
 */
export async function promptDatabaseChoice(): Promise<'fresh' | 'continue' | 'sample'> {
  // Check if database file exists
  const dbExists = fs.existsSync(dbPath);

  if (!dbExists) {
    console.log('\n📊 No existing database found. Creating a new database...\n');
    return 'fresh';
  }

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log('\n' + '='.repeat(70));
    console.log('🗄️  DATABASE STARTUP OPTIONS');
    console.log('='.repeat(70));
    console.log('\n📊 Existing database found at:', dbPath);
    console.log('\nChoose an option:');
    console.log('  [1] Continue with existing database (keep all data)');
    console.log('  [2] Start fresh (delete all data and reset)');
    console.log('  [3] Load sample data (showcase features with demo data)');
    console.log('\n' + '='.repeat(70));

    rl.question('\nEnter your choice (1, 2, or 3): ', (answer) => {
      rl.close();

      const choice = answer.trim();

      if (choice === '2') {
        console.log('\n⚠️  WARNING: This will delete ALL existing data!');
        const confirmRl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        confirmRl.question('Are you sure? Type "yes" to confirm: ', (confirm) => {
          confirmRl.close();

          if (confirm.trim().toLowerCase() === 'yes') {
            console.log('\n🗑️  Deleting existing database...');
            resolve('fresh');
          } else {
            console.log('\n✅ Cancelled. Continuing with existing database...');
            resolve('continue');
          }
        });
      } else if (choice === '3') {
        console.log('\n⚠️  WARNING: This will delete ALL existing data and load sample data!');
        const confirmRl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        confirmRl.question('Are you sure? Type "yes" to confirm: ', (confirm) => {
          confirmRl.close();

          if (confirm.trim().toLowerCase() === 'yes') {
            console.log('\n📦 Loading sample data...');
            resolve('sample');
          } else {
            console.log('\n✅ Cancelled. Continuing with existing database...');
            resolve('continue');
          }
        });
      } else {
        console.log('\n✅ Continuing with existing database...');
        resolve('continue');
      }
    });
  });
}

/**
 * Delete the database file
 * Note: After calling this, the database connection will be closed.
 * A new connection will be created when the database is initialized again.
 */
export function deleteDatabaseFile(): void {
  try {
    if (fs.existsSync(dbPath)) {
      // Close the database connection first
      try {
        sqlite.close();
        console.log('🔌 Database connection closed');
      } catch (e) {
        // Ignore if already closed
        console.log('⚠️  Database connection was already closed');
      }

      // Wait a bit for file locks to be released
      const startTime = Date.now();
      let deleted = false;

      while (!deleted && Date.now() - startTime < 3000) {
        try {
          fs.unlinkSync(dbPath);
          deleted = true;
          console.log('✅ Database file deleted successfully');
        } catch (e: any) {
          if (e.code === 'EBUSY' || e.code === 'EACCES') {
            // File is still locked, wait a bit and retry
            const now = Date.now();
            while (Date.now() - now < 100) {
              // Busy wait for 100ms
            }
          } else {
            throw e;
          }
        }
      }

      if (!deleted) {
        throw new Error('Failed to delete database file after multiple attempts');
      }
    }
  } catch (error) {
    console.error('❌ Error deleting database file:', error);
    throw error;
  }
}

/**
 * Get database statistics
 */
export function getDatabaseStats(): any {
  try {
    const stats: any = {
      exists: fs.existsSync(dbPath),
      path: dbPath,
    };

    if (stats.exists) {
      const fileStats = fs.statSync(dbPath);
      stats.size = fileStats.size;
      stats.sizeFormatted = formatBytes(fileStats.size);
      stats.created = fileStats.birthtime;
      stats.modified = fileStats.mtime;

      // Get table counts
      try {
        const tables = [
          'users',
          'branches',
          'shifts',
          'shift_trades',
          'payroll_periods',
          'payroll_entries',
          'approvals',
          'time_off_requests',
          'notifications'
        ];

        stats.tables = {};
        for (const table of tables) {
          try {
            const result = sqlite.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
            stats.tables[table] = result.count;
          } catch (e) {
            stats.tables[table] = 'N/A';
          }
        }
      } catch (e) {
        console.error('Error getting table counts:', e);
      }
    }

    return stats;
  } catch (error) {
    console.error('Error getting database stats:', error);
    return { exists: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Display database statistics
 */
export function displayDatabaseStats(): void {
  const stats = getDatabaseStats();

  console.log('\n' + '='.repeat(70));
  console.log('📊 DATABASE STATISTICS');
  console.log('='.repeat(70));

  if (!stats.exists) {
    console.log('\n❌ Database does not exist');
    return;
  }

  console.log(`\n📁 File: ${stats.path}`);
  console.log(`📏 Size: ${stats.sizeFormatted}`);
  console.log(`📅 Created: ${stats.created}`);
  console.log(`🔄 Modified: ${stats.modified}`);

  if (stats.tables) {
    console.log('\n📋 Table Records:');
    for (const [table, count] of Object.entries(stats.tables)) {
      console.log(`   ${table.padEnd(20)} : ${count}`);
    }
  }

  console.log('\n' + '='.repeat(70) + '\n');
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Load sample data into the database
 */
export async function loadSampleData(): Promise<void> {
  try {
    console.log('\n📦 Loading sample data...\n');

    // Hash password for all users (password123)
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Mark setup as complete first
    const setupId = 'setup-status-1';
    sqlite.prepare(`
      INSERT INTO setup_status (id, is_setup_complete, setup_completed_at)
      VALUES (?, ?, ?)
    `).run(setupId, 1, Math.floor(Date.now() / 1000));

    // Sample branch
    const branchId = 'branch-sample-1';
    sqlite.prepare(`
      INSERT INTO branches (id, name, address, phone, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(branchId, 'Downtown Cafe', '123 Main St, Downtown', '(555) 123-4567', 1, Math.floor(Date.now() / 1000));

    // Sample manager (auto-verified on blockchain)
    const managerId = 'user-manager-1';
    const managerData = `${managerId}-Sarah-Johnson-sarah@thecafe.com-Store Manager`;
    const managerHash = crypto.createHash('sha256').update(managerData).digest('hex');

    sqlite.prepare(`
      INSERT INTO users (id, username, password, first_name, last_name, email, role, position, hourly_rate, branch_id, is_active, blockchain_verified, blockchain_hash, verified_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(managerId, 'sarah', hashedPassword, 'Sarah', 'Johnson', 'sarah@thecafe.com', 'manager', 'Store Manager', '25.00', branchId, 1, 1, managerHash, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000));

    // Sample employees
    const employees = [
      { id: 'user-emp-1', username: 'john', name: 'John', lastName: 'Smith', email: 'john@thecafe.com', position: 'Barista', rate: '15.00' },
      { id: 'user-emp-2', username: 'jane', name: 'Jane', lastName: 'Doe', email: 'jane@thecafe.com', position: 'Cashier', rate: '14.50' },
      { id: 'user-emp-3', username: 'mike', name: 'Mike', lastName: 'Wilson', email: 'mike@thecafe.com', position: 'Chef', rate: '18.00' },
      { id: 'user-emp-4', username: 'emma', name: 'Emma', lastName: 'Brown', email: 'emma@thecafe.com', position: 'Barista', rate: '15.50' },
    ];

    for (const emp of employees) {
      sqlite.prepare(`
        INSERT INTO users (id, username, password, first_name, last_name, email, role, position, hourly_rate, branch_id, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(emp.id, emp.username, hashedPassword, emp.name, emp.lastName, emp.email, 'employee', emp.position, emp.rate, branchId, 1, Math.floor(Date.now() / 1000));
    }

    // Sample shifts for this week
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (let i = 0; i < 7; i++) {
      const shiftDate = new Date(today);
      shiftDate.setDate(shiftDate.getDate() + i);

      // Skip Sundays
      if (shiftDate.getDay() === 0) continue;

      for (let empIdx = 0; empIdx < employees.length; empIdx++) {
        const shiftId = `shift-${i}-${empIdx}`;
        const startTime = new Date(shiftDate);
        startTime.setHours(9, 0, 0, 0);
        const endTime = new Date(shiftDate);
        endTime.setHours(17, 0, 0, 0);

        sqlite.prepare(`
          INSERT INTO shifts (id, user_id, branch_id, start_time, end_time, position, is_recurring, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          shiftId,
          employees[empIdx].id,
          branchId,
          Math.floor(startTime.getTime() / 1000),
          Math.floor(endTime.getTime() / 1000),
          employees[empIdx].position,
          0,
          'scheduled',
          Math.floor(Date.now() / 1000)
        );
      }
    }

    // Sample payroll period
    const periodStart = new Date(today);
    periodStart.setDate(periodStart.getDate() - periodStart.getDay() + 1); // Start of week
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 6); // End of week

    const periodId = 'period-sample-1';
    sqlite.prepare(`
      INSERT INTO payroll_periods (id, branch_id, start_date, end_date, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      periodId,
      branchId,
      Math.floor(periodStart.getTime() / 1000),
      Math.floor(periodEnd.getTime() / 1000),
      'open',
      Math.floor(Date.now() / 1000)
    );

    // Sample Shift Drop Requests (to demonstrate the feature)
    // Create shifts for 5-7 days from now for drop requests
    const dropRequestShifts = [];
    for (let i = 5; i <= 7; i++) {
      const shiftDate = new Date(today);
      shiftDate.setDate(shiftDate.getDate() + i);

      for (let empIdx = 0; empIdx < 2; empIdx++) {
        const shiftId = `shift-drop-${i}-${empIdx}`;
        const startTime = new Date(shiftDate);
        startTime.setHours(9, 0, 0, 0);
        const endTime = new Date(shiftDate);
        endTime.setHours(17, 0, 0, 0);

        sqlite.prepare(`
          INSERT INTO shifts (id, user_id, branch_id, start_time, end_time, position, is_recurring, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          shiftId,
          employees[empIdx].id,
          branchId,
          Math.floor(startTime.getTime() / 1000),
          Math.floor(endTime.getTime() / 1000),
          employees[empIdx].position,
          0,
          'scheduled',
          Math.floor(Date.now() / 1000)
        );

        dropRequestShifts.push({ shiftId, empId: employees[empIdx].id, date: shiftDate });
      }
    }

    // Create sample shift drop requests in various states
    // 1. Pending request from John (waiting for manager approval)
    sqlite.prepare(`
      INSERT INTO shift_drop_requests (id, shift_id, user_id, reason, status, urgency, requested_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'drop-req-1',
      dropRequestShifts[0].shiftId,
      dropRequestShifts[0].empId,
      'I have a doctor appointment that day and cannot reschedule.',
      'pending',
      'normal',
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    );

    // 2. Approved request from Jane (available for pickup)
    sqlite.prepare(`
      INSERT INTO shift_drop_requests (id, shift_id, user_id, reason, status, urgency, resolved_by, resolved_at, manager_notes, requested_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'drop-req-2',
      dropRequestShifts[1].shiftId,
      dropRequestShifts[1].empId,
      'Family emergency - need to travel out of town.',
      'approved',
      'urgent',
      managerId,
      Math.floor(Date.now() / 1000),
      'Approved due to family emergency. Please find coverage.',
      Math.floor((Date.now() - 86400000) / 1000), // Requested yesterday
      Math.floor((Date.now() - 86400000) / 1000)
    );

    // 3. Rejected request from John (must work the shift)
    sqlite.prepare(`
      INSERT INTO shift_drop_requests (id, shift_id, user_id, reason, status, urgency, resolved_by, resolved_at, manager_notes, requested_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'drop-req-3',
      dropRequestShifts[2].shiftId,
      dropRequestShifts[2].empId,
      'Want to attend a concert.',
      'rejected',
      'low',
      managerId,
      Math.floor(Date.now() / 1000),
      'Sorry, we are short-staffed that day. Please work your shift.',
      Math.floor((Date.now() - 172800000) / 1000), // Requested 2 days ago
      Math.floor((Date.now() - 172800000) / 1000)
    );

    // 4. Picked up request (completed flow)
    sqlite.prepare(`
      INSERT INTO shift_drop_requests (id, shift_id, user_id, reason, status, urgency, resolved_by, resolved_at, manager_notes, picked_up_by, picked_up_at, requested_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'drop-req-4',
      dropRequestShifts[3].shiftId,
      dropRequestShifts[3].empId,
      'Need to attend a wedding.',
      'picked_up',
      'normal',
      managerId,
      Math.floor((Date.now() - 86400000) / 1000),
      'Approved. Mike has agreed to cover.',
      employees[2].id, // Mike picked it up
      Math.floor(Date.now() / 1000),
      Math.floor((Date.now() - 172800000) / 1000),
      Math.floor((Date.now() - 172800000) / 1000)
    );

    // Create sample notifications for the drop requests
    sqlite.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'notif-drop-1',
      managerId,
      'shift_drop_request',
      'New Shift Drop Request',
      'John Smith has requested to drop their shift. Please review.',
      0,
      Math.floor(Date.now() / 1000)
    );

    sqlite.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'notif-drop-2',
      employees[0].id, // John
      'shift_drop_rejected',
      'Shift Drop Request Rejected',
      'Your request to drop the shift has been rejected. You are required to work.',
      0,
      Math.floor(Date.now() / 1000)
    );

    sqlite.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'notif-drop-3',
      employees[2].id, // Mike
      'shift_available',
      'Shift Available for Pickup',
      'A shift is now available for pickup. Check the Shift Trading page.',
      0,
      Math.floor(Date.now() / 1000)
    );

    // ==================== TIME OFF REQUESTS ====================
    const timeOffStartDate1 = new Date(today);
    timeOffStartDate1.setDate(timeOffStartDate1.getDate() + 10); // 10 days from now
    const timeOffEndDate1 = new Date(timeOffStartDate1);
    timeOffEndDate1.setDate(timeOffEndDate1.getDate() + 2);

    const timeOffStartDate2 = new Date(today);
    timeOffStartDate2.setDate(timeOffStartDate2.getDate() + 14); // 14 days from now
    const timeOffEndDate2 = new Date(timeOffStartDate2);
    timeOffEndDate2.setDate(timeOffEndDate2.getDate() + 4);

    const timeOffStartDate3 = new Date(today);
    timeOffStartDate3.setDate(timeOffStartDate3.getDate() + 7); // 7 days from now

    // Pending time off request from John
    sqlite.prepare(`
      INSERT INTO time_off_requests (id, user_id, start_date, end_date, type, reason, status, requested_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'timeoff-1',
      employees[0].id, // John
      Math.floor(timeOffStartDate1.getTime() / 1000),
      Math.floor(timeOffEndDate1.getTime() / 1000),
      'vacation',
      'Family vacation planned months ago. Would appreciate the time off.',
      'pending',
      Math.floor(Date.now() / 1000)
    );

    // Approved time off request from Emma
    sqlite.prepare(`
      INSERT INTO time_off_requests (id, user_id, start_date, end_date, type, reason, status, approved_by, approved_at, requested_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'timeoff-2',
      employees[3].id, // Emma
      Math.floor(timeOffStartDate2.getTime() / 1000),
      Math.floor(timeOffEndDate2.getTime() / 1000),
      'personal',
      'Attending a wedding out of state.',
      'approved',
      managerId,
      Math.floor(Date.now() / 1000),
      Math.floor((Date.now() - 86400000) / 1000) // Requested yesterday
    );

    // Rejected time off request from Mike
    sqlite.prepare(`
      INSERT INTO time_off_requests (id, user_id, start_date, end_date, type, reason, status, approved_by, approved_at, requested_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'timeoff-3',
      employees[2].id, // Mike
      Math.floor(timeOffStartDate3.getTime() / 1000),
      Math.floor(timeOffStartDate3.getTime() / 1000),
      'personal',
      'Want to go to a game.',
      'rejected',
      managerId,
      Math.floor(Date.now() / 1000),
      Math.floor((Date.now() - 172800000) / 1000) // Requested 2 days ago
    );

    // Time off notification for manager
    sqlite.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'notif-timeoff-1',
      managerId,
      'time_off_request',
      'New Time Off Request',
      'John Smith has requested time off. Please review.',
      0,
      Math.floor(Date.now() / 1000)
    );

    // ==================== SHIFT TRADES ====================
    // Create shifts for shift trades (8+ days from now)
    const tradeShift1Date = new Date(today);
    tradeShift1Date.setDate(tradeShift1Date.getDate() + 8);
    const tradeShift2Date = new Date(today);
    tradeShift2Date.setDate(tradeShift2Date.getDate() + 9);

    const tradeShift1Start = new Date(tradeShift1Date);
    tradeShift1Start.setHours(9, 0, 0, 0);
    const tradeShift1End = new Date(tradeShift1Date);
    tradeShift1End.setHours(17, 0, 0, 0);

    const tradeShift2Start = new Date(tradeShift2Date);
    tradeShift2Start.setHours(14, 0, 0, 0);
    const tradeShift2End = new Date(tradeShift2Date);
    tradeShift2End.setHours(22, 0, 0, 0);

    sqlite.prepare(`
      INSERT INTO shifts (id, user_id, branch_id, start_time, end_time, position, is_recurring, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'shift-trade-1',
      employees[0].id, // John
      branchId,
      Math.floor(tradeShift1Start.getTime() / 1000),
      Math.floor(tradeShift1End.getTime() / 1000),
      'Barista',
      0,
      'scheduled',
      Math.floor(Date.now() / 1000)
    );

    sqlite.prepare(`
      INSERT INTO shifts (id, user_id, branch_id, start_time, end_time, position, is_recurring, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'shift-trade-2',
      employees[1].id, // Jane
      branchId,
      Math.floor(tradeShift2Start.getTime() / 1000),
      Math.floor(tradeShift2End.getTime() / 1000),
      'Cashier',
      0,
      'scheduled',
      Math.floor(Date.now() / 1000)
    );

    // Pending shift trade from John (wants to trade with anyone)
    sqlite.prepare(`
      INSERT INTO shift_trades (id, shift_id, from_user_id, to_user_id, reason, status, urgency, requested_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'trade-1',
      'shift-trade-1',
      employees[0].id, // John
      null, // Available to anyone
      'I have a class conflict that day. Looking for someone to cover.',
      'pending',
      'normal',
      Math.floor(Date.now() / 1000)
    );

    // ==================== COMPLETED SHIFTS (for payroll testing) ====================
    // Mark some past shifts as completed with actual clock times
    for (let daysAgo = 1; daysAgo <= 3; daysAgo++) {
      const shiftDate = new Date(today);
      shiftDate.setDate(shiftDate.getDate() - daysAgo);

      // Skip weekends
      if (shiftDate.getDay() === 0) continue;

      for (let empIdx = 0; empIdx < employees.length; empIdx++) {
        const shiftId = `shift-past-${daysAgo}-${empIdx}`;
        const startTime = new Date(shiftDate);
        startTime.setHours(9, 0, 0, 0);
        const endTime = new Date(shiftDate);
        endTime.setHours(17, 0, 0, 0);

        // Slightly varied actual times to simulate real clock in/out
        const actualStart = new Date(startTime);
        actualStart.setMinutes(actualStart.getMinutes() + Math.floor(Math.random() * 10) - 5); // +/- 5 mins
        const actualEnd = new Date(endTime);
        actualEnd.setMinutes(actualEnd.getMinutes() + Math.floor(Math.random() * 15)); // 0-15 mins extra

        sqlite.prepare(`
          INSERT INTO shifts (id, user_id, branch_id, start_time, end_time, actual_start_time, actual_end_time, position, is_recurring, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          shiftId,
          employees[empIdx].id,
          branchId,
          Math.floor(startTime.getTime() / 1000),
          Math.floor(endTime.getTime() / 1000),
          Math.floor(actualStart.getTime() / 1000),
          Math.floor(actualEnd.getTime() / 1000),
          employees[empIdx].position,
          0,
          'completed',
          Math.floor(Date.now() / 1000)
        );
      }
    }

    // ==================== MORE NOTIFICATIONS ====================
    // Notification for Emma about approved time off
    sqlite.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'notif-timeoff-approved',
      employees[3].id, // Emma
      'time_off_approved',
      'Time Off Approved! 🎉',
      'Your time off request has been approved. Enjoy your break!',
      0,
      Math.floor(Date.now() / 1000)
    );

    // Notification for Mike about rejected time off
    sqlite.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'notif-timeoff-rejected',
      employees[2].id, // Mike
      'time_off_rejected',
      'Time Off Request Declined',
      'Unfortunately, your time off request could not be approved at this time.',
      0,
      Math.floor(Date.now() / 1000)
    );

    // Shift trade notification for all employees
    for (let i = 1; i < employees.length; i++) {
      sqlite.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, is_read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        `notif-trade-${i}`,
        employees[i].id,
        'shift_trade_available',
        'Shift Trade Available',
        'John Smith is looking for someone to take their shift. Check the Shift Trading page.',
        0,
        Math.floor(Date.now() / 1000)
      );
    }

    // Welcome notification for all employees
    for (const emp of employees) {
      sqlite.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, is_read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        `notif-welcome-${emp.id}`,
        emp.id,
        'welcome',
        'Welcome to The Café! ☕',
        'Thanks for joining our team. Check your schedule and clock in when you arrive for your shift.',
        1, // Already read
        Math.floor((Date.now() - 604800000) / 1000) // 1 week ago
      );
    }

    console.log('✅ Sample data loaded successfully!\n');
    console.log('📋 Sample Data Created:');
    console.log('   • 1 Branch: Downtown Cafe');
    console.log('   • 1 Manager: sarah (password: password123)');
    console.log('   • 4 Employees: john, jane, mike, emma (password: password123)');
    console.log('   • 30+ Shifts for this week and next');
    console.log('   • 1 Open Payroll Period');
    console.log('   • 4 Shift Drop Requests (pending, approved, rejected, picked_up)');
    console.log('   • 3 Time Off Requests (pending, approved, rejected)');
    console.log('   • 1 Shift Trade Request (pending)');
    console.log('   • 15+ Clock Entries (for payroll testing)');
    console.log('   • 10+ Notifications\n');
    console.log('🎯 Test Scenarios:');
    console.log('   1. SHIFT DROP: Login as john → Schedule → Request Shift Drop');
    console.log('   2. PICK UP SHIFT: Login as mike/emma → Schedule → Pick up Jane\'s available shift');
    console.log('   3. TIME OFF: Login as sarah → Review John\'s pending time off request');
    console.log('   4. SHIFT TRADE: Login as jane/mike → View John\'s shift trade offer');
    console.log('   5. PAYROLL: Login as sarah → Reports → Hours Report (see clock entries)\n');
  } catch (error) {
    console.error('❌ Error loading sample data:', error);
    throw error;
  }
}

