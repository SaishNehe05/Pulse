import { useFocusEffect, useRouter } from 'expo-router';
import { Bookmark, DollarSign, Download, Eye, Headphones, History, Inbox, Search, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BOTTOM_NAV_PADDING } from '../../constants/layout';
import { Colors } from '../../constants/theme';
import { supabase } from '../../supabase';
import { timeAgo } from '../../utils/dateUtils';
import { useTheme } from '../theme'; // Adjusted path to app/theme.tsx

export default function Subscriptions() {
  const { isDarkMode } = useTheme(); // Hook into global theme
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('All');
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  const theme = isDarkMode ? Colors.dark : Colors.light;

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

  const fetchSavedPosts = useCallback(async () => {
    if (activeFilter !== 'Saved') {
      setPosts([]);
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('bookmarks')
        .select(`
          created_at,
          post:posts (
            id,
            title,
            content,
            image_url,
            user_id,
            created_at,
            views_count
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rawPosts = data?.map(b => ({ ...b.post, bookmarked_at: b.created_at })) || [];

      if (rawPosts.length > 0) {
        const userIds = [...new Set(rawPosts.map((p: any) => p.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', userIds);

        const merged = rawPosts.map((p: any) => ({
          ...p,
          profiles: profiles?.find(prof => prof.id === p.user_id)
        }));
        setPosts(merged);
      } else {
        setPosts([]);
      }

    } catch (err) {
      console.error("Error fetching saved posts:", err);
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  // Real-time updates when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchSavedPosts();
    }, [fetchSavedPosts])
  );

  const filters = [
    { id: 'All', icon: Inbox },
    { id: 'Paid', icon: DollarSign },
    { id: 'Saved', icon: Bookmark },
    { id: 'Audio', icon: Headphones },
    { id: 'History', icon: History },
    { id: 'Vault', icon: Download },
  ];

  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return posts;
    const query = searchQuery.toLowerCase().trim();
    return posts.filter(post =>
      post.title?.toLowerCase().includes(query) ||
      post.content?.toLowerCase().includes(query) ||
      post.profiles?.username?.toLowerCase().includes(query)
    );
  }, [posts, searchQuery]);

  const toggleSearch = () => {
    if (isSearchVisible) {
      setSearchQuery('');
      Keyboard.dismiss();
    }
    setIsSearchVisible(!isSearchVisible);
  };


  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        {isSearchVisible ? (
          <View style={[styles.searchBarContainer, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
            <Search size={18} color={theme.textMuted} style={{ marginRight: 10 }} />
            <TextInput
              placeholder="Search subscriptions..."
              placeholderTextColor={theme.textMuted}
              style={[styles.searchInput, { color: theme.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              clearButtonMode="while-editing"
            />
            <TouchableOpacity onPress={toggleSearch}>
              <X size={20} color={theme.text} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={[styles.title, { color: theme.text }]}>Subscriptions</Text>

            <View style={styles.headerIcons}>
              <TouchableOpacity style={styles.iconBtn} onPress={toggleSearch}>
                <Search size={22} color={theme.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push('/profile')}
              >
                <View style={[styles.profileCircle, { borderColor: theme.divider, backgroundColor: theme.surface }]}>
                  {currentUserAvatar ? (
                    <Image source={{ uri: currentUserAvatar }} style={styles.fullImg} />
                  ) : null}
                </View>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: BOTTOM_NAV_PADDING }}>
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {filters.map((f) => (
              <TouchableOpacity
                key={f.id}
                onPress={() => setActiveFilter(f.id)}
                style={[
                  styles.filterTab,
                  { backgroundColor: activeFilter === f.id ? theme.primary : theme.surface }
                ]}
              >
                <f.icon
                  color={activeFilter === f.id ? '#FFF' : theme.textMuted}
                  size={18}
                />
                <Text style={[
                  styles.filterLabel,
                  { color: activeFilter === f.id ? '#FFF' : theme.textMuted }
                ]}>
                  {f.id}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>


        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.secondary} />
          </View>
        ) : filteredPosts.length > 0 ? (
          <View style={styles.listContainer}>
            {filteredPosts.map((post) => (
              <TouchableOpacity
                key={post.id}
                activeOpacity={0.8}
                style={[styles.postCard, { backgroundColor: theme.surface }]}
                onPress={() => router.push({ pathname: '/article-detail', params: { id: post.id } })}
              >
                <View style={styles.postMain}>
                  <View style={styles.textColumn}>
                    <Text style={[styles.postTitle, { color: theme.text }]} numberOfLines={2}>{post.title}</Text>
                    <Text style={[styles.postSnippet, { color: theme.textMuted }]} numberOfLines={2}>{post.content}</Text>
                  </View>
                  {post.image_url && (
                    <Image source={{ uri: post.image_url }} style={styles.postThumb} />
                  )}
                </View>

                <View style={styles.postFooter}>
                  <View style={styles.authorGroup}>
                    <View style={styles.authorThumb}>
                      {post.profiles?.avatar_url ? (
                        <Image
                          source={{ uri: supabase.storage.from('avatars').getPublicUrl(post.profiles.avatar_url).data.publicUrl }}
                          style={styles.fullImg}
                        />
                      ) : <View style={[styles.avatarPlaceholder, { backgroundColor: theme.divider }]} />}
                    </View>
                    <Text style={[styles.authorName, { color: theme.text }]}>
                      {post.profiles?.username || 'Pulse Writer'}
                    </Text>
                    <Text style={[styles.dot, { color: theme.textMuted }]}>•</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Eye size={12} color={theme.textMuted} />
                      <Text style={[styles.postDate, { color: theme.textMuted }]}>{post.views_count || 0}</Text>
                    </View>
                    <Text style={[styles.dot, { color: theme.textMuted }]}>•</Text>
                    <Text style={[styles.postDate, { color: theme.textMuted }]}>{timeAgo(post.created_at)}</Text>
                  </View>
                  <Bookmark size={16} color={theme.primary} fill={theme.primary} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.center}>
            <View style={[styles.emptyIconCircle, { backgroundColor: theme.surface }]}>
              <Bookmark size={32} color={theme.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {searchQuery ? "No matching results" : (activeFilter === 'Saved' ? "Your vault is empty" : "Nothing here yet")}
            </Text>
            <Text style={[styles.emptySub, { color: theme.textMuted }]}>
              {searchQuery
                ? `Maybe try a different keyword?`
                : (activeFilter === 'Saved'
                  ? "Posts you bookmark for later will be preserved here."
                  : `No ${activeFilter} content found.`)}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    alignItems: 'center'
  },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { marginRight: 15, padding: 5 },
  title: { fontSize: 28, fontFamily: 'ClashGrotesk-Bold', letterSpacing: -1 },
  profileCircle: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', borderWidth: 1 },
  fullImg: { width: '100%', height: '100%' },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 0
  },
  searchInput: { flex: 1, fontSize: 16, fontFamily: 'ClashGrotesk-Medium', height: '100%' },
  filterRow: { marginVertical: 10, paddingLeft: 20 },
  filterTab: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    alignItems: 'center',
    marginRight: 10,
  },
  filterLabel: { marginLeft: 8, fontSize: 14, fontFamily: 'ClashGrotesk-Bold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 60 },
  emptyIconCircle: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontFamily: 'ClashGrotesk-Bold' },
  emptySub: { fontSize: 15, textAlign: 'center', marginTop: 10, fontFamily: 'ClashGrotesk', lineHeight: 22 },
  listContainer: { paddingHorizontal: 20 },
  postCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  postMain: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  textColumn: { flex: 1, marginRight: 12 },
  postTitle: { fontSize: 18, fontFamily: 'ClashGrotesk-Bold', lineHeight: 24, marginBottom: 8 },
  postSnippet: { fontSize: 14, fontFamily: 'ClashGrotesk-Medium', lineHeight: 20 },
  postThumb: { width: 80, height: 80, borderRadius: 12 },
  postFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  authorGroup: { flexDirection: 'row', alignItems: 'center' },
  authorThumb: { width: 20, height: 20, borderRadius: 10, overflow: 'hidden', marginRight: 8 },
  avatarPlaceholder: { flex: 1 },
  authorName: { fontSize: 13, fontFamily: 'ClashGrotesk-SemiBold' },
  dot: { marginHorizontal: 6 },
  postDate: { fontSize: 12, fontFamily: 'ClashGrotesk-Medium', opacity: 0.6 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 },
  tagText: { fontSize: 11, fontFamily: 'ClashGrotesk-Bold' }
});