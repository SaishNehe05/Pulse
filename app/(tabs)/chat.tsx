import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageSquarePlus, Search as SearchIcon, User } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../supabase';
import { useTheme } from '../theme'; // Adjusted path to app/theme.tsx

export default function ChatListScreen() {
  const { isDarkMode } = useTheme(); // Hook into global theme
  const [conversations, setConversations] = useState([]);
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
        const otherName = msg.sender_id === user.id ? msg.receiver?.username : msg.sender?.username;
        
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
    } catch (err) {
      console.error("Inbox Error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic Theme Colors
  const themeContainer = { backgroundColor: isDarkMode ? '#121212' : '#fff' };
  const themeText = { color: isDarkMode ? '#fff' : '#1a1a1a' };
  const themeSubText = { color: isDarkMode ? '#888' : '#666' };
  const themeBorder = { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' };
  const themeIconCircle = { backgroundColor: isDarkMode ? '#1E1E1E' : '#f5f5f5' };
  const themeAvatarBg = { backgroundColor: isDarkMode ? '#333' : '#1a1a1a' };

  return (
    <SafeAreaView style={[styles.container, themeContainer]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, themeText]}>Messages</Text>
        <TouchableOpacity style={[styles.searchCircle, themeIconCircle]}>
          <SearchIcon size={20} color={isDarkMode ? "#888" : "#666"} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#FF6719" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: isDarkMode ? '#444' : '#ccc' }]}>No conversations yet.</Text>
              <Text style={[styles.emptySub, { color: isDarkMode ? '#333' : '#ddd' }]}>Tap the orange button to start one!</Text>
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
        style={styles.fab} 
        onPress={() => router.push('/new-message')}
      >
        <MessageSquarePlus color="white" size={28} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  headerTitle: { fontSize: 28, fontWeight: '800' },
  searchCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  chatRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 15, alignItems: 'center' },
  avatar: { width: 55, height: 55, borderRadius: 27.5, justifyContent: 'center', alignItems: 'center' },
  chatContent: { flex: 1, marginLeft: 15, borderBottomWidth: 0.5, paddingBottom: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  userName: { fontSize: 17, fontWeight: '700' },
  time: { fontSize: 12 },
  snippet: { fontSize: 14 },
  fab: { position: 'absolute', bottom: 30, right: 20, backgroundColor: '#FF6719', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 18, fontWeight: '700' },
  emptySub: { marginTop: 5 }
});