import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface NotificationPayload {
    id: number;
    user_id: string;   // recipient
    actor_id: string;  // who triggered the action
    type: 'like' | 'comment' | 'follow' | 'message';
    post_id?: string;
    comment_id?: string;
    text?: string;
    is_read: boolean;
    created_at: string;
}

const getNotificationContent = (type: string, actorUsername: string, text?: string) => {
    switch (type) {
        case 'like':
            return {
                title: '❤️ New Like',
                body: `${actorUsername} liked your post`,
            };
        case 'comment':
            return {
                title: '💬 New Comment',
                body: `${actorUsername} commented on your post`,
            };
        case 'follow':
            return {
                title: '👤 New Follower',
                body: `${actorUsername} started following you`,
            };
        case 'message':
            return {
                title: `💬 ${actorUsername}`,
                body: text || 'Sent you a message',
            };
        default:
            return {
                title: 'New Notification',
                body: `${actorUsername} interacted with you`,
            };
    }
};

Deno.serve(async (req) => {
    try {
        // Only allow POST
        if (req.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405 });
        }

        const payload: NotificationPayload = await req.json();
        console.log('[send-push-notification] Incoming payload:', JSON.stringify(payload));
        const { user_id, actor_id, type, post_id } = payload;

        // Don't send push notifications for self-actions
        if (!user_id || !actor_id || user_id === actor_id) {
            return new Response(JSON.stringify({ skipped: true, reason: 'self-action or missing ids' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Create Supabase admin client
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        );

        // 1. Get the actor's username
        const { data: actorProfile, error: actorError } = await supabaseAdmin
            .from('profiles')
            .select('username')
            .eq('id', actor_id)
            .single();

        if (actorError || !actorProfile) {
            console.error('Failed to fetch actor profile:', actorError);
            return new Response(JSON.stringify({ error: 'Actor not found' }), { status: 200 });
        }

        // 2. Get the recipient's push tokens
        const { data: tokens, error: tokenError } = await supabaseAdmin
            .from('push_tokens')
            .select('token')
            .eq('user_id', user_id);

        if (tokenError || !tokens || tokens.length === 0) {
            console.log('No push tokens found for user:', user_id);
            return new Response(JSON.stringify({ skipped: true, reason: 'no push tokens' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 3. Build notification content
        const { title, body } = getNotificationContent(type, actorProfile.username, payload.text);

        // 4. Send to all of the user's devices
        const messages = tokens.map(({ token }) => ({
            to: token,
            sound: 'default',
            title,
            body,
            data: {
                type,
                post_id: post_id ?? null,
                actor_id,
            },
            priority: 'high',
            channelId: 'default',
        }));

        const expoResponse = await fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages),
        });

        const expoResult = await expoResponse.json();
        console.log('Expo Push Result:', JSON.stringify(expoResult));

        return new Response(JSON.stringify({ success: true, result: expoResult }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Edge Function Error:', error);
        return new Response(JSON.stringify({ error: String(error) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});
