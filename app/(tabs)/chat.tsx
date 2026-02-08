import { useRouter } from 'expo-router';
import { MessageSquarePlus, Search as SearchIcon, User } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BOTTOM_NAV_PADDING } from '../../constants/layout';
import { Colors } from '../../constants/theme';
import { supabase } from '../../supabase';
import { useTheme } from '../theme'; // Adjusted path to app/theme.tsx

export default function ChatListScreen() {
  const { isDarkMode } = useTheme(); // Hook into global theme
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchConversations();

    const channel = supabase
      .channel('inbox_updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchConversations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: messages, error } = await supabase
        .from('messages')
        .select(`
          id, text, created_at, sender_id, receiver_id,
          sender:profiles!messages_sender_id_fkey(username),
          receiver:profiles!messages_receiver_id_fkey(username)
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const chatMap = new Map();
      messages.forEach(msg => {
        const { data: { user: currentUser } } = { data: { user } };
        const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        const otherName = msg.sender_id === user.id ? (msg.receiver as any)?.username : (msg.sender as any)?.username;

        if (!chatMap.has(otherId) && otherId) {
          chatMap.set(otherId, {
            id: otherId,
            name: otherName || 'Unknown User',
            lastMessage: msg.text,
            time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            rawTime: msg.created_at
          });
        }
      });

      setConversations(Array.from(chatMap.values()));
    } catch (err: any) {
      console.error("Inbox Error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic Theme Colors
  const themeContainer = { backgroundColor: 'transparent' };
  const themeText = { color: isDarkMode ? Colors.dark.text : Colors.light.text };
  const themeSubText = { color: isDarkMode ? Colors.dark.textMuted : Colors.light.textMuted };
  const themeBorder = { borderBottomColor: isDarkMode ? Colors.dark.divider : Colors.light.divider };
  const themeIconCircle = { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface };
  const themeAvatarBg = { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface };

  return (
    <SafeAreaView style={[styles.container, themeContainer]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, themeText]}>Messages</Text>
        <TouchableOpacity style={[styles.searchCircle, themeIconCircle]}>
          <SearchIcon size={20} color={isDarkMode ? "#888" : "#666"} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={isDarkMode ? Colors.dark.primary : Colors.light.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={conversations}
          contentContainerStyle={{ paddingBottom: BOTTOM_NAV_PADDING }}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: isDarkMode ? '#444' : '#ccc' }]}>No conversations yet.</Text>
              <Text style={[styles.emptySub, { color: isDarkMode ? '#333' : '#ddd' }]}>Tap the blue button to start one!</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.chatRow}
              onPress={() => router.push({
                pathname: '/chat-window',
                params: { recipientId: item.id, recipientName: item.name }
              })}
            >
              <View style={[styles.avatar, themeAvatarBg]}>
                <User color="white" size={24} />
              </View>
              <View style={[styles.chatContent, themeBorder]}>
                <View style={styles.row}>
                  <Text style={[styles.userName, themeText]}>{item.name}</Text>
                  <Text style={[styles.time, { color: isDarkMode ? '#666' : '#999' }]}>{item.time}</Text>
                </View>
                <Text style={[styles.snippet, themeSubText]} numberOfLines={1}>{item.lastMessage}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary }]}
        onPress={() => router.push('/new-message')}
      >
        <MessageSquarePlus color={isDarkMode ? "#000" : "#1C1917"} size={28} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  headerTitle: { fontSize: 28, fontFamily: 'ClashGrotesk-Bold' },
  searchCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  chatRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 15, alignItems: 'center' },
  avatar: { width: 55, height: 55, borderRadius: 27.5, justifyContent: 'center', alignItems: 'center' },
  chatContent: { flex: 1, marginLeft: 15, borderBottomWidth: 0.5, paddingBottom: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  userName: { fontSize: 17, fontFamily: 'ClashGrotesk-Bold' },
  time: { fontSize: 12, fontFamily: 'ClashGrotesk' },
  snippet: { fontSize: 14, fontFamily: 'ClashGrotesk' },
  fab: { position: 'absolute', bottom: 85, right: 20, backgroundColor: Colors.light.primary, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 18, fontFamily: 'ClashGrotesk-Bold' },
  emptySub: { marginTop: 5, fontFamily: 'ClashGrotesk' }
});