import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const branches = sqliteTable("branches", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  phone: text("phone"),
  isActive: integer("is_active", { mode: 'boolean' }).default(true),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("employee"), // employee, manager, admin
  position: text("position").notNull(),
  hourlyRate: text("hourly_rate").notNull(),
  branchId: text("branch_id").references(() => branches.id).notNull(),
  isActive: integer("is_active", { mode: 'boolean' }).default(true),
  blockchainVerified: integer("blockchain_verified", { mode: 'boolean' }).default(false),
  blockchainHash: text("blockchain_hash"), // Hash of the employee record for blockchain verification
  verifiedAt: integer("verified_at", { mode: 'timestamp' }),
  // Recurring deductions per pay period
  sssLoanDeduction: text("sss_loan_deduction").default("0"),
  pagibigLoanDeduction: text("pagibig_loan_deduction").default("0"),
  cashAdvanceDeduction: text("cash_advance_deduction").default("0"),
  otherDeductions: text("other_deductions").default("0"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const shifts = sqliteTable("shifts", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id).notNull(),
  branchId: text("branch_id").references(() => branches.id).notNull(),
  startTime: integer("start_time", { mode: 'timestamp' }).notNull(),
  endTime: integer("end_time", { mode: 'timestamp' }).notNull(),
  position: text("position").notNull(),
  isRecurring: integer("is_recurring", { mode: 'boolean' }).default(false),
  recurringPattern: text("recurring_pattern"), // weekly, biweekly, monthly
  status: text("status").default("scheduled"), // scheduled, completed, missed, cancelled
  actualStartTime: integer("actual_start_time", { mode: 'timestamp' }),
  actualEndTime: integer("actual_end_time", { mode: 'timestamp' }),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const shiftTrades = sqliteTable("shift_trades", {
  id: text("id").primaryKey(),
  shiftId: text("shift_id").references(() => shifts.id).notNull(),
  fromUserId: text("from_user_id").references(() => users.id).notNull(),
  toUserId: text("to_user_id").references(() => users.id),
  reason: text("reason").notNull(),
  status: text("status").default("pending"), // pending, approved, rejected, completed
  urgency: text("urgency").default("normal"), // urgent, normal, low
  notes: text("notes"),
  requestedAt: integer("requested_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
  approvedAt: integer("approved_at", { mode: 'timestamp' }),
  approvedBy: text("approved_by").references(() => users.id),
});

// Shift Drop Requests - for employees requesting to drop shifts (requires manager approval)
export const shiftDropRequests = sqliteTable("shift_drop_requests", {
  id: text("id").primaryKey(),
  shiftId: text("shift_id").references(() => shifts.id).notNull(),
  userId: text("user_id").references(() => users.id).notNull(), // Employee requesting the drop
  reason: text("reason").notNull(), // Required reason for dropping
  status: text("status").default("pending"), // pending, approved, rejected, cancelled, picked_up
  urgency: text("urgency").default("normal"), // urgent, normal, low
  // Manager response fields
  resolvedBy: text("resolved_by").references(() => users.id), // Manager who approved/rejected
  resolvedAt: integer("resolved_at", { mode: 'timestamp' }),
  managerNotes: text("manager_notes"), // Manager's notes when approving/rejecting
  // Pickup tracking
  pickedUpBy: text("picked_up_by").references(() => users.id), // Employee who picked up the shift
  pickedUpAt: integer("picked_up_at", { mode: 'timestamp' }),
  // Escalation tracking
  escalatedAt: integer("escalated_at", { mode: 'timestamp' }), // When manager was alerted about unfilled shift
  escalationSent: integer("escalation_sent", { mode: 'boolean' }).default(false),
  // Timestamps
  requestedAt: integer("requested_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const payrollPeriods = sqliteTable("payroll_periods", {
  id: text("id").primaryKey(),
  branchId: text("branch_id").references(() => branches.id).notNull(),
  startDate: integer("start_date", { mode: 'timestamp' }).notNull(),
  endDate: integer("end_date", { mode: 'timestamp' }).notNull(),
  status: text("status").default("open"), // open, closed, paid
  totalHours: text("total_hours"),
  totalPay: text("total_pay"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const payrollEntries = sqliteTable("payroll_entries", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id).notNull(),
  payrollPeriodId: text("payroll_period_id").references(() => payrollPeriods.id).notNull(),
  totalHours: text("total_hours").notNull(),
  regularHours: text("regular_hours").notNull(),
  overtimeHours: text("overtime_hours").default("0"),
  nightDiffHours: text("night_diff_hours").default("0"),
  // Basic pay components
  basicPay: text("basic_pay").notNull(),
  holidayPay: text("holiday_pay").default("0"),
  overtimePay: text("overtime_pay").default("0"),
  nightDiffPay: text("night_diff_pay").default("0"),
  restDayPay: text("rest_day_pay").default("0"),
  grossPay: text("gross_pay").notNull(),
  // Detailed deductions
  sssContribution: text("sss_contribution").default("0"),
  sssLoan: text("sss_loan").default("0"),
  philHealthContribution: text("philhealth_contribution").default("0"),
  pagibigContribution: text("pagibig_contribution").default("0"),
  pagibigLoan: text("pagibig_loan").default("0"),
  withholdingTax: text("withholding_tax").default("0"),
  advances: text("advances").default("0"),
  otherDeductions: text("other_deductions").default("0"),
  totalDeductions: text("total_deductions").default("0"),
  deductions: text("deductions").default("0"), // Keep for backward compatibility
  netPay: text("net_pay").notNull(),
  status: text("status").default("pending"), // pending, approved, paid
  // Blockchain fields
  blockchainHash: text("blockchain_hash"), // Hash of the record for blockchain verification
  blockNumber: integer("block_number"), // Block number where record was stored
  transactionHash: text("transaction_hash"), // Transaction hash for the blockchain record
  verified: integer("verified", { mode: 'boolean' }).default(false), // Whether the record has been verified on blockchain
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const approvals = sqliteTable("approvals", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // shift_trade, leave_request, time_correction
  requestId: text("request_id").notNull(), // ID of the related request
  requestedBy: text("requested_by").references(() => users.id).notNull(),
  approvedBy: text("approved_by").references(() => users.id),
  status: text("status").default("pending"), // pending, approved, rejected
  reason: text("reason"),
  requestData: text("request_data"), // Additional data about the request (JSON string)
  requestedAt: integer("requested_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
  respondedAt: integer("responded_at", { mode: 'timestamp' }),
});

// Insert Schemas
export const insertBranchSchema = createInsertSchema(branches).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertShiftSchema = createInsertSchema(shifts).omit({
  id: true,
  createdAt: true,
}).extend({
  // Coerce string dates to Date objects
  startTime: z.union([z.date(), z.string().pipe(z.coerce.date())]),
  endTime: z.union([z.date(), z.string().pipe(z.coerce.date())]),
});

export const insertShiftTradeSchema = z.object({
  id: z.string().uuid().optional(),
  shiftId: z.string().uuid(),
  fromUserId: z.string().uuid(),
  toUserId: z.string().uuid(),
  reason: z.string().min(1, "Reason is required"),
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  urgency: z.enum(['urgent', 'normal', 'low']).default('normal'),
  notes: z.string().optional(),
  requestedAt: z.date().optional(),
  approvedAt: z.date().optional(),
  approvedBy: z.string().uuid().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Shift Drop Request Schema
export const insertShiftDropRequestSchema = z.object({
  shiftId: z.string().uuid(),
  userId: z.string().uuid(),
  reason: z.string().min(1, "Reason is required"),
  urgency: z.enum(['urgent', 'normal', 'low']).default('normal'),
});

export const insertPayrollPeriodSchema = createInsertSchema(payrollPeriods).omit({
  id: true,
  createdAt: true,
});

export const insertPayrollEntrySchema = createInsertSchema(payrollEntries).omit({
  id: true,
  createdAt: true,
});

export const timeOffRequests = sqliteTable("time_off_requests", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id).notNull(),
  startDate: integer("start_date", { mode: 'timestamp' }).notNull(),
  endDate: integer("end_date", { mode: 'timestamp' }).notNull(),
  type: text("type").notNull(), // vacation, sick, personal
  reason: text("reason").notNull(),
  status: text("status").default("pending"), // pending, approved, rejected
  requestedAt: integer("requested_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
  approvedAt: integer("approved_at", { mode: 'timestamp' }),
  approvedBy: text("approved_by").references(() => users.id),
});

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // payroll, schedule, announcement, system
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: integer("is_read", { mode: 'boolean' }).default(false),
  data: text("data"), // Additional data for the notification (JSON string)
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const setupStatus = sqliteTable("setup_status", {
  id: text("id").primaryKey(),
  isSetupComplete: integer("is_setup_complete", { mode: 'boolean' }).default(false),
  setupCompletedAt: integer("setup_completed_at", { mode: 'timestamp' }),
});

export const deductionSettings = sqliteTable("deduction_settings", {
  id: text("id").primaryKey(),
  branchId: text("branch_id").references(() => branches.id).notNull(),
  deductSSS: integer("deduct_sss", { mode: 'boolean' }).default(true),
  deductPhilHealth: integer("deduct_philhealth", { mode: 'boolean' }).default(false),
  deductPagibig: integer("deduct_pagibig", { mode: 'boolean' }).default(false),
  deductWithholdingTax: integer("deduct_withholding_tax", { mode: 'boolean' }).default(false),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Deduction rates configuration (admin-editable)
export const deductionRates = sqliteTable("deduction_rates", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // 'sss', 'philhealth', 'pagibig', 'tax'
  minSalary: text("min_salary").notNull(), // Stored as text for precision
  maxSalary: text("max_salary"), // null for unlimited
  employeeRate: text("employee_rate"), // Percentage or fixed amount
  employeeContribution: text("employee_contribution"), // Fixed contribution amount
  description: text("description"), // Description of the bracket
  isActive: integer("is_active", { mode: 'boolean' }).default(true),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Philippine Holidays table for pay computation
export const holidays = sqliteTable("holidays", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  date: integer("date", { mode: 'timestamp' }).notNull(), // The holiday date
  type: text("type").notNull(), // 'regular', 'special_non_working', 'special_working'
  year: integer("year").notNull(), // Year for easy filtering
  isRecurring: integer("is_recurring", { mode: 'boolean' }).default(false), // Same date every year
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Archived payroll periods for audit trail
export const archivedPayrollPeriods = sqliteTable("archived_payroll_periods", {
  id: text("id").primaryKey(),
  originalPeriodId: text("original_period_id").notNull(),
  branchId: text("branch_id").references(() => branches.id).notNull(),
  startDate: integer("start_date", { mode: 'timestamp' }).notNull(),
  endDate: integer("end_date", { mode: 'timestamp' }).notNull(),
  status: text("status").notNull(),
  totalHours: text("total_hours"),
  totalPay: text("total_pay"),
  archivedAt: integer("archived_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
  archivedBy: text("archived_by").references(() => users.id),
  entriesSnapshot: text("entries_snapshot"), // JSON snapshot of all entries
});

export const insertApprovalSchema = createInsertSchema(approvals).omit({
  id: true,
  requestedAt: true,
  respondedAt: true,
});

export const insertTimeOffRequestSchema = createInsertSchema(timeOffRequests).omit({
  id: true,
  requestedAt: true,
  approvedAt: true,
}).extend({
  // Coerce string dates to Date objects
  startDate: z.union([z.date(), z.string().pipe(z.coerce.date())]),
  endDate: z.union([z.date(), z.string().pipe(z.coerce.date())]),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertDeductionSettingsSchema = createInsertSchema(deductionSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDeductionRatesSchema = createInsertSchema(deductionRates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHolidaySchema = createInsertSchema(holidays).omit({
  id: true,
  createdAt: true,
}).extend({
  date: z.union([z.date(), z.string().pipe(z.coerce.date())]),
});

export const insertArchivedPayrollPeriodSchema = createInsertSchema(archivedPayrollPeriods).omit({
  id: true,
  archivedAt: true,
});

export interface DashboardStats {
  stats: {
    late: number;
    revenue: number;
  };
}

// Types
export type Branch = typeof branches.$inferSelect;
export type User = typeof users.$inferSelect;
export type Shift = typeof shifts.$inferSelect;
export type ShiftTrade = typeof shiftTrades.$inferSelect;
export type ShiftDropRequest = typeof shiftDropRequests.$inferSelect;
export type PayrollPeriod = typeof payrollPeriods.$inferSelect;
export type PayrollEntry = typeof payrollEntries.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type TimeOffRequest = typeof timeOffRequests.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type SetupStatus = typeof setupStatus.$inferSelect;
export type DeductionSettings = typeof deductionSettings.$inferSelect;
export type DeductionRate = typeof deductionRates.$inferSelect;
export type Holiday = typeof holidays.$inferSelect;
export type ArchivedPayrollPeriod = typeof archivedPayrollPeriods.$inferSelect;

export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type InsertShiftTrade = z.infer<typeof insertShiftTradeSchema>;
export type InsertShiftDropRequest = z.infer<typeof insertShiftDropRequestSchema>;
export type InsertPayrollPeriod = z.infer<typeof insertPayrollPeriodSchema>;
export type InsertPayrollEntry = z.infer<typeof insertPayrollEntrySchema>;
export type InsertApproval = z.infer<typeof insertApprovalSchema>;
export type InsertTimeOffRequest = z.infer<typeof insertTimeOffRequestSchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type InsertDeductionSettings = z.infer<typeof insertDeductionSettingsSchema>;
export type InsertDeductionRate = z.infer<typeof insertDeductionRatesSchema>;
export type InsertHoliday = z.infer<typeof insertHolidaySchema>;
export type InsertArchivedPayrollPeriod = z.infer<typeof insertArchivedPayrollPeriodSchema>;
