import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  payload: Record<string, any>;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('notifications' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    const list = ((data ?? []) as unknown) as Notification[];
    setNotifications(list);
    setUnreadCount(list.filter(n => !n.read_at).length);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();

    let channel: any;
    let pollInterval: any;

    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const userId = session.user.id;

      channel = supabase
        .channel('notifications-' + userId)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${userId}`,
          },
          (payload) => {
            const n = payload.new as unknown as Notification;
            setNotifications(prev => [n, ...prev].slice(0, 50));
            setUnreadCount(prev => prev + 1);
          }
        )
        .subscribe();

      pollInterval = setInterval(() => {
        fetchAll();
      }, 60000);
    };

    setup();

    return () => {
      if (channel) supabase.removeChannel(channel);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [fetchAll]);

  const markAsRead = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    await supabase.from('notifications' as any)
      .update({ read_at: now })
      .eq('id', id);
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read_at: now } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    const now = new Date().toISOString();
    await supabase.from('notifications' as any)
      .update({ read_at: now })
      .is('read_at', null);
    setNotifications(prev => prev.map(n => n.read_at ? n : { ...n, read_at: now }));
    setUnreadCount(0);
  }, []);

  const remove = useCallback(async (id: string) => {
    await supabase.from('notifications' as any).delete().eq('id', id);
    setNotifications(prev => {
      const target = prev.find(n => n.id === id);
      if (target && !target.read_at) {
        setUnreadCount(c => Math.max(0, c - 1));
      }
      return prev.filter(n => n.id !== id);
    });
  }, []);

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, remove, refetch: fetchAll };
}
