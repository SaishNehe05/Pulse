import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PulseLogo from '../components/PulseLogo';
import { Colors } from '../constants/theme';
import { supabase } from '../supabase';
import { useTheme } from './theme';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Updated theme object
  const theme = {
    bg: 'transparent', // Transparent
    text: isDarkMode ? '#E6E8F0' : '#1E2230', // Updated hex from request
    input: isDarkMode ? Colors.dark.surface : Colors.light.surface,
    btn: isDarkMode ? Colors.dark.primary : Colors.light.primary,
    btnText: '#1E2230' // Dark text on light button
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
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <PulseLogo size={80} style={{ alignSelf: 'center', marginBottom: 15 }} />
          <Text style={[styles.title, { fontFamily: 'ClashGrotesk-Bold' }]}>Pulse</Text>

          <TextInput
            placeholder="Email"
            placeholderTextColor="#888"
            style={[styles.input, { backgroundColor: theme.input, color: theme.text, fontFamily: 'ClashGrotesk' }]}
            value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
          />
          <TextInput
            placeholder="Password"
            placeholderTextColor="#888"
            style={[styles.input, { backgroundColor: theme.input, color: theme.text, fontFamily: 'ClashGrotesk' }]}
            secureTextEntry value={password} onChangeText={setPassword}
          />



          {/* The button will now use the orange background from the theme */}
          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: theme.btn }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={isDarkMode ? Colors.dark.secondary : Colors.light.secondary} />
            ) : (
              <Text style={[styles.btnText, { color: theme.btnText, fontFamily: 'ClashGrotesk-Bold' }]}>
                Log In
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/signup')}
            style={styles.footer}
          >
            <Text style={[styles.footerText, { color: isDarkMode ? '#aaa' : '#666', fontFamily: 'ClashGrotesk' }]}>
              Don't have an account? <Text style={styles.orangeLinkText}>Sign up</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 30, justifyContent: 'center' },
  title: { fontSize: 36, color: Colors.light.primary, textAlign: 'center', marginBottom: 40 },
  input: { padding: 18, borderRadius: 12, marginBottom: 15, fontSize: 16 },
  loginBtn: { padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnText: { fontSize: 18 },
  footer: { marginTop: 30, alignItems: 'center' },
  footerText: { fontSize: 15 },
  orangeLinkText: { color: Colors.light.primary },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
  },
  googleIcon: {
    width: 24,
    height: 24,
    marginRight: 10,
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 14,
  }
});
