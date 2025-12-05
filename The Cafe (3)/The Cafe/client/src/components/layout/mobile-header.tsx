import { Button } from "@/components/ui/button";
import { Menu, X, ArrowLeft, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  showMenu?: boolean;
  menuOpen?: boolean;
  onMenuToggle?: () => void;
  onBack?: () => void;
  notificationCount?: number;
  onNotificationClick?: () => void;
  rightAction?: React.ReactNode;
}

export default function MobileHeader({
  title,
  subtitle,
  showBack = false,
  showMenu = true,
  menuOpen = false,
  onMenuToggle,
  onBack,
  notificationCount = 0,
  onNotificationClick,
  rightAction,
}: MobileHeaderProps) {
  return (
    <div className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-md">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 flex-1">
          {showBack && (
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-primary-foreground/20"
              onClick={onBack || (() => window.history.back())}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="flex-1">
            <h2 className="font-semibold text-lg">{title}</h2>
            {subtitle && <p className="text-xs opacity-90">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNotificationClick && (
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-primary-foreground/20 relative"
              onClick={onNotificationClick}
            >
              <Bell className="h-5 w-5" />
              {notificationCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {notificationCount > 9 ? '9+' : notificationCount}
                </Badge>
              )}
            </Button>
          )}

          {rightAction}

          {showMenu && onMenuToggle && (
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-primary-foreground/20"
              onClick={onMenuToggle}
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

