import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera, FileText, Image as ImageIcon, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { supabase } from '../supabase';
import { useTheme } from './theme';

export default function WriteSubstack() {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { isDarkMode } = useTheme();
  const [isArticleMode, setIsArticleMode] = useState(false);
  const router = useRouter();

  const themeColors = {
    bg: isDarkMode ? Colors.dark.background : '#fff',
    text: isDarkMode ? Colors.dark.text : '#000',
    secondaryText: isDarkMode ? Colors.dark.textMuted : '#999',
    primary: isDarkMode ? Colors.dark.primary : Colors.light.primary,
    border: isDarkMode ? Colors.dark.divider : '#f0f0f0',
    surface: isDarkMode ? Colors.dark.surface : '#fff',
    chipBg: isDarkMode ? 'rgba(94, 155, 255, 0.1)' : '#FFF0E8'
  };

  // CAMERA LOGIC
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permission Denied", "We need camera access to take photos.");
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) setImage(result.assets[0].uri);
  };

  // GALLERY LOGIC
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };


  const publishNote = async () => {
    if (!content.trim() && !image) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please log in again.");

      let uploadedImageUrl = null;
      if (image) {
        const fileName = `${user.id}/${Date.now()}.jpg`;

        const formData = new FormData();
        formData.append('file', {
          uri: image,
          name: fileName,
          type: 'image/jpeg',
        } as any);

        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(fileName, formData, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('post-images').getPublicUrl(fileName);
        uploadedImageUrl = publicUrlData.publicUrl;
      }

      // Ensure consistent field naming and content handling
      const { error: insertError } = await supabase.from('posts').insert([
        {
          user_id: user.id,
          title: isArticleMode ? title.trim() : (content.trim().substring(0, 50) || "New Note"),
          content: content.trim(),
          image_url: uploadedImageUrl
        }
      ]);

      if (insertError) throw insertError;
      router.back();
    } catch (err: any) {
      console.error("Publish error:", err);
      Alert.alert("Error", err.message || "Failed to publish post");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.bg }]}>
      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: themeColors.bg }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <X size={28} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>{isArticleMode ? 'New article' : 'New note'}</Text>
        <TouchableOpacity
          onPress={publishNote}
          disabled={loading || (!content.trim() && !image)}
        >
          {loading ? <ActivityIndicator size="small" color={themeColors.primary} /> :
            <Text style={[styles.publishText, { color: themeColors.primary }, (!content.trim() && !image) && { opacity: 0.3 }]}>Publish</Text>}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* ARTICLE TITLE FIELD */}
          {isArticleMode && (
            <TextInput
              placeholder="Post Title"
              style={[styles.titleInput, { color: themeColors.text, borderBottomColor: themeColors.border }]}
              placeholderTextColor={themeColors.secondaryText}
              value={title}
              onChangeText={setTitle}
            />
          )}

          <View style={styles.inputSection}>
            <View style={[styles.avatarPlaceholder, { backgroundColor: isDarkMode ? Colors.dark.surface : '#333' }]} />
            <TextInput
              placeholder={isArticleMode ? "Start writing..." : "Write something..."}
              style={[styles.bodyInput, { color: themeColors.text }]}
              placeholderTextColor={themeColors.secondaryText}
              value={content}
              onChangeText={setContent}
              multiline
              autoFocus
            />
          </View>

          {image && (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: image }} style={styles.previewImage} />
              <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImage(null)}>
                <X size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* ATTACHMENT GRID */}
        <View style={[styles.attachmentGrid, { borderTopColor: themeColors.border, backgroundColor: themeColors.surface }]}>
          <AttachmentItem
            icon={<ImageIcon size={22} color={themeColors.text} />}
            label="Library"
            onPress={pickImage}
            themeColors={themeColors}
          />
          <AttachmentItem
            icon={<Camera size={22} color={themeColors.text} />}
            label="Camera"
            onPress={takePhoto}
            themeColors={themeColors}
          />
          <AttachmentItem
            icon={<FileText size={22} color={isArticleMode ? themeColors.primary : themeColors.text} />}
            label="Article"
            onPress={() => setIsArticleMode(!isArticleMode)}
            isActive={isArticleMode}
            themeColors={themeColors}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AttachmentItem({ icon, label, onPress, isActive, themeColors }: any) {
  return (
    <TouchableOpacity style={styles.gridBox} onPress={onPress}>
      <View style={[
        styles.iconBox,
        { backgroundColor: themeColors.surface },
        isActive && { backgroundColor: themeColors.chipBg, borderWidth: 1, borderColor: themeColors.primary }
      ]}>
        {icon}
      </View>
      <Text style={[
        styles.gridLabel,
        { color: themeColors.text },
        isActive && { color: themeColors.primary }
      ]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 60
  },
  headerTitle: { fontSize: 18, fontFamily: 'ClashGrotesk-Bold' },
  publishText: { color: '#FF6719', fontSize: 16, fontFamily: 'ClashGrotesk-Bold' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },
  titleInput: {
    fontSize: 24,
    color: '#000',
    fontFamily: 'ClashGrotesk-Bold',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 10
  },
  inputSection: { flexDirection: 'row', alignItems: 'flex-start' },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#333', marginRight: 15 },
  bodyInput: { flex: 1, fontSize: 18, color: '#000', paddingTop: 8, minHeight: 150, fontFamily: 'ClashGrotesk' },
  imagePreviewContainer: { marginTop: 20, position: 'relative', paddingBottom: 100 },
  previewImage: { width: '100%', height: 250, borderRadius: 12 },
  removeImageBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 15, padding: 4 },
  attachmentGrid: {
    flexDirection: 'row',
    padding: 15,
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff'
  },
  gridBox: { alignItems: 'center', width: '30%' },
  iconBox: {
    width: '100%',
    height: 60,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8
  },
  activeIconBox: { borderWidth: 1 },
  gridLabel: { fontSize: 12, fontFamily: 'ClashGrotesk-Medium' },
  activeText: {}
});