import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Bookmark, Eye, Heart, MessageSquare, Send, Share2, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView, Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { supabase } from '../supabase';
import { timeAgo } from '../utils/dateUtils';
import { useTheme } from './theme'; // Import your theme hook

const { width } = Dimensions.get('window');

export default function ArticleDetail() {
  const { isDarkMode } = useTheme();
  const { id, focusComments } = useLocalSearchParams();
  const router = useRouter();

  const scrollViewRef = React.useRef<ScrollView>(null);
  const commentsYRef = React.useRef<number>(0);

  const [post, setPost] = useState<any>(null);
  const [author, setAuthor] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [likesCount, setLikesCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [hasActivePulse, setHasActivePulse] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });
  }, []);

  const handleReply = (comment: any) => {
    setReplyingTo(comment);
  };

  const handleDeleteComment = async (commentId: string) => {
    Alert.alert(
      "Delete Comment",
      "Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase.from('comments').delete().eq('id', commentId);
              if (error) throw error;

              await supabase.from('notifications').delete().match({
                comment_id: commentId,
                type: 'comment'
              });

              setComments(prev => prev.filter(c => c.id !== commentId));
            } catch (err) {
              Alert.alert("Error", "Could not delete comment.");
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    if (id) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!loading && focusComments === 'true' && scrollViewRef.current) {
      // slight delay to ensure layout is ready
      setTimeout(() => {
        scrollToComments();
      }, 500);
    }
  }, [loading, focusComments]);

  const scrollToComments = () => {
    scrollViewRef.current?.scrollTo({ y: commentsYRef.current, animated: true });
  };

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
        .select('*, profiles(username, avatar_url)')
        .eq('post_id', id)
        .order('created_at', { ascending: true });

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

        const { data: bookmarkCheck } = await supabase
          .from('bookmarks')
          .select('*')
          .eq('post_id', id)
          .eq('user_id', user.id)
          .maybeSingle();

        setIsLiked(!!likeCheck);
        setIsFollowing(!!followCheck);
        setIsBookmarked(!!bookmarkCheck);
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

      // Check for active pulses
      const { count: pulseCount } = await supabase
        .from('pulses')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', postData.user_id)
        .gt('expires_at', new Date().toISOString());

      setHasActivePulse((pulseCount || 0) > 0);

      // Increment views
      await supabase.rpc('increment_views', { post_id: id });

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

  const handleGoToPulse = () => {
    if (author?.id && hasActivePulse) {
      router.push({
        pathname: "/view-pulse",
        params: { userId: author.id }
      });
    }
  };

  const getPublicUrl = (bucket: string, path: string) => {
    if (!path) return null;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleToggleLike = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Alert.alert("Join Pulse", "Sign in to like.");

    const originalIsLiked = isLiked;
    setIsLiked(!isLiked);
    setLikesCount(prev => originalIsLiked ? prev - 1 : prev + 1);

    if (originalIsLiked) {
      const { error: unlikeError } = await supabase.from('likes').delete().eq('post_id', id).eq('user_id', user.id);
      if (unlikeError) {
        console.error("Unlike Error:", unlikeError);
        Alert.alert("Error", "Could not unlike post.");
        // Revert UI if needed, but for now just alert
        return;
      }

      // Remove notification if it exists
      await supabase.from('notifications').delete().match({
        user_id: post?.user_id || '',
        actor_id: user.id,
        type: 'like',
        post_id: id
      });
    } else {
      const { error } = await supabase.from('likes').insert([{ post_id: id, user_id: user.id }]);
      if (error) {
        console.error("Like Error:", error);
        Alert.alert("Error", "Could not like post.");
        return;
      }

      if (post?.user_id && post.user_id !== user.id) {
        try {
          // 1. Force delete any existing/stale notification first
          const { error: delError } = await supabase
            .from('notifications')
            .delete()
            .eq('user_id', post.user_id)
            .eq('actor_id', user.id)
            .eq('type', 'like')
            .eq('post_id', id);

          if (delError) console.error("Notification Delete Error:", delError);

          // 2. Insert fresh notification
          const { error: insError } = await supabase
            .from('notifications')
            .insert({
              user_id: post.user_id,
              actor_id: user.id,
              type: 'like',
              post_id: id,
              is_read: false
            });

          if (insError) console.error("Notification Insert Error:", insError);
        } catch (err) {
          console.error("Notification Logic Exception:", err);
        }
      }
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
      // Remove notification
      await supabase.from('notifications').delete().match({
        user_id: author.id,
        actor_id: user.id,
        type: 'follow'
      });
    } else {
      const { error } = await supabase.from('follows').insert([{ follower_id: user.id, following_id: author.id }]);
      if (!error) {
        // Check if notification already exists
        const { data: existing } = await supabase.from('notifications').select('id').match({
          user_id: author.id,
          actor_id: user.id,
          type: 'follow'
        }).maybeSingle();

        if (!existing) {
          await supabase.from('notifications').insert({
            user_id: author.id,
            actor_id: user.id,
            type: 'follow',
            is_read: false
          });
        }
      }
    }
  };

  const handleToggleBookmark = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Alert.alert("Join Pulse", "Sign in to bookmark stories.");

    const original = isBookmarked;
    setIsBookmarked(!isBookmarked);

    if (original) {
      await supabase.from('bookmarks').delete().eq('post_id', id).eq('user_id', user.id);
    } else {
      await supabase.from('bookmarks').insert([{ post_id: id, user_id: user.id }]);
    }
  };

  const handleShare = async () => {
    try {
      if (!post) return;

      const shareOptions = {
        title: post.title,
        message: `${post.title}\n\n${post.content}`,
      };

      await Share.share(shareOptions);
    } catch (error: any) {
      console.error("Share Error:", error.message);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return Alert.alert("Error", "Sign in to comment.");

      const payload: any = {
        post_id: id,
        user_id: user.id,
        content: newComment.trim()
      };

      if (replyingTo) {
        payload.parent_id = replyingTo.id;
      }

      const { data: commentData, error } = await supabase.from('comments').insert([payload]).select().single();

      if (error) throw error;

      // Notification logic
      const targetUserId = replyingTo ? replyingTo.user_id : post?.user_id;

      if (targetUserId && targetUserId !== user.id) {
        await supabase.from('notifications').insert({
          user_id: targetUserId,
          actor_id: user.id,
          type: 'comment',
          post_id: id,
          comment_id: commentData.id,
          is_read: false
        });
      }

      setNewComment('');
      setReplyingTo(null);
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
      <ActivityIndicator size="large" color={isDarkMode ? Colors.dark.secondary : Colors.light.secondary} />
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
            <TouchableOpacity style={styles.headerBtn} onPress={scrollToComments}>
              <MessageSquare size={22} color={iconColor} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={handleToggleBookmark}>
              <Bookmark size={22} color={isBookmarked ? Colors.light.primary : iconColor} fill={isBookmarked ? Colors.light.primary : "transparent"} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={handleShare}>
              <Share2 size={22} color={iconColor} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {hasActivePulse && (
            <TouchableOpacity onPress={handleGoToPulse} activeOpacity={0.8}>
              <LinearGradient
                colors={isDarkMode ? [Colors.dark.primary, Colors.dark.secondary] : [Colors.light.primary, Colors.light.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.pulseBadge}
              >
                <Text style={styles.pulseBadgeText}>{author?.username?.toUpperCase() || 'USER'}'S PULSE</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={[styles.dateText, { color: subTextColor }]}>
                  {post?.created_at ? timeAgo(post.created_at) : ''}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Eye size={14} color={subTextColor} />
                  <Text style={[styles.dateText, { color: subTextColor }]}>{post?.views_count || 0}</Text>
                </View>
              </View>
            </TouchableOpacity>

            {currentUserId !== author?.id && (
              <TouchableOpacity
                onPress={toggleFollow}
                style={[styles.followButton, isFollowing && { backgroundColor: isDarkMode ? '#333' : '#F0F0F0' }]}
              >
                <Text style={[styles.followButtonText, isFollowing && { color: subTextColor }]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {post?.finalUrl && (
            <View style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 25, height: 280, backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface }}>
              <Image source={{ uri: post.finalUrl }} style={styles.fullImg} resizeMode="cover" />
            </View>
          )}
          <Text style={[styles.articleBody, { color: isDarkMode ? '#DDD' : '#222' }]}>{post?.content}</Text>

          <View style={[styles.sectionDivider, { backgroundColor: borderColor }]} />

          <View onLayout={(event) => {
            const layout = event.nativeEvent.layout;
            commentsYRef.current = layout.y;
          }}>
            <Text style={[styles.commentHeader, { color: textColor }]}>Discussion</Text>
          </View>
          {/* Render Helper */}
          {(() => {
            const rootComments = comments.filter(c => !c.parent_id);
            const getReplies = (parentId: string) => comments.filter(c => c.parent_id === parentId);

            const renderCommentItem = (item: any, isReply = false) => {
              const commentAvatar = item.profiles?.avatar_url
                ? getPublicUrl('avatars', item.profiles.avatar_url)
                : null;
              const isMyComment = currentUserId && item.user_id === currentUserId;

              return (
                <View key={item.id} style={[
                  styles.commentCard,
                  isReply && { marginLeft: 30, borderLeftWidth: 2, borderLeftColor: borderColor, paddingLeft: 10, borderBottomWidth: 0 },
                  { borderBottomColor: isDarkMode ? '#222' : '#F5F5F5' }
                ]}>
                  <View style={styles.commentHeaderRow}>
                    <View style={styles.commentAuthorInfo}>
                      {commentAvatar ? (
                        <Image source={{ uri: commentAvatar }} style={styles.commentAvatar} />
                      ) : (
                        <View style={[styles.commentAvatar, { backgroundColor: isDarkMode ? '#333' : '#EEE', justifyContent: 'center', alignItems: 'center' }]}>
                          <Text style={{ color: subTextColor, fontSize: 12 }}>{item.profiles?.username?.[0]?.toUpperCase()}</Text>
                        </View>
                      )}
                      <View style={{ justifyContent: 'center' }}>
                        <Text style={styles.commentUser}>@{item.profiles?.username || 'user'}</Text>
                        <Text style={[styles.commentTime, { color: isDarkMode ? '#777' : '#999' }]}>{new Date(item.created_at).toLocaleDateString()}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                      {!isReply && (
                        <TouchableOpacity onPress={() => handleReply(item)} hitSlop={10}>
                          <Text style={{ color: isDarkMode ? Colors.dark.secondary : Colors.light.secondary, fontSize: 13, fontFamily: 'ClashGrotesk-SemiBold' }}>Reply</Text>
                        </TouchableOpacity>
                      )}
                      {isMyComment && (
                        <TouchableOpacity onPress={() => handleDeleteComment(item.id)} hitSlop={15} style={styles.deleteBtn}>
                          <Trash2 size={16} color={isDarkMode ? '#666' : '#CCC'} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <Text style={[styles.commentBody, { color: isDarkMode ? '#CCCCCC' : '#444444' }]}>{item.content}</Text>
                </View>
              );
            };

            return rootComments.map((item) => (
              <View key={item.id}>
                {renderCommentItem(item)}
                {getReplies(item.id).map(reply => renderCommentItem(reply, true))}
              </View>
            ));
          })()}
          <View style={{ height: 120 }} />
        </ScrollView>

        <View style={[
          styles.interactionPill,
          {
            backgroundColor: interactionPillBg,
            borderColor: borderColor,
            shadowColor: isDarkMode ? '#000' : '#000',
            flexDirection: 'column',
            height: replyingTo ? 100 : 70,
            alignItems: 'stretch',
            paddingVertical: 5
          }
        ]}>
          {replyingTo && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: borderColor }}>
              <Text style={{ color: textColor, fontSize: 13, fontFamily: 'ClashGrotesk' }}>Replying to @{replyingTo.profiles?.username}</Text>
              <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ padding: 5 }}>
                <Text style={{ color: Colors.light.primary, fontSize: 13, fontFamily: 'ClashGrotesk-Bold' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingHorizontal: 10 }}>
            <TouchableOpacity style={styles.likeAction} onPress={handleToggleLike}>
              <Heart size={22} color={isLiked ? "#FF3B30" : iconColor} fill={isLiked ? "#FF3B30" : "transparent"} />
              <Text style={[styles.likeText, { color: isLiked ? '#FF3B30' : textColor }]}>{likesCount}</Text>
            </TouchableOpacity>
            <View style={[styles.verticalDivider, { backgroundColor: borderColor }]} />
            <TextInput
              style={[styles.commentInput, { color: textColor }]}
              placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
              placeholderTextColor={isDarkMode ? "#555" : "#999"}
              value={newComment}
              onChangeText={setNewComment}
              autoFocus={!!replyingTo}
            />
            <TouchableOpacity onPress={handlePostComment} style={styles.sendCircle} disabled={submitting}>
              {submitting ? <ActivityIndicator size="small" color="#1C1917" /> : <Send size={18} color="#1C1917" />}
            </TouchableOpacity>
          </View>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
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
  commentCard: {
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  commentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentAuthorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  commentUser: {
    color: Colors.light.primary,
    fontFamily: 'ClashGrotesk-Bold',
    fontSize: 14,
    marginBottom: 2
  },
  commentTime: {
    fontSize: 11,
    fontFamily: 'ClashGrotesk'
  },
  commentBody: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'ClashGrotesk',
    marginLeft: 46, // Aligns with text start
    paddingRight: 10
  },
  deleteBtn: {
    padding: 5,
  },
  interactionPill: { position: 'absolute', bottom: 30, left: 15, right: 15, height: 60, borderRadius: 30, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10, borderWidth: 1 },
  likeAction: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 },
  likeText: { marginLeft: 8, fontSize: 16, fontFamily: 'ClashGrotesk-Bold' },
  verticalDivider: { width: 1, height: 25 },
  commentInput: { flex: 1, paddingHorizontal: 15, fontSize: 15, fontFamily: 'ClashGrotesk' },
  sendCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.light.primary, justifyContent: 'center', alignItems: 'center' }
});