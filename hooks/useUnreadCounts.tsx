import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';

interface UnreadContextType {
    unreadMessages: number;
    unreadNotifications: number;
    refresh: () => Promise<void>;
}

const UnreadContext = createContext<UnreadContextType>({
    unreadMessages: 0,
    unreadNotifications: 0,
    refresh: async () => { },
});

export const UnreadProvider = ({ children }: { children: React.ReactNode }) => {
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [unreadNotifications, setUnreadNotifications] = useState(0);

    const fetchUnreadCounts = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setUnreadMessages(0);
                setUnreadNotifications(0);
                return;
            }

            // Fetch unread messages count
            const { count: msgCount, error: msgError } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('receiver_id', user.id)
                .neq('is_read', true);

            if (!msgError) {
                setUnreadMessages(msgCount || 0);
            }

            // Fetch unread notifications count
            const { count: notifCount, error: notifError } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .neq('is_read', true);

            if (!notifError) {
                setUnreadNotifications(notifCount || 0);
            }
        } catch (e) {
            console.error("fetchUnreadCounts error:", e);
        }
    }, []);

    useEffect(() => {
        fetchUnreadCounts();

        let messageChannel: any;
        let notificationChannel: any;

        const setup = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Messages Real-time (Broader listener for better reliability)
            messageChannel = supabase
                .channel('global_unread_messages')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'messages',
                    // Listens to all and checks in JS (safer for RLS updates)
                }, (payload) => {
                    const isRelevant =
                        payload.new &&
                        ((payload.new as any).receiver_id === user.id || (payload.new as any).sender_id === user.id);
                    if (isRelevant) {
                        fetchUnreadCounts();
                    }
                })
                .subscribe();

            // 2. Notifications Real-time (Updated for robustness)
            notificationChannel = supabase
                .channel('global_unread_notifications')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                }, (payload) => {
                    // Check if relevant
                    let isRelevant = false;

                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        // For INSERT/UPDATE, we have the new row with user_id
                        isRelevant = (payload.new as any).user_id === user.id;
                    } else if (payload.eventType === 'DELETE') {
                        // For DELETE, assume relevant (we only see our own deletes usually)
                        isRelevant = true;
                    }

                    if (isRelevant) {
                        fetchUnreadCounts();
                    }
                })
                .subscribe();
        };

        setup();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            fetchUnreadCounts();
            if (messageChannel) supabase.removeChannel(messageChannel);
            if (notificationChannel) supabase.removeChannel(notificationChannel);
            setup();
        });

        // 3. Fallback Polling (Every 10 seconds)
        const intervalId = setInterval(fetchUnreadCounts, 10000);

        return () => {
            if (messageChannel) supabase.removeChannel(messageChannel);
            if (notificationChannel) supabase.removeChannel(notificationChannel);
            subscription.unsubscribe();
            clearInterval(intervalId);
        };
    }, [fetchUnreadCounts]);

    return (
        <UnreadContext.Provider value={{ unreadMessages, unreadNotifications, refresh: fetchUnreadCounts }}>
            {children}
        </UnreadContext.Provider>
    );
};

export const useUnreadCounts = () => useContext(UnreadContext);
