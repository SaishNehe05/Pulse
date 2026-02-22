import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';

interface ChatStatusContextType {
    onlineUsers: Set<string>;
    typingUsers: { [userId: string]: boolean };
    setTyping: (recipientId: string, isTyping: boolean) => void;
}

const ChatStatusContext = createContext<ChatStatusContextType>({
    onlineUsers: new Set(),
    typingUsers: {},
    setTyping: () => { },
});

export const ChatStatusProvider = ({ children }: { children: React.ReactNode }) => {
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const [typingUsers, setTypingUsers] = useState<{ [userId: string]: boolean }>({});

    const myUserIdRef = useRef<string | null>(null);
    const presenceChannelRef = useRef<any>(null);
    const incomingTypingChannelRef = useRef<any>(null);
    const outgoingTypingRef = useRef<Map<string, { channel: any; subscribed: boolean }>>(new Map());

    const setTyping = useCallback((recipientId: string, isTyping: boolean) => {
        const myId = myUserIdRef.current;
        if (!myId) return;

        const existing = outgoingTypingRef.current.get(recipientId);

        const sendTyping = (channel: any) => {
            channel.send({
                type: 'broadcast',
                event: 'typing',
                payload: { userId: myId, isTyping },
            });
        };

        if (existing) {
            if (existing.subscribed) {
                sendTyping(existing.channel);
            }
        } else {
            // Use a shared channel name that BOTH users join
            // Sender and receiver both join the same room based on sorted user IDs
            // But since we don't have recipientId on the receiver side easily,
            // we use a simpler approach: broadcast on a channel named after the RECIPIENT
            // and the recipient listens on a channel named after THEMSELVES
            const channelName = `typing_room_${recipientId}`;
            const channel = supabase.channel(channelName, {
                config: {
                    broadcast: { ack: false },
                },
            });
            const entry = { channel, subscribed: false };
            outgoingTypingRef.current.set(recipientId, entry);

            channel.subscribe((status: string) => {
                if (status === 'SUBSCRIBED') {
                    entry.subscribed = true;
                    sendTyping(channel);
                }
            });
        }
    }, []);

    useEffect(() => {
        const cleanup = () => {
            if (presenceChannelRef.current) {
                supabase.removeChannel(presenceChannelRef.current);
                presenceChannelRef.current = null;
            }
            if (incomingTypingChannelRef.current) {
                supabase.removeChannel(incomingTypingChannelRef.current);
                incomingTypingChannelRef.current = null;
            }
            outgoingTypingRef.current.forEach(({ channel }) => supabase.removeChannel(channel));
            outgoingTypingRef.current.clear();
        };

        const setup = async () => {
            cleanup();

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            myUserIdRef.current = user.id;

            // 1. Presence — track online users
            const pChannel = supabase.channel('online-users', {
                config: { presence: { key: user.id } },
            });

            pChannel
                .on('presence', { event: 'sync' }, () => {
                    const state = pChannel.presenceState();
                    setOnlineUsers(new Set(Object.keys(state)));
                })
                .on('presence', { event: 'join' }, ({ key }: { key: string }) => {
                    setOnlineUsers(prev => new Set([...prev, key]));
                })
                .on('presence', { event: 'leave' }, ({ key }: { key: string }) => {
                    setOnlineUsers(prev => {
                        const next = new Set(prev);
                        next.delete(key);
                        return next;
                    });
                })
                .subscribe(async (status: string) => {
                    if (status === 'SUBSCRIBED') {
                        await pChannel.track({ online_at: new Date().toISOString() });
                    }
                });

            presenceChannelRef.current = pChannel;

            // 2. Incoming typing — listen on typing_room_<myId>
            // The OTHER user broadcasts to typing_room_<myId> when they type to me
            const tChannel = supabase
                .channel(`typing_room_${user.id}`, {
                    config: {
                        broadcast: { ack: false },
                    },
                })
                .on('broadcast', { event: 'typing' }, ({ payload }: { payload: { userId: string; isTyping: boolean } }) => {
                    setTypingUsers(prev => ({
                        ...prev,
                        [payload.userId]: payload.isTyping,
                    }));

                    // Auto-clear after 3s in case stop event is missed
                    if (payload.isTyping) {
                        setTimeout(() => {
                            setTypingUsers(prev => ({
                                ...prev,
                                [payload.userId]: false,
                            }));
                        }, 3000);
                    }
                })
                .subscribe();

            incomingTypingChannelRef.current = tChannel;
        };

        setup();

        const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                setup();
            } else if (event === 'SIGNED_OUT') {
                cleanup();
                myUserIdRef.current = null;
                setOnlineUsers(new Set());
                setTypingUsers({});
            }
        });

        return () => {
            cleanup();
            authSub.unsubscribe();
        };
    }, []);

    return (
        <ChatStatusContext.Provider value={{ onlineUsers, typingUsers, setTyping }}>
            {children}
        </ChatStatusContext.Provider>
    );
};

export const useChatStatus = () => useContext(ChatStatusContext);
