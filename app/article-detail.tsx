import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Bookmark, Heart, MoreHorizontal, Send, Share2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView, Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { supabase } from '../supabase';
import { useTheme } from './theme'; // Import your theme hook

const { width } = Dimensions.get('window');

export default function ArticleDetail() {
  const { isDarkMode } = useTheme();
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [post, setPost] = useState<any>(null);
  const [author, setAuthor] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [likesCount, setLikesCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [id]);

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      const { data: postData, error: postErr } = await supabase
        .from('posts')
        .select('*')
        .eq('id', id)
        .single();

      if (postErr || !postData) throw new Error("Post not found");

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', postData.user_id)
        .single();

      const { data: commentsData } = await supabase
        .from('comments')
        .select('*, profiles(username)')
        .eq('post_id', id)
        .order('created_at', { ascending: false });

      const { count: likes } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', id);

      if (user) {
        const { data: likeCheck } = await supabase
          .from('likes')
          .select('*')
          .eq('post_id', id)
          .eq('user_id', user.id)
          .maybeSingle();

        const { data: followCheck } = await supabase
          .from('follows')
          .select('*')
          .eq('follower_id', user.id)
          .eq('following_id', postData.user_id)
          .maybeSingle();

        setIsLiked(!!likeCheck);
        setIsFollowing(!!followCheck);
      }

      let finalUrl = postData.image_url;
      if (postData.image_url && !postData.image_url.startsWith('http')) {
        const { data } = supabase.storage.from('post-images').getPublicUrl(postData.image_url);
        finalUrl = data.publicUrl;
      }

      let finalAvatarUrl = null;
      if (profileData?.avatar_url) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(profileData.avatar_url);
        finalAvatarUrl = data.publicUrl;
      }

      setPost({ ...postData, finalUrl });
      setAuthor({ ...profileData, finalAvatarUrl });
      setComments(commentsData || []);
      setLikesCount(likes || 0);

    } catch (err) {
      Alert.alert("Error", "Could not load article.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoToProfile = () => {
    if (author?.id) {
      router.push({
        pathname: "/profile",
        params: { userId: author.id }
      });
    }
  };

  const handleToggleLike = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Alert.alert("Join Pulse", "Sign in to like.");

    const originalIsLiked = isLiked;
    setIsLiked(!isLiked);
    setLikesCount(prev => originalIsLiked ? prev - 1 : prev + 1);

    if (originalIsLiked) {
      await supabase.from('likes').delete().eq('post_id', id).eq('user_id', user.id);
    } else {
      await supabase.from('likes').insert([{ post_id: id, user_id: user.id }]);
    }
  };

  const toggleFollow = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Alert.alert("Join Pulse", "Sign in to follow creators.");
    if (user.id === author?.id) return;

    const original = isFollowing;
    setIsFollowing(!isFollowing);

    if (original) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', author.id);
    } else {
      await supabase.from('follows').insert([{ follower_id: user.id, following_id: author.id }]);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return Alert.alert("Error", "Sign in to comment.");

      await supabase.from('comments').insert([{
        post_id: id,
        user_id: user.id,
        content: newComment.trim()
      }]);

      setNewComment('');
      Keyboard.dismiss();
      fetchData();
    } catch (err) {
      Alert.alert("Error", "Could not post comment.");
    } finally {
      setSubmitting(false);
    }
  };

  // Theme Constants
  const bgColor = 'transparent';
  const textColor = isDarkMode ? Colors.dark.text : Colors.light.text;
  const subTextColor = isDarkMode ? Colors.dark.textMuted : Colors.light.textMuted;
  const borderColor = isDarkMode ? Colors.dark.divider : Colors.light.divider;
  const cardBg = isDarkMode ? Colors.dark.surface : Colors.light.surface;
  const interactionPillBg = isDarkMode ? Colors.dark.surface : Colors.light.surface;
  const iconColor = isDarkMode ? Colors.dark.text : Colors.light.text;

  if (loading) return (
    <View style={[styles.centered, { backgroundColor: bgColor }]}>
      <ActivityIndicator size="large" color={Colors.light.primary} />
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <ArrowLeft size={22} color={iconColor} />
          </TouchableOpacity>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerBtn}><Bookmark size={22} color={iconColor} /></TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn}><Share2 size={22} color={iconColor} /></TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn}><MoreHorizontal size={22} color={iconColor} /></TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity onPress={handleGoToProfile} activeOpacity={0.8}>
            <LinearGradient
              colors={isDarkMode ? ['#8F9AFF', '#FFB1EE'] : ['#5E9BFF', '#FF8E59']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.pulseBadge}
            >
              <Text style={styles.pulseBadgeText}>{author?.username?.toUpperCase() || 'USER'}'S PULSE</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={[styles.titleText, { color: textColor }]}>{post?.title}</Text>

          <View style={styles.authorRow}>
            <TouchableOpacity onPress={handleGoToProfile} style={styles.avatar}>
              {author?.finalAvatarUrl ? (
                <Image source={{ uri: author.finalAvatarUrl }} style={styles.fullImg} />
              ) : (
                <Text style={styles.avatarText}>{author?.username?.[0]?.toUpperCase() || '?'}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleGoToProfile} style={{ flex: 1 }}>
              <Text style={[styles.authorName, { color: textColor }]}>{author?.username || 'Anonymous'}</Text>
              <Text style={[styles.dateText, { color: subTextColor }]}>
                {post?.created_at ? new Date(post.created_at).toLocaleDateString() : ''} · 4 min read
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleFollow}
              style={[styles.followButton, isFollowing && { backgroundColor: isDarkMode ? '#333' : '#F0F0F0' }]}
            >
              <Text style={[styles.followButtonText, isFollowing && { color: subTextColor }]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          </View>

          {post?.finalUrl && <Image source={{ uri: post.finalUrl }} style={styles.heroImage} />}
          <Text style={[styles.articleBody, { color: isDarkMode ? '#DDD' : '#222' }]}>{post?.content}</Text>

          <View style={[styles.sectionDivider, { backgroundColor: borderColor }]} />

          <Text style={[styles.commentHeader, { color: textColor }]}>Discussion</Text>
          {comments.map((item) => (
            <View key={item.id} style={[styles.commentCard, { borderBottomColor: isDarkMode ? '#222' : '#F5F5F5' }]}>
              <View style={styles.commentTop}>
                <Text style={styles.commentUser}>@{item.profiles?.username || 'user'}</Text>
                <Text style={[styles.commentTime, { color: isDarkMode ? '#555' : '#AAA' }]}>{new Date(item.created_at).toLocaleDateString()}</Text>
              </View>
              <Text style={[styles.commentBody, { color: isDarkMode ? '#BBB' : '#444' }]}>{item.content}</Text>
            </View>
          ))}
          <View style={{ height: 120 }} />
        </ScrollView>

        <View style={[
          styles.interactionPill,
          {
            backgroundColor: interactionPillBg,
            borderColor: borderColor,
            shadowColor: isDarkMode ? '#000' : '#000',
          }
        ]}>
          <TouchableOpacity style={styles.likeAction} onPress={handleToggleLike}>
            <Heart size={22} color={isLiked ? "#FF3B30" : iconColor} fill={isLiked ? "#FF3B30" : "transparent"} />
            <Text style={[styles.likeText, { color: isLiked ? '#FF3B30' : textColor }]}>{likesCount}</Text>
          </TouchableOpacity>
          <View style={[styles.verticalDivider, { backgroundColor: borderColor }]} />
          <TextInput
            style={[styles.commentInput, { color: textColor }]}
            placeholder="Write a reply..."
            placeholderTextColor={isDarkMode ? "#555" : "#999"}
            value={newComment}
            onChangeText={setNewComment}
          />
          <TouchableOpacity onPress={handlePostComment} style={styles.sendCircle} disabled={submitting}>
            {submitting ? <ActivityIndicator size="small" color="#1C1917" /> : <Send size={18} color="#1C1917" />}
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10 },
  headerRight: { flexDirection: 'row' },
  headerBtn: { padding: 10 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10 },
  pulseBadge: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginBottom: 15 },
  pulseBadgeText: { color: '#FFFFFF', fontSize: 12, letterSpacing: 1.2, fontFamily: 'ClashGrotesk-Bold' },
  titleText: { fontSize: 32, lineHeight: 38, marginBottom: 20, fontFamily: 'ClashGrotesk-Bold' },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.light.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' },
  fullImg: { width: '100%', height: '100%' },
  avatarText: { color: '#1E2230', fontSize: 18, fontFamily: 'ClashGrotesk-Bold' },
  authorName: { fontSize: 16, fontFamily: 'ClashGrotesk-Bold' },
  dateText: { fontSize: 13, marginTop: 2, fontFamily: 'ClashGrotesk' },
  followButton: { backgroundColor: Colors.light.primary, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  followButtonText: { color: '#1E2230', fontSize: 14, fontFamily: 'ClashGrotesk-Bold' },
  heroImage: { width: '100%', height: 280, borderRadius: 16, marginBottom: 25 },
  articleBody: { fontSize: 18, lineHeight: 30, fontFamily: 'ClashGrotesk' },
  sectionDivider: { height: 1, marginVertical: 40 },
  commentHeader: { fontSize: 22, marginBottom: 20, fontFamily: 'ClashGrotesk-Bold' },
  commentCard: { marginBottom: 20, paddingBottom: 20, borderBottomWidth: 1 },
  commentTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  commentUser: { color: Colors.light.primary, fontFamily: 'ClashGrotesk-Bold' },
  commentTime: { fontSize: 12, fontFamily: 'ClashGrotesk' },
  commentBody: { fontSize: 15, lineHeight: 22, fontFamily: 'ClashGrotesk' },
  interactionPill: { position: 'absolute', bottom: 30, left: 15, right: 15, height: 60, borderRadius: 30, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10, borderWidth: 1 },
  likeAction: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 },
  likeText: { marginLeft: 8, fontSize: 16, fontFamily: 'ClashGrotesk-Bold' },
  verticalDivider: { width: 1, height: 25 },
  commentInput: { flex: 1, paddingHorizontal: 15, fontSize: 15, fontFamily: 'ClashGrotesk' },
  sendCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.light.primary, justifyContent: 'center', alignItems: 'center' }
});