import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, Clock, FileText, Download, Calculator, Shield, AlertCircle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUser } from "@/lib/auth";

interface PayrollEntry {
  id: string;
  userId: string;
  payrollPeriodId: string;
  totalHours: number | string;
  regularHours: number | string;
  grossPay: number | string;
  deductions: number | string;
  netPay: number | string;
  status: string;
  createdAt: string;
  // Blockchain fields
  blockchainHash?: string;
  blockNumber?: number;
  transactionHash?: string;
  verified?: boolean;
}

interface PayrollPeriod {
  id: string;
  branchId: string;
  startDate: string;
  endDate: string;
  status: string;
  totalHours?: number;
  totalPay?: number;
}

export default function Payroll() {
  const currentUser = getCurrentUser();
  const { toast } = useToast();

  // Fetch payroll entries for current user
  const { data: payrollData, isLoading: payrollLoading } = useQuery({
    queryKey: ['payroll-entries'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/payroll');
      return response.json();
    },
  });

  // Fetch current payroll period
  const { data: currentPeriod } = useQuery({
    queryKey: ['current-payroll-period'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/payroll/periods/current?branchId=${currentUser?.branchId}`);
      return response.json();
    },
  });

  // Handle blockchain operations
  const handleBlockchainStore = async (entryId: string) => {
    try {
      await apiRequest("POST", "/api/blockchain/payroll/store", { payrollEntryId: entryId });
      toast({
        title: "Success",
        description: "Payroll record stored on blockchain",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to store on blockchain",
        variant: "destructive",
      });
    }
  };

  const handleBlockchainVerify = async (entryId: string) => {
    try {
      await apiRequest("POST", "/api/blockchain/payroll/verify", { payrollEntryId: entryId });
      toast({
        title: "Success",
        description: "Payroll record verified against blockchain",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to verify blockchain record",
        variant: "destructive",
      });
    }
  };

  const handleDownloadPayslip = async (entryId: string) => {
    try {
      const response = await apiRequest('GET', `/api/payroll/payslip/${entryId}`);
      const payslipData = await response.json();

      // Fetch and convert logo to base64 for offline viewing
      let logoBase64 = '';
      try {
        const logoResponse = await fetch('/LOGO.png');
        const logoBlob = await logoResponse.blob();
        logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(logoBlob);
        });
      } catch (e) {
        console.warn('Failed to load logo, using fallback');
      }

      // Create Philippine-format payslip for download
      const payslip = payslipData.payslip;
      const hourlyRate = parseFloat(payslip.hourlyRate || 0);
      const dailyRate = hourlyRate * 8; // 8 hours per day
      const basicPay = parseFloat(payslip.basicPay || payslip.grossPay || 0);
      const holidayPay = parseFloat(payslip.holidayPay || 0);
      const nightDiffPay = parseFloat(payslip.nightDiffPay || 0);
      const restDayPay = parseFloat(payslip.restDayPay || 0);
      const grossPay = parseFloat(payslip.grossPay || 0);
      const sssContribution = parseFloat(payslip.sssContribution || 0);
      const sssLoan = parseFloat(payslip.sssLoan || 0);
      const philHealthContribution = parseFloat(payslip.philHealthContribution || 0);
      const pagibigContribution = parseFloat(payslip.pagibigContribution || 0);
      const pagibigLoan = parseFloat(payslip.pagibigLoan || 0);
      const withholdingTax = parseFloat(payslip.withholdingTax || 0);
      const advances = parseFloat(payslip.advances || 0);
      const otherDeductions = parseFloat(payslip.otherDeductions || 0);
      const totalDeductions = parseFloat(payslip.totalDeductions || payslip.deductions || 0);
      const netPay = parseFloat(payslip.netPay || 0);

      // Calculate total earnings
      const totalEarnings = basicPay + holidayPay + nightDiffPay + restDayPay;

      // Format pay period dates
      const periodStart = payslip.periodStart ? format(new Date(payslip.periodStart), "MMMM dd, yyyy") : format(new Date(payslip.period), "MMMM dd, yyyy");
      const periodEnd = payslip.periodEnd ? format(new Date(payslip.periodEnd), "MMMM dd, yyyy") : format(new Date(payslip.period), "MMMM dd, yyyy");

      const payslipHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payslip - ${payslip.employeeName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; font-size: 11px; padding: 20px; max-width: 800px; margin: 0 auto; }
            .payslip-container { border: 1px solid #000; }
            .header-section { display: flex; border-bottom: 1px solid #000; }
            .logo-section { width: 120px; padding: 10px; border-right: 1px solid #000; display: flex; align-items: center; justify-content: center; }
            .logo-section img { max-width: 100px; max-height: 80px; }
            .info-section { flex: 1; padding: 8px 15px; }
            .info-row { display: flex; margin-bottom: 3px; }
            .info-label { font-weight: bold; width: 140px; color: #0000CC; }
            .info-value { flex: 1; }
            .main-content { display: flex; }
            .earnings-column { flex: 1; border-right: 1px solid #000; }
            .deductions-column { flex: 1; }
            .column-header { background: #f0f0f0; padding: 5px 10px; font-weight: bold; border-bottom: 1px solid #000; text-align: center; }
            .section-header { background: #e8e8e8; padding: 3px 10px; font-weight: bold; border-bottom: 1px solid #ccc; }
            .row { display: flex; justify-content: space-between; padding: 2px 10px; border-bottom: 1px solid #eee; }
            .row.highlight { background: #ffffd0; }
            .row-label { color: #0000CC; }
            .row-amount { text-align: right; min-width: 80px; }
            .total-row { display: flex; justify-content: space-between; padding: 5px 10px; font-weight: bold; background: #f5f5f5; border-top: 2px solid #000; }
            .acknowledge-section { border-top: 1px solid #000; padding: 15px; text-align: center; }
            .acknowledge-title { font-weight: bold; margin-bottom: 10px; }
            .acknowledge-text { font-size: 10px; font-style: italic; }
            .netpay-section { display: flex; border-top: 1px solid #000; }
            .netpay-spacer { flex: 1; border-right: 1px solid #000; }
            .netpay-box { flex: 1; display: flex; justify-content: space-between; padding: 10px 15px; font-weight: bold; font-size: 14px; }
            .netpay-label { color: #000; }
            .netpay-amount { color: #CC0000; }
            .sub-total-row { display: flex; justify-content: space-between; padding: 3px 10px; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; background: #f9f9f9; }
          </style>
        </head>
        <body>
          <div class="payslip-container">
            <!-- Header with Logo and Employee Info -->
            <div class="header-section">
              <div class="logo-section">
                <img src="${logoBase64 || '/LOGO.png'}" alt="Don Macchiatos" onerror="this.style.display='none';" />
              </div>
              <div class="info-section">
                <div class="info-row">
                  <span class="info-label">NAME</span>
                  <span class="info-value">${payslip.employeeName}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">COMPANY</span>
                  <span class="info-value">DON MACCHIATOS</span>
                </div>
                <div class="info-row">
                  <span class="info-label">POSITION</span>
                  <span class="info-value">${payslip.position || 'Employee'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">EMPLOYEE ID</span>
                  <span class="info-value">${payslip.employeeId || ''}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">PAY PERIOD</span>
                  <span class="info-value">${periodStart} – ${periodEnd}</span>
                </div>
              </div>
            </div>

            <!-- Main Content: Earnings and Deductions -->
            <div class="main-content">
              <!-- Earnings Column -->
              <div class="earnings-column">
                <div class="column-header">EARNINGS:</div>

                <div class="row highlight">
                  <span class="row-label">DAILY RATE: ₱${dailyRate.toFixed(2)}</span>
                  <span class="row-amount"></span>
                </div>
                <div class="row">
                  <span class="row-label">BASIC PAY</span>
                  <span class="row-amount">${basicPay.toFixed(2)}</span>
                </div>
                <div class="row">
                  <span class="row-label">LATE/UNDERTIME</span>
                  <span class="row-amount">0.00</span>
                </div>
                <div class="sub-total-row">
                  <span class="row-label">Sub-Total</span>
                  <span class="row-amount">${basicPay.toFixed(2)}</span>
                </div>

                <div class="section-header">OTHER INCOME</div>
                <div class="row">
                  <span class="row-label">Holiday Pay</span>
                  <span class="row-amount">${holidayPay.toFixed(2)}</span>
                </div>
                <div class="row">
                  <span class="row-label">Night Differential</span>
                  <span class="row-amount">${nightDiffPay.toFixed(2)}</span>
                </div>
                <div class="row">
                  <span class="row-label">Rest Day Pay</span>
                  <span class="row-amount">${restDayPay.toFixed(2)}</span>
                </div>

                <div class="section-header">ALLOWANCES</div>
                <div class="row">
                  <span class="row-label">Rice Subsidy</span>
                  <span class="row-amount">0.00</span>
                </div>
                <div class="row">
                  <span class="row-label">Meal Allowance</span>
                  <span class="row-amount">0.00</span>
                </div>
                <div class="row">
                  <span class="row-label">Transportation</span>
                  <span class="row-amount">0.00</span>
                </div>

                <div class="total-row">
                  <span>TOTAL EARNINGS</span>
                  <span>${totalEarnings.toFixed(2)}</span>
                </div>
              </div>

              <!-- Deductions Column -->
              <div class="deductions-column">
                <div class="column-header">DEDUCTIONS:</div>

                <div class="section-header" style="visibility: hidden;">AMOUNT</div>
                <div class="row">
                  <span class="row-label">SSS PREMIUM</span>
                  <span class="row-amount">${sssContribution.toFixed(2)}</span>
                </div>
                <div class="row">
                  <span class="row-label">PHILHEALTH</span>
                  <span class="row-amount">${philHealthContribution.toFixed(2)}</span>
                </div>
                <div class="row">
                  <span class="row-label">HDMF (Pag-IBIG)</span>
                  <span class="row-amount">${pagibigContribution.toFixed(2)}</span>
                </div>
                <div class="row">
                  <span class="row-label">TAX WITHHELD</span>
                  <span class="row-amount">${withholdingTax.toFixed(2)}</span>
                </div>

                <div class="section-header">LOANS & OTHERS</div>
                <div class="row">
                  <span class="row-label">SSS LOAN</span>
                  <span class="row-amount">${sssLoan.toFixed(2)}</span>
                </div>
                <div class="row">
                  <span class="row-label">HDMF LOAN</span>
                  <span class="row-amount">${pagibigLoan.toFixed(2)}</span>
                </div>
                <div class="row">
                  <span class="row-label">CASH ADVANCE</span>
                  <span class="row-amount">${advances.toFixed(2)}</span>
                </div>
                <div class="row">
                  <span class="row-label">OTHERS</span>
                  <span class="row-amount">${otherDeductions.toFixed(2)}</span>
                </div>

                <div class="acknowledge-section">
                  <div class="acknowledge-title">ACKNOWLEDGE RECEIPT</div>
                  <div class="acknowledge-text">
                    I AGREE WITH THE WAGE COMPUTATION<br/>
                    ACKNOWLEDGE RECEIPT OF THE SAME.
                  </div>
                  <div style="margin-top: 20px; border-bottom: 1px solid #000; width: 80%; margin-left: auto; margin-right: auto;"></div>
                  <div style="font-size: 9px; margin-top: 3px;">Employee Signature / Date</div>
                </div>

                <div class="total-row">
                  <span>TOTAL DEDUCTIONS</span>
                  <span>${totalDeductions.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <!-- Net Pay Section -->
            <div class="netpay-section">
              <div class="netpay-spacer"></div>
              <div class="netpay-box">
                <span class="netpay-label">NET PAY</span>
                <span class="netpay-amount">₱${netPay.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      // Create and download the file
      const blob = new Blob([payslipHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payslip_${payslipData.payslip.employeeName}_${format(new Date(payslipData.payslip.period), "yyyy-MM-dd")}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Payslip Downloaded",
        description: "Payslip has been downloaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to download payslip",
        variant: "destructive",
      });
    }
  };

  const payrollEntries = payrollData?.entries || [];
  const currentPeriodData = currentPeriod?.period;

  // Calculate summary statistics
  const totalGrossPay = payrollEntries.reduce((sum: number, entry: PayrollEntry) => {
    const value = typeof entry.grossPay === 'number' ? entry.grossPay : parseFloat(String(entry.grossPay) || '0');
    return sum + value;
  }, 0);
  const totalNetPay = payrollEntries.reduce((sum: number, entry: PayrollEntry) => {
    const value = typeof entry.netPay === 'number' ? entry.netPay : parseFloat(String(entry.netPay) || '0');
    return sum + value;
  }, 0);
  const totalDeductions = payrollEntries.reduce((sum: number, entry: PayrollEntry) => {
    const value = typeof entry.deductions === 'number' ? entry.deductions : parseFloat(String(entry.deductions) || '0');
    return sum + value;
  }, 0);
  const totalHours = payrollEntries.reduce((sum: number, entry: PayrollEntry) => {
    const value = typeof entry.totalHours === 'number' ? entry.totalHours : parseFloat(String(entry.totalHours) || '0');
    return sum + value;
  }, 0);

  if (payrollLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Payroll Summary</h2>
          <p className="text-muted-foreground">
            View your pay details, cutoff periods, and computation breakdown
          </p>
        </div>
      </div>

      <Tabs defaultValue="current" className="space-y-4">
        <TabsList>
          <TabsTrigger value="current">
            <Calendar className="h-4 w-4 mr-2" />
            Current Period
          </TabsTrigger>
          <TabsTrigger value="history">
            <FileText className="h-4 w-4 mr-2" />
            Pay History
          </TabsTrigger>
          <TabsTrigger value="summary">
            <Calculator className="h-4 w-4 mr-2" />
            Summary
          </TabsTrigger>
        </TabsList>

        <TabsContent value="current">
          <div className="grid gap-6">
            {/* Current Period Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="h-5 w-5 text-primary mr-2" />
                  Current Payroll Period
                </CardTitle>
              </CardHeader>
              <CardContent>
                {currentPeriodData ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Start Date</p>
                      <p className="text-lg font-semibold">
                        {format(new Date(currentPeriodData.startDate), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">End Date</p>
                      <p className="text-lg font-semibold">
                        {format(new Date(currentPeriodData.endDate), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Status</p>
                      <Badge
                        variant={currentPeriodData.status === 'open' ? 'default' : 'secondary'}
                        className="text-sm"
                      >
                        {currentPeriodData.status}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No active payroll period</p>
                )}
              </CardContent>
            </Card>

            {/* Current Period Summary */}
            {payrollEntries.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalHours.toFixed(1)}</div>
                    <p className="text-xs text-muted-foreground">This period</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Gross Pay</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">₱{totalGrossPay.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">Before deductions</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Deductions</CardTitle>
                    <Calculator className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">-₱{totalDeductions.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">Taxes & other deductions</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Net Pay</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">₱{totalNetPay.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">Take home pay</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Pay Breakdown */}
            {payrollEntries.map((entry: PayrollEntry) => (
              <Card key={entry.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Pay Period: {format(new Date(entry.createdAt), "MMM d, yyyy")}</span>
                    <Badge variant={entry.status === 'paid' ? 'default' : 'secondary'}>
                      {entry.status}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Regular Hours:</span>
                        <span className="font-medium">{String(entry.regularHours)}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Total Hours:</span>
                        <span className="font-medium">{String(entry.totalHours)}h</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Gross Pay:</span>
                        <span className="font-medium">₱{parseFloat(String(entry.grossPay || 0)).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Deductions:</span>
                        <span className="font-medium text-red-600">-₱{parseFloat(String(entry.deductions || 0)).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>Net Pay:</span>
                        <span className="text-green-600">₱{parseFloat(String(entry.netPay || 0)).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {/* Blockchain verification badge */}
                        {entry.verified ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <Shield className="h-3 w-3 mr-1" />
                            Blockchain Verified
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Not Verified
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadPayslip(entry.id)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download Payslip
                        </Button>
                        {!entry.verified && (
                          <Button
                            size="sm"
                            onClick={() => handleBlockchainStore(entry.id)}
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            Store on Blockchain
                          </Button>
                        )}
                        {entry.verified && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleBlockchainVerify(entry.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Verify
                          </Button>
                        )}
                      </div>
                    </div>
                    {entry.blockchainHash && (
                      <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center space-x-2 text-sm">
                          <Shield className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-800">Blockchain Record</span>
                        </div>
                        <div className="mt-1 text-xs text-green-700">
                          <p>Hash: {entry.blockchainHash.substring(0, 16)}...</p>
                          <p>Block: {entry.blockNumber}</p>
                          <p>Transaction: {entry.transactionHash?.substring(0, 16)}...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {payrollEntries.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">No payroll data available for the current period</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Payroll History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {payrollEntries.map((entry: PayrollEntry) => (
                  <div key={entry.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">
                        Period ending {format(new Date(entry.createdAt), "MMM d, yyyy")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {String(entry.totalHours)}h • ₱{parseFloat(String(entry.netPay || 0)).toFixed(2)} net pay
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={entry.status === 'paid' ? 'default' : 'secondary'}>
                        {entry.status}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadPayslip(entry.id)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {payrollEntries.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No payroll history available
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Year-to-Date Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">{totalHours.toFixed(1)}</p>
                    <p className="text-sm text-muted-foreground">Total Hours Worked</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">₱{totalNetPay.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">Total Net Pay</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-muted-foreground">
                      {payrollEntries.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Pay Periods</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payroll Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Gross Pay</span>
                    <span className="font-medium">₱{totalGrossPay.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Deductions</span>
                    <span>-₱{totalDeductions.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg border-t pt-2">
                    <span>Net Pay</span>
                    <span className="text-green-600">₱{totalNetPay.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
