import { db, sql } from './db';
import { branches, users, timeEntries, shifts, shiftTrades, payrollPeriods, payrollEntries, approvals } from '@shared/schema';
import { sql as drizzleSql } from 'drizzle-orm';

async function runMigrations() {
  try {
    // Drop tables if they exist (be careful with this in production)
    await db.run(drizzleSql`DROP TABLE IF EXISTS approvals`);
    await db.run(drizzleSql`DROP TABLE IF EXISTS payroll_entries`);
    await db.run(drizzleSql`DROP TABLE IF EXISTS payroll_periods`);
    await db.run(drizzleSql`DROP TABLE IF EXISTS shift_trades`);
    await db.run(drizzleSql`DROP TABLE IF EXISTS shifts`);
    await db.run(drizzleSql`DROP TABLE IF EXISTS time_entries`);
    await db.run(drizzleSql`DROP TABLE IF EXISTS users`);
    await db.run(drizzleSql`DROP TABLE IF EXISTS branches`);

    // Create tables
    await db.run(drizzleSql`
      CREATE TABLE IF NOT EXISTS branches (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        phone TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(drizzleSql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL DEFAULT 'employee',
        position TEXT NOT NULL,
        hourly_rate DECIMAL(10, 2) NOT NULL,
        branch_id TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (branch_id) REFERENCES branches (id)
      )
    `);

    await db.run(drizzleSql`
      CREATE TABLE IF NOT EXISTS time_entries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        clock_in TEXT NOT NULL,
        clock_out TEXT,
        break_start TEXT,
        break_end TEXT,
        total_hours DECIMAL(5, 2),
        is_approved BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (branch_id) REFERENCES branches (id)
      )
    `);

    console.log('Database tables created successfully!');
    
    // Create a default branch using raw SQL
    const defaultBranchId = crypto.randomUUID();
    await db.run(drizzleSql`
      INSERT INTO branches (id, name, address, phone, is_active, created_at)
      VALUES (
        ${defaultBranchId},
        'Main Branch',
        '123 Main St, Anytown, USA',
        '+1234567890',
        true,
        datetime('now')
      )
    `);
    
    console.log('Default branch created!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  }
}

runMigrations();
