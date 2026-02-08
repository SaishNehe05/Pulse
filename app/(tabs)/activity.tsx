import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BOTTOM_NAV_PADDING } from '../../constants/layout';
import { Colors } from '../../constants/theme';
import { supabase } from '../../supabase';
import { useTheme } from '../theme'; // Adjusted path to app/theme.tsx

export default function Activity() {
  const { isDarkMode } = useTheme(); // Hook into global theme
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .single();

        if (data?.avatar_url) {
          const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(data.avatar_url);

          setCurrentUserAvatar(urlData.publicUrl);
        }
      }
    } catch (error) {
      console.error("Error fetching avatar:", error);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  // Dynamic Theme Colors
  const themeContainer = { backgroundColor: 'transparent' };
  const themeText = { color: isDarkMode ? '#FAFAF9' : '#1C1917' };
  const themeSubText = { color: isDarkMode ? '#A8A29E' : '#78716C' };
  const themeBorder = { borderColor: isDarkMode ? '#292524' : '#E5E7EB' };
  const themeCardBg = { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface };

  return (
    <SafeAreaView style={[styles.container, themeContainer]} edges={['top']}>
      {/* Header with Title and Profile Image */}
      <View style={styles.header}>
        <Text style={[styles.title, themeText]}>Activity</Text>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push('/profile')}
        >
          <View style={[styles.profileCircle, themeBorder, { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB' }]}>
            {currentUserAvatar ? (
              <Image
                source={{ uri: currentUserAvatar }}
                style={styles.fullImg}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.avatarFallback} />
            )}
          </View>
        </TouchableOpacity>
      </View>

      <FlatList
        data={[]} // Empty state
        contentContainerStyle={{ flexGrow: 1, paddingBottom: BOTTOM_NAV_PADDING }}
        renderItem={() => null}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.iconCircle, themeCardBg]}>
              <Bell size={32} color={isDarkMode ? "#666" : "#AAA"} />
            </View>
            <Text style={[styles.emptyTitle, themeText]}>No activity yet</Text>
            <Text style={[styles.emptySubtitle, themeSubText]}>
              When people interact with your writing, you'll see it here.
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDarkMode ? Colors.dark.primary : Colors.light.primary}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center'
  },
  title: { fontSize: 32, fontFamily: 'ClashGrotesk-Bold' },
  profileCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    borderWidth: 1,
  },
  fullImg: {
    width: '100%',
    height: '100%'
  },
  avatarFallback: {
    flex: 1,
    backgroundColor: '#333'
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    paddingBottom: 100
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20
  },
  emptyTitle: { fontSize: 18, fontFamily: 'ClashGrotesk-Bold' },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
    fontFamily: 'ClashGrotesk'
  }
});