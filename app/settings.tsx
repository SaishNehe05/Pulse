import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  Switch, ScrollView, ActivityIndicator, Alert, Platform 
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Moon, Sun, User, FileText } from 'lucide-react-native';
import { supabase } from '../supabase';
import { useTheme } from './theme'; // Ensure this path matches app/theme.tsx

export default function SettingsScreen() {
  const router = useRouter();
  
  // 1. Hook into Global Theme
  const { isDarkMode, toggleTheme } = useTheme();
  
  // 2. Local State for Profile Data
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('username, bio')
          .eq('id', user.id)
          .single();
        
        if (data) {
          setUsername(data.username || '');
          setBio(data.bio || '');
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('profiles')
          .update({ 
            username: username, 
            bio: bio 
          })
          .eq('id', user.id);

        if (error) throw error;
        Alert.alert("Success", "Profile updated successfully");
        router.back();
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: isDarkMode ? '#121212' : '#FFF' }]}>
        <ActivityIndicator color="#FF6719" size="large" />
      </View>
    );
  }

  // Dynamic Styles
  const bgColor = isDarkMode ? '#121212' : '#FFF';
  const textColor = isDarkMode ? '#FFF' : '#000';
  const inputBg = isDarkMode ? '#1E1E1E' : '#F7F7F7';
  const borderColor = isDarkMode ? '#333' : '#EEE';
  const subTextColor = isDarkMode ? '#888' : '#666';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color={textColor} size={28} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>Settings</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#FF6719" />
          ) : (
            <Text style={styles.saveBtn}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        
        {/* Appearance Section */}
        <Text style={[styles.sectionLabel, { color: subTextColor }]}>APPEARANCE</Text>
        <View style={[styles.row, { backgroundColor: inputBg, borderColor: borderColor }]}>
          <View style={styles.rowLeft}>
            {isDarkMode ? (
              <Moon size={22} color="#FF6719" />
            ) : (
              <Sun size={22} color="#666" />
            )}
            <Text style={[styles.rowText, { color: textColor }]}>Dark Mode</Text>
          </View>
          <Switch 
            value={isDarkMode} 
            onValueChange={toggleTheme} 
            trackColor={{ true: '#FF6719', false: '#D1D1D1' }}
            thumbColor={Platform.OS === 'android' ? (isDarkMode ? '#FFF' : '#f4f3f4') : ''}
          />
        </View>

        {/* Profile Section */}
        <Text style={[styles.sectionLabel, { color: subTextColor, marginTop: 30 }]}>PROFILE</Text>
        
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: textColor }]}>Username</Text>
          <TextInput 
            style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor: borderColor }]} 
            value={username} 
            onChangeText={setUsername}
            placeholder="Set your username"
            placeholderTextColor={subTextColor}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: textColor }]}>Bio</Text>
          <TextInput 
            style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor: borderColor, height: 100 }]} 
            value={bio} 
            onChangeText={setBio}
            multiline
            numberOfLines={4}
            placeholder="Tell the world about yourself"
            placeholderTextColor={subTextColor}
            textAlignVertical="top"
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    padding: 16, 
    alignItems: 'center', 
    borderBottomWidth: 1 
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  backBtn: { padding: 4, marginLeft: -8 },
  saveBtn: { color: '#FF6719', fontWeight: '800', fontSize: 16 },
  scrollBody: { padding: 20 },
  sectionLabel: { 
    fontSize: 12, 
    fontWeight: '900', 
    letterSpacing: 1.2, 
    marginBottom: 12 
  },
  row: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    borderRadius: 16,
    borderWidth: 1
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { fontSize: 16, fontWeight: '600' },
  inputGroup: { marginTop: 20 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 8, marginLeft: 4 },
  input: { 
    padding: 16, 
    borderRadius: 16, 
    fontSize: 16, 
    borderWidth: 1 
  }
});