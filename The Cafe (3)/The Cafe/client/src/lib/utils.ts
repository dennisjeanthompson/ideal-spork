import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(date: Date | string | null): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleTimeString([], { 
    hour: "2-digit", 
    minute: "2-digit" 
  });
}

export function formatDate(date: Date | string | null): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function formatHours(hours: string | number | null): string {
  if (!hours) return "0h";
  const numHours = typeof hours === "string" ? parseFloat(hours) : hours;
  const wholeHours = Math.floor(numHours);
  const minutes = Math.round((numHours - wholeHours) * 60);
  
  if (minutes === 0) {
    return `${wholeHours}h`;
  }
  return `${wholeHours}h ${minutes}m`;
}

export function formatCurrency(amount: string | number | null): string {
  if (!amount) return "₱0.00";
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numAmount);
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "working":
    case "present":
    case "active":
      return "bg-accent text-accent-foreground";
    case "on break":
    case "break":
      return "bg-chart-2 text-accent-foreground";
    case "late":
    case "absent":
      return "bg-destructive text-destructive-foreground";
    case "scheduled":
      return "bg-muted text-muted-foreground";
    case "off":
    case "clocked out":
      return "bg-secondary text-secondary-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function getCurrentWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek; // First day is Sunday
  
  const start = new Date(now);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

export function getPayPeriodRange(): { start: Date; end: Date } {
  const now = new Date();
  const currentDate = now.getDate();
  
  // Assuming bi-weekly pay periods starting on the 1st and 16th
  let start: Date;
  if (currentDate >= 1 && currentDate <= 15) {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 16);
  }
  
  const end = new Date(start);
  end.setDate(start.getDate() + 14);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}
