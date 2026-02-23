import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { 
  Bell, 
  Check, 
  DollarSign, 
  Heart, 
  TrendingDown, 
  Trophy,
  FileText,
  ShoppingCart,
  Users,
  X
} from "lucide-react";
import { toast } from "sonner";

const iconMap = {
  price_drop: TrendingDown,
  wishlist_contribution: Heart,
  social_milestone: Users,
  referral_earnings: DollarSign,
  survey_available: FileText,
  achievement_unlocked: Trophy,
  purchase_complete: ShoppingCart,
  points_earned: Trophy
};

export default function NotificationCenter({ user }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const notifs = await base44.entities.Notification.filter({
        user_id: user.id
      }, '-created_date', 50);
      return notifs;
    },
    enabled: !!user
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId) => {
      await base44.entities.Notification.update(notificationId, {
        status: 'read'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
    }
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unreadNotifs = notifications.filter(n => n.status === 'unread');
      await Promise.all(
        unreadNotifs.map(n => 
          base44.entities.Notification.update(n.id, { status: 'read' })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
      toast.success('All notifications marked as read');
    }
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId) => {
      await base44.entities.Notification.delete(notificationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
      toast.success('Notification deleted');
    }
  });

  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  const handleNotificationClick = (notification) => {
    if (notification.status === 'unread') {
      markAsReadMutation.mutate(notification.id);
    }
    if (notification.action_url) {
      window.location.href = notification.action_url;
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-600">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
            </SheetTitle>
            {unreadCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => markAllAsReadMutation.mutate()}
              >
                <Check className="w-4 h-4 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No notifications yet</p>
            </div>
          ) : (
            notifications.map((notification) => {
              const Icon = iconMap[notification.type] || Bell;
              const isUnread = notification.status === 'unread';

              return (
                <Card
                  key={notification.id}
                  className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                    isUnread ? 'bg-blue-50 border-blue-200' : 'bg-white'
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex gap-3">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      isUnread ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      <Icon className={`w-5 h-5 ${isUnread ? 'text-blue-600' : 'text-gray-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`font-medium text-sm ${isUnread ? 'text-gray-900' : 'text-gray-700'}`}>
                          {notification.title}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotificationMutation.mutate(notification.id);
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(notification.created_date).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}