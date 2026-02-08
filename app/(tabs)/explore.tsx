import { useRouter } from 'expo-router';
import { Heart, Search } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const categories = ['Explore', 'Culture', 'Technology', 'Business'];

  useEffect(() => {
    fetchPosts();
  }, [searchQuery]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (searchQuery.trim() !== '' && searchQuery !== 'Explore') {
        query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
      }

      const { data: rawPosts, error: postError } = await query;
      if (postError) throw postError;

      const { data: allProfiles } = await supabase.from('profiles').select('id, username');

      const mergedData = rawPosts.map(post => ({
        ...post,
        profiles: allProfiles?.find(p => p.id === post.user_id) || { username: 'Pulse User' }
      }));

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
    if (posts.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: isDarkMode ? Colors.dark.textMuted : Colors.light.textMuted }]}>No results for "{searchQuery}"</Text>
        </View>
      );
    }

    const heroPost = posts[0];
    const remainingPosts = posts.slice(1);

    return (
      <View>
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.heroCard, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface }]}
          onPress={() => router.push({ pathname: '/article-detail', params: { id: heroPost.id } })}
        >
          {heroPost.image_url ? (
            <Image source={{ uri: heroPost.image_url }} style={styles.heroImage} />
          ) : (
            <View style={[styles.heroImage, { backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary }]} />
          )}
          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>{heroPost.title || "Untitled Story"}</Text>
            <Text style={[styles.heroUser, { color: isDarkMode ? Colors.dark.primary : Colors.light.primary }]}>By {heroPost.profiles?.username}</Text>
          </View>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { color: textColor }]}>Discover More</Text>
        {remainingPosts.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.listItem, { borderBottomColor: borderColor }]}
            onPress={() => router.push({ pathname: '/article-detail', params: { id: item.id } })}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.boldText, { color: textColor }]} numberOfLines={2}>
                {item.title || "New Story"}
              </Text>
              <Text style={[styles.grayText, { color: subTextColor }]} numberOfLines={2}>{item.content}</Text>

              <View style={styles.itemActions}>
                <Text style={[styles.authorTag, { color: isDarkMode ? Colors.dark.primary : Colors.light.primary }]}>@{item.profiles?.username}</Text>
                <View style={[styles.dot, { backgroundColor: isDarkMode ? '#333' : '#ccc' }]} />
                <Heart size={12} color={isDarkMode ? "#555" : "#999"} />
                <Text style={[styles.actionCount, { color: isDarkMode ? Colors.dark.textMuted : Colors.light.textMuted }]}> 24</Text>
              </View>
            </View>
            {item.image_url && (
              <Image source={{ uri: item.image_url }} style={styles.smallThumb} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
      <View style={styles.searchHeader}>
        <View style={[styles.searchBar, { backgroundColor: inputBg, borderColor: borderColor }]}>
          <Search size={18} color={isDarkMode ? Colors.dark.primary : Colors.light.primary} />
          <TextInput
            placeholder="Search stories..."
            placeholderTextColor={isDarkMode ? Colors.dark.textMuted : Colors.light.textMuted}
            style={[styles.searchInput, { color: textColor }]}
            value={searchQuery === 'Explore' ? '' : searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPosts(); }} tintColor={isDarkMode ? Colors.dark.primary : Colors.light.primary} />}
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
            <ActivityIndicator size="large" color={Colors.light.primary} />
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
  chips: { paddingHorizontal: 15, marginVertical: 10 },
  chip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginRight: 10 },
  activeChip: { backgroundColor: Colors.light.primary },
  // whiteText: { color: '#fff', fontWeight: 'bold' }, // Removed white text style
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
  emptyText: { textAlign: 'center', fontSize: 16, fontFamily: 'ClashGrotesk-SemiBold' }
});