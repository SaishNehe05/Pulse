import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView,
  Image
} from 'react-native';
import { supabase } from '../supabase';
import { useRouter } from 'expo-router';
import { X, Image as ImageIcon, Camera, FileText } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

export default function WriteSubstack() {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isArticleMode, setIsArticleMode] = useState(false); // Toggles Title field
  const router = useRouter();

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
        formData.append('file', { uri: image, name: fileName, type: 'image/jpeg' } as any);
        const { error: uploadError } = await supabase.storage.from('post-images').upload(fileName, formData);
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('post-images').getPublicUrl(fileName);
        uploadedImageUrl = publicUrlData.publicUrl;
      }

      // FIX: Ensure title is never null for the database
      const finalTitle = isArticleMode && title.trim() 
        ? title.trim() 
        : content.trim().substring(0, 50) || "New Note";

      const { error: insertError } = await supabase.from('posts').insert([
        { 
            user_id: user.id, // Standard Supabase column name
            title: finalTitle, 
            content: content.trim(), 
            image_url: uploadedImageUrl 
        }
      ]);

      if (insertError) throw insertError;
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <X size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isArticleMode ? 'New article' : 'New note'}</Text>
        <TouchableOpacity 
          onPress={publishNote} 
          disabled={loading || (!content.trim() && !image)}
        >
          {loading ? <ActivityIndicator size="small" color="#FF6719" /> : 
          <Text style={[styles.publishText, (!content.trim() && !image) && { opacity: 0.3 }]}>Publish</Text>}
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
              style={styles.titleInput}
              placeholderTextColor="#999"
              value={title}
              onChangeText={setTitle}
            />
          )}

          <View style={styles.inputSection}>
            <View style={styles.avatarPlaceholder} />
            <TextInput
              placeholder={isArticleMode ? "Start writing..." : "Write something..."}
              style={styles.bodyInput}
              placeholderTextColor="#999"
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
        <View style={styles.attachmentGrid}>
          <AttachmentItem 
            icon={<ImageIcon size={22} color="#000" />} 
            label="Library" 
            onPress={pickImage} 
          />
          <AttachmentItem 
            icon={<Camera size={22} color="#000" />} 
            label="Camera" 
            onPress={takePhoto} 
          />
          <AttachmentItem 
            icon={<FileText size={22} color={isArticleMode ? "#FF6719" : "#000"} />} 
            label="Article" 
            onPress={() => setIsArticleMode(!isArticleMode)} 
            isActive={isArticleMode}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AttachmentItem({ icon, label, onPress, isActive }: any) {
  return (
    <TouchableOpacity style={styles.gridBox} onPress={onPress}>
      <View style={[styles.iconBox, isActive && styles.activeIconBox]}>
        {icon}
      </View>
      <Text style={[styles.gridLabel, isActive && styles.activeText]}>{label}</Text>
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
  headerTitle: { fontSize: 18, fontWeight: '700' },
  publishText: { color: '#FF6719', fontWeight: '700', fontSize: 16 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },
  titleInput: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: '#000', 
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 10
  },
  inputSection: { flexDirection: 'row', alignItems: 'flex-start' },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#333', marginRight: 15 },
  bodyInput: { flex: 1, fontSize: 18, color: '#000', paddingTop: 8, minHeight: 150 },
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
  activeIconBox: { backgroundColor: '#FFF0E8', borderWidth: 1, borderColor: '#FF6719' },
  gridLabel: { fontSize: 12, fontWeight: '600', color: '#333' },
  activeText: { color: '#FF6719' }
});