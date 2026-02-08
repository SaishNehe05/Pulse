import { useRouter } from 'expo-router';
import { ChevronLeft, Search, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
      setResults(data || []);
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
    accent: Colors.light.primary
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

        <View style={[styles.searchContainer, { backgroundColor: theme.inputBg }]}>
          <Search size={18} color={theme.subtext} style={styles.searchIcon} />
          <TextInput
            placeholder="Search by username..."
            placeholderTextColor={isDarkMode ? "#555" : "#A0A0A0"}
            style={[styles.input, { color: theme.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={18} color={theme.subtext} />
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
            activeOpacity={0.7}
            style={[styles.userItem, { borderBottomColor: theme.border }]}
            onPress={() => {
              Keyboard.dismiss();
              router.push({
                pathname: '/chat-window',
                params: { recipientId: item.id, recipientName: item.username || 'Pulse User' }
              });
            }}
          >
            <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
              <Text style={styles.avatarInitial}>
                {item.username ? item.username[0].toUpperCase() : 'P'}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={[styles.username, { color: theme.text }]}>{item.username || "Pulse User"}</Text>
              <Text style={[styles.subtext, { color: theme.subtext }]}>Active on Pulse</Text>
            </View>
            <ChevronLeft size={20} color={theme.border} style={{ transform: [{ rotate: '180deg' }] }} />
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
    borderRadius: 14,
    alignItems: 'center',
    height: 50
  },
  searchIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'ClashGrotesk-Medium'
  },
  listPadding: {
    paddingBottom: 40
  },
  userItem: {
    flexDirection: 'row',
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 0.5
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    shadowColor: Colors.light.primary,
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3
  },
  avatarInitial: {
    color: '#1E2230',
    fontSize: 20,
    fontFamily: 'ClashGrotesk-Bold'
  },
  userInfo: { flex: 1 },
  username: {
    fontSize: 17,
    marginBottom: 2,
    fontFamily: 'ClashGrotesk-Bold'
  },
  subtext: { fontSize: 13, fontFamily: 'ClashGrotesk' },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
    paddingHorizontal: 40
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    fontFamily: 'ClashGrotesk-Medium'
  }
});