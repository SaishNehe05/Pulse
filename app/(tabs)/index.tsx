import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { Eye, Heart, MessageSquare, MoreHorizontal, Plus, Share2 } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Image, RefreshControl, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import PostMenu from '../../components/PostMenu';
import PulseBar from '../../components/PulseBar';
import { BOTTOM_NAV_PADDING } from '../../constants/layout';
import { Colors } from '../../constants/theme';
import { supabase } from '../../supabase';
import { timeAgo } from '../../utils/dateUtils';
import { useTheme } from '../theme';

export default function HomeFeed() {
  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const [activePost, setActivePost] = useState<any>(null);
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

      // Parallel fetch for efficiency
      const [postsRes, profilesRes, likesRes] = await Promise.all([
        supabase.from('posts').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, username, avatar_url'),
        user ? supabase.from('likes').select('post_id').eq('user_id', user.id) : { data: [] }
      ]);

      if (postsRes.error) throw postsRes.error;
      if (profilesRes.error) throw profilesRes.error;

      if (user) {
        const myProfile = profilesRes.data?.find(p => p.id === user.id);
        setCurrentUserAvatar(getPublicUrl('avatars', myProfile?.avatar_url));
      }

      const userLikes = new Set(likesRes.data?.map(l => l.post_id));

      const combined = postsRes.data?.map(post => {
        const author = profilesRes.data?.find(p => p.id === post.user_id);
        return {
          ...post,
          displayName: author?.username || "Pulse Writer",
          displayAvatar: author?.avatar_url ? getPublicUrl('avatars', author.avatar_url) : null,
          postImage: post.image_url ? getPublicUrl('post-images', post.image_url) : null,
          isLiked: userLikes.has(post.id),
          likesCount: post.likes_count || 0,
          commentsCount: post.comments_count || 0
        };
      });
      setPosts(combined || []);
    } catch (err: any) {
      if (err.message && !err.message.includes("fetch")) {
        // Silently fail or handle gracefully in UI
      }
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
        // Remove notification
        await supabase.from('notifications').delete().match({
          user_id: post.user_id,
          actor_id: userId,
          type: 'like',
          post_id: post.id
        });
      } else {
        const { error } = await supabase.from('likes').insert({ post_id: post.id, user_id: userId });
        if (!error && post.user_id && post.user_id !== userId) {
          // 1. Force delete any existing/stale notification first
          await supabase.from('notifications').delete().match({
            user_id: post.user_id,
            actor_id: userId,
            type: 'like',
            post_id: post.id
          });

          // 2. Insert fresh notification
          await supabase.from('notifications').insert({
            user_id: post.user_id,
            actor_id: userId,
            type: 'like',
            post_id: post.id,
            is_read: false
          });
        }
      }
    } catch (err) {
      // Database sync error handled silently
    }
  };

  const handleShare = async (title: string, content: string) => {
    try {
      await Share.share({ message: `${title}\n\n${content}` });
    } catch (error) {
    }
  };

  const handleDeletePost = async (postId: number, imageUrl: string | null) => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase.from('posts').delete().eq('id', postId);

              if (error) {
                throw error;
              }

              // 2. Delete the associated image from storage if it exists
              if (imageUrl) {
                try {
                  // Extract the file path from the public URL
                  // Example URL: .../storage/v1/object/public/post-images/USER_ID/TIMESTAMP.jpg
                  const pathParts = imageUrl.split('post-images/');
                  if (pathParts.length > 1) {
                    const filePath = pathParts[1];
                    await supabase.storage.from('post-images').remove([filePath]);
                  }
                } catch (storageErr) {
                  // Non-fatal, post is already deleted
                }
              }

              setPosts(prev => prev.filter(p => p.id !== postId));
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          }
        }
      ]
    );
  };

  const handleMoreOptions = (post: any, event: any) => {
    // pageX and pageY are available on the native event from TouchableOpacity
    const { pageX, pageY } = event.nativeEvent;
    setMenuAnchor({ x: pageX, y: pageY });
    setActivePost(post);
    setMenuVisible(true);
  };

  const getMenuOptions = (post: any) => {
    const options: { label: string; onPress: () => void; destructive?: boolean }[] = [
      { label: "Share", onPress: () => { handleShare(post.title, post.content); } },
    ];

    if (post.user_id === userId) {
      options.push({
        label: "Delete",
        destructive: true,
        onPress: () => { handleDeletePost(post.id, post.image_url); }
      });
    }

    return options;
  };

  const themeContainer = { backgroundColor: 'transparent' }; // Transparent to show ThemedBackground
  const themeText = { color: isDarkMode ? Colors.dark.text : Colors.light.text };
  const themeBorder = { borderBottomColor: isDarkMode ? Colors.dark.divider : Colors.light.divider };
  const themeBodyText = { color: isDarkMode ? Colors.dark.textMuted : Colors.light.textMuted };

  const renderPost = ({ item }: { item: any }) => (
    <View style={[styles.postCard, themeBorder]}>
      <View style={styles.postHeader}>
        <View style={styles.authorSection}>
          <TouchableOpacity onPress={() => router.push(`/profile?userId=${item.user_id}`)}>
            {item.displayAvatar ? (
              <Image source={{ uri: item.displayAvatar }} style={styles.tinyAvatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface }]} />
            )}
          </TouchableOpacity>
          <View>
            <Text style={[styles.authorText, themeText]}>{item.displayName}</Text>
            <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.moreBtn} onPress={(e) => handleMoreOptions(item, e)}>
            <MoreHorizontal size={20} color={isDarkMode ? "#555" : "#BBB"} />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity onPress={() => router.push({ pathname: '/article-detail', params: { id: item.id } })}>
        {item.title && <Text style={[styles.titleText, themeText]}>{item.title}</Text>}
        <Text style={[styles.bodyText, themeBodyText]} numberOfLines={4}>{item.content}</Text>
      </TouchableOpacity>

      {item.postImage && (
        <TouchableOpacity style={styles.imageCard} onPress={() => router.push({ pathname: '/article-detail', params: { id: item.id } })}>
          <Image source={{ uri: item.postImage }} style={styles.fullImage} resizeMode="cover" />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.grad} />
          <View style={styles.cardContent}>
            <View style={styles.cardSourceRow}>
              {item.displayAvatar ? (
                <Image source={{ uri: item.displayAvatar }} style={styles.miniAvatar} />
              ) : (
                <View style={styles.miniAvatar} />
              )}
              <Text style={styles.cardSourceText}>{item.displayName}</Text>
            </View>
            <View style={styles.cardTitleRow}>
              <Text style={styles.imageOverlayTitle}>{item.title || "Latest Post"}</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.statGroup} onPress={() => handleLike(item)}>
          <Heart
            size={20}
            color={item.isLiked ? Colors.light.primary : (isDarkMode ? "#555" : "#666")}
            fill={item.isLiked ? Colors.light.primary : "transparent"}
          />
          <Text style={[styles.statLabel, { color: isDarkMode ? '#888' : '#666' }, item.isLiked && { color: Colors.light.primary }]}>{item.likesCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statGroup}
          onPress={() => router.push({ pathname: '/article-detail', params: { id: item.id, focusComments: 'true' } })}
        >
          <MessageSquare size={20} color={isDarkMode ? "#555" : "#666"} />
          <Text style={[styles.statLabel, { color: isDarkMode ? '#888' : '#666' }]}>{item.commentsCount}</Text>
        </TouchableOpacity>

        <View style={styles.statGroup}>
          <Eye size={20} color={isDarkMode ? "#555" : "#666"} />
          <Text style={[styles.statLabel, { color: isDarkMode ? '#888' : '#666' }]}>{item.views_count || 0}</Text>
        </View>

        <TouchableOpacity onPress={() => handleShare(item.title, item.content)}>
          <Share2 size={20} color={isDarkMode ? "#555" : "#666"} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, themeContainer]} edges={['top']}>
      <View style={[styles.navBar, themeBorder]}>
        <Text style={[styles.pulseLogo, { color: isDarkMode ? Colors.dark.primary : Colors.light.primary }]}>Pulse</Text>
        <TouchableOpacity onPress={() => router.push('/profile')}>
          <View style={[styles.headerAvatar, { borderColor: isDarkMode ? Colors.dark.primary : Colors.light.primary }]}>
            {currentUserAvatar ? (
              <Image source={{ uri: currentUserAvatar }} style={styles.fullImg} />
            ) : (
              <View style={[styles.headerPlaceholder, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface }]} />
            )}
          </View>
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        ListHeaderComponent={<PulseBar />}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPost}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchPosts(true)} tintColor={isDarkMode ? Colors.dark.secondary : Colors.light.secondary} />
        }
        contentContainerStyle={{ paddingBottom: BOTTOM_NAV_PADDING }}
      />

      {/* Floating Action Button - Updated with Dynamic Padding */}
      <TouchableOpacity
        style={[styles.fab, {
          backgroundColor: isDarkMode ? Colors.dark.primary : Colors.light.primary,
          bottom: 90 + insets.bottom,
          zIndex: 100
        }]}
        onPress={() => router.push('/write')}
        activeOpacity={0.8}
      >
        <Plus size={30} color={isDarkMode ? '#000' : '#1C1917'} />
      </TouchableOpacity>

      <PostMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        anchor={menuAnchor}
        options={activePost ? getMenuOptions(activePost) : []}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center', borderBottomWidth: 1 },
  pulseLogo: { fontSize: 24, color: Colors.light.primary, letterSpacing: -0.5, fontFamily: 'ClashGrotesk-Bold' },
  headerAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F0F0F0', overflow: 'hidden', borderWidth: 1 },
  fullImg: { width: '100%', height: '100%' },
  headerPlaceholder: { flex: 1 },
  postCard: { padding: 16, borderBottomWidth: 1 },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  authorSection: { flexDirection: 'row', alignItems: 'center' },
  tinyAvatar: { width: 38, height: 38, borderRadius: 19, marginRight: 12 },
  avatarPlaceholder: { width: 38, height: 38, borderRadius: 19, marginRight: 12 },
  authorText: { fontSize: 15, fontFamily: 'ClashGrotesk-SemiBold' },
  timeText: { color: '#999', fontSize: 12, fontFamily: 'ClashGrotesk' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  subscribeText: { color: Colors.light.primary, fontSize: 13, marginRight: 10, fontFamily: 'ClashGrotesk-Bold' },
  deleteBtn: { marginRight: 10 },
  deleteText: { color: '#FF3B30', fontWeight: '700', fontSize: 13 },
  moreBtn: { padding: 4 },
  titleText: { fontSize: 20, marginBottom: 6, fontFamily: 'ClashGrotesk-Bold' },
  bodyText: { fontSize: 15, lineHeight: 22, marginBottom: 16, fontFamily: 'ClashGrotesk' },
  imageCard: { height: 220, borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  fullImage: { ...StyleSheet.absoluteFillObject },
  grad: { ...StyleSheet.absoluteFillObject },
  cardContent: { position: 'absolute', bottom: 14, left: 14, right: 14 },
  cardSourceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  miniAvatar: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFF', marginRight: 6, overflow: 'hidden' },
  cardSourceText: { color: '#FFF', fontSize: 11, fontFamily: 'ClashGrotesk-Medium' },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  imageOverlayTitle: { color: '#FFF', fontSize: 17, flex: 1, fontFamily: 'ClashGrotesk-Bold' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  statGroup: { flexDirection: 'row', alignItems: 'center' },
  statLabel: { marginLeft: 6, fontSize: 13, fontFamily: 'ClashGrotesk-Medium' },
  fab: {
    position: 'absolute',
    bottom: 80, // Fallback, overridden by insets
    right: 25,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  }
});