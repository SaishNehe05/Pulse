import { useFocusEffect, useRouter } from 'expo-router';
import { Bell, Heart, MessageSquare, UserPlus } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BOTTOM_NAV_PADDING } from '../../constants/layout';
import { Colors } from '../../constants/theme';
import { useUnreadCounts } from '../../hooks/useUnreadCounts';
import { supabase } from '../../supabase';
import { formatPulseDate, timeAgo } from '../../utils/dateUtils';
import { useTheme } from '../theme'; // Adjusted path to app/theme.tsx

export default function Activity() {
  const { isDarkMode } = useTheme();
  const { refresh } = useUnreadCounts();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);

  const theme = isDarkMode ? Colors.dark : Colors.light;

  const getPublicUrl = (bucket: string, path: string | null) => {
    if (!path || path === "") return null;
    if (path.startsWith('http')) return path;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const fetchProfileAndNotifications = async () => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch Profile Avatar
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single();

      if (profile?.avatar_url) {
        setCurrentUserAvatar(getPublicUrl('avatars', profile.avatar_url));
      }

      // 2. Fetch Notifications
      const { data: rawNotifs, error: notifErr } = await supabase
        .from('notifications')
        .select(`
          id,
          user_id,
          actor_id,
          type,
          post_id,
          comment_id,
          is_read,
          created_at,
          post:posts (
            id,
            title,
            image_url
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (notifErr) throw notifErr;

      if (rawNotifs && rawNotifs.length > 0) {
        // Fetch actor profiles separately to ensure all details are included
        const actorIds = [...new Set(rawNotifs.map(n => n.actor_id))];
        const { data: actors } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', actorIds);

        // Fetch follow statuses for notifications of type 'follow'
        const { data: followStatuses } = await supabase
          .from('follows')
          .select('follower_id, following_id, status')
          .eq('following_id', user.id)
          .in('follower_id', actorIds);

        const merged = rawNotifs.map(notif => {
          const actorProfile = actors?.find(a => a.id === notif.actor_id);
          const followInfo = notif.type === 'follow' ? followStatuses?.find(f => f.follower_id === notif.actor_id) : null;
          const post = Array.isArray(notif.post) ? notif.post[0] : notif.post;
          return {
            ...notif,
            follow_status: followInfo?.status || null,
            actor: {
              ...actorProfile,
              username: actorProfile?.username || 'Someone',
              avatar_full_url: getPublicUrl('avatars', actorProfile?.avatar_url || null)
            },
            post: post ? {
              ...post,
              image_full_url: getPublicUrl('post-images', post.image_url)
            } : null
          };
        });
        setNotifications(merged);
        return merged;
      } else {
        setNotifications([]);
        return [];
      }
    } catch (err: any) {
      setError(err.message);
      console.error("Activity Error:", err);
    } finally {
      setLoading(false);
    }
    return []; // Fallback
  };

  useFocusEffect(
    useCallback(() => {
      // Real-time subscription for new notifications
      let channel: any;
      const setupSubscription = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        channel = supabase
          .channel('activity_realtime')
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'notifications',
          }, async (payload) => {
            // Check if relevant
            let isRelevant = false;
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              isRelevant = (payload.new as any).user_id === user.id;
            } else if (payload.eventType === 'DELETE') {
              isRelevant = true; // Assume relevant for safety/refresh
            }

            if (isRelevant) {
              const updatedNotifs = await fetchProfileAndNotifications();
              if (updatedNotifs) markAllExceptCommentsAsRead(updatedNotifs);
              refresh();
            }
          })
          .subscribe();
      };

      // Single init: fetch + mark read + subscribe
      const init = async () => {
        const freshNotifs = await fetchProfileAndNotifications();
        if (freshNotifs) markAllExceptCommentsAsRead(freshNotifs);
        refresh();
      };

      init();
      setupSubscription();

      return () => {
        if (channel) supabase.removeChannel(channel);
      };
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfileAndNotifications();
    setRefreshing(false);
  };

  const markAsRead = async (id: number) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      await refresh(); // Await global badge refresh
    } catch (err) {
      console.error("Error marking read:", err);
    }
  };

  const markAllExceptCommentsAsRead = async (rawNotifs: any[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const unreadNonComments = rawNotifs.filter(n => n.type !== 'comment' && !n.is_read);

      if (unreadNonComments.length === 0) return;

      const ids = unreadNonComments.map(n => n.id);

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', ids);

      if (error) throw error;

      // Update local state and unread badge
      setNotifications(prev =>
        prev.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n)
      );
      await refresh();
    } catch (err) {
      console.error("Error bulk marking read:", err);
    }
  };

  const handleNotificationPress = (item: any) => {
    if (item.type === 'follow') {
      router.push({ pathname: '/profile', params: { userId: item.actor_id } });
    } else if (item.post_id) {
      router.push({ pathname: '/article-detail', params: { id: item.post_id } });
    }
    // Mark as read AFTER starting navigation to prevent "vanishing" UI
    markAsRead(item.id);
  };

  const handleAcceptFollow = async (item: any) => {
    try {
      const { error } = await supabase
        .from('follows')
        .update({ status: 'accepted' })
        .eq('follower_id', item.actor_id)
        .eq('following_id', item.user_id);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => n.id === item.id ? { ...n, follow_status: 'accepted' } : n)
      );
    } catch (err) {
      console.error("Error accepting follow:", err);
    }
  };

  const handleCancelFollow = async (item: any) => {
    try {
      // Delete the follow record
      const { error: followErr } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', item.actor_id)
        .eq('following_id', item.user_id);

      if (followErr) throw followErr;

      // Delete the notification
      const { error: notifErr } = await supabase
        .from('notifications')
        .delete()
        .eq('id', item.id);

      if (notifErr) throw notifErr;

      setNotifications(prev => prev.filter(n => n.id !== item.id));
      refresh();
    } catch (err) {
      console.error("Error canceling follow:", err);
    }
  };


  // Group notifications by day in a rock-solid, stable way
  const sectionData = useMemo(() => {
    // 1. Explicitly sort by date (desc) and then ID (desc) to ensure absolute stability
    const sorted = [...notifications].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return b.id - a.id;
    });

    // 2. Group into sections
    return sorted.reduce((acc: any[], notif) => {
      const heading = formatPulseDate(notif.created_at, { isHeader: true });
      const existingSection = acc.find(s => s.title === heading);

      if (existingSection) {
        existingSection.data.push(notif);
      } else {
        acc.push({ title: heading, data: [notif] });
      }
      return acc;
    }, []);
  }, [notifications]);

  const renderNotification = ({ item }: { item: any }) => {
    const isLike = item.type === 'like';
    const isComment = item.type === 'comment';
    const isFollow = item.type === 'follow';

    const Icon = isLike ? Heart : (isComment ? MessageSquare : UserPlus);
    // Use theme-consistent colors for interaction badges
    const iconColor = isLike ? '#FF1744' : (isComment ? theme.primary : '#00E676');
    const actionText = isLike ? 'liked your post' : (isComment ? 'commented on your post' : 'started following you');

    const actorAvatar = item.actor?.avatar_full_url;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={[
          styles.notificationCard,
          !item.is_read && (isDarkMode ? styles.unreadDark : styles.unreadLight)
        ]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.actorAvatarContainer}>
          <View style={[styles.actorAvatar, { backgroundColor: theme.surface }]}>
            {actorAvatar ? (
              <Image source={{ uri: actorAvatar }} style={styles.fullImg} />
            ) : (
              <View style={styles.avatarFallback} />
            )}
          </View>
          <View style={[styles.typeBadge, { backgroundColor: iconColor, borderColor: isDarkMode ? '#11131A' : '#F4F5F7' }]}>
            <Icon size={12} color="#FFF" fill={isLike ? "#FFF" : "none"} />
          </View>
        </View>

        <View style={styles.notifContent}>
          <Text style={[styles.notifText, { color: theme.text }]}>
            <Text style={styles.bold}>{item.actor?.username || 'Someone'}</Text> {actionText}
            {item.post?.title && <Text style={[styles.postTitleSmall, { color: theme.textMuted }]}>: {item.post.title}</Text>}
          </Text>
          <Text style={[styles.timeText, { color: theme.textMuted }]}>
            {timeAgo(item.created_at)}
          </Text>
        </View>

        {item.post?.image_full_url && !isFollow && (
          <Image source={{ uri: item.post.image_full_url }} style={styles.postMiniThumb} />
        )}

        <View style={[styles.unreadDot, { backgroundColor: item.is_read ? 'transparent' : theme.primary }]} />

        {isFollow && item.follow_status === 'pending' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              onPress={() => handleCancelFollow(item)}
              style={[styles.smallActionBtn, { backgroundColor: isDarkMode ? '#222' : '#F0F0F0' }]}
            >
              <Text style={[styles.actionBtnText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleAcceptFollow(item)}
              style={[styles.smallActionBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.actionBtnText, { color: '#FFF' }]}>Accept</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Activity</Text>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push('/profile')}
        >
          <View style={[styles.profileCircle, { borderColor: theme.divider, backgroundColor: theme.surface }]}>
            {currentUserAvatar ? (
              <Image source={{ uri: currentUserAvatar }} style={styles.fullImg} resizeMode="cover" />
            ) : (
              <View style={styles.avatarFallback} />
            )}
          </View>
        </TouchableOpacity>
      </View>

      {error && !loading && (
        <View style={[styles.errorBanner, { backgroundColor: isDarkMode ? 'rgba(255,0,0,0.1)' : '#FEF2F2', borderColor: theme.error }]}>
          <Text style={[styles.errorText, { color: theme.error }]}>Network Error: {error}</Text>
        </View>
      )}

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.secondary} size="large" />
        </View>
      ) : (
        <SectionList
          sections={sectionData}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: BOTTOM_NAV_PADDING }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{title}</Text>
            </View>
          )}
          renderItem={({ item }) => renderNotification({ item })}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.iconCircle, { backgroundColor: theme.surface }]}>
                <Bell size={40} color={theme.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No activity yet</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                When people interact with your writing, or you follow others, you'll see it here.
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.secondary}
            />
          }
        />
      )}
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
  title: { fontSize: 34, fontFamily: 'ClashGrotesk-Bold', letterSpacing: -0.5 },
  profileCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  fullImg: {
    width: '100%',
    height: '100%'
  },
  avatarFallback: {
    flex: 1,
    backgroundColor: '#333'
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'ClashGrotesk-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  notificationCard: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    alignItems: 'center',
  },
  unreadDark: {
    backgroundColor: 'rgba(143,154,255,0.08)'
  },
  unreadLight: {
    backgroundColor: 'rgba(94,155,255,0.05)'
  },
  actorAvatarContainer: {
    position: 'relative',
    width: 50,
    height: 50,
  },
  actorAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
  },
  typeBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
  notifContent: {
    flex: 1,
    marginLeft: 15,
    justifyContent: 'center'
  },
  notifText: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: 'ClashGrotesk-Medium'
  },
  bold: {
    fontFamily: 'ClashGrotesk-Bold'
  },
  postTitleSmall: {
    fontFamily: 'ClashGrotesk-Bold',
    opacity: 0.9
  },
  timeText: {
    fontSize: 12,
    marginTop: 3,
    fontFamily: 'ClashGrotesk-Medium',
  },
  postMiniThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginLeft: 12,
    backgroundColor: '#DDD'
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    paddingBottom: 120
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
  },
  emptyTitle: { fontSize: 22, fontFamily: 'ClashGrotesk-Bold' },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
    fontFamily: 'ClashGrotesk',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  errorBanner: {
    padding: 12,
    marginHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 15
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'ClashGrotesk-Medium',
    textAlign: 'center'
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 10,
  },
  smallActionBtn: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 12,
    fontFamily: 'ClashGrotesk-Bold',
  },
});