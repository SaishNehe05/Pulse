import { useFocusEffect, useRouter } from 'expo-router';
import { MessageSquarePlus, Search as SearchIcon, User } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOTTOM_NAV_PADDING } from '../../constants/layout';
import { Colors } from '../../constants/theme';
import { useChatStatus } from '../../hooks/useChatStatus';
import { setIsChatTabActive } from '../../hooks/useNotifications';
import { useUnreadCounts } from '../../hooks/useUnreadCounts';
import { supabase } from '../../supabase';
import { formatPulseDate } from '../../utils/dateUtils';
import { useTheme } from '../theme';

export default function ChatListScreen() {
  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { refresh } = useUnreadCounts();
  const { onlineUsers, typingUsers } = useChatStatus();
  const [conversations, setConversations] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      setIsChatTabActive(true);
      fetchConversations();
      refresh();

      return () => {
        setIsChatTabActive(false);
      };
    }, [])
  );

  useEffect(() => {
    fetchConversations();

    // Listen for new messages globally to update the list
    const channel = supabase
      .channel('inbox_updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages'
      }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchConversations = async (isRefreshing = false) => {
    try {
      if (isRefreshing) setRefreshing(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch all messages involving the current user
      const { data: messages, error } = await supabase
        .from('messages')
        .select(`
          id, text, image_url, created_at, sender_id, receiver_id, is_read,
          sender:profiles!messages_sender_id_fkey(username, avatar_url),
          receiver:profiles!messages_receiver_id_fkey(username, avatar_url)
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 2. Fetch profiles for consistent display meta-data
      const chatMap = new Map();
      messages.forEach(msg => {
        const isMeSender = msg.sender_id === user.id;
        const otherId = isMeSender ? msg.receiver_id : msg.sender_id;
        const otherProfile: any = isMeSender ? msg.receiver : msg.sender;

        if (!chatMap.has(otherId) && otherId) {
          const { data: avatarData } = (otherProfile?.avatar_url)
            ? supabase.storage.from('avatars').getPublicUrl(otherProfile.avatar_url)
            : { data: { publicUrl: null } };

          chatMap.set(otherId, {
            id: otherId,
            name: otherProfile?.username || 'Pulse User',
            avatar: avatarData?.publicUrl,
            lastMessage: (msg.text && msg.text.trim() !== '') ? msg.text : (msg.image_url ? '📷 Photo' : 'No message'),
            time: formatPulseDate(msg.created_at),
            rawTime: msg.created_at,
            unreadCount: 0,
            isLastMessageMine: isMeSender
          });
        }

        // Increment unread count if I am the receiver and it's not read
        if (otherId && msg.receiver_id === user.id && msg.is_read !== true) {
          const chat = chatMap.get(otherId);
          if (chat) chat.unreadCount += 1;
        }
      });

      setConversations(Array.from(chatMap.values()));
    } catch (err: any) {
      console.error("Inbox Error:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDeleteConversation = async (otherUserId: string, otherUserName: string) => {
    Alert.alert(
      "Delete Conversation",
      `Are you sure you want to delete your entire chat history with ${otherUserName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;

              const { error } = await supabase
                .from('messages')
                .delete()
                .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`);

              if (error) throw error;

              setConversations(prev => prev.filter(c => c.id !== otherUserId));
              refresh(); // Update global unread counts
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          }
        }
      ]
    );
  };

  // Dynamic Theme Colors
  const themeText = { color: isDarkMode ? Colors.dark.text : Colors.light.text };
  const themeSubText = { color: isDarkMode ? Colors.dark.textMuted : Colors.light.textMuted };
  const themeBorder = { borderBottomColor: isDarkMode ? Colors.dark.divider : Colors.light.divider };
  const themeIconCircle = { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, themeText]}>Messages</Text>
        <TouchableOpacity
          style={[styles.searchCircle, themeIconCircle]}
          onPress={() => router.push('/new-message')}
        >
          <SearchIcon size={20} color={isDarkMode ? "#888" : "#666"} />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color={isDarkMode ? Colors.dark.secondary : Colors.light.secondary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={conversations}
          contentContainerStyle={{ paddingBottom: BOTTOM_NAV_PADDING }}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchConversations(true)} tintColor={isDarkMode ? Colors.dark.secondary : Colors.light.secondary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, themeSubText]}>No conversations yet.</Text>
              <Text style={[styles.emptySub, themeSubText]}>Start messaging your Pulse connections!</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.chatRow}
              onPress={() => {
                router.push({
                  pathname: '/chat-window',
                  params: { recipientId: item.id, recipientName: item.name }
                });
              }}
              onLongPress={() => handleDeleteConversation(item.id, item.name)}
            >
              <View style={styles.avatarContainer}>
                <View style={[styles.avatar, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface, borderColor: isDarkMode ? Colors.dark.divider : Colors.light.divider }]}>
                  {item.avatar ? (
                    <Image source={{ uri: item.avatar }} style={styles.fullImg} />
                  ) : (
                    <User color={isDarkMode ? "#555" : "#CCC"} size={28} />
                  )}
                </View>
                {onlineUsers.has(item.id) && <View style={[styles.onlineBadge, { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary, borderColor: isDarkMode ? Colors.dark.background : Colors.light.background }]} />}
              </View>

              <View style={[styles.chatContent, themeBorder]}>
                <View style={styles.row}>
                  <Text style={[styles.userName, themeText, item.unreadCount > 0 && { fontFamily: 'ClashGrotesk-Bold' }]}>{item.name}</Text>
                  <Text style={[styles.time, { color: item.unreadCount > 0 ? (isDarkMode ? Colors.dark.primary : Colors.light.primary) : (isDarkMode ? '#666' : '#999') }]}>{item.time}</Text>
                </View>
                <View style={styles.msgPreview}>
                  {typingUsers[item.id] ? (
                    <Text style={[styles.lastMsg, { color: isDarkMode ? Colors.dark.primary : Colors.light.primary }]}>typing...</Text>
                  ) : (
                    <Text style={[styles.lastMsg, themeSubText, item.unreadCount > 0 && [styles.unreadText, themeText]]} numberOfLines={1}>
                      {item.isLastMessageMine ? 'You: ' : ''}{item.lastMessage}
                    </Text>
                  )}
                  {item.unreadCount > 0 && (
                    <View style={[styles.unreadCountCircle, { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary }]}>
                      <Text style={styles.unreadCountText}>{item.unreadCount}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )
          }
        />
      )}

      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.fab, {
          backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary,
          bottom: 95 + insets.bottom,
          zIndex: 100
        }]}
        onPress={() => router.push('/new-message')}
      >
        <MessageSquarePlus color={isDarkMode ? "#000" : "#1C1917"} size={28} />
      </TouchableOpacity>
    </SafeAreaView >
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  headerTitle: { fontSize: 28, fontFamily: 'ClashGrotesk-Bold' },
  searchCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  chatRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 15, alignItems: 'center' },
  avatarContainer: { position: 'relative' },
  avatar: { width: 55, height: 55, borderRadius: 27.5, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1 },
  fullImg: { width: '100%', height: '100%' },
  unreadBadge: { position: 'absolute', top: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.light.primary, borderWidth: 2 },
  onlineBadge: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  chatContent: { flex: 1, marginLeft: 15, borderBottomWidth: 0.5, paddingBottom: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' },
  userName: { fontSize: 17, fontFamily: 'ClashGrotesk-Medium' },
  time: { fontSize: 12, fontFamily: 'ClashGrotesk' },
  msgPreview: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flex: 1 },
  lastMsg: { fontSize: 14, fontFamily: 'ClashGrotesk', flex: 1, marginRight: 10 },
  unreadText: { fontFamily: 'ClashGrotesk-Medium' },
  unreadCountCircle: { minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  unreadCountText: { color: '#FFF', fontSize: 10, fontFamily: 'ClashGrotesk-Bold' },
  fab: { position: 'absolute', bottom: 85, right: 20, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 18, fontFamily: 'ClashGrotesk-Bold' },
  emptySub: { marginTop: 5, fontFamily: 'ClashGrotesk', textAlign: 'center', paddingHorizontal: 40 }
});