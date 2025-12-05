import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Coffee, Clock } from "lucide-react";
import { DashboardStats } from "@shared/schema";

export default function QuickStats() {
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  // Default values for stats with type safety
  const statsData = {
    clockedIn: stats?.stats?.clockedIn ?? 0,
    onBreak: stats?.stats?.onBreak ?? 0,
    late: stats?.stats?.late ?? 0,
  };

  const statCards = [
    {
      title: "Employees Clocked In",
      value: statsData.clockedIn,
      icon: Users,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "On Break",
      value: statsData.onBreak,
      icon: Coffee,
      color: "text-chart-2",
      bgColor: "bg-chart-2/10",
    },
    {
      title: "Late Arrivals",
      value: statsData.late,
      icon: Clock,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statCards.map((stat, index) => (
        <Card key={index} data-testid={`stat-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">{stat.title}</p>
                <p className={`text-3xl font-bold ${stat.color}`} data-testid={`value-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
                  {stat.value}
                </p>
              </div>
              <div className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
