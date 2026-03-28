import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useNotifications(userId) {
  const qc = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => base44.entities.Notification.filter({ user_id: userId }, '-created_date', 50),
    enabled: !!userId,
    refetchInterval: 30000, // poll every 30s
    staleTime: 0,
  });

  const unread = notifications.filter(n => n.status === 'unread');

  const markReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { status: 'read' }),
    onSuccess: () => qc.invalidateQueries(['notifications', userId]),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { status: 'read' })));
    },
    onSuccess: () => qc.invalidateQueries(['notifications', userId]),
  });

  return {
    notifications,
    unread,
    unreadCount: unread.length,
    markRead: markReadMutation.mutate,
    markAllRead: markAllReadMutation.mutate,
  };
}