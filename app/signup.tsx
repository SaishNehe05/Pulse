import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PulseLogo from '../components/PulseLogo';
import { Colors } from '../constants/theme';
import { supabase } from '../supabase';
import { useTheme } from './theme';

export default function SignupScreen() {
  const router = useRouter();
  const { isDarkMode } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const theme = {
    bg: 'transparent',
    text: isDarkMode ? '#E6E8F0' : '#1E2230',
    input: isDarkMode ? Colors.dark.surface : Colors.light.surface,
    btn: isDarkMode ? Colors.dark.primary : Colors.light.primary,
    btnText: '#1E2230'
  };

  async function handleSignUp() {
    // 1. Basic Validation
    if (!email || !password || !username) {
      return Alert.alert("Error", "Please fill in all fields");
    }

    setLoading(true);

    try {
      // 2. Pre-check if username exists (Prevents profiles_username_key error)
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username.trim())
        .maybeSingle();

      if (existingUser) {
        setLoading(false);
        return Alert.alert("Username Taken", "This username is already in use. Please try another.");
      }

      // 3. Sign up the user in Supabase Auth
      // Note: Make sure "Confirm Email" is OFF in Supabase Auth Settings
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // 4. Upsert the profile (Fixes profiles_pkey duplicate error)
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: authData.user.id,
            username: username.trim(),
            email: email.trim().toLowerCase(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'id'
          });

        if (profileError) {
          // Double check if username was grabbed in the split second during registration
          if (profileError.message.includes('profiles_username_key')) {
            throw new Error("That username was just taken. Please try another.");
          }
          throw profileError;
        }

        // 5. Success - Redirect to Main App
        Alert.alert("Success", "Account created successfully!");
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      Alert.alert("Signup Failed", error.message);
    } finally {
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
          <Text style={[styles.title, { fontFamily: 'ClashGrotesk-Bold' }]}>Join Pulse</Text>

          <TextInput
            placeholder="Username"
            placeholderTextColor="#888"
            style={[styles.input, { backgroundColor: theme.input, color: theme.text, fontFamily: 'ClashGrotesk' }]}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          <TextInput
            placeholder="Email"
            placeholderTextColor="#888"
            style={[styles.input, { backgroundColor: theme.input, color: theme.text, fontFamily: 'ClashGrotesk' }]}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            placeholder="Password"
            placeholderTextColor="#888"
            style={[styles.input, { backgroundColor: theme.input, color: theme.text, fontFamily: 'ClashGrotesk' }]}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: theme.btn }]}
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={isDarkMode ? Colors.dark.secondary : Colors.light.secondary} />
            ) : (
              <Text style={[styles.btnText, { color: theme.btnText, fontFamily: 'ClashGrotesk-Bold' }]}>
                Create Account
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={styles.footer}>
            <Text style={[styles.footerText, { color: isDarkMode ? '#aaa' : '#666', fontFamily: 'ClashGrotesk' }]}>
              Already have an account? <Text style={styles.orangeLinkText}>Log In</Text>
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
  logoBox: { width: 60, height: 60, backgroundColor: Colors.light.primary, borderRadius: 12, alignSelf: 'center', marginBottom: 10, justifyContent: 'center', alignItems: 'center' },
  pulseLine: { width: 30, height: 4, backgroundColor: '#1C1917', borderRadius: 2 },
  title: { fontSize: 32, color: Colors.light.primary, textAlign: 'center', marginBottom: 40 },
  input: { padding: 18, borderRadius: 12, marginBottom: 15, fontSize: 16 },
  loginBtn: { padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnText: { fontSize: 18 },
  footer: { marginTop: 30, alignItems: 'center' },
  footerText: { fontSize: 15 },
  orangeLinkText: { color: Colors.light.primary }
});