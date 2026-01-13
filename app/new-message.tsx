import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, FlatList, StyleSheet, 
  TouchableOpacity, ActivityIndicator, Keyboard 
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../supabase';
import { Search, User, ChevronLeft, X } from 'lucide-react-native';
import { useTheme } from './theme'; 

export default function NewMessageSearch() {
  const { isDarkMode } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
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
    bg: isDarkMode ? '#121212' : '#FFFFFF',
    text: isDarkMode ? '#FFFFFF' : '#1A1A1A',
    subtext: isDarkMode ? '#A0A0A0' : '#666666',
    inputBg: isDarkMode ? '#1E1E1E' : '#F5F5F7',
    border: isDarkMode ? '#2C2C2E' : '#E5E5EA',
    accent: '#FF6719'
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
    fontWeight: '800', 
    marginLeft: 10 
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
    fontWeight: '500' 
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
    shadowColor: '#FF6719',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3
  },
  avatarInitial: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800'
  },
  userInfo: { flex: 1 },
  username: { 
    fontSize: 17, 
    fontWeight: '700',
    marginBottom: 2
  },
  subtext: { fontSize: 13 },
  emptyContainer: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 100, 
    paddingHorizontal: 40 
  },
  emptyText: { 
    fontSize: 15, 
    textAlign: 'center', 
    fontWeight: '500' 
  }
});