import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface QuickActionButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: "default" | "primary" | "success" | "warning" | "danger";
  disabled?: boolean;
}

export default function QuickActionButton({
  icon: Icon,
  label,
  onClick,
  variant = "default",
  disabled = false,
}: QuickActionButtonProps) {
  const variantStyles = {
    default: "bg-card hover:bg-muted border-border",
    primary: "bg-primary/10 hover:bg-primary/20 border-primary/20 text-primary",
    success: "bg-green-50 hover:bg-green-100 border-green-200 text-green-700 dark:bg-green-950 dark:hover:bg-green-900 dark:border-green-800 dark:text-green-400",
    warning: "bg-yellow-50 hover:bg-yellow-100 border-yellow-200 text-yellow-700 dark:bg-yellow-950 dark:hover:bg-yellow-900 dark:border-yellow-800 dark:text-yellow-400",
    danger: "bg-red-50 hover:bg-red-100 border-red-200 text-red-700 dark:bg-red-950 dark:hover:bg-red-900 dark:border-red-800 dark:text-red-400",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all active:scale-95 ${
        variantStyles[variant]
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <div className="w-12 h-12 rounded-full bg-background/50 flex items-center justify-center mb-2">
        <Icon className="h-6 w-6" />
      </div>
      <span className="text-sm font-medium text-center">{label}</span>
    </button>
  );
}

