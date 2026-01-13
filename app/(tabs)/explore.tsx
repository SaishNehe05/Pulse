import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  ScrollView, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Search, Heart } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../../supabase';
import { useTheme } from '../theme'; // Adjusted path to app/theme.tsx

export default function Explore() {
  const { isDarkMode } = useTheme(); // Hook into global theme
  const router = useRouter();
  const [posts, setPosts] = useState([]);
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
    } catch (err) {
      console.error("Search Error:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Dynamic Theme Colors
  const bgColor = isDarkMode ? '#121212' : '#fff';
  const textColor = isDarkMode ? '#fff' : '#000';
  const subTextColor = isDarkMode ? '#888' : '#666';
  const borderColor = isDarkMode ? '#333' : '#eee';
  const inputBg = isDarkMode ? '#1E1E1E' : '#f8f8f8';
  const chipBg = isDarkMode ? '#222' : '#f2f2f2';

  const renderFeedContent = () => {
    if (posts.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: isDarkMode ? '#555' : '#999' }]}>No results for "{searchQuery}"</Text>
        </View>
      );
    }

    const heroPost = posts[0];
    const remainingPosts = posts.slice(1);

    return (
      <View>
        <TouchableOpacity 
          activeOpacity={0.9}
          style={[styles.heroCard, { backgroundColor: isDarkMode ? '#1E1E1E' : '#eee' }]}
          onPress={() => router.push({ pathname: '/article-detail', params: { id: heroPost.id } })}
        >
          {heroPost.image_url ? (
            <Image source={{ uri: heroPost.image_url }} style={styles.heroImage} />
          ) : (
            <View style={[styles.heroImage, { backgroundColor: '#FF6719' }]} />
          )}
          <View style={styles.heroOverlay}>
             <Text style={styles.heroTitle}>{heroPost.title || "Untitled Story"}</Text>
             <Text style={styles.heroUser}>By {heroPost.profiles?.username}</Text>
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
                <Text style={styles.authorTag}>@{item.profiles?.username}</Text>
                <View style={[styles.dot, { backgroundColor: isDarkMode ? '#333' : '#ccc' }]} />
                <Heart size={12} color={isDarkMode ? "#555" : "#999"} />
                <Text style={[styles.actionCount, { color: isDarkMode ? '#555' : '#999' }]}> 24</Text>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }}>
      <View style={styles.searchHeader}>
        <View style={[styles.searchBar, { backgroundColor: inputBg, borderColor: borderColor }]}>
          <Search size={18} color="#FF6719" />
          <TextInput 
            placeholder="Search stories..." 
            placeholderTextColor={isDarkMode ? "#555" : "#999"}
            style={[styles.searchInput, { color: textColor }]} 
            value={searchQuery === 'Explore' ? '' : searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); fetchPosts();}} tintColor="#FF6719" />}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={{ paddingRight: 30 }}>
          {categories.map((t, i) => (
            <TouchableOpacity 
                key={i} 
                style={[
                  styles.chip, 
                  { backgroundColor: chipBg },
                  (searchQuery === t || (t === 'Explore' && searchQuery === '')) && styles.activeChip
                ]}
                onPress={() => setSearchQuery(t === 'Explore' ? '' : t)}
            >
              <Text style={
                (searchQuery === t || (t === 'Explore' && searchQuery === '')) 
                ? styles.whiteText 
                : [styles.blackText, { color: isDarkMode ? '#888' : '#666' }]
              }>
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading && !refreshing ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#FF6719" />
          </View>
        ) : (
          renderFeedContent()
        )}
        
        <View style={{ height: 60 }} /> 
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  searchHeader: { flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center' },
  searchBar: { flex: 1, flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, height: 40 },
  chips: { paddingHorizontal: 15, marginVertical: 10 },
  chip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginRight: 10 },
  activeChip: { backgroundColor: '#FF6719' },
  whiteText: { color: '#fff', fontWeight: 'bold' },
  blackText: { fontWeight: 'bold' },
  heroCard: { margin: 15, height: 260, borderRadius: 20, overflow: 'hidden', justifyContent: 'flex-end' },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroOverlay: { backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '900', lineHeight: 30 },
  heroUser: { color: '#FF6719', fontSize: 14, fontWeight: 'bold', marginTop: 8 },
  listItem: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, alignItems: 'center' },
  smallThumb: { width: 80, height: 80, borderRadius: 12, marginLeft: 15 },
  sectionTitle: { fontSize: 22, fontWeight: '900', marginHorizontal: 15, marginTop: 15, marginBottom: 5 },
  boldText: { fontWeight: '800', fontSize: 17, marginBottom: 4 },
  grayText: { fontSize: 14, lineHeight: 18 },
  itemActions: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  authorTag: { fontSize: 12, color: '#FF6719', fontWeight: '700' },
  dot: { width: 3, height: 3, borderRadius: 2, marginHorizontal: 8 },
  actionCount: { fontSize: 12, fontWeight: '600' },
  loaderContainer: { marginTop: 100, alignItems: 'center' },
  emptyContainer: { marginTop: 80, alignItems: 'center', padding: 40 },
  emptyText: { textAlign: 'center', fontSize: 16, fontWeight: '600' }
});