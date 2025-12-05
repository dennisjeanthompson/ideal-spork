import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  TrendingUp,
  Users,
  Clock,
  DollarSign,
  Calendar,
  Download,
  FileText,
  PieChart
} from "lucide-react";
import { hasManagerAccess } from "@/lib/auth";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";

export default function Reports() {
  const isManagerRole = hasManagerAccess();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);

  // Redirect non-managers to dashboard
  useEffect(() => {
    if (!isManagerRole) {
      setLocation("/");
    }
  }, [isManagerRole, setLocation]);

  const { data: payrollData } = useQuery({
    queryKey: ["/api/reports/payroll"],
    enabled: isManagerRole,
  });

  const { data: attendanceData } = useQuery({
    queryKey: ["/api/reports/attendance"],
    enabled: isManagerRole,
  });

  const { data: shiftsData } = useQuery({
    queryKey: ["/api/reports/shifts"],
    enabled: isManagerRole,
  });

  const { data: employeeData } = useQuery({
    queryKey: ["/api/reports/employees"],
    enabled: isManagerRole,
  });

  // Fetch team hours summary
  const { data: teamHours } = useQuery({
    queryKey: ["/api/hours/team-summary"],
    enabled: isManagerRole,
  });

  // Fetch employee statistics
  const { data: employeeStats } = useQuery({
    queryKey: ['employee-stats'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/employees/stats');
      return response.json();
    },
    enabled: isManagerRole,
  });

  // Fetch hours report summary (current month)
  const { data: hoursReportData } = useQuery({
    queryKey: ['/api/hours/report'],
    queryFn: async () => {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const startDate = format(monthStart, 'yyyy-MM-dd');
      const endDate = format(monthEnd, 'yyyy-MM-dd');
      const response = await apiRequest('GET', `/api/hours/report?startDate=${startDate}&endDate=${endDate}`);
      return response.json();
    },
    enabled: isManagerRole,
  });

  if (!isManagerRole) {
    return null; // Will redirect in useEffect
  }

  // Report generation handlers
  const generateDailyAttendanceReport = async () => {
    setGeneratingReport("daily-attendance");
    try {
      const today = new Date();
      const startDate = format(startOfDay(today), 'yyyy-MM-dd');
      const endDate = format(endOfDay(today), 'yyyy-MM-dd');

      const response = await apiRequest('GET', `/api/hours/report?startDate=${startDate}&endDate=${endDate}`);
      const data = await response.json();

      // Generate CSV with safe defaults - data is in summary object
      const csvRows = [
        ['Daily Attendance Report', format(today, 'MMMM dd, yyyy')],
        [],
        ['Employee Name', 'Position', 'Hours Worked', 'Shifts', 'Status'],
        ...(data.employees || []).map((emp: any) => [
          emp.employeeName || 'Unknown',
          emp.position || 'N/A',
          (emp.totalHours || 0).toFixed(2),
          emp.totalShifts || 0,
          (emp.totalShifts || 0) > 0 ? 'Present' : 'Absent'
        ]),
        [],
        ['Total Hours', (data.summary?.totalHours || 0).toFixed(2)],
        ['Total Employees', data.summary?.employeeCount || 0]
      ];

      downloadCSV(csvRows, `daily-attendance-${format(today, 'yyyy-MM-dd')}.csv`);
      toast({ title: "Report Generated", description: "Daily attendance report downloaded successfully" });
    } catch (error: any) {
      console.error('Daily Attendance Report Error:', error);
      toast({ title: "Error", description: error.message || "Failed to generate report", variant: "destructive" });
    } finally {
      setGeneratingReport(null);
    }
  };

  const generateWeeklyPayrollReport = async () => {
    setGeneratingReport("weekly-payroll");
    try {
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(weekEnd, 'yyyy-MM-dd');

      const response = await apiRequest('GET', `/api/hours/report?startDate=${startDate}&endDate=${endDate}`);
      const data = await response.json();

      const csvRows = [
        ['Weekly Payroll Report', `${format(weekStart, 'MMM dd')} - ${format(weekEnd, 'MMM dd, yyyy')}`],
        [],
        ['Employee Name', 'Position', 'Hourly Rate', 'Hours Worked', 'Gross Pay'],
        ...(data.employees || []).map((emp: any) => [
          emp.employeeName || 'Unknown',
          emp.position || 'N/A',
          `₱${(emp.hourlyRate || 0).toFixed(2)}`,
          (emp.totalHours || 0).toFixed(2),
          `₱${(emp.estimatedPay || 0).toFixed(2)}`
        ]),
        [],
        ['Total Hours', (data.summary?.totalHours || 0).toFixed(2)],
        ['Total Payroll', `₱${(data.summary?.totalPay || 0).toFixed(2)}`]
      ];

      downloadCSV(csvRows, `weekly-payroll-${format(weekStart, 'yyyy-MM-dd')}.csv`);
      toast({ title: "Report Generated", description: "Weekly payroll report downloaded successfully" });
    } catch (error: any) {
      console.error('Weekly Payroll Report Error:', error);
      toast({ title: "Error", description: error.message || "Failed to generate report", variant: "destructive" });
    } finally {
      setGeneratingReport(null);
    }
  };

  const generateEmployeePerformanceReport = async () => {
    setGeneratingReport("employee-performance");
    try {
      const response = await apiRequest('GET', '/api/employees/performance');
      const data = await response.json();

      const csvRows = [
        ['Employee Performance Report', format(new Date(), 'MMMM dd, yyyy')],
        [],
        ['Employee Name', 'Position', 'Performance Score', 'Attendance Rate', 'On-Time Rate'],
        ...data.map((emp: any) => [
          emp.employeeName,
          emp.position || 'N/A',
          emp.performanceScore?.toFixed(1) || 'N/A',
          emp.attendanceRate ? `${emp.attendanceRate.toFixed(1)}%` : 'N/A',
          emp.onTimeRate ? `${emp.onTimeRate.toFixed(1)}%` : 'N/A'
        ])
      ];

      downloadCSV(csvRows, `employee-performance-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      toast({ title: "Report Generated", description: "Employee performance report downloaded successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate report", variant: "destructive" });
    } finally {
      setGeneratingReport(null);
    }
  };

  const generateBranchComparisonReport = async () => {
    setGeneratingReport("branch-comparison");
    try {
      const response = await apiRequest('GET', '/api/branches');
      const branchesData = await response.json();
      const branches = branchesData.branches || [];

      const csvRows = [
        ['Branch Comparison Report', format(new Date(), 'MMMM dd, yyyy')],
        [],
        ['Branch Name', 'Address', 'Phone', 'Status'],
        ...branches.map((branch: any) => [
          branch.name,
          branch.address,
          branch.phone,
          branch.isActive ? 'Active' : 'Inactive'
        ])
      ];

      downloadCSV(csvRows, `branch-comparison-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      toast({ title: "Report Generated", description: "Branch comparison report downloaded successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate report", variant: "destructive" });
    } finally {
      setGeneratingReport(null);
    }
  };

  const generateShiftCoverageReport = async () => {
    setGeneratingReport("shift-coverage");
    try {
      const response = await apiRequest('GET', '/api/reports/shifts');
      const data = await response.json();

      const csvRows = [
        ['Shift Coverage Report', format(new Date(), 'MMMM dd, yyyy')],
        [],
        ['Metric', 'Value'],
        ['Total Shifts', data.totalShifts || 0],
        ['Completed Shifts', data.completedShifts || 0],
        ['Missed Shifts', data.missedShifts || 0],
        ['Cancelled Shifts', data.cancelledShifts || 0],
        ['Coverage Rate', data.totalShifts > 0 ? `${((data.completedShifts / data.totalShifts) * 100).toFixed(1)}%` : '0%']
      ];

      downloadCSV(csvRows, `shift-coverage-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      toast({ title: "Report Generated", description: "Shift coverage report downloaded successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate report", variant: "destructive" });
    } finally {
      setGeneratingReport(null);
    }
  };

  const generateCostAnalysisReport = async () => {
    setGeneratingReport("cost-analysis");
    try {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const startDate = format(monthStart, 'yyyy-MM-dd');
      const endDate = format(monthEnd, 'yyyy-MM-dd');

      const response = await apiRequest('GET', `/api/hours/report?startDate=${startDate}&endDate=${endDate}`);
      const data = await response.json();

      const totalHours = data.summary?.totalHours || 0;
      const totalPay = data.summary?.totalPay || 0;

      const csvRows = [
        ['Labor Cost Analysis Report', format(today, 'MMMM yyyy')],
        [],
        ['Employee Name', 'Position', 'Hours Worked', 'Hourly Rate', 'Total Cost'],
        ...(data.employees || []).map((emp: any) => [
          emp.employeeName || 'Unknown',
          emp.position || 'N/A',
          (emp.totalHours || 0).toFixed(2),
          `₱${(emp.hourlyRate || 0).toFixed(2)}`,
          `₱${(emp.estimatedPay || 0).toFixed(2)}`
        ]),
        [],
        ['Total Labor Hours', totalHours.toFixed(2)],
        ['Total Labor Cost', `₱${totalPay.toFixed(2)}`],
        ['Average Cost per Hour', totalHours > 0 ? `₱${(totalPay / totalHours).toFixed(2)}` : '₱0.00']
      ];

      downloadCSV(csvRows, `cost-analysis-${format(today, 'yyyy-MM')}.csv`);
      toast({ title: "Report Generated", description: "Cost analysis report downloaded successfully" });
    } catch (error: any) {
      console.error('Cost Analysis Report Error:', error);
      toast({ title: "Error", description: error.message || "Failed to generate report", variant: "destructive" });
    } finally {
      setGeneratingReport(null);
    }
  };

  // Helper function to download CSV with UTF-8 BOM for proper Excel encoding
  const downloadCSV = (rows: any[][], filename: string) => {
    const csvContent = rows.map(row => row.join(',')).join('\n');
    // Add UTF-8 BOM for proper encoding in Excel
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Export All Reports
  const handleExportAll = async () => {
    setGeneratingReport("export-all");
    try {
      // Generate all reports sequentially
      await generateDailyAttendanceReport();
      await generateWeeklyPayrollReport();
      await generateCostAnalysisReport();

      toast({
        title: "All Reports Exported",
        description: "All reports have been downloaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to export all reports",
        variant: "destructive",
      });
    } finally {
      setGeneratingReport(null);
    }
  };

  const reportCards = [
    {
      title: "Payroll Summary",
      icon: DollarSign,
      description: "Monthly payroll breakdown and costs",
      value: payrollData?.totalPayroll ? `₱${payrollData.totalPayroll.toLocaleString()}` : "₱0",
      change: "+12.5%",
      changeType: "positive" as const,
    },
    {
      title: "Employee Hours",
      icon: Clock,
      description: "Total hours worked this month",
      value: attendanceData?.totalHours ? `${attendanceData.totalHours}h` : "0h",
      change: "+8.2%",
      changeType: "positive" as const,
    },
    {
      title: "Active Employees",
      icon: Users,
      description: "Currently active staff members",
      value: employeeData?.activeCount || "0",
      change: "+2",
      changeType: "positive" as const,
    },
    {
      title: "Shifts Completed",
      icon: Calendar,
      description: "Shifts completed this month",
      value: shiftsData?.completedShifts || "0",
      change: "+15.3%",
      changeType: "positive" as const,
    },
  ];

  const quickReports = [
    {
      title: "Daily Attendance Report",
      description: "View daily clock-in/out records",
      icon: Clock,
      action: "Generate",
      handler: generateDailyAttendanceReport,
      id: "daily-attendance"
    },
    {
      title: "Weekly Payroll Report",
      description: "Detailed payroll breakdown by week",
      icon: DollarSign,
      action: "Generate",
      handler: generateWeeklyPayrollReport,
      id: "weekly-payroll"
    },
    {
      title: "Employee Performance",
      description: "Individual employee metrics",
      icon: TrendingUp,
      action: "Generate",
      handler: generateEmployeePerformanceReport,
      id: "employee-performance"
    },
    {
      title: "Branch Comparison",
      description: "Compare performance across branches",
      icon: BarChart3,
      action: "Generate",
      handler: generateBranchComparisonReport,
      id: "branch-comparison"
    },
    {
      title: "Shift Coverage Report",
      description: "Analyze shift coverage and gaps",
      icon: Calendar,
      action: "Generate",
      handler: generateShiftCoverageReport,
      id: "shift-coverage"
    },
    {
      title: "Cost Analysis",
      description: "Labor cost breakdown and trends",
      icon: PieChart,
      action: "Generate",
      handler: generateCostAnalysisReport,
      id: "cost-analysis"
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Reports & Analytics</h2>
          <p className="text-muted-foreground">Comprehensive business insights and reporting</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => window.location.href = '/hours-report'}
          >
            <Clock className="h-4 w-4 mr-2" />
            Hours Report
          </Button>
          <Button
            className="flex items-center space-x-2"
            onClick={handleExportAll}
            disabled={generatingReport === "export-all"}
          >
            <Download className="h-4 w-4" />
            <span>{generatingReport === "export-all" ? "Exporting..." : "Export All"}</span>
          </Button>
        </div>
      </div>

      {/* Team Hours Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700 dark:text-purple-300 font-medium mb-1">Team Hours This Week</p>
                <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                  {teamHours?.thisWeek?.toFixed(1) || '0.0'}
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                  {teamHours?.weekShifts || 0} shifts
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-200 dark:bg-purple-800 rounded-lg flex items-center justify-center">
                <Clock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700 dark:text-orange-300 font-medium mb-1">Team Hours This Month</p>
                <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">
                  {teamHours?.thisMonth?.toFixed(1) || '0.0'}
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                  {teamHours?.monthShifts || 0} shifts
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-200 dark:bg-orange-800 rounded-lg flex items-center justify-center">
                <Clock className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-1">Active Employees</p>
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                  {teamHours?.employeeCount || 0}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  in your branch
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-200 dark:bg-blue-800 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Employee Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employeeStats?.totalEmployees ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {employeeStats?.activeEmployees ?? 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hours This Month</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(employeeStats?.totalHoursThisMonth ?? 0).toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              Total worked hours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payroll Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₱{(employeeStats?.totalPayrollThisMonth ?? 0).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Hours Report Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-1">Total Hours</p>
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                  {(hoursReportData?.summary?.totalHours ?? 0).toFixed(1)}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-200 dark:bg-blue-800 rounded-lg flex items-center justify-center">
                <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 dark:text-green-300 font-medium mb-1">Total Pay</p>
                <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                  ₱{(hoursReportData?.summary?.totalPay ?? 0).toFixed(0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-200 dark:bg-green-800 rounded-lg flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700 dark:text-purple-300 font-medium mb-1">Total Shifts</p>
                <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                  {hoursReportData?.summary?.totalShifts ?? 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-200 dark:bg-purple-800 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700 dark:text-orange-300 font-medium mb-1">Employees</p>
                <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">
                  {hoursReportData?.summary?.employeeCount ?? 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-200 dark:bg-orange-800 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 text-primary mr-2" />
            Quick Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickReports.map((report, index) => (
              <div
                key={index}
                className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <report.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-sm">{report.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{report.description}</p>
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-3"
                  onClick={report.handler}
                  disabled={generatingReport === report.id}
                  data-testid={`generate-${report.title.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {generatingReport === report.id ? (
                    <>
                      <Download className="h-4 w-4 mr-2 animate-bounce" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      {report.action}
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Payroll Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {payrollData?.recentActivity?.length > 0 ? (
                payrollData.recentActivity.map((activity: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">{activity.date}</p>
                    </div>
                    <span className="text-sm font-medium">₱{activity.amount}</span>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-4">No recent payroll activity</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {attendanceData?.trends?.length > 0 ? (
                attendanceData.trends.map((trend: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{trend.period}</p>
                      <p className="text-xs text-muted-foreground">{trend.description}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium">{trend.hours}h</span>
                      <div className="flex items-center">
                        <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                        <span className="text-xs text-green-500">{trend.change}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-4">No attendance data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
