import { sql as sqlite } from './db';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

export async function initializeDatabase() {
  console.log('🔧 Initializing SQLite database...');

  try {
    // Create branches table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS branches (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        phone TEXT,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER DEFAULT (unixepoch())
      )
    `);

    // Create users table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL DEFAULT 'employee',
        position TEXT NOT NULL,
        hourly_rate TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        blockchain_verified INTEGER DEFAULT 0,
        blockchain_hash TEXT,
        verified_at INTEGER,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      )
    `);

    // Migrate existing users table to add blockchain verification columns if they don't exist
    try {
      sqlite.exec(`ALTER TABLE users ADD COLUMN blockchain_verified INTEGER DEFAULT 0`);
      console.log('✅ Added blockchain_verified column to users table');
    } catch (error: any) {
      // Column already exists or other error - ignore if it's a duplicate column error
      if (!error.message.includes('duplicate column name')) {
        console.log('ℹ️  blockchain_verified column already exists or migration not needed');
      }
    }

    try {
      sqlite.exec(`ALTER TABLE users ADD COLUMN blockchain_hash TEXT`);
      console.log('✅ Added blockchain_hash column to users table');
    } catch (error: any) {
      if (!error.message.includes('duplicate column name')) {
        console.log('ℹ️  blockchain_hash column already exists or migration not needed');
      }
    }

    try {
      sqlite.exec(`ALTER TABLE users ADD COLUMN verified_at INTEGER`);
      console.log('✅ Added verified_at column to users table');
    } catch (error: any) {
      if (!error.message.includes('duplicate column name')) {
        console.log('ℹ️  verified_at column already exists or migration not needed');
      }
    }

    // Add recurring deduction columns to users table
    try {
      sqlite.exec(`ALTER TABLE users ADD COLUMN sss_loan_deduction TEXT DEFAULT '0'`);
      console.log('✅ Added sss_loan_deduction column to users table');
    } catch (error: any) {
      if (!error.message.includes('duplicate column name')) {
        console.log('ℹ️  sss_loan_deduction column already exists');
      }
    }

    try {
      sqlite.exec(`ALTER TABLE users ADD COLUMN pagibig_loan_deduction TEXT DEFAULT '0'`);
      console.log('✅ Added pagibig_loan_deduction column to users table');
    } catch (error: any) {
      if (!error.message.includes('duplicate column name')) {
        console.log('ℹ️  pagibig_loan_deduction column already exists');
      }
    }

    try {
      sqlite.exec(`ALTER TABLE users ADD COLUMN cash_advance_deduction TEXT DEFAULT '0'`);
      console.log('✅ Added cash_advance_deduction column to users table');
    } catch (error: any) {
      if (!error.message.includes('duplicate column name')) {
        console.log('ℹ️  cash_advance_deduction column already exists');
      }
    }

    try {
      sqlite.exec(`ALTER TABLE users ADD COLUMN other_deductions TEXT DEFAULT '0'`);
      console.log('✅ Added other_deductions column to users table');
    } catch (error: any) {
      if (!error.message.includes('duplicate column name')) {
        console.log('ℹ️  other_deductions column already exists');
      }
    }

    // Create shifts table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS shifts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        position TEXT NOT NULL,
        is_recurring INTEGER DEFAULT 0,
        recurring_pattern TEXT,
        status TEXT DEFAULT 'scheduled',
        actual_start_time INTEGER,
        actual_end_time INTEGER,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      )
    `);

    // Create shift_trades table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS shift_trades (
        id TEXT PRIMARY KEY,
        shift_id TEXT NOT NULL,
        from_user_id TEXT NOT NULL,
        to_user_id TEXT,
        reason TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        urgency TEXT DEFAULT 'normal',
        notes TEXT,
        requested_at INTEGER DEFAULT (unixepoch()),
        approved_at INTEGER,
        approved_by TEXT,
        FOREIGN KEY (shift_id) REFERENCES shifts(id),
        FOREIGN KEY (from_user_id) REFERENCES users(id),
        FOREIGN KEY (to_user_id) REFERENCES users(id),
        FOREIGN KEY (approved_by) REFERENCES users(id)
      )
    `);

    // Create shift_drop_requests table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS shift_drop_requests (
        id TEXT PRIMARY KEY,
        shift_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        urgency TEXT DEFAULT 'normal',
        resolved_by TEXT,
        resolved_at INTEGER,
        manager_notes TEXT,
        picked_up_by TEXT,
        picked_up_at INTEGER,
        escalated_at INTEGER,
        escalation_sent INTEGER DEFAULT 0,
        requested_at INTEGER DEFAULT (unixepoch()),
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (shift_id) REFERENCES shifts(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (resolved_by) REFERENCES users(id),
        FOREIGN KEY (picked_up_by) REFERENCES users(id)
      )
    `);

    // Create payroll_periods table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS payroll_periods (
        id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL,
        start_date INTEGER NOT NULL,
        end_date INTEGER NOT NULL,
        status TEXT DEFAULT 'open',
        total_hours TEXT,
        total_pay TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      )
    `);

    // Create payroll_entries table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS payroll_entries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        payroll_period_id TEXT NOT NULL,
        total_hours TEXT NOT NULL,
        regular_hours TEXT NOT NULL,
        overtime_hours TEXT DEFAULT '0',
        gross_pay TEXT NOT NULL,
        deductions TEXT DEFAULT '0',
        net_pay TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        blockchain_hash TEXT,
        block_number INTEGER,
        transaction_hash TEXT,
        verified INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (payroll_period_id) REFERENCES payroll_periods(id)
      )
    `);

    // Create approvals table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        request_id TEXT NOT NULL,
        requested_by TEXT NOT NULL,
        approved_by TEXT,
        status TEXT DEFAULT 'pending',
        reason TEXT,
        request_data TEXT,
        requested_at INTEGER DEFAULT (unixepoch()),
        responded_at INTEGER,
        FOREIGN KEY (requested_by) REFERENCES users(id),
        FOREIGN KEY (approved_by) REFERENCES users(id)
      )
    `);

    // Create time_off_requests table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS time_off_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        start_date INTEGER NOT NULL,
        end_date INTEGER NOT NULL,
        type TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        requested_at INTEGER DEFAULT (unixepoch()),
        approved_at INTEGER,
        approved_by TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (approved_by) REFERENCES users(id)
      )
    `);

    // Create notifications table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        data TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Create setup_status table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS setup_status (
        id TEXT PRIMARY KEY,
        is_setup_complete INTEGER DEFAULT 0,
        setup_completed_at INTEGER
      )
    `);

    // Create deduction_settings table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS deduction_settings (
        id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL,
        deduct_sss INTEGER DEFAULT 1,
        deduct_philhealth INTEGER DEFAULT 0,
        deduct_pagibig INTEGER DEFAULT 0,
        deduct_withholding_tax INTEGER DEFAULT 0,
        updated_at INTEGER DEFAULT (unixepoch()),
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      )
    `);

    // Create deduction_rates table (admin-editable deduction rates)
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS deduction_rates (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        min_salary TEXT NOT NULL,
        max_salary TEXT,
        employee_rate TEXT,
        employee_contribution TEXT,
        description TEXT,
        is_active INTEGER DEFAULT 1,
        updated_at INTEGER DEFAULT (unixepoch()),
        created_at INTEGER DEFAULT (unixepoch())
      )
    `);

    // Create holidays table for Philippine holiday pay computation
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS holidays (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        date INTEGER NOT NULL,
        type TEXT NOT NULL,
        year INTEGER NOT NULL,
        is_recurring INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch())
      )
    `);

    // Create archived_payroll_periods table for audit trail
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS archived_payroll_periods (
        id TEXT PRIMARY KEY,
        original_period_id TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        start_date INTEGER NOT NULL,
        end_date INTEGER NOT NULL,
        status TEXT NOT NULL,
        total_hours TEXT,
        total_pay TEXT,
        archived_at INTEGER DEFAULT (unixepoch()),
        archived_by TEXT,
        entries_snapshot TEXT,
        FOREIGN KEY (branch_id) REFERENCES branches(id),
        FOREIGN KEY (archived_by) REFERENCES users(id)
      )
    `);

    // Migrate payroll_entries table to add new deduction columns
    const newColumns = [
      'basic_pay TEXT DEFAULT "0"',
      'holiday_pay TEXT DEFAULT "0"',
      'overtime_pay TEXT DEFAULT "0"',
      'night_diff_hours TEXT DEFAULT "0"',
      'night_diff_pay TEXT DEFAULT "0"',
      'rest_day_pay TEXT DEFAULT "0"',
      'sss_contribution TEXT DEFAULT "0"',
      'sss_loan TEXT DEFAULT "0"',
      'philhealth_contribution TEXT DEFAULT "0"',
      'pagibig_contribution TEXT DEFAULT "0"',
      'pagibig_loan TEXT DEFAULT "0"',
      'withholding_tax TEXT DEFAULT "0"',
      'advances TEXT DEFAULT "0"',
      'other_deductions TEXT DEFAULT "0"',
      'total_deductions TEXT DEFAULT "0"'
    ];

    for (const column of newColumns) {
      try {
        const columnName = column.split(' ')[0];
        sqlite.exec(`ALTER TABLE payroll_entries ADD COLUMN ${column}`);
        console.log(`✅ Added ${columnName} column to payroll_entries table`);
      } catch (error: any) {
        // Column already exists - ignore
        if (!error.message.includes('duplicate column name')) {
          console.log(`ℹ️  Column migration skipped or already exists`);
        }
      }
    }

    console.log('✅ Database tables created successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Create default admin account if it doesn't exist
 * Admin credentials: username: admin, password: admin123
 */
export async function createAdminAccount() {
  try {
    // Check if admin already exists
    const existingAdmin = sqlite.prepare('SELECT * FROM users WHERE username = ?').get('admin');

    if (existingAdmin) {
      console.log('ℹ️  Admin account already exists');
      return;
    }

    // Check if there's at least one branch to assign admin to
    const branch = sqlite.prepare('SELECT * FROM branches LIMIT 1').get() as any;

    if (!branch) {
      console.log('⚠️  No branches found. Admin account will be created after setup.');
      return;
    }

    // Create admin account
    const adminId = 'user-admin-1';
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const adminData = `${adminId}-Admin-User-admin@thecafe.com-System Administrator`;
    const adminHash = crypto.createHash('sha256').update(adminData).digest('hex');

    sqlite.prepare(`
      INSERT INTO users (id, username, password, first_name, last_name, email, role, position, hourly_rate, branch_id, is_active, blockchain_verified, blockchain_hash, verified_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      adminId,
      'admin',
      hashedPassword,
      'Admin',
      'User',
      'admin@thecafe.com',
      'admin',
      'System Administrator',
      '0.00',
      branch.id,
      1,
      1,
      adminHash,
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    );

    console.log('✅ Admin account created successfully');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('   ⚠️  Please change the password after first login!');
  } catch (error) {
    console.error('❌ Failed to create admin account:', error);
  }
}

/**
 * Seed default deduction rates if table is empty
 * This creates the Philippine government contribution tables
 */
export async function seedDeductionRates() {
  try {
    // Check if rates already exist
    const existingRates = sqlite.prepare('SELECT COUNT(*) as count FROM deduction_rates').get() as any;

    if (existingRates.count > 0) {
      console.log('ℹ️  Deduction rates already seeded');
      return;
    }

    console.log('🌱 Seeding default deduction rates...');

    // SSS Contribution Table 2024 (Complete - All 44 brackets)
    const sssRates = [
      { min: '0', max: '4249.99', contribution: '180' },
      { min: '4250', max: '4749.99', contribution: '202.50' },
      { min: '4750', max: '5249.99', contribution: '225' },
      { min: '5250', max: '5749.99', contribution: '247.50' },
      { min: '5750', max: '6249.99', contribution: '270' },
      { min: '6250', max: '6749.99', contribution: '292.50' },
      { min: '6750', max: '7249.99', contribution: '315' },
      { min: '7250', max: '7749.99', contribution: '337.50' },
      { min: '7750', max: '8249.99', contribution: '360' },
      { min: '8250', max: '8749.99', contribution: '382.50' },
      { min: '8750', max: '9249.99', contribution: '405' },
      { min: '9250', max: '9749.99', contribution: '427.50' },
      { min: '9750', max: '10249.99', contribution: '450' },
      { min: '10250', max: '10749.99', contribution: '472.50' },
      { min: '10750', max: '11249.99', contribution: '495' },
      { min: '11250', max: '11749.99', contribution: '517.50' },
      { min: '11750', max: '12249.99', contribution: '540' },
      { min: '12250', max: '12749.99', contribution: '562.50' },
      { min: '12750', max: '13249.99', contribution: '585' },
      { min: '13250', max: '13749.99', contribution: '607.50' },
      { min: '13750', max: '14249.99', contribution: '630' },
      { min: '14250', max: '14749.99', contribution: '652.50' },
      { min: '14750', max: '15249.99', contribution: '675' },
      { min: '15250', max: '15749.99', contribution: '697.50' },
      { min: '15750', max: '16249.99', contribution: '720' },
      { min: '16250', max: '16749.99', contribution: '742.50' },
      { min: '16750', max: '17249.99', contribution: '765' },
      { min: '17250', max: '17749.99', contribution: '787.50' },
      { min: '17750', max: '18249.99', contribution: '810' },
      { min: '18250', max: '18749.99', contribution: '832.50' },
      { min: '18750', max: '19249.99', contribution: '855' },
      { min: '19250', max: '19749.99', contribution: '877.50' },
      { min: '19750', max: '20249.99', contribution: '900' },
      { min: '20250', max: '20749.99', contribution: '922.50' },
      { min: '20750', max: '21249.99', contribution: '945' },
      { min: '21250', max: '21749.99', contribution: '967.50' },
      { min: '21750', max: '22249.99', contribution: '990' },
      { min: '22250', max: '22749.99', contribution: '1012.50' },
      { min: '22750', max: '23249.99', contribution: '1035' },
      { min: '23250', max: '23749.99', contribution: '1057.50' },
      { min: '23750', max: '24249.99', contribution: '1080' },
      { min: '24250', max: '24749.99', contribution: '1102.50' },
      { min: '24750', max: '29999.99', contribution: '1125' },
      { min: '30000', max: null, contribution: '1125' }, // Maximum contribution
    ];

    const insertRate = sqlite.prepare(`
      INSERT INTO deduction_rates (id, type, min_salary, max_salary, employee_rate, employee_contribution, description, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let count = 0;

    // Insert SSS rates
    for (const rate of sssRates) {
      const id = `rate-sss-${count++}`;
      insertRate.run(
        id,
        'sss',
        rate.min,
        rate.max,
        null,
        rate.contribution,
        `SSS Bracket ₱${rate.min} - ₱${rate.max}`,
        1,
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000)
      );
    }

    // PhilHealth rate (percentage-based)
    insertRate.run(
      `rate-philhealth-${count++}`,
      'philhealth',
      '10000',
      '100000',
      '2.5',
      null,
      'PhilHealth 2.5% employee share (5% total premium)',
      1,
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    );

    // Pag-IBIG rates
    insertRate.run(
      `rate-pagibig-${count++}`,
      'pagibig',
      '0',
      '1500',
      '1',
      null,
      'Pag-IBIG 1% for salary ≤ ₱1,500',
      1,
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    );

    insertRate.run(
      `rate-pagibig-${count++}`,
      'pagibig',
      '1500.01',
      null,
      '2',
      null,
      'Pag-IBIG 2% for salary > ₱1,500 (max ₱100)',
      1,
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    );

    // Withholding Tax rates (TRAIN Law - Annual brackets)
    // Note: These are annual brackets, calculations will convert monthly to annual
    const taxRates = [
      { min: '0', max: '250000', rate: '0', description: 'Tax-exempt bracket' },
      { min: '250000.01', max: '400000', rate: '15', description: '15% on excess over ₱250,000' },
      { min: '400000.01', max: '800000', rate: '20', description: '₱22,500 + 20% on excess over ₱400,000' },
      { min: '800000.01', max: '2000000', rate: '25', description: '₱102,500 + 25% on excess over ₱800,000' },
      { min: '2000000.01', max: '8000000', rate: '30', description: '₱402,500 + 30% on excess over ₱2,000,000' },
      { min: '8000000.01', max: null, rate: '35', description: '₱2,202,500 + 35% on excess over ₱8,000,000' },
    ];

    for (const rate of taxRates) {
      const id = `rate-tax-${count++}`;
      insertRate.run(
        id,
        'tax',
        rate.min,
        rate.max,
        rate.rate,
        null,
        rate.description,
        1,
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000)
      );
    }

    console.log(`✅ Seeded ${count} deduction rates`);
  } catch (error) {
    console.error('❌ Failed to seed deduction rates:', error);
  }
}

/**
 * Seed Philippine holidays for the current year
 */
export async function seedPhilippineHolidays() {
  try {
    // Check if holidays already exist for 2025
    const existingHolidays = sqlite.prepare('SELECT COUNT(*) as count FROM holidays WHERE year = 2025').get() as any;

    if (existingHolidays.count > 0) {
      console.log('ℹ️  Philippine holidays for 2025 already seeded');
      return;
    }

    console.log('🌱 Seeding Philippine holidays for 2025...');

    const insertHoliday = sqlite.prepare(`
      INSERT INTO holidays (id, name, date, type, year, is_recurring, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const holidays = [
      // Regular Holidays (200% if worked)
      { name: "New Year's Day", date: new Date(2025, 0, 1), type: 'regular', recurring: true },
      { name: "Eid ul-Fitr", date: new Date(2025, 3, 1), type: 'regular', recurring: false },
      { name: "Araw ng Kagitingan", date: new Date(2025, 3, 9), type: 'regular', recurring: true },
      { name: "Maundy Thursday", date: new Date(2025, 3, 17), type: 'regular', recurring: false },
      { name: "Good Friday", date: new Date(2025, 3, 18), type: 'regular', recurring: false },
      { name: "Labor Day", date: new Date(2025, 4, 1), type: 'regular', recurring: true },
      { name: "Independence Day", date: new Date(2025, 5, 12), type: 'regular', recurring: true },
      { name: "Eid ul-Adha", date: new Date(2025, 5, 7), type: 'regular', recurring: false },
      { name: "National Heroes Day", date: new Date(2025, 7, 25), type: 'regular', recurring: false },
      { name: "Bonifacio Day", date: new Date(2025, 10, 30), type: 'regular', recurring: true },
      { name: "Christmas Day", date: new Date(2025, 11, 25), type: 'regular', recurring: true },
      { name: "Rizal Day", date: new Date(2025, 11, 30), type: 'regular', recurring: true },

      // Special Non-Working Days (130% if worked, no pay if not)
      { name: "Chinese New Year", date: new Date(2025, 0, 29), type: 'special_non_working', recurring: false },
      { name: "Black Saturday", date: new Date(2025, 3, 19), type: 'special_non_working', recurring: false },
      { name: "Ninoy Aquino Day", date: new Date(2025, 7, 21), type: 'special_non_working', recurring: true },
      { name: "All Saints' Day Eve", date: new Date(2025, 9, 31), type: 'special_non_working', recurring: true },
      { name: "All Saints' Day", date: new Date(2025, 10, 1), type: 'special_non_working', recurring: true },
      { name: "Feast of the Immaculate Conception", date: new Date(2025, 11, 8), type: 'special_non_working', recurring: true },
      { name: "Christmas Eve", date: new Date(2025, 11, 24), type: 'special_non_working', recurring: true },
      { name: "Last Day of the Year", date: new Date(2025, 11, 31), type: 'special_non_working', recurring: true },
    ];

    let count = 0;
    for (const holiday of holidays) {
      const id = `holiday-2025-${count++}`;
      insertHoliday.run(
        id,
        holiday.name,
        Math.floor(holiday.date.getTime() / 1000),
        holiday.type,
        2025,
        holiday.recurring ? 1 : 0,
        Math.floor(Date.now() / 1000)
      );
    }

    console.log(`✅ Seeded ${count} Philippine holidays for 2025`);
  } catch (error) {
    console.error('❌ Failed to seed Philippine holidays:', error);
  }
}

