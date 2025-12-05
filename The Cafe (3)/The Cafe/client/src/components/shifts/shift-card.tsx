import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTime } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ShiftCardProps {
  trade: any;
  type: "available" | "my";
  "data-testid"?: string;
}

export default function ShiftCard({ trade, type, "data-testid": testId }: ShiftCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const takeShiftMutation = useMutation({
    mutationFn: (tradeId: string) => 
      apiRequest("PUT", `/api/shift-trades/${tradeId}/take`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-trades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shift-trades/available"] });
      toast({
        title: "Success",
        description: "Shift trade request sent for approval",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to take shift",
        variant: "destructive",
      });
    },
  });

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "urgent":
        return "bg-destructive text-destructive-foreground";
      case "normal":
        return "bg-chart-2 text-accent-foreground";
      case "low":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-chart-2 text-accent-foreground";
      case "approved":
        return "bg-accent text-accent-foreground";
      case "rejected":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Card data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-medium" data-testid={`employee-name-${trade.id}`}>
              {trade.fromUser?.firstName} {trade.fromUser?.lastName}
            </p>
            <p className="text-sm text-muted-foreground" data-testid={`employee-position-${trade.id}`}>
              {trade.fromUser?.position}
            </p>
          </div>
          <Badge 
            className={getUrgencyColor(trade.urgency)}
            data-testid={`urgency-${trade.id}`}
          >
            {trade.urgency}
          </Badge>
        </div>

        {trade.shift && (
          <div className="mb-3 space-y-1">
            <p className="text-sm">
              <strong>Date:</strong> {formatDate(trade.shift.startTime)}
            </p>
            <p className="text-sm">
              <strong>Time:</strong> {formatTime(trade.shift.startTime)} - {formatTime(trade.shift.endTime)}
            </p>
            <p className="text-sm">
              <strong>Position:</strong> {trade.shift.position}
            </p>
            {trade.reason && (
              <p className="text-sm">
                <strong>Reason:</strong> {trade.reason}
              </p>
            )}
          </div>
        )}

        {type === "available" ? (
          <Button
            className="w-full"
            onClick={() => takeShiftMutation.mutate(trade.id)}
            disabled={takeShiftMutation.isPending}
            data-testid={`button-take-shift-${trade.id}`}
          >
            {takeShiftMutation.isPending ? "Taking..." : "Take This Shift"}
          </Button>
        ) : (
          <div className="flex items-center justify-between">
            <Badge 
              className={getStatusColor(trade.status)}
              data-testid={`status-${trade.id}`}
            >
              {trade.status}
            </Badge>
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                data-testid={`button-edit-${trade.id}`}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="destructive"
                data-testid={`button-cancel-${trade.id}`}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
