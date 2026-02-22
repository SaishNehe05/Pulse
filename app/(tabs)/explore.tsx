import { useFocusEffect, useRouter } from 'expo-router';
import { Heart, MessageCircle, Search, X } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BOTTOM_NAV_PADDING } from '../../constants/layout';
import { Colors } from '../../constants/theme';
import { supabase } from '../../supabase';
import { useTheme } from '../theme'; // Adjusted path to app/theme.tsx

export default function Explore() {
  const { isDarkMode } = useTheme(); // Hook into global theme
  const router = useRouter();
  const [posts, setPosts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const categories = ['Explore', 'Culture', 'Technology', 'Business'];

  useFocusEffect(
    useCallback(() => {
      fetchResults();
    }, [searchQuery])
  );

  const shuffleArray = (array: any[]) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[shuffled[j] ? j : i]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const fetchResults = async () => {
    setLoading(true);
    try {
      // 1. Fetch all profiles first for username matching
      const { data: allProfiles } = await supabase.from('profiles').select('id, username');

      // 2. Fetch Posts
      let postQuery = supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (searchQuery.trim() !== '' && searchQuery !== 'Explore') {
        // Search by title, content, OR author username
        const matchingUserIds = allProfiles
          ?.filter(p => p.username?.toLowerCase().includes(searchQuery.toLowerCase()))
          .map(p => p.id) || [];

        if (matchingUserIds.length > 0) {
          // Include posts that match title/content OR posts by matching users
          postQuery = postQuery.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%,user_id.in.(${matchingUserIds.join(',')})`);
        } else {
          // No matching users, just search title/content
          postQuery = postQuery.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
        }
      }

      const { data: rawPosts, error: postError } = await postQuery;
      if (postError) throw postError;

      // 3. Fetch Users if searching
      let foundUsers: any[] = [];
      if (searchQuery.trim() !== '' && searchQuery !== 'Explore') {
        const { data: userData } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .ilike('username', `%${searchQuery}%`)
          .limit(10);

        if (userData) {
          foundUsers = userData.map(u => {
            if (u.avatar_url) {
              const { data } = supabase.storage.from('avatars').getPublicUrl(u.avatar_url);
              return { ...u, avatar_full_url: data.publicUrl };
            }
            return u;
          });
        }
      }
      setUsers(foundUsers);

      let mergedData = rawPosts.map(post => ({
        ...post,
        profiles: allProfiles?.find(p => p.id === post.user_id) || { username: 'Pulse User' }
      }));

      // Randomize if in default Explore view
      if (searchQuery === '' || searchQuery === 'Explore') {
        mergedData = shuffleArray(mergedData);
      }

      setPosts(mergedData);
    } catch (err: any) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Dynamic Theme Colors
  const themeContainer = { backgroundColor: 'transparent' };
  const textColor = isDarkMode ? Colors.dark.text : Colors.light.text;
  const subTextColor = isDarkMode ? Colors.dark.textMuted : Colors.light.textMuted;
  const borderColor = isDarkMode ? Colors.dark.divider : Colors.light.divider;
  const inputBg = isDarkMode ? Colors.dark.surface : Colors.light.surface;
  const chipBg = isDarkMode ? Colors.dark.surface : Colors.light.surface;

  const renderFeedContent = () => {
    if (posts.length === 0 && users.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: isDarkMode ? Colors.dark.textMuted : Colors.light.textMuted }]}>No results for "{searchQuery}"</Text>
        </View>
      );
    }

    return (
      <View>
        {/* PEOPLE SECTION */}
        {users.length > 0 && (
          <View style={styles.peopleSection}>
            <Text style={[styles.sectionTitle, { color: textColor, marginBottom: 15 }]}>People</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 15, paddingRight: 30 }}>
              {users.map((user) => (
                <View key={user.id} style={[styles.personCard, { backgroundColor: inputBg, borderColor: borderColor }]}>
                  <TouchableOpacity
                    style={styles.personInfo}
                    onPress={() => router.push(`/profile?userId=${user.id}`)}
                  >
                    <View style={styles.personAvatar}>
                      {user.avatar_full_url ? (
                        <Image source={{ uri: user.avatar_full_url }} style={styles.fullImg} />
                      ) : (
                        <View style={[styles.fullImg, { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }]} />
                      )}
                    </View>
                    <Text style={[styles.personName, { color: textColor }]} numberOfLines={1}>@{user.username}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.messageIconBtn, { backgroundColor: isDarkMode ? Colors.dark.secondary : Colors.light.secondary }]}
                    onPress={() => router.push({
                      pathname: '/chat-window',
                      params: { recipientId: user.id, recipientName: user.username }
                    })}
                  >
                    <MessageCircle size={16} color={isDarkMode ? "#1C1917" : "#FFF"} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {posts.length > 0 && (
          <>
            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.heroCard, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface }]}
              onPress={() => router.push({ pathname: '/article-detail', params: { id: posts[0].id } })}
            >
              {posts[0].image_url ? (
                <Image source={{ uri: posts[0].image_url }} style={styles.heroImage} />
              ) : (
                <View style={[styles.heroImage, { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary }]} />
              )}
              <View style={styles.heroOverlay}>
                <Text style={styles.heroTitle}>{posts[0].title || "Untitled Post"}</Text>
                <Text style={[styles.heroUser, { color: isDarkMode ? Colors.dark.primary : Colors.light.primary }]}>By {posts[0].profiles?.username}</Text>
              </View>
            </TouchableOpacity>

            <Text style={[styles.sectionTitle, { color: textColor }]}>Discover More</Text>
            {posts.slice(1).map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.listItem, { borderBottomColor: borderColor }]}
                onPress={() => router.push({ pathname: '/article-detail', params: { id: item.id } })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.boldText, { color: textColor }]} numberOfLines={2}>
                    {item.title || "New Post"}
                  </Text>
                  <Text style={[styles.grayText, { color: subTextColor }]} numberOfLines={2}>{item.content}</Text>

                  <View style={styles.itemActions}>
                    <Text style={[styles.authorTag, { color: isDarkMode ? Colors.dark.primary : Colors.light.primary }]}>@{item.profiles?.username}</Text>
                    <View style={[styles.dot, { backgroundColor: isDarkMode ? '#333' : '#ccc' }]} />
                    <Heart size={12} color={isDarkMode ? "#555" : "#999"} />
                    <Text style={[styles.actionCount, { color: isDarkMode ? Colors.dark.textMuted : Colors.light.textMuted }]}> {item.likes_count || 0}</Text>
                  </View>
                </View>
                {item.image_url && (
                  <Image source={{ uri: item.image_url }} style={styles.smallThumb} />
                )}
              </TouchableOpacity>
            ))}
          </>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
      <View style={styles.searchHeader}>
        <View style={[styles.searchBar, { backgroundColor: inputBg, borderColor: borderColor }]}>
          <Search size={18} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
          <TextInput
            placeholder="Search..."
            placeholderTextColor={isDarkMode ? Colors.dark.textMuted : Colors.light.textMuted}
            style={[styles.searchInput, { color: textColor }]}
            value={searchQuery === 'Explore' ? '' : searchQuery}
            onChangeText={setSearchQuery}
          />
          {(searchQuery !== '' && searchQuery !== 'Explore') && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
              <X size={16} color={isDarkMode ? Colors.dark.textMuted : Colors.light.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchResults(); }} tintColor={isDarkMode ? Colors.dark.secondary : Colors.light.secondary} />}
        contentContainerStyle={{ paddingBottom: BOTTOM_NAV_PADDING }}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={{ paddingRight: 30 }}>
          {categories.map((t, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.chip,
                { backgroundColor: chipBg },
                (searchQuery === t || (t === 'Explore' && searchQuery === '')) && styles.activeChip,
                (searchQuery === t || (t === 'Explore' && searchQuery === '')) && { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary }
              ]}
              onPress={() => setSearchQuery(t === 'Explore' ? '' : t)}
            >
              <Text style={
                (searchQuery === t || (t === 'Explore' && searchQuery === ''))
                  ? [styles.blackText, { color: Colors.light.text }] // Black text on lime/blue
                  : [styles.blackText, { color: isDarkMode ? Colors.dark.textMuted : Colors.light.textMuted }]
              }>
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading && !refreshing ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={isDarkMode ? Colors.dark.secondary : Colors.light.secondary} />
          </View>
        ) : (
          renderFeedContent()
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  searchHeader: { flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center' },
  searchBar: { flex: 1, flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, height: 40, fontFamily: 'ClashGrotesk' },
  clearBtn: { padding: 4, marginLeft: 5 },
  chips: { paddingHorizontal: 15, marginVertical: 10 },
  chip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginRight: 10 },
  activeChip: { backgroundColor: Colors.light.primary },
  blackText: { fontFamily: 'ClashGrotesk-Bold' },
  heroCard: { margin: 15, height: 260, borderRadius: 20, overflow: 'hidden', justifyContent: 'flex-end' },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroOverlay: { backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 },
  heroTitle: { color: '#fff', fontSize: 26, lineHeight: 30, fontFamily: 'ClashGrotesk-Bold' },
  heroUser: { color: Colors.light.primary, fontSize: 14, marginTop: 8, fontFamily: 'ClashGrotesk-Bold' },
  listItem: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, alignItems: 'center' },
  smallThumb: { width: 80, height: 80, borderRadius: 12, marginLeft: 15 },
  sectionTitle: { fontSize: 22, marginHorizontal: 15, marginTop: 15, marginBottom: 5, fontFamily: 'ClashGrotesk-Bold' },
  boldText: { fontSize: 17, marginBottom: 4, fontFamily: 'ClashGrotesk-Bold' },
  grayText: { fontSize: 14, lineHeight: 18, fontFamily: 'ClashGrotesk' },
  itemActions: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  authorTag: { fontSize: 12, color: Colors.light.primary, fontFamily: 'ClashGrotesk-Bold' },
  dot: { width: 3, height: 3, borderRadius: 2, marginHorizontal: 8 },
  actionCount: { fontSize: 12, fontFamily: 'ClashGrotesk-Medium' },
  loaderContainer: { marginTop: 100, alignItems: 'center' },
  emptyContainer: { marginTop: 80, alignItems: 'center', padding: 40 },
  emptyText: { textAlign: 'center', fontSize: 16, fontFamily: 'ClashGrotesk-SemiBold' },
  peopleSection: { marginBottom: 30 },
  personCard: {
    width: 120,
    alignItems: 'center',
    marginRight: 15,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1
  },
  personInfo: { alignItems: 'center', marginBottom: 10, width: '100%' },
  personAvatar: {
    width: 60,
    height: 60,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.05)'
  },
  personName: { fontSize: 12, fontFamily: 'ClashGrotesk-Bold', textAlign: 'center', width: '100%' },
  messageIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImg: { width: '100%', height: '100%' }
});