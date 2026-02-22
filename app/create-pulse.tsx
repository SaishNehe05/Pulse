import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera, Image as LucideImage, Send, X } from 'lucide-react-native';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { supabase } from '../supabase';
import { useTheme } from './theme';

export default function CreatePulse() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const theme = {
    bg: isDarkMode ? Colors.dark.background : Colors.light.background,
    text: isDarkMode ? Colors.dark.text : Colors.light.text,
    border: isDarkMode ? Colors.dark.divider : Colors.light.divider,
    placeholder: isDarkMode ? Colors.dark.textMuted : Colors.light.textMuted,
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled) {
        setMediaUri(result.assets[0].uri);
      }
    } catch (err) {
      Alert.alert("Camera Error", "Could not launch camera");
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      setMediaUri(result.assets[0].uri);
    }
  };

  const uploadPulse = async () => {
    if (!mediaUri) return;

    try {
      setIsUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      // 1. Upload to Storage
      const fileExt = mediaUri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const formData = new FormData();
      formData.append('file', {
        uri: mediaUri,
        name: fileName,
        type: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
      } as any);

      const { error: uploadError } = await supabase.storage
        .from('pulses') // Ensure this bucket exists!
        .upload(fileName, formData, {
          contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
        });

      if (uploadError) throw uploadError;

      // 2. Create Record
      const { error: dbError } = await supabase.from('pulses').insert({
        user_id: user.id,
        media_url: fileName, // Store path, not full URL
        caption: caption.trim() || null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() //Explicitly set 24 hours
      });

      if (dbError) throw dbError;

      router.back();
    } catch (err: any) {
      Alert.alert("Upload Failed", err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <X size={28} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>New Pulse</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Content */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
          <View
            style={[styles.mediaPlaceholder, { borderColor: theme.border, borderStyle: mediaUri ? 'solid' : 'dashed' }]}
          >
            {mediaUri ? (
              <>
                <Image source={{ uri: mediaUri }} style={styles.previewImage} resizeMode="cover" />
                <TouchableOpacity style={styles.repickBtn} onPress={() => setMediaUri(null)}>
                  <Text style={styles.repickText}>Remove</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.optionsRow}>
                <TouchableOpacity style={styles.optionBtn} onPress={takePhoto}>
                  <View style={[styles.optionIcon, { backgroundColor: isDarkMode ? '#333' : '#EEE' }]}>
                    <Camera size={32} color={theme.text} />
                  </View>
                  <Text style={[styles.optionLabel, { color: theme.text }]}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionBtn} onPress={pickImage}>
                  <View style={[styles.optionIcon, { backgroundColor: isDarkMode ? '#333' : '#EEE' }]}>
                    <LucideImage size={32} color={theme.text} />
                  </View>
                  <Text style={[styles.optionLabel, { color: theme.text }]}>Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            placeholder="Add a caption..."
            placeholderTextColor={theme.placeholder}
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={100}
          />
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity
            style={[styles.sendBtn, (!mediaUri || isUploading) && styles.disabledBtn]}
            onPress={uploadPulse}
            disabled={!mediaUri || isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.sendText}>Upload</Text>
                <Send size={18} color="#FFF" style={{ marginLeft: 8 }} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontFamily: 'ClashGrotesk-Bold',
  },
  iconBtn: { padding: 4 },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  mediaPlaceholder: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 20,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.02)',
    marginBottom: 20,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 40
  },
  optionBtn: {
    alignItems: 'center',
    gap: 10
  },
  optionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center'
  },
  optionLabel: {
    fontFamily: 'ClashGrotesk-Medium',
    fontSize: 14
  },
  repickBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14
  },
  repickText: {
    color: '#FFF',
    fontSize: 12,
    fontFamily: 'ClashGrotesk-Bold'
  },
  input: {
    fontSize: 16,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    fontFamily: 'ClashGrotesk',
    minHeight: 80,
    textAlignVertical: 'top'
  },
  footer: {
    paddingHorizontal: 20,
  },
  sendBtn: {
    backgroundColor: Colors.light.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
  },
  disabledBtn: {
    backgroundColor: '#AAA',
    opacity: 0.7
  },
  sendText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'ClashGrotesk-Bold'
  }
});