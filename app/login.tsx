import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../supabase';
import { useTheme } from './theme';

export default function LoginScreen() {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Updated theme object to set the button to orange
  const theme = {
    bg: isDarkMode ? '#121212' : '#fff',
    text: isDarkMode ? '#fff' : '#1a1a1a',
    input: isDarkMode ? '#1e1e1e' : '#f5f5f5',
    btn: '#FF6719', // Always orange
    btnText: '#fff'  // Always white for contrast
  };

  async function handleLogin() {
    if (!email || !password) return Alert.alert("Error", "Fill in all fields");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      Alert.alert("Login Error", error.message);
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.content}>
        <View style={styles.logoBox}><View style={styles.pulseLine} /></View>
        <Text style={[styles.title, { fontFamily: 'Montserrat-Bold' }]}>Pulse</Text>
        
        <TextInput 
          placeholder="Email" 
          placeholderTextColor="#888"
          style={[styles.input, { backgroundColor: theme.input, color: theme.text, fontFamily: 'Montserrat' }]} 
          value={email} onChangeText={setEmail} autoCapitalize="none"
        />
        <TextInput 
          placeholder="Password" 
          placeholderTextColor="#888"
          style={[styles.input, { backgroundColor: theme.input, color: theme.text, fontFamily: 'Montserrat' }]} 
          secureTextEntry value={password} onChangeText={setPassword}
        />

        {/* The button will now use the orange background from the theme */}
        <TouchableOpacity 
          style={[styles.loginBtn, { backgroundColor: theme.btn }]} 
          onPress={handleLogin} 
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.btnText} />
          ) : (
            <Text style={[styles.btnText, { color: theme.btnText, fontFamily: 'Montserrat-Bold' }]}>
              Log In
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => router.push('/signup')} 
          style={styles.footer}
        >
          <Text style={[styles.footerText, { color: isDarkMode ? '#aaa' : '#666', fontFamily: 'Montserrat' }]}>
            Don't have an account? <Text style={styles.orangeLinkText}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 30, justifyContent: 'center' },
  logoBox: { width: 60, height: 60, backgroundColor: '#FF6719', borderRadius: 12, alignSelf: 'center', marginBottom: 10, justifyContent: 'center', alignItems: 'center' },
  pulseLine: { width: 30, height: 4, backgroundColor: '#fff', borderRadius: 2 },
  title: { fontSize: 36, color: '#FF6719', textAlign: 'center', marginBottom: 40 },
  input: { padding: 18, borderRadius: 12, marginBottom: 15, fontSize: 16 },
  loginBtn: { padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnText: { fontWeight: 'bold', fontSize: 18 },
  footer: { marginTop: 30, alignItems: 'center' },
  footerText: { fontSize: 15 },
  orangeLinkText: { color: '#FF6719', fontWeight: 'bold' }
});