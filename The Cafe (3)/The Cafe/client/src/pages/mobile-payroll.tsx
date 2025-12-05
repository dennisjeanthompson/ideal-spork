import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, Clock, Download } from "lucide-react";
import { format, parseISO } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { getCurrentUser, getAuthState } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import MobileHeader from "@/components/layout/mobile-header";
import MobileBottomNav from "@/components/layout/mobile-bottom-nav";

interface PayrollEntry {
  id: string;
  totalHours: number | string;
  grossPay: number | string;
  netPay: number | string;
  deductions: number | string;
  status: string;
  createdAt: string;
}

export default function MobilePayroll() {
  const currentUser = getCurrentUser();
  const { isAuthenticated, user } = getAuthState();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Wait for authentication to load
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // This component is only accessible on mobile server, so all users are employees

  // Fetch payroll entries
  const { data: payrollData, isLoading } = useQuery({
    queryKey: ['mobile-payroll', currentUser?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/payroll');
      return response.json();
    },
  });

  const payrollEntries: PayrollEntry[] = payrollData?.entries || [];

  const handleLogout = async () => {
    try {
      await apiRequest('POST', '/api/auth/logout');
      // Clear auth state
      localStorage.removeItem('auth-user');
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
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

      // Create Philippine-format payslip
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

      // Download the file
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <MobileHeader
        title="Payroll"
        subtitle="Payment history"
        showBack={true}
        onBack={() => setLocation('/mobile-dashboard')}
      />

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {/* Summary Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Payroll Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  ₱{payrollEntries.reduce((sum, entry) =>
                    sum + parseFloat(String(entry.netPay)), 0).toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground">Total Earned</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {payrollEntries.reduce((sum, entry) =>
                    sum + parseFloat(String(entry.totalHours)), 0).toFixed(1)}h
                </p>
                <p className="text-sm text-muted-foreground">Hours Worked</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payroll Entries */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Payment History</CardTitle>
            <CardDescription>
              Your recent payroll entries
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground">Loading payroll data...</p>
              </div>
            ) : payrollEntries.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No payroll entries yet</p>
                <p className="text-xs">Payroll entries will appear here after processing</p>
              </div>
            ) : (
              payrollEntries.map((entry) => (
                <div key={entry.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium">
                        {format(parseISO(entry.createdAt), "MMMM d, yyyy")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Pay Period
                      </p>
                    </div>
                    <Badge
                      variant={
                        entry.status === 'paid' ? 'default' :
                        entry.status === 'approved' ? 'secondary' : 'outline'
                      }
                    >
                      {entry.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Hours</p>
                      <p className="font-semibold">
                        {parseFloat(String(entry.totalHours)).toFixed(1)}h
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Gross Pay</p>
                      <p className="font-semibold">
                        ₱{parseFloat(String(entry.grossPay)).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground">Net Pay</p>
                      <p className="text-xl font-bold text-green-600">
                        ₱{parseFloat(String(entry.netPay)).toFixed(2)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadPayslip(entry.id)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Payslip
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <MobileBottomNav />
    </div>
  );
}
