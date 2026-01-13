import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, FlatList, StyleSheet, 
  KeyboardAvoidingView, Platform, TouchableOpacity,
  Modal, Pressable
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../supabase';
import { ChevronLeft, Plus, Image as ImageIcon, CheckCheck, Bell } from 'lucide-react-native';
import { useTheme } from './theme'; // Import theme hook

export default function ChatWindow() {
  const { isDarkMode } = useTheme();
  const { recipientId, recipientName } = useLocalSearchParams();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [notificationCount, setNotificationCount] = useState(3);
  const router = useRouter();
  const flatListRef = useRef(null);

  useEffect(() => {
    if (!recipientId || recipientId === 'undefined') return;
    fetchMessages();

    const channel = supabase.channel(`chat_${recipientId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages' 
      }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new.sender_id === recipientId) {
          setMessages((prev) => [payload.new, ...prev]);
          setNotificationCount(prev => prev + 1);
        } else if (payload.eventType === 'UPDATE') {
          setMessages((prev) => prev.map(m => m.id === payload.new.id ? payload.new : m));
        }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [recipientId]);

  const fetchMessages = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !recipientId) return;

    const { data } = await supabase.from('messages').select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${recipientId}),and(sender_id.eq.${recipientId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: false });
    if (data) setMessages(data);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const text = newMessage.trim();
    setNewMessage('');

    const tempMsg = { 
      id: Math.random().toString(), 
      sender_id: user.id, 
      text, 
      created_at: new Date().toISOString(),
      reaction: null 
    };
    setMessages((prev) => [tempMsg, ...prev]);
    flatListRef.current?.scrollToOffset({ animated: true, offset: 0 });

    await supabase.from('messages').insert([{ sender_id: user.id, receiver_id: recipientId, text }]);
  };

  const addReaction = async (msgId, emoji) => {
    setSelectedMessageId(null);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reaction: emoji } : m));
    await supabase.from('messages').update({ reaction: emoji }).eq('id', msgId);
  };

  // Theme Constants
  const bgColor = isDarkMode ? '#121212' : '#fff';
  const headerBg = isDarkMode ? '#121212' : '#fff';
  const textColor = isDarkMode ? '#fff' : '#000';
  const borderColor = isDarkMode ? '#222' : '#eee';
  const inputBg = isDarkMode ? '#1E1E1E' : '#f2f2f2';
  const theirBubbleBg = isDarkMode ? '#222' : '#f1f1f1';

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={[styles.container, { backgroundColor: bgColor }]} 
    >
      <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerLeft}>
          <ChevronLeft size={30} color="#FF6719" />
          <View style={[styles.avatarCircle, { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }]}>
             <Text style={[styles.avatarText, { color: isDarkMode ? '#ccc' : '#555' }]}>
               {recipientName ? String(recipientName)[0].toUpperCase() : '?'}
             </Text>
          </View>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: textColor }]}>{recipientName || 'Chat'}</Text>
          <Text style={styles.onlineStatus}>Online</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.bellContainer} 
          onPress={() => setNotificationCount(0)}
        >
          <Bell size={24} color={isDarkMode ? "#fff" : "#000"} />
          {notificationCount > 0 && (
            <View style={[styles.badge, { borderColor: bgColor }]}>
              <Text style={styles.badgeText}>{notificationCount > 9 ? '9+' : notificationCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        inverted
        contentContainerStyle={styles.listContent}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isMine = item.sender_id !== recipientId;
          return (
            <View style={[styles.msgRow, isMine ? styles.myRow : styles.theirRow]}>
              <View style={[styles.bubbleContainer, isMine ? {alignItems: 'flex-end'} : {alignItems: 'flex-start'}]}>
                <TouchableOpacity 
                  activeOpacity={0.9} 
                  onLongPress={() => setSelectedMessageId(item.id)} 
                  style={[
                    styles.bubble, 
                    isMine ? styles.myBubble : [styles.theirBubble, { backgroundColor: theirBubbleBg }]
                  ]}
                >
                  <Text style={[styles.msgText, isMine ? styles.myText : { color: textColor }]}>{item.text}</Text>
                  <View style={styles.timestampContainer}>
                    <Text style={[styles.timeText, isMine ? styles.myTime : styles.theirTime]}>
                      {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {isMine && <CheckCheck size={14} color="#fff" style={{ marginLeft: 4, opacity: 0.8 }} />}
                  </View>
                  {item.reaction && (
                    <View style={[
                      styles.reactionBadge, 
                      { backgroundColor: isDarkMode ? '#333' : '#fff', borderColor: borderColor },
                      isMine ? {left: -10} : {right: -10}
                    ]}>
                      <Text style={{fontSize: 12}}>{item.reaction}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      <Modal transparent visible={!!selectedMessageId} animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedMessageId(null)}>
          <View style={[styles.reactionMenu, { backgroundColor: isDarkMode ? '#222' : '#fff' }]}>
            {['❤️', '👍', '🔥', '😂', '😮'].map((emoji) => (
              <TouchableOpacity key={emoji} onPress={() => addReaction(selectedMessageId, emoji)}>
                <Text style={styles.menuEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      <View style={[styles.inputArea, { backgroundColor: bgColor, borderTopColor: borderColor }]}>
        <TouchableOpacity style={styles.plusBtn}><Plus size={24} color="#fff" /></TouchableOpacity>
        <View style={[styles.inputWrapper, { backgroundColor: inputBg }]}>
          <TextInput 
            style={[styles.input, { color: textColor }]} 
            placeholder="Message..." 
            value={newMessage} 
            onChangeText={setNewMessage}
            placeholderTextColor={isDarkMode ? "#555" : "#999"}
          />
          <TouchableOpacity><ImageIcon size={22} color={isDarkMode ? "#555" : "#999"} /></TouchableOpacity>
        </View>
        {newMessage.length > 0 && (
          <TouchableOpacity onPress={handleSendMessage} style={styles.sendBtn}>
            <Text style={styles.sendLabel}>Send</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', paddingTop: 60, paddingBottom: 10, paddingHorizontal: 15, alignItems: 'center', borderBottomWidth: 0.5 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  avatarText: { fontWeight: '700' },
  headerInfo: { marginLeft: 12 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  onlineStatus: { fontSize: 12, color: '#4CAF50' },
  bellContainer: { marginLeft: 'auto', position: 'relative', padding: 5 },
  badge: {
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: '#FF3B30',
    borderRadius: 9,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  listContent: { paddingVertical: 10 },
  msgRow: { marginVertical: 8, paddingHorizontal: 12 },
  myRow: { alignItems: 'flex-end' },
  theirRow: { alignItems: 'flex-start' },
  bubbleContainer: { maxWidth: '80%', position: 'relative' },
  bubble: { paddingHorizontal: 12, paddingVertical: 8, minWidth: 95, borderRadius: 18 },
  myBubble: { backgroundColor: '#FF6719', borderTopRightRadius: 2 },
  theirBubble: { borderTopLeftRadius: 2 },
  msgText: { fontSize: 16 },
  myText: { color: '#fff' },
  timestampContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 },
  timeText: { fontSize: 10 },
  myTime: { color: 'rgba(255,255,255,0.7)' },
  theirTime: { color: '#999' },
  reactionBadge: { position: 'absolute', bottom: -10, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 12, borderWidth: 1, elevation: 3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  reactionMenu: { flexDirection: 'row', padding: 10, borderRadius: 30, elevation: 5 },
  menuEmoji: { fontSize: 28, marginHorizontal: 10 },
  inputArea: { flexDirection: 'row', padding: 10, alignItems: 'center', borderTopWidth: 0.5, paddingBottom: Platform.OS === 'ios' ? 30 : 15 },
  plusBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FF6719', justifyContent: 'center', alignItems: 'center' },
  inputWrapper: { flex: 1, flexDirection: 'row', borderRadius: 22, paddingHorizontal: 15, marginHorizontal: 10, alignItems: 'center', minHeight: 40 },
  input: { flex: 1, paddingVertical: 8, fontSize: 16 },
  sendBtn: { paddingLeft: 5 },
  sendLabel: { color: '#FF6719', fontWeight: 'bold', fontSize: 16 }
});