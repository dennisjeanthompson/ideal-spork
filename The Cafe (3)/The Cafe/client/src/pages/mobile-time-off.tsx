import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, X, Check, Clock, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { getCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import MobileHeader from "@/components/layout/mobile-header";
import MobileBottomNav from "@/components/layout/mobile-bottom-nav";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TimeOffRequest {
  id: string;
  startDate: string;
  endDate: string;
  type: string;
  reason: string;
  status: string;
  requestedAt: string;
}

export default function MobileTimeOff() {
  const currentUser = getCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  // Calculate minimum date (3 days from today)
  const getMinDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    return format(date, "yyyy-MM-dd");
  };

  const [formData, setFormData] = useState({
    startDate: getMinDate(),
    endDate: getMinDate(),
    type: "vacation",
    reason: "",
  });

  // Fetch time off requests
  const { data: requestsData, isLoading } = useQuery({
    queryKey: ['mobile-time-off', currentUser?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/time-off-requests');
      return response.json();
    },
  });

  // Submit time off request
  const submitMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest('POST', '/api/time-off-requests', {
        ...data,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
        userId: currentUser?.id,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mobile-time-off'] });
      toast({
        title: "Success",
        description: "Time off request submitted successfully",
      });
      setShowForm(false);
      setFormData({
        startDate: getMinDate(),
        endDate: getMinDate(),
        type: "vacation",
        reason: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit request",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.reason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for your request",
        variant: "destructive",
      });
      return;
    }

    // Validate 3-day advance notice
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 3);
    minDate.setHours(0, 0, 0, 0);

    const startDate = new Date(formData.startDate);
    startDate.setHours(0, 0, 0, 0);

    if (startDate < minDate) {
      toast({
        title: "Error",
        description: "Time off requests must be submitted at least 3 days in advance",
        variant: "destructive",
      });
      return;
    }

    submitMutation.mutate(formData);
  };

  const requests: TimeOffRequest[] = requestsData?.requests || [];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any }> = {
      pending: { variant: "secondary", icon: Clock },
      approved: { variant: "default", icon: Check },
      rejected: { variant: "destructive", icon: X },
    };
    const config = variants[status] || variants.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      vacation: "Vacation",
      sick: "Sick Leave",
      personal: "Personal",
      other: "Other",
    };
    return labels[type] || type;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <MobileHeader
        title="Time Off"
        subtitle="Request and manage time off"
        showBack={false}
        showMenu={false}
        rightAction={
          !showForm && (
            <Button
              size="sm"
              onClick={() => setShowForm(true)}
              className="bg-primary text-primary-foreground"
            >
              <Plus className="h-4 w-4 mr-1" />
              Request
            </Button>
          )
        }
      />

      <div className="p-4 space-y-4">
        {/* Request Form */}
        {showForm && (
          <Card className="border-primary/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">New Time Off Request</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowForm(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vacation">Vacation</SelectItem>
                      <SelectItem value="sick">Sick Leave</SelectItem>
                      <SelectItem value="personal">Personal</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <p className="text-xs text-muted-foreground">At least 3 days from today</p>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      min={getMinDate()}
                      onChange={(e) =>
                        setFormData({ ...formData, startDate: e.target.value, endDate: e.target.value > formData.endDate ? e.target.value : formData.endDate })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <p className="text-xs text-muted-foreground">&nbsp;</p>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      min={formData.startDate}
                      onChange={(e) =>
                        setFormData({ ...formData, endDate: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason</Label>
                  <Textarea
                    id="reason"
                    value={formData.reason}
                    onChange={(e) =>
                      setFormData({ ...formData, reason: e.target.value })
                    }
                    placeholder="Please provide a reason for your request..."
                    rows={4}
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={submitMutation.isPending}
                  >
                    {submitMutation.isPending ? "Submitting..." : "Submit Request"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Requests List */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg px-1">Your Requests</h3>
          
          {isLoading ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground animate-pulse mx-auto mb-2" />
              <p className="text-muted-foreground">Loading requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-2">No time off requests yet</p>
                <p className="text-sm text-muted-foreground">
                  Tap the "Request" button to submit your first request
                </p>
              </CardContent>
            </Card>
          ) : (
            requests.map((request) => (
              <Card key={request.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold">{getTypeLabel(request.type)}</h4>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(request.startDate), "MMM d")} -{" "}
                        {format(parseISO(request.endDate), "MMM d, yyyy")}
                      </p>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{request.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    Requested {format(parseISO(request.requestedAt), "MMM d, yyyy")}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <MobileBottomNav />
    </div>
  );
}

