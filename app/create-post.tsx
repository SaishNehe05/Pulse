import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { supabase } from '../supabase';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useTheme } from './theme'; 

export default function CreatePost() {
  const { isDarkMode } = useTheme();
  const [content, setContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const router = useRouter();

  // DEBUG: Check your terminal to see if this fires when you toggle theme
  useEffect(() => {
    console.log("CreatePost Screen Theme:", isDarkMode ? "DARK" : "LIGHT");
  }, [isDarkMode]);

  // Theme Palette
  const theme = {
    bg: isDarkMode ? '#121212' : '#FFFFFF',
    text: isDarkMode ? '#FFFFFF' : '#000000',
    border: isDarkMode ? '#222222' : '#EEEEEE',
    placeholder: isDarkMode ? '#555555' : '#999999',
    disabledBtn: isDarkMode ? '#4D2410' : '#FFB38C',
    accent: '#FF6719'
  };

  const handlePost = async () => {
    if (!content.trim()) {
      Alert.alert("Empty Post", "Please type something before sharing.");
      return;
    }

    setIsPosting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User session not found.");

      const { error } = await supabase.from('posts').insert([
        { user_id: user.id, content: content.trim() }
      ]);

      if (error) throw error;
      router.replace('/(tabs)/explore'); 
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        {/* HEADER */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconPadding}>
            <X size={28} color={theme.text} />
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { color: theme.text }]}>New Post</Text>
          
          <TouchableOpacity 
            style={[
              styles.postBtn, 
              !content.trim() && { backgroundColor: theme.disabledBtn }
            ]} 
            onPress={handlePost}
            disabled={isPosting || !content.trim()}
          >
            {isPosting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.postBtnText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* CONTENT INPUT */}
        <View style={styles.inputSection}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="What's happening on Pulse?"
            placeholderTextColor={theme.placeholder}
            multiline
            autoFocus
            value={content}
            onChangeText={setContent}
            keyboardAppearance={isDarkMode ? 'dark' : 'light'}
            textAlignVertical="top"
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'ios' ? 60 : 40, 
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  iconPadding: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  postBtn: { 
    backgroundColor: '#FF6719', 
    paddingHorizontal: 20, 
    paddingVertical: 8, 
    borderRadius: 20 
  },
  postBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  inputSection: { flex: 1, padding: 20 },
  input: { 
    fontSize: 19, 
    lineHeight: 26, 
    flex: 1 
  }
});