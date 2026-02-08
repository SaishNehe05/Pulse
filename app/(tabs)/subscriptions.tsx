import { useRouter } from 'expo-router';
import { Bookmark, DollarSign, Download, Headphones, History, Inbox, List } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BOTTOM_NAV_PADDING } from '../../constants/layout';
import { Colors } from '../../constants/theme';
import { supabase } from '../../supabase';
import { useTheme } from '../theme'; // Adjusted path to app/theme.tsx

export default function Subscriptions() {
  const { isDarkMode } = useTheme(); // Hook into global theme
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('All');
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);

  // Fetch real user profile image for the circle
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).single();
        if (data?.avatar_url) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(data.avatar_url);
          setCurrentUserAvatar(urlData.publicUrl);
        }
      }
    };
    fetchProfile();
  }, []);

  const filters = [
    { id: 'All', icon: Inbox },
    { id: 'Paid', icon: DollarSign },
    { id: 'Saved', icon: Bookmark },
    { id: 'Audio', icon: Headphones },
    { id: 'History', icon: History },
    { id: 'Vault', icon: Download },
  ];

  // Dynamic Theme Colors
  const themeContainer = { backgroundColor: 'transparent' };
  const themeText = { color: isDarkMode ? '#FAFAF9' : '#1C1917' };
  const themeSubText = { color: isDarkMode ? '#A8A29E' : '#78716C' };
  const themeInactiveFilter = { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface };
  const themeActiveFilter = { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary };
  const activeIconColor = "#FFFFFF"; // Keep white on primary color background

  return (
    <SafeAreaView style={[styles.container, themeContainer]} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={[styles.title, themeText]}>Subscriptions</Text>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push('/profile')}
        >
          <View style={[styles.profileCircle, { backgroundColor: isDarkMode ? '#333' : '#F0F0F0' }]}>
            {currentUserAvatar ? (
              <Image source={{ uri: currentUserAvatar }} style={styles.fullImg} />
            ) : null}
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: BOTTOM_NAV_PADDING }}>
        <View style={styles.filterRow}>
          {filters.map((f) => (
            <TouchableOpacity
              key={f.id}
              onPress={() => setActiveFilter(f.id)}
              style={[
                activeFilter === f.id ? styles.activeFilter : styles.inactiveFilter,
                activeFilter === f.id ? themeActiveFilter : themeInactiveFilter
              ]}
            >
              <f.icon
                color={activeFilter === f.id ? activeIconColor : (isDarkMode ? "#888" : "#666")}
                size={20}
              />
              {activeFilter === f.id && <Text style={styles.whiteText}>{f.id}</Text>}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.priorityRow}>
          <Text style={[styles.grayLabel, { color: isDarkMode ? '#555' : '#999' }]}>↑↓ PRIORITY</Text>
          <List size={20} color={isDarkMode ? "#555" : "#666"} />
        </View>

        <View style={styles.center}>
          <Text style={[styles.emptyTitle, themeText]}>You're all caught up!</Text>
          <Text style={[styles.emptySub, themeSubText]}>Showing {activeFilter} content.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10, alignItems: 'center' },
  title: { fontSize: 32, fontFamily: 'ClashGrotesk-Bold' },
  profileCircle: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden' },
  fullImg: { width: '100%', height: '100%' },
  filterRow: { flexDirection: 'row', paddingHorizontal: 20, marginVertical: 15 },
  activeFilter: { flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginRight: 10 },
  inactiveFilter: { padding: 10, borderRadius: 10, marginRight: 10 },
  whiteText: { color: 'white', marginLeft: 8, fontFamily: 'ClashGrotesk-Bold' },
  priorityRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
  grayLabel: { fontSize: 12, fontFamily: 'ClashGrotesk-Bold' },
  center: { flex: 0.8, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontFamily: 'ClashGrotesk-Bold' },
  emptySub: { fontSize: 14, textAlign: 'center', marginTop: 10, fontFamily: 'ClashGrotesk' }
});