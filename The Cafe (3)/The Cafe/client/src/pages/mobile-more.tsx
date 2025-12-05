import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Bell, LogOut, ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import MobileHeader from "@/components/layout/mobile-header";
import MobileBottomNav from "@/components/layout/mobile-bottom-nav";

export default function MobileMore() {
  const currentUser = getCurrentUser();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    try {
      await apiRequest('POST', '/api/auth/logout');
      localStorage.removeItem('auth-user');
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const menuItems = [
    {
      icon: User,
      label: "My Profile",
      description: "View and edit your profile",
      path: "/mobile-profile",
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    {
      icon: Bell,
      label: "Notifications",
      description: "View all notifications",
      path: "/mobile-notifications",
      color: "text-yellow-600",
      bgColor: "bg-yellow-50 dark:bg-yellow-950",
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <MobileHeader
        title="More"
        subtitle="Settings and options"
        showBack={false}
        showMenu={false}
      />

      <div className="p-4 space-y-6">
        {/* User Profile Card */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground text-2xl font-medium">
                  {currentUser?.firstName?.[0]}{currentUser?.lastName?.[0]}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-xl">
                  {currentUser?.firstName} {currentUser?.lastName}
                </h3>
                <p className="text-sm text-muted-foreground">{currentUser?.position}</p>
                <p className="text-xs text-muted-foreground mt-1">{currentUser?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Menu Items */}
        <div className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.path}
                className="cursor-pointer hover:bg-muted/50 transition-colors active:scale-[0.98]"
                onClick={() => setLocation(item.path)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl ${item.bgColor} flex items-center justify-center`}>
                      <Icon className={`h-6 w-6 ${item.color}`} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">{item.label}</h4>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Logout Button */}
        <Button
          variant="destructive"
          className="w-full h-14 text-lg"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5 mr-2" />
          Logout
        </Button>

        {/* App Info */}
        <div className="text-center text-sm text-muted-foreground pt-4">
          <p>The Café Management System</p>
          <p className="text-xs mt-1">Employee Portal v1.0</p>
        </div>
      </div>

      <MobileBottomNav />
    </div>
  );
}

