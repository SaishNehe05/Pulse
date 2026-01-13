import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Image, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, MessageSquare, Repeat2, Share2, Plus, Bookmark, MoreHorizontal } from 'lucide-react-native'; 
import { supabase } from '../../supabase'; 
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme'; 

export default function HomeFeed() {
  const { isDarkMode } = useTheme(); 
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  const getPublicUrl = (bucket: string, path: string | null) => {
    if (!path || path === "") return null;
    if (path.startsWith('http')) return path;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const fetchPosts = async (isRefreshing = false) => {
    try {
      if (isRefreshing) setRefreshing(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);

      const [postsRes, profilesRes, likesRes] = await Promise.all([
        supabase.from('posts').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*'),
        user ? supabase.from('likes').select('post_id').eq('user_id', user.id) : { data: [] }
      ]);

      if (user) {
        const myProfile = profilesRes.data?.find(p => p.id === user.id);
        setCurrentUserAvatar(getPublicUrl('avatars', myProfile?.avatar_url));
      }

      const userLikes = new Set(likesRes.data?.map(l => l.post_id));

      const combined = postsRes.data?.map(post => {
        const author = profilesRes.data?.find(p => p.id === post.user_id || p.id === post.author_id);
        return {
          ...post,
          displayName: author?.username || "Pulse Writer",
          displayAvatar: getPublicUrl('avatars', author?.avatar_url),
          postImage: getPublicUrl('post-images', post.image_url),
          isLiked: userLikes.has(post.id),
          likesCount: post.likes_count || 0,
          commentsCount: post.comments_count || 0
        };
      });
      setPosts(combined || []);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchPosts(); }, []));

  const handleLike = async (post: any) => {
    if (!userId) return;
    const isCurrentlyLiked = post.isLiked;
    
    setPosts(current => current.map(p => p.id === post.id ? { 
      ...p, 
      isLiked: !isCurrentlyLiked, 
      likesCount: isCurrentlyLiked ? Math.max(0, p.likesCount - 1) : p.likesCount + 1 
    } : p));

    try {
      if (isCurrentlyLiked) {
        await supabase.from('likes').delete().match({ post_id: post.id, user_id: userId });
      } else {
        await supabase.from('likes').insert({ post_id: post.id, user_id: userId });
      }
    } catch (err) {
      console.error("Database sync error:", err);
    }
  };

  const handleShare = async (title: string, content: string) => {
    try {
      await Share.share({ message: `${title}\n\n${content}` });
    } catch (error) {
      console.log(error);
    }
  };

  const themeContainer = { backgroundColor: isDarkMode ? '#121212' : '#FFF' };
  const themeText = { color: isDarkMode ? '#FFF' : '#000' };
  const themeBorder = { borderBottomColor: isDarkMode ? '#222' : '#F2F2F2' };
  const themeBodyText = { color: isDarkMode ? '#CCC' : '#333' };

  const renderPost = ({ item }: { item: any }) => (
    <View style={[styles.postCard, themeBorder]}>
      <View style={styles.postHeader}>
        <View style={styles.authorSection}>
          <TouchableOpacity onPress={() => router.push(`/profile?userId=${item.user_id}`)}>
            {item.displayAvatar ? (
              <Image source={{ uri: item.displayAvatar }} style={styles.tinyAvatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: isDarkMode ? '#333' : '#F5F5F5' }]} />
            )}
          </TouchableOpacity>
          <View>
            <Text style={[styles.authorText, themeText]}>{item.displayName}</Text>
            <Text style={styles.timeText}>5d</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity><Text style={styles.subscribeText}>Subscribe</Text></TouchableOpacity>
          <TouchableOpacity style={styles.moreBtn}><MoreHorizontal size={20} color={isDarkMode ? "#555" : "#BBB"} /></TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity onPress={() => router.push({ pathname: '/article-detail', params: { id: item.id } })}>
        {item.title && <Text style={[styles.titleText, themeText]}>{item.title}</Text>}
        <Text style={[styles.bodyText, themeBodyText]} numberOfLines={4}>{item.content}</Text>
      </TouchableOpacity>

      {item.postImage && (
        <TouchableOpacity style={styles.imageCard} onPress={() => router.push({ pathname: '/article-detail', params: { id: item.id } })}>
          <Image source={{ uri: item.postImage }} style={styles.fullImage} />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.grad} />
          <View style={styles.cardContent}>
             <View style={styles.cardSourceRow}>
                <View style={styles.miniAvatar} />
                <Text style={styles.cardSourceText}>{item.displayName}</Text>
             </View>
             <View style={styles.cardTitleRow}>
                <Text style={styles.imageOverlayTitle}>{item.title || "Latest Article"}</Text>
                <Bookmark size={20} color="#FFF" />
             </View>
          </View>
        </TouchableOpacity>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.statGroup} onPress={() => handleLike(item)}>
          <Heart 
            size={20} 
            color={item.isLiked ? "#FF6719" : (isDarkMode ? "#555" : "#666")} 
            fill={item.isLiked ? "#FF6719" : "transparent"} 
          />
          <Text style={[styles.statLabel, { color: isDarkMode ? '#888' : '#666' }, item.isLiked && {color: "#FF6719"}]}>{item.likesCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.statGroup} 
          onPress={() => router.push({ pathname: '/article-detail', params: { id: item.id } })}
        >
          <MessageSquare size={20} color={isDarkMode ? "#555" : "#666"} />
          <Text style={[styles.statLabel, { color: isDarkMode ? '#888' : '#666' }]}>{item.commentsCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statGroup}>
          <Repeat2 size={20} color={isDarkMode ? "#555" : "#666"} />
          <Text style={[styles.statLabel, { color: isDarkMode ? '#888' : '#666' }]}>12</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => handleShare(item.title, item.content)}>
          <Share2 size={20} color={isDarkMode ? "#555" : "#666"} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, themeContainer]} edges={['top']}>
      <View style={[styles.navBar, themeBorder]}>
        <Text style={styles.pulseLogo}>Pulse</Text>
        <TouchableOpacity onPress={() => router.push('/profile')}>
          <View style={[styles.headerAvatar, { borderColor: '#FF6719' }]}>
            {currentUserAvatar ? (
              <Image source={{ uri: currentUserAvatar }} style={styles.fullImg} />
            ) : (
              <View style={[styles.headerPlaceholder, { backgroundColor: isDarkMode ? '#333' : '#DDD' }]} />
            )}
          </View>
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPost}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchPosts(true)} tintColor="#FF6719" />
        }
      />

      {/* Floating Action Button - Updated to Orange */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => router.push('/write')}
        activeOpacity={0.8}
      >
        <Plus size={30} color="#FFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center', borderBottomWidth: 1 },
  pulseLogo: { fontSize: 24, fontWeight: '900', color: '#FF6719', letterSpacing: -0.5 },
  headerAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F0F0F0', overflow: 'hidden', borderWidth: 1 },
  fullImg: { width: '100%', height: '100%' },
  headerPlaceholder: { flex: 1 },
  postCard: { padding: 16, borderBottomWidth: 1 },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  authorSection: { flexDirection: 'row', alignItems: 'center' },
  tinyAvatar: { width: 38, height: 38, borderRadius: 19, marginRight: 12 },
  avatarPlaceholder: { width: 38, height: 38, borderRadius: 19, marginRight: 12 },
  authorText: { fontWeight: '700', fontSize: 15 },
  timeText: { color: '#999', fontSize: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  subscribeText: { color: '#FF6719', fontWeight: '700', fontSize: 13, marginRight: 10 },
  moreBtn: { padding: 4 },
  titleText: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  bodyText: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  imageCard: { height: 220, borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  fullImage: { ...StyleSheet.absoluteFillObject },
  grad: { ...StyleSheet.absoluteFillObject },
  cardContent: { position: 'absolute', bottom: 14, left: 14, right: 14 },
  cardSourceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  miniAvatar: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFF', marginRight: 6 },
  cardSourceText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  imageOverlayTitle: { color: '#FFF', fontSize: 17, fontWeight: '800', flex: 1 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  statGroup: { flexDirection: 'row', alignItems: 'center' },
  statLabel: { marginLeft: 6, fontSize: 13 },
  fab: { 
    position: 'absolute', 
    bottom: 30, 
    right: 25, 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    backgroundColor: '#FF6719', 
    justifyContent: 'center', 
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  }
});