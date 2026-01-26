/**
 * Notifications Page
 * 
 * View and manage user notifications
 */
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, X, Clock, AlertCircle, CheckCircle, Info } from "lucide-react";

// Mock notifications data
const notifications = [
  {
    id: 1,
    type: "success",
    title: "Workflow Completed",
    message: "Your 'Research Pipeline' workflow has completed successfully.",
    timestamp: "2 minutes ago",
    unread: true,
  },
  {
    id: 2,
    type: "info",
    title: "New Version Available",
    message: "A new version of the platform is available with bug fixes and improvements.",
    timestamp: "1 hour ago",
    unread: true,
  },
  {
    id: 3,
    type: "warning",
    title: "PHI Scan Alert",
    message: "Potential PHI detected in Stage 5. Review required before proceeding.",
    timestamp: "3 hours ago",
    unread: true,
  },
  {
    id: 4,
    type: "info",
    title: "Team Member Added",
    message: "John Doe has been added to your organization.",
    timestamp: "Yesterday",
    unread: false,
  },
  {
    id: 5,
    type: "success",
    title: "Stage Approved",
    message: "Your IRB Proposal (Stage 3) has been approved.",
    timestamp: "2 days ago",
    unread: false,
  },
];

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "success":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "warning":
      return <AlertCircle className="h-5 w-5 text-amber-500" />;
    case "error":
      return <X className="h-5 w-5 text-red-500" />;
    default:
      return <Info className="h-5 w-5 text-blue-500" />;
  }
};

export default function NotificationsPage() {
  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto py-8 px-6 pt-24">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-ros-workflow/10">
                <Bell className="h-6 w-6 text-ros-workflow" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Notifications</h1>
                {unreadCount > 0 && (
                  <p className="text-muted-foreground">
                    You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm">
              <Check className="h-4 w-4 mr-2" />
              Mark all as read
            </Button>
          </div>

          <div className="space-y-3">
            {notifications.map((notification) => (
              <Card 
                key={notification.id}
                className={`transition-all hover:shadow-md ${
                  notification.unread ? 'border-ros-workflow/50 bg-ros-workflow/5' : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-sm">
                          {notification.title}
                        </h3>
                        {notification.unread && (
                          <Badge variant="secondary" className="bg-ros-workflow text-white text-xs shrink-0">
                            New
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {notification.timestamp}
                      </div>
                    </div>
                    {notification.unread && (
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {notifications.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No notifications</h3>
                <p className="text-muted-foreground text-center">
                  You're all caught up! Check back later for updates.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
