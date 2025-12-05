import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRightLeft, Clock, MapPin, User, Plus, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { getCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import MobileHeader from "@/components/layout/mobile-header";
import MobileBottomNav from "@/components/layout/mobile-bottom-nav";

interface ShiftTrade {
  id: string;
  shift: {
    id: string;
    startTime: string;
    endTime: string;
    position: string;
  };
  fromUser: {
    firstName: string;
    lastName: string;
  };
  reason: string;
  status: string;
  urgency: string;
}

export default function MobileShiftTrading() {
  const currentUser = getCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"available" | "my">("available");

  // Fetch available shifts
  const { data: availableData, isLoading: loadingAvailable } = useQuery({
    queryKey: ['mobile-shift-trades-available'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/shift-trades/available');
      return response.json();
    },
  });

  // Fetch my trades
  const { data: myTradesData, isLoading: loadingMy } = useQuery({
    queryKey: ['mobile-shift-trades-my'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/shift-trades');
      return response.json();
    },
  });

  // Take shift mutation
  const takeShiftMutation = useMutation({
    mutationFn: (tradeId: string) =>
      apiRequest("PUT", `/api/shift-trades/${tradeId}/take`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mobile-shift-trades-available'] });
      queryClient.invalidateQueries({ queryKey: ['mobile-shift-trades-my'] });
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

  // Cancel trade mutation
  const cancelTradeMutation = useMutation({
    mutationFn: (tradeId: string) =>
      apiRequest("DELETE", `/api/shift-trades/${tradeId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mobile-shift-trades-my'] });
      toast({
        title: "Success",
        description: "Shift trade cancelled",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel trade",
        variant: "destructive",
      });
    },
  });

  const availableTrades: ShiftTrade[] = availableData?.trades || [];
  const myTrades: ShiftTrade[] = myTradesData?.trades || [];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: "secondary",
      approved: "default",
      rejected: "destructive",
    };
    return (
      <Badge variant={variants[status] || "secondary"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getUrgencyBadge = (urgency: string) => {
    const variants: Record<string, any> = {
      low: "secondary",
      normal: "default",
      high: "destructive",
    };
    return (
      <Badge variant={variants[urgency] || "default"} className="text-xs">
        {urgency.charAt(0).toUpperCase() + urgency.slice(1)}
      </Badge>
    );
  };

  const renderShiftCard = (trade: ShiftTrade, type: "available" | "my") => {
    return (
      <Card key={trade.id}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold">{trade.shift.position}</h4>
                {getUrgencyBadge(trade.urgency)}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                <span>
                  {format(parseISO(trade.shift.startTime), "MMM d, h:mm a")} -{" "}
                  {format(parseISO(trade.shift.endTime), "h:mm a")}
                </span>
              </div>
              {type === "available" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>
                    {trade.fromUser.firstName} {trade.fromUser.lastName}
                  </span>
                </div>
              )}
            </div>
            {type === "my" && getStatusBadge(trade.status)}
          </div>

          <p className="text-sm text-muted-foreground mb-3">{trade.reason}</p>

          {type === "available" ? (
            <Button
              className="w-full"
              onClick={() => takeShiftMutation.mutate(trade.id)}
              disabled={takeShiftMutation.isPending}
            >
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Take This Shift
            </Button>
          ) : trade.status === "pending" ? (
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => cancelTradeMutation.mutate(trade.id)}
              disabled={cancelTradeMutation.isPending}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel Trade
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <MobileHeader
        title="Shift Trading"
        subtitle="Trade shifts with coworkers"
        showBack={true}
        showMenu={false}
      />

      <div className="p-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2 bg-muted p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("available")}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${
              activeTab === "available"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            Available ({availableTrades.length})
          </button>
          <button
            onClick={() => setActiveTab("my")}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${
              activeTab === "my"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            My Trades ({myTrades.length})
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3">
          {activeTab === "available" ? (
            loadingAvailable ? (
              <div className="text-center py-8">
                <ArrowRightLeft className="h-12 w-12 text-muted-foreground animate-pulse mx-auto mb-2" />
                <p className="text-muted-foreground">Loading available shifts...</p>
              </div>
            ) : availableTrades.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <ArrowRightLeft className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-2">No available shifts</p>
                  <p className="text-sm text-muted-foreground">
                    Check back later for shifts to trade
                  </p>
                </CardContent>
              </Card>
            ) : (
              availableTrades.map((trade) => renderShiftCard(trade, "available"))
            )
          ) : loadingMy ? (
            <div className="text-center py-8">
              <ArrowRightLeft className="h-12 w-12 text-muted-foreground animate-pulse mx-auto mb-2" />
              <p className="text-muted-foreground">Loading your trades...</p>
            </div>
          ) : myTrades.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <ArrowRightLeft className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-2">No active trades</p>
                <p className="text-sm text-muted-foreground">
                  You haven't posted any shifts for trade
                </p>
              </CardContent>
            </Card>
          ) : (
            myTrades.map((trade) => renderShiftCard(trade, "my"))
          )}
        </div>
      </div>

      <MobileBottomNav />
    </div>
  );
}

