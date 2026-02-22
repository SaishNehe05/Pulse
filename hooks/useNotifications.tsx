import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../supabase';

// Global state to track which chat is currently active
// Using a singleton for better cross-module reliability
const NotificationState = {
    activeChatId: null as string | null,
    isChatTabActive: false,
};

export const setActiveChatId = (id: string | null) => {
    console.log('[useNotifications] Setting activeChatId to:', id);
    NotificationState.activeChatId = id;
};

export const setIsChatTabActive = (active: boolean) => {
    console.log('[useNotifications] Setting isChatTabActive to:', active);
    NotificationState.isChatTabActive = active;
};

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
        const data = notification.request.content.data;
        const { activeChatId, isChatTabActive } = NotificationState;

        // Suppression Logic:
        // 1. If currently inside a specific chat and message is from that chat
        const isFromCurrentSpecificChat = !!(
            activeChatId &&
            (String(data.actor_id) === String(activeChatId) || String(data.sender_id) === String(activeChatId))
        );

        // 2. If currently in the overall Chat/Messages list tab and notification is a message
        const isMessageWhileOnChatTab = !!(isChatTabActive && data.type === 'message');

        const shouldSuppress = isFromCurrentSpecificChat || isMessageWhileOnChatTab;

        console.log('[useNotifications] Foreground check:', {
            activeChatId,
            isChatTabActive,
            actor_id: data?.actor_id,
            type: data?.type,
            shouldSuppress
        });

        return {
            shouldShowAlert: !isFromCurrentSpecificChat && !isMessageWhileOnChatTab,
            shouldPlaySound: !isFromCurrentSpecificChat && !isMessageWhileOnChatTab,
            shouldSetBadge: true, // Always keep badge count sync'd
            shouldShowBanner: !isFromCurrentSpecificChat && !isMessageWhileOnChatTab,
            shouldShowList: !isFromCurrentSpecificChat, // If in a specific chat, don't show in list. If in Inbox tab, DO show in list.
        };
    },
});

export function useNotifications() {
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const [notification, setNotification] = useState<Notifications.Notification | null>(null);
    const notificationListener = useRef<Notifications.EventSubscription | undefined>(undefined);
    const responseListener = useRef<Notifications.EventSubscription | undefined>(undefined);

    // 1. Initial token generation and listener setup
    useEffect(() => {
        let isMounted = true;

        registerForPushNotificationsAsync().then(token => {
            if (token && isMounted) {
                console.log('[useNotifications] Token generated:', token);
                setExpoPushToken(token);
            }
        });

        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            setNotification(notification);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            handleNotificationResponse(response);
        });

        return () => {
            isMounted = false;
            if (notificationListener.current) notificationListener.current.remove();
            if (responseListener.current) responseListener.current.remove();
        };
    }, []);

    // 2. Auth-aware token saving (more aggressive)
    useEffect(() => {
        if (!expoPushToken) return;

        // Try saving immediately in case session already exists
        savePushTokenToDatabase(expoPushToken);

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('[useNotifications] Auth event:', event);
            if (session?.user) {
                savePushTokenToDatabase(expoPushToken);
            }
        });

        return () => subscription.unsubscribe();
    }, [expoPushToken]);

    return {
        expoPushToken,
        notification,
    };
}

async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'Pulse Notifications',
            description: 'Notifications for likes, comments, and follows',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#5E9BFF',
            sound: 'default',
            enableVibrate: true,
            enableLights: true,
            showBadge: true,
        });
    }

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('[useNotifications] Permission not granted');
            return;
        }

        try {
            const projectId = '8271372d-7662-4edb-9e80-021e33765c4c';
            token = (await Notifications.getExpoPushTokenAsync({
                projectId,
            })).data;
        } catch (error: any) {
            console.error('[useNotifications] Error getting token:', error.message);
        }
    } else {
        console.log('[useNotifications] Must use physical device');
    }

    return token;
}

async function savePushTokenToDatabase(token: string) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.log('[useNotifications] Skip save: No user logged in');
            return;
        }

        const deviceType = Platform.OS;

        const { error } = await supabase
            .from('push_tokens')
            .upsert(
                {
                    user_id: user.id,
                    token,
                    device_type: deviceType,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'token' }
            );

        if (error) {
            console.error('[useNotifications] Upsert Error:', error.message);
        } else {
            console.log('[useNotifications] Token saved successfully for:', user.id);
        }
    } catch (error: any) {
        console.error('[useNotifications] Save Exception:', error.message);
    }
}

function handleNotificationResponse(response: Notifications.NotificationResponse) {
    const data = response.notification.request.content.data;

    // Handle navigation based on notification type
    // This will be integrated with your router

    // Example: Navigate to post if post_id exists
    // if (data.post_id) {
    //   router.push({ pathname: '/article-detail', params: { id: data.post_id } });
    // }
}
