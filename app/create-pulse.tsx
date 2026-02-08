import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function CreatePulse() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const router = useRouter();

  async function handleCreate() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Alert.alert("Error", "Please login first");

    const { error } = await supabase
      .from('pulses')
      .insert([{ user_id: user.id, name, description }]);

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert("Success", "Pulse launched!");
      router.back();
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Start Your Pulse</Text>
      <TextInput style={styles.input} placeholder="Pulse Name (e.g. Better You)" value={name} onChangeText={setName} />
      <TextInput style={[styles.input, { height: 100 }]} placeholder="Description" multiline value={description} onChangeText={setDescription} />
      <TouchableOpacity style={styles.button} onPress={handleCreate}>
        <Text style={styles.buttonText}>Create Pulse</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, marginBottom: 20, fontFamily: 'ClashGrotesk-Bold' },
  input: { borderWidth: 1, borderColor: '#eee', padding: 15, borderRadius: 10, marginBottom: 15, fontFamily: 'ClashGrotesk' },
  button: { backgroundColor: '#FF6719', padding: 18, borderRadius: 30, alignItems: 'center' },
  buttonText: { color: '#fff', fontFamily: 'ClashGrotesk-Bold' }
});