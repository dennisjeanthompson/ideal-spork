import { Home, Calendar, DollarSign, User } from "lucide-react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";

interface MobileBottomNavProps {
  notificationCount?: number;
}

export default function MobileBottomNav({ notificationCount = 0 }: MobileBottomNavProps) {
  const [location, setLocation] = useLocation();

  const navItems = [
    { path: "/mobile-dashboard", icon: Home, label: "Home" },
    { path: "/mobile-schedule", icon: Calendar, label: "Schedule" },
    { path: "/mobile-payroll", icon: DollarSign, label: "Pay" },
    { path: "/mobile-more", icon: User, label: "More" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-lg z-50">
      <div className="flex items-center justify-around px-2 py-2 safe-area-inset-bottom">
        {navItems.map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all min-w-[60px] relative ${
                isActive
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Icon className={`h-5 w-5 mb-1 ${isActive ? "scale-110" : ""}`} />
              <span className="text-xs font-medium">{item.label}</span>

              {/* Notification badge for notifications tab */}
              {item.path === "/mobile-more" && notificationCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute top-1 right-2 h-4 w-4 flex items-center justify-center p-0 text-[10px]"
                >
                  {notificationCount > 9 ? '9+' : notificationCount}
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

