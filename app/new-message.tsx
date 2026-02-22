import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  StyleSheet,
  Text, TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Colors } from '../constants/theme';
import { supabase } from '../supabase';
import { useTheme } from './theme';

export default function NewMessageSearch() {
  const { isDarkMode } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length > 1) searchUsers();
      else setResults([]);
    }, 400); // Slightly longer debounce for better performance
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const searchUsers = async () => {
    setLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .ilike('username', `%${searchQuery.trim()}%`)
        .neq('id', currentUser.id)
        .limit(15);

      if (error) throw error;

      const resultsWithAvatars = (data || []).map(u => {
        if (u.avatar_url) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(u.avatar_url);
          return { ...u, avatar_full_url: urlData.publicUrl };
        }
        return u;
      });

      setResults(resultsWithAvatars);
    } catch (err: any) {
      console.error("Search error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // Theme Palette
  const theme = {
    bg: 'transparent',
    text: isDarkMode ? Colors.dark.text : Colors.light.text,
    subtext: isDarkMode ? Colors.dark.textMuted : Colors.light.textMuted,
    inputBg: isDarkMode ? Colors.dark.surface : Colors.light.surface,
    border: isDarkMode ? Colors.dark.divider : Colors.light.divider,
    accent: isDarkMode ? Colors.dark.secondary : Colors.light.secondary
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* HEADER SECTION */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={28} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>New Message</Text>
        </View>

        <View style={[
          styles.searchContainer,
          {
            backgroundColor: theme.inputBg,
            borderColor: theme.border
          }
        ]}>
          <Search size={18} color={theme.accent} style={styles.searchIcon} />
          <TextInput
            placeholder="Search by username..."
            placeholderTextColor={theme.subtext}
            style={[styles.input, { color: theme.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
              <X size={16} color={theme.subtext} />
            </TouchableOpacity>
          )}
          {loading && <ActivityIndicator size="small" color={theme.accent} style={{ marginLeft: 10 }} />}
        </View>
      </View>

      {/* RESULTS LIST */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listPadding}
        ListEmptyComponent={
          !loading && searchQuery.length > 1 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.subtext }]}>No users found for "{searchQuery}"</Text>
            </View>
          ) : searchQuery.length <= 1 ? (
            <View style={styles.emptyContainer}>
              <Search size={40} color={theme.border} />
              <Text style={[styles.emptyText, { color: theme.subtext, marginTop: 10 }]}>
                Start typing to find someone on Pulse
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.userCard,
              {
                backgroundColor: theme.inputBg,
                borderColor: theme.border
              }
            ]}
            onPress={() => {
              Keyboard.dismiss();
              router.push({
                pathname: '/chat-window',
                params: { recipientId: item.id, recipientName: item.username || 'User' }
              });
            }}
          >
            <View style={[styles.avatar, { borderColor: theme.border }]}>
              {item.avatar_full_url ? (
                <Image source={{ uri: item.avatar_full_url }} style={styles.fullImg} />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                  <Text style={[styles.avatarInitial, { color: theme.accent }]}>
                    {item.username ? item.username[0].toUpperCase() : 'P'}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.userInfo}>
              <Text style={[styles.username, { color: theme.text }]}>{item.username || "User"}</Text>
            </View>
            <View style={[styles.actionIcon, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
              <ChevronRight size={16} color={theme.accent} />
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20
  },
  headerTitle: {
    fontSize: 20,
    marginLeft: 10,
    fontFamily: 'ClashGrotesk-Bold'
  },
  backBtn: { marginLeft: -10 },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    borderRadius: 18,
    alignItems: 'center',
    height: 54,
    borderWidth: 1,
  },
  searchIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'ClashGrotesk-Medium',
    letterSpacing: -0.2
  },
  clearBtn: {
    padding: 4,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 10,
    marginLeft: 8
  },
  listPadding: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 40
  },
  userCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    overflow: 'hidden',
    borderWidth: 1,
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarInitial: {
    fontSize: 20,
    fontFamily: 'ClashGrotesk-Bold'
  },
  userInfo: { flex: 1 },
  username: {
    fontSize: 16,
    fontFamily: 'ClashGrotesk-Bold',
    letterSpacing: -0.3
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  fullImg: { width: '100%', height: '100%' },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    paddingHorizontal: 40
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'ClashGrotesk-Medium',
    opacity: 0.6
  }
});