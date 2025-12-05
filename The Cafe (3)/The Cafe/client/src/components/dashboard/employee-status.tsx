import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCog } from "lucide-react";
import { getInitials, getStatusColor } from "@/lib/utils";

export default function EmployeeStatus() {
  const { data: employeeStatus, isLoading } = useQuery({
    queryKey: ["/api/dashboard/employee-status"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <UserCog className="h-5 w-5 text-primary mr-2" />
            Employee Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <UserCog className="h-5 w-5 text-primary mr-2" />
          Employee Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {employeeStatus?.employeeStatus?.length > 0 ? (
            employeeStatus.employeeStatus.map((employee: any) => (
              <div
                key={employee.user.id}
                className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                data-testid={`employee-status-${employee.user.id}`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-primary-foreground font-medium text-sm">
                      {getInitials(employee.user.firstName, employee.user.lastName)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium" data-testid={`employee-name-${employee.user.id}`}>
                      {employee.user.firstName} {employee.user.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid={`employee-position-${employee.user.id}`}>
                      {employee.user.position}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span 
                    className={`px-3 py-1 text-xs rounded-full ${getStatusColor(employee.status)}`}
                    data-testid={`employee-status-badge-${employee.user.id}`}
                  >
                    {employee.status}
                  </span>
                  {employee.statusInfo && (
                    <p className="text-xs text-muted-foreground mt-1" data-testid={`employee-status-info-${employee.user.id}`}>
                      {employee.statusInfo}
                    </p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No employees found
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
