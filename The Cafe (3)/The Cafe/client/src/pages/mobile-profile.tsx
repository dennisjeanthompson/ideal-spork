import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Briefcase, DollarSign, MapPin, Calendar } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { format } from "date-fns";
import MobileHeader from "@/components/layout/mobile-header";
import MobileBottomNav from "@/components/layout/mobile-bottom-nav";

export default function MobileProfile() {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    return null;
  }

  const profileSections = [
    {
      title: "Personal Information",
      items: [
        { icon: User, label: "Full Name", value: `${currentUser.firstName} ${currentUser.lastName}` },
        { icon: Mail, label: "Email", value: currentUser.email },
        { icon: Briefcase, label: "Position", value: currentUser.position },
      ],
    },
    {
      title: "Employment Details",
      items: [
        { icon: DollarSign, label: "Hourly Rate", value: `₱${currentUser.hourlyRate}/hr` },
        { icon: Calendar, label: "Member Since", value: currentUser.createdAt ? format(new Date(currentUser.createdAt), "MMMM yyyy") : "N/A" },
        { icon: MapPin, label: "Status", value: currentUser.isActive ? "Active" : "Inactive" },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <MobileHeader
        title="My Profile"
        subtitle="Your account information"
        showBack={true}
        showMenu={false}
      />

      <div className="p-4 space-y-6">
        {/* Profile Header */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6 text-center">
            <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-primary-foreground text-3xl font-medium">
                {currentUser.firstName[0]}{currentUser.lastName[0]}
              </span>
            </div>
            <h2 className="text-2xl font-bold mb-1">
              {currentUser.firstName} {currentUser.lastName}
            </h2>
            <p className="text-muted-foreground mb-3">{currentUser.position}</p>
            <Badge variant={currentUser.isActive ? "default" : "secondary"}>
              {currentUser.isActive ? "Active Employee" : "Inactive"}
            </Badge>
          </CardContent>
        </Card>

        {/* Profile Sections */}
        {profileSections.map((section, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="text-lg">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {section.items.map((item, itemIndex) => {
                const Icon = item.icon;
                return (
                  <div key={itemIndex} className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">{item.label}</p>
                      <p className="font-medium">{item.value}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Username</span>
              <span className="font-medium">{currentUser.username}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Role</span>
              <span className="font-medium capitalize">{currentUser.role}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Employee ID</span>
              <span className="font-mono text-xs">{currentUser.id.slice(0, 8)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <MobileBottomNav />
    </div>
  );
}

