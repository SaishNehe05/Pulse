import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, CheckCheck, ChevronDown, ChevronLeft, Download, Image as ImageIcon, Trash2, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text, TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { useChatStatus } from '../hooks/useChatStatus';
import { setActiveChatId } from '../hooks/useNotifications';
import { useUnreadCounts } from '../hooks/useUnreadCounts';
import { supabase } from '../supabase';
import { formatMessageTime, formatPulseDate } from '../utils/dateUtils';
import { useTheme } from './theme'; // Import theme hook

export default function ChatWindow() {
  const { isDarkMode } = useTheme();
  const { refresh } = useUnreadCounts();
  const { onlineUsers, typingUsers, setTyping } = useChatStatus();
  const { recipientId, recipientName } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [recipientProfile, setRecipientProfile] = useState<{ name: string; avatar: string | null }>({
    name: String(recipientName || 'Chat'),
    avatar: null
  });
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [isTypingLocal, setIsTypingLocal] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [downloadingImage, setDownloadingImage] = useState(false);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<any>(null);
  const scrollOffset = useRef(0);

  // Derive typing and online status from context
  const isOtherUserTyping = typingUsers[String(recipientId)] || false;
  const isOtherUserOnline = onlineUsers.has(String(recipientId));

  useFocusEffect(
    useCallback(() => {
      markAllAsRead();
      // Set this conversation as active for notification suppression
      if (recipientId) {
        setActiveChatId(String(recipientId));
      }

      return () => {
        // Clear active conversation when blurred
        setActiveChatId(null);
      };
    }, [recipientId])
  );

  useEffect(() => {
    if (!recipientId || recipientId === 'undefined') return;

    let msgChannel: any;

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const myId = user.id;
      setCurrentUserId(myId);
      fetchMessages(myId);
      markAllAsRead(myId);

      // Fetch recipient profile data
      const { data: prof } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', recipientId)
        .single();

      if (prof) {
        let finalAvatar = null;
        if (prof.avatar_url) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(prof.avatar_url);
          finalAvatar = urlData.publicUrl;
        }
        setRecipientProfile({
          name: prof.username || String(recipientName || 'Pulse User'),
          avatar: finalAvatar
        });
      }


      msgChannel = supabase.channel(`chat_room_${recipientId}_${Math.random()}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'messages',
        }, (payload) => {
          const msg = payload.new as any;

          // Filter: Only care about messages in this room
          // For UPDATE, we might not have sender/receiver unless REPLICA IDENTITY FULL is set
          // So we check if the ID exists in our local list first
          const isKnownUpdate = payload.eventType === 'UPDATE' && messages.some(m => m.id === msg.id);

          const isRelevant =
            isKnownUpdate ||
            (msg.sender_id === recipientId && msg.receiver_id === myId) ||
            (msg.sender_id === myId && msg.receiver_id === recipientId);

          if (!isRelevant) return;

          if (payload.eventType === 'INSERT') {
            setMessages((prev) => {
              if (prev.some(m => m.id === msg.id)) return prev;
              return [msg, ...prev];
            });
            if (msg.sender_id === recipientId) {
              markAsRead(msg.id);
            }
            if (scrollOffset.current > 100) {
              setHasNewMessages(true);
            }
          } else if (payload.eventType === 'UPDATE') {
            setMessages((prev) => prev.map(m => m.id === msg.id ? { ...m, ...msg } : m));
          }
        })
        .subscribe((status) => {
          console.log(`ChatWindow: Message channel status: ${status}`);
        });
    };

    setup();

    return () => {
      console.log("ChatWindow: Cleaning up");
      if (msgChannel) {
        supabase.removeChannel(msgChannel);
      }
      setTyping(String(recipientId), false);
    };
  }, [recipientId]);

  const fetchMessages = async (userIdOverride?: string) => {
    let userId = userIdOverride;
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userId = user.id;
    }
    if (!recipientId) return;

    const { data } = await supabase.from('messages').select('*')
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${recipientId}),and(sender_id.eq.${recipientId},receiver_id.eq.${userId})`)
      .order('created_at', { ascending: false });
    if (data) setMessages(data);
  };

  const markAllAsRead = async (userIdOverride?: string) => {
    try {
      let userId = userIdOverride;
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        userId = user.id;
      }
      if (!recipientId) return;

      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('sender_id', String(recipientId))
        .eq('receiver_id', userId)
        .neq('is_read', true);

      if (error) {
        console.error("markAllAsRead Error:", error.message);
      } else {
        console.log("markAllAsRead Success for", recipientId);
        await refresh(); // Await global unread count refresh
      }
    } catch (e) {
      console.error("markAllAsRead Exception:", e);
    }
  };

  const markAsRead = async (msgId: string) => {
    await supabase.from('messages').update({ is_read: true }).eq('id', msgId);
    refresh(); // Refresh global unread count
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return;

    const text = newMessage.trim();
    setNewMessage('');
    stopTyping();

    await supabase.from('messages').insert([{
      sender_id: user.id,
      receiver_id: recipientId,
      text,
      image_url: null
    }]);
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need camera access to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0].uri) {
        await uploadChatImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0].uri) {
        await uploadChatImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadChatImage = async (uri: string) => {
    try {
      setUploadingImage(true);
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return;

      const fileName = `${user.id}/${Date.now()}.jpg`;
      const formData = new FormData();
      formData.append('file', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: fileName,
        type: 'image/jpeg',
      } as any);

      const { data, error } = await supabase.storage
        .from('chat-images')
        .upload(fileName, formData);

      if (error) throw error;

      // Send message with image_url
      await supabase.from('messages').insert([{
        sender_id: user.id,
        receiver_id: recipientId,
        text: '',
        image_url: data.path
      }]);

    } catch (error: any) {
      console.error('Upload Error:', error);
      Alert.alert('Upload Failed', error.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const getPublicImageUrl = (path: string) => {
    if (!path) return null;
    const { data } = supabase.storage.from('chat-images').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleTyping = (text: string) => {
    setNewMessage(text);
    if (!isTypingLocal) {
      setIsTypingLocal(true);
      setTyping(String(recipientId), true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2000);
  };

  const stopTyping = () => {
    setIsTypingLocal(false);
    setTyping(String(recipientId), false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  const handleBack = async () => {
    await markAllAsRead();
    router.back();
  };

  const addReaction = async (msgId: string, emoji: string) => {
    const msg = messages.find(m => m.id === msgId);
    const newEmoji = msg?.reaction === emoji ? null : emoji;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSelectedMessageId(null);

    // Optimistic update
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reaction: newEmoji } : m));

    const { error } = await supabase.from('messages').update({ reaction: newEmoji }).eq('id', msgId);
    if (error) {
      // Rollback on error
      fetchMessages();
    }
  };

  const removeReaction = async (msgId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reaction: null } : m));
    await supabase.from('messages').update({ reaction: null }).eq('id', msgId);
  };

  const handleDeleteMessage = async (msgId: string) => {
    const msgToDelete = messages.find(m => m.id === msgId);
    setSelectedMessageId(null);
    Alert.alert(
      "Delete Message",
      "Are you sure you want to delete this message?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // 1. If it's an image message, delete from storage first
              if (msgToDelete?.image_url) {
                try {
                  const filePath = msgToDelete.image_url; // Path is already stored in image_url
                  await supabase.storage.from('chat-images').remove([filePath]);
                } catch (storageErr) {
                  // Non-fatal, proceed with message deletion
                }
              }

              // 2. Delete message from database
              const { error } = await supabase.from('messages').delete().eq('id', msgId);
              if (error) throw error;

              setMessages(prev => prev.filter(m => m.id !== msgId));
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          }
        }
      ]
    );
  };

  const handleDownloadImage = async (url: string) => {
    try {
      setDownloadingImage(true);

      // 1. Request permissions (writeOnly: true avoids requiring all media permissions)
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need storage permission to save images.');
        return;
      }

      // 2. Create local file path
      const fileUri = FileSystem.cacheDirectory + 'pulse_image_' + Date.now() + '.jpg';

      // 3. Download the file
      const downloadRes = await FileSystem.downloadAsync(url, fileUri);

      if (downloadRes.status !== 200) {
        throw new Error('Failed to download image from server');
      }

      // 4. Save to gallery
      const asset = await MediaLibrary.createAssetAsync(downloadRes.uri);
      await MediaLibrary.createAlbumAsync('Pulse', asset, false);

      Alert.alert('Success', 'Image saved to gallery!');
    } catch (error: any) {
      console.error('Download Error:', error);
      Alert.alert('Download Failed', error.message);
    } finally {
      setDownloadingImage(false);
    }
  };



  const scrollToBottom = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setHasNewMessages(false);
    setShowScrollToBottom(false);
  };

  const handleScroll = (event: any) => {
    const offset = event.nativeEvent.contentOffset.y;
    scrollOffset.current = offset;
    setShowScrollToBottom(offset > 300);
    if (offset < 10) {
      setHasNewMessages(false);
    }
  };

  const bgColor = 'transparent';
  const headerBg = isDarkMode ? Colors.dark.background : Colors.light.background;
  const textColor = isDarkMode ? Colors.dark.text : Colors.light.text;
  const borderColor = isDarkMode ? Colors.dark.divider : Colors.light.divider;
  const inputBg = isDarkMode ? Colors.dark.surface : Colors.light.surface;
  const myBubbleBg = isDarkMode ? Colors.dark.primary : Colors.light.primary;
  const theirBubbleBg = isDarkMode ? '#292524' : '#E5E7EB';


  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.container, { backgroundColor: bgColor }]}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={handleBack} style={styles.headerLeft}>
          <ChevronLeft size={30} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
          <View style={[styles.avatarCircle, { backgroundColor: isDarkMode ? Colors.dark.surface : '#f0f0f0', overflow: 'hidden' }]}>
            {recipientProfile.avatar ? (
              <Image source={{ uri: recipientProfile.avatar }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Text style={[styles.avatarText, { color: isDarkMode ? Colors.dark.text : '#555' }]}>
                {recipientProfile.name[0]?.toUpperCase() || '?'}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: textColor }]}>{recipientProfile.name}</Text>
          <Text style={[
            styles.onlineStatus,
            (isOtherUserTyping || isOtherUserOnline) ? { color: isDarkMode ? Colors.dark.primary : Colors.light.primary } : { color: isDarkMode ? Colors.dark.textMuted : Colors.light.textMuted }
          ]}>
            {isOtherUserTyping ? 'typing...' : (isOtherUserOnline ? 'Online' : 'Offline')}
          </Text>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        inverted
        contentContainerStyle={styles.listContent}
        keyExtractor={(item) => item.id}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => {
          const isMine = item.sender_id !== recipientId;
          const showDate = index === messages.length - 1 ||
            new Date(messages[index].created_at).toDateString() !==
            new Date(messages[index + 1]?.created_at).toDateString();

          return (
            <View>
              {showDate && (
                <View style={styles.dateHeader}>
                  <Text style={styles.dateText}>{formatPulseDate(item.created_at, { isHeader: true })}</Text>
                </View>
              )}
              <View style={[styles.msgRow, isMine ? styles.myRow : styles.theirRow]}>
                <View style={[styles.bubbleContainer, isMine ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                      if (item.image_url) {
                        setViewingImageUrl(getPublicImageUrl(item.image_url));
                      }
                    }}
                    onLongPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setSelectedMessageId(item.id);
                    }}
                    style={[
                      styles.bubble,
                      isMine ? [styles.myBubble, { backgroundColor: myBubbleBg }] : [styles.theirBubble, { backgroundColor: theirBubbleBg }],
                      item.image_url && { padding: 1, borderRadius: 20 }
                    ]}
                  >
                    {item.image_url && (
                      <Image
                        source={{ uri: getPublicImageUrl(item.image_url) || undefined }}
                        style={styles.bubbleImage}
                        resizeMode="cover"
                      />
                    )}
                    {item.text ? (
                      <Text style={[styles.msgText, isMine ? styles.myText : { color: textColor }]}>{item.text}</Text>
                    ) : null}
                    <View style={styles.timestampContainer}>
                      <Text style={[styles.timeText, isMine ? styles.myTime : styles.theirTime]}>
                        {formatMessageTime(item.created_at)}
                      </Text>
                      {isMine && (
                        <CheckCheck
                          size={13}
                          color={item.is_read ? "#00E676" : "rgba(28, 25, 23, 0.5)"}
                          style={{ marginLeft: 4 }}
                        />
                      )}
                    </View>
                    {item.reaction && (
                      <Animated.View
                        entering={ZoomIn}
                        exiting={ZoomOut}
                        style={[
                          styles.reactionBadge,
                          { backgroundColor: isDarkMode ? '#333' : '#fff', borderColor: borderColor },
                          isMine ? { left: -10 } : { right: -10 }
                        ]}
                      >
                        <TouchableOpacity onPress={() => removeReaction(item.id)} hitSlop={10}>
                          <Text style={{ fontSize: 13 }}>{item.reaction}</Text>
                        </TouchableOpacity>
                      </Animated.View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
      />

      {(showScrollToBottom || hasNewMessages) && (
        <TouchableOpacity
          style={[
            styles.scrollToBottom,
            {
              backgroundColor: isDarkMode ? Colors.dark.surface : '#FFF',
              borderColor: isDarkMode ? Colors.dark.divider : Colors.light.divider,
              borderWidth: 0.5
            }
          ]}
          onPress={scrollToBottom}
        >
          {hasNewMessages && <View style={styles.newMsgDot} />}
          <ChevronDown size={24} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
          {hasNewMessages && <Text style={[styles.newMsgText, { color: isDarkMode ? Colors.dark.text : Colors.light.text }]}>New Messages</Text>}
        </TouchableOpacity>
      )}

      {!!selectedMessageId && (
        <Modal transparent visible animationType="none">
          <Pressable style={styles.modalOverlay} onPress={() => setSelectedMessageId(null)}>
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              style={[
                styles.reactionMenu,
                { backgroundColor: isDarkMode ? '#1C1917' : '#fff', borderColor: borderColor, borderWidth: 1 }
              ]}
            >
              {['❤️', '👍', '🔥', '😂', '😮'].map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => addReaction(selectedMessageId, emoji)}
                  style={styles.emojiWrapper}
                >
                  <Text style={styles.menuEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
              <View style={[styles.menuDivider, { backgroundColor: borderColor }]} />
              <TouchableOpacity
                onPress={() => handleDeleteMessage(selectedMessageId)}
                style={styles.deleteMenuOption}
              >
                <Trash2 size={22} color="#FF4C4C" />
              </TouchableOpacity>
            </Animated.View>
          </Pressable>
        </Modal>
      )}

      {/* Fullscreen Image Viewer Modal */}
      <Modal visible={!!viewingImageUrl} transparent animationType="fade" onRequestClose={() => setViewingImageUrl(null)}>
        <Pressable style={styles.fullscreenOverlay} onPress={() => setViewingImageUrl(null)}>
          <View style={styles.fullscreenContent}>
            {viewingImageUrl && (
              <Image source={{ uri: viewingImageUrl }} style={styles.fullScreenImage} resizeMode="contain" />
            )}
            <TouchableOpacity style={[styles.closeViewerBtn, { top: insets.top + 10 }]} onPress={() => setViewingImageUrl(null)}>
              <X size={30} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.downloadBtn, { top: insets.top + 10 }]}
              onPress={() => viewingImageUrl && handleDownloadImage(viewingImageUrl)}
              disabled={downloadingImage}
            >
              {downloadingImage ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Download size={30} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <View style={[styles.inputArea, { backgroundColor: bgColor, borderTopColor: borderColor }]}>
        <TouchableOpacity
          style={[styles.plusBtn, { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary }]}
          onPress={handleTakePhoto}
          disabled={uploadingImage}
        >
          {uploadingImage ? (
            <ActivityIndicator size="small" color={isDarkMode ? "#000" : "#FFF"} />
          ) : (
            <Camera size={22} color={isDarkMode ? "#121212" : "#FFF"} />
          )}
        </TouchableOpacity>
        <View style={[styles.inputWrapper, { backgroundColor: inputBg }]}>
          <TextInput
            style={[styles.input, { color: textColor }]}
            placeholder="Type a message..."
            value={newMessage}
            onChangeText={handleTyping}
            placeholderTextColor={isDarkMode ? "#555" : "#999"}
            multiline
          />
          <TouchableOpacity onPress={handlePickImage} disabled={uploadingImage}>
            {uploadingImage ? (
              <ActivityIndicator size="small" color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
            ) : (
              <ImageIcon size={22} color={isDarkMode ? "#555" : "#999"} />
            )}
          </TouchableOpacity>
        </View>
        {(newMessage.length > 0) ? (
          <TouchableOpacity onPress={handleSendMessage} style={styles.sendBtn}>
            <Text style={[styles.sendLabel, { color: isDarkMode ? Colors.dark.primary : Colors.light.primary }]}>Send</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', paddingTop: 60, paddingBottom: 10, paddingHorizontal: 15, alignItems: 'center', borderBottomWidth: 0.5 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  avatarText: { fontFamily: 'ClashGrotesk-Bold' },
  headerInfo: { marginLeft: 12 },
  headerTitle: { fontSize: 16, fontFamily: 'ClashGrotesk-Bold' },
  onlineStatus: { fontSize: 12, color: Colors.light.secondary, fontFamily: 'ClashGrotesk-Medium' },
  dateHeader: { alignItems: 'center', marginVertical: 15 },
  dateText: { fontSize: 11, fontFamily: 'ClashGrotesk-Bold', color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
  listContent: { paddingVertical: 10 },
  msgRow: { marginVertical: 4, paddingHorizontal: 12 },
  myRow: { alignItems: 'flex-end' },
  theirRow: { alignItems: 'flex-start' },
  bubbleContainer: { maxWidth: '80%', position: 'relative' },
  bubble: { paddingHorizontal: 12, paddingVertical: 8, minWidth: 95, borderRadius: 18 },
  myBubble: { borderTopRightRadius: 2 },
  theirBubble: { borderTopLeftRadius: 2 },
  msgText: { fontSize: 16, fontFamily: 'ClashGrotesk', marginTop: 4 },
  bubbleImage: {
    width: 220,
    height: 220,
    borderRadius: 19,
    marginBottom: 4,
    borderWidth: 0.3,
    borderColor: 'rgba(0,0,0,0.05)'
  },
  myText: { color: '#1E2230' },
  timestampContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 },
  timeText: { fontSize: 10, fontFamily: 'ClashGrotesk' },
  myTime: { color: 'rgba(28, 25, 23, 0.6)' },
  theirTime: { color: '#999' },
  reactionBadge: { position: 'absolute', bottom: -12, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 14, borderWidth: 1.5, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  reactionMenu: { flexDirection: 'row', padding: 10, borderRadius: 40, elevation: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12 },
  emojiWrapper: { padding: 4 },
  menuEmoji: { fontSize: 28, marginHorizontal: 6 },
  menuDivider: { width: 1, height: 24, marginHorizontal: 8 },
  deleteMenuOption: { padding: 4, marginLeft: 2 },
  inputArea: { flexDirection: 'row', padding: 10, alignItems: 'center', borderTopWidth: 0.5, paddingBottom: Platform.OS === 'ios' ? 35 : 15 },
  plusBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  inputWrapper: { flex: 1, flexDirection: 'row', borderRadius: 22, paddingHorizontal: 15, marginHorizontal: 10, alignItems: 'center', minHeight: 40, maxHeight: 100 },
  input: { flex: 1, paddingVertical: 8, fontSize: 16, fontFamily: 'ClashGrotesk' },
  sendBtn: { paddingLeft: 5 },
  sendLabel: { fontSize: 16, fontFamily: 'ClashGrotesk-Bold' },
  scrollToBottom: {
    position: 'absolute',
    bottom: 110,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 25,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 99,
  },
  newMsgDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.light.secondary,
    marginRight: 8,
  },
  newMsgText: {
    fontSize: 12,
    fontFamily: 'ClashGrotesk-Bold',
    marginLeft: 5,
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullscreenContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  closeViewerBtn: {
    position: 'absolute',
    right: 20,
    padding: 10,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 25,
  },
  downloadBtn: {
    position: 'absolute',
    right: 70, // Offset from the close button
    padding: 10,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 25,
  },
});
