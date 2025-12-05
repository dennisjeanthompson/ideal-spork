import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Settings, Save } from "lucide-react";
import { useState, useEffect } from "react";

interface DeductionSettings {
  id: string;
  branchId: string;
  deductSSS: boolean;
  deductPhilHealth: boolean;
  deductPagibig: boolean;
  deductWithholdingTax: boolean;
}

export default function DeductionSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<DeductionSettings | null>(null);

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ["/api/deduction-settings"],
  });

  useEffect(() => {
    if (settingsData?.settings) {
      setSettings(settingsData.settings);
    }
  }, [settingsData]);

  const updateMutation = useMutation({
    mutationFn: async (updatedSettings: Partial<DeductionSettings>) => {
      if (!settings?.id) throw new Error("Settings not loaded");
      
      const response = await apiRequest(
        "PUT",
        `/api/deduction-settings/${settings.id}`,
        updatedSettings
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deduction-settings"] });
      toast({
        title: "Settings Updated",
        description: "Deduction settings have been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (field: keyof DeductionSettings, value: boolean) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
  };

  const handleSave = () => {
    if (!settings) return;
    updateMutation.mutate({
      deductSSS: settings.deductSSS,
      deductPhilHealth: settings.deductPhilHealth,
      deductPagibig: settings.deductPagibig,
      deductWithholdingTax: settings.deductWithholdingTax,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Payroll Deduction Settings
        </h2>
        <p className="text-muted-foreground">
          Configure which deductions are automatically applied to employee payroll
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mandatory Deductions</CardTitle>
          <CardDescription>
            Enable or disable automatic deductions for government contributions and taxes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sss" className="text-base font-medium">
                SSS Contribution
              </Label>
              <p className="text-sm text-muted-foreground">
                Social Security System employee contribution (Default: ON)
              </p>
            </div>
            <Switch
              id="sss"
              checked={settings?.deductSSS ?? true}
              onCheckedChange={(checked) => handleToggle("deductSSS", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="philhealth" className="text-base font-medium">
                PhilHealth Contribution
              </Label>
              <p className="text-sm text-muted-foreground">
                Philippine Health Insurance Corporation contribution (Default: OFF)
              </p>
            </div>
            <Switch
              id="philhealth"
              checked={settings?.deductPhilHealth ?? false}
              onCheckedChange={(checked) => handleToggle("deductPhilHealth", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="pagibig" className="text-base font-medium">
                Pag-IBIG Contribution
              </Label>
              <p className="text-sm text-muted-foreground">
                Home Development Mutual Fund contribution (Default: OFF)
              </p>
            </div>
            <Switch
              id="pagibig"
              checked={settings?.deductPagibig ?? false}
              onCheckedChange={(checked) => handleToggle("deductPagibig", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="tax" className="text-base font-medium">
                Withholding Tax
              </Label>
              <p className="text-sm text-muted-foreground">
                Bureau of Internal Revenue withholding tax (Default: OFF)
              </p>
            </div>
            <Switch
              id="tax"
              checked={settings?.deductWithholdingTax ?? false}
              onCheckedChange={(checked) => handleToggle("deductWithholdingTax", checked)}
            />
          </div>

          <div className="pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="w-full sm:w-auto"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

