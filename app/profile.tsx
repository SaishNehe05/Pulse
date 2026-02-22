import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Camera, Eye, LogOut, MoreHorizontal } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert,
  Dimensions,
  Image,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Step 1: Import this
import PostMenu from '../components/PostMenu';
import { Colors } from '../constants/theme';
import { supabase } from '../supabase';
import { timeAgo } from '../utils/dateUtils';
import { useTheme } from './theme';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const { isDarkMode } = useTheme();
  const { userId } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets(); // Step 2: Initialize insets

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [activeTab, setActiveTab] = useState('Posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followStatus, setFollowStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [tabData, setTabData] = useState<any[]>([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const [activePost, setActivePost] = useState<any>(null);

  const [stats, setStats] = useState({ posts: 0, likes: 0, followers: 0 });

  useEffect(() => {
    fetchProfileAndStats();
  }, [userId]);

  useEffect(() => {
    fetchTabData();
  }, [activeTab, profile]);

  const fetchProfileAndStats = async () => {
    try {
      setLoading(true);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const targetId = userId || currentUser?.id;

      if (!targetId) return;
      const own = targetId === currentUser?.id;
      setIsOwnProfile(own);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetId)
        .single();

      if (profileData?.avatar_url) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(profileData.avatar_url);
        profileData.avatar_full_url = data.publicUrl;
      }
      setProfile(profileData);

      if (!own && currentUser) {
        const { data: followCheck } = await supabase.from('follows').select('status').eq('follower_id', currentUser.id).eq('following_id', targetId).maybeSingle();
        setIsFollowing(!!followCheck);
        setFollowStatus(followCheck?.status || null);
      }

      const [postsRes, likesRes, followsRes] = await Promise.all([
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', targetId),
        supabase.from('likes').select('*', { count: 'exact', head: true }).eq('user_id', targetId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', targetId)
      ]);

      setStats({
        posts: postsRes.count || 0,
        likes: likesRes.count || 0,
        followers: followsRes.count || 0
      });
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to log out of Pulse?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/login');
          }
        }
      ]
    );
  };

  const pickImage = async () => {
    if (!isOwnProfile) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.4,
    });
    if (!result.canceled) {
      uploadAvatar(result.assets[0].uri);
    }
  };


  const uploadAvatar = async (uri: string) => {
    try {
      setUploading(true);
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${profile.id}/${Date.now()}.${fileExt}`;

      const formData = new FormData();
      formData.append('file', {
        uri: uri,
        name: fileName,
        type: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
      } as any);

      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, formData, {
          contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: fileName })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setProfile({ ...profile, avatar_url: fileName, avatar_full_url: urlData.publicUrl });
      Alert.alert("Success", "Profile photo updated!");
    } catch (err: any) {
      Alert.alert("Upload Error", "Check your connection and Supabase settings.");
    } finally {
      setUploading(false);
    }
  };

  const toggleFollow = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return Alert.alert("Join Pulse", "Sign in to follow creators.");
    if (currentUser.id === profile?.id) return;

    const originalState = isFollowing;
    const originalStatus = followStatus;

    if (originalState) {
      // Unfollow or Cancel Request
      setIsFollowing(false);
      setFollowStatus(null);
      setStats(prev => ({ ...prev, followers: originalStatus === 'accepted' ? Math.max(0, prev.followers - 1) : prev.followers }));

      await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', profile.id);
      await supabase.from('notifications').delete().match({
        user_id: profile.id,
        actor_id: currentUser.id,
        type: 'follow'
      });
    } else {
      // Send Follow Request
      setIsFollowing(true);
      setFollowStatus('pending');
      // Followers count only increases when accepted, so we don't optimistic update stats here unless it's accepted immediately

      const { error } = await supabase.from('follows').insert([{ follower_id: currentUser.id, following_id: profile.id, status: 'pending' }]);
      if (!error) {
        const { data: existing } = await supabase.from('notifications').select('id').match({
          user_id: profile.id,
          actor_id: currentUser.id,
          type: 'follow'
        }).maybeSingle();

        if (!existing) {
          await supabase.from('notifications').insert({
            user_id: profile.id,
            actor_id: currentUser.id,
            type: 'follow',
            is_read: false
          });
        }
      } else {
        // Rollback on error
        setIsFollowing(originalState);
        setFollowStatus(originalStatus);
      }
    }
  };

  const fetchTabData = async () => {
    if (!profile) return;
    try {
      let query;
      if (activeTab === 'Posts') {
        query = supabase.from('posts').select('*').eq('user_id', profile.id).order('created_at', { ascending: false });
      } else if (activeTab === 'Likes') {
        query = supabase.from('likes').select('*, posts(*)').eq('user_id', profile.id);
      } else {
        query = supabase.from('comments').select('*, posts(title, id)').eq('user_id', profile.id).limit(10);
      }
      const { data } = await query;
      setTabData(data || []);
    } catch (err) { }
  };

  const handleMoreOptions = (item: any, event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    setMenuAnchor({ x: pageX, y: pageY });
    setActivePost(item);
    setMenuVisible(true);
  };

  const getMenuOptions = (item: any) => {
    const options: { label: string; onPress: () => void; destructive?: boolean }[] = [
      { label: "Share", onPress: () => { Share.share({ message: `Check out this post: ${item.title || item.content}` }); } }
    ];

    if (isOwnProfile && activeTab === 'Posts') {
      options.push({
        label: "Delete",
        destructive: true,
        onPress: () => { handleDeletePost(item.id, item.image_url); }
      });
    }

    return options;
  };

  const handleDeletePost = async (postId: any, imageUrl: string | null) => {
    Alert.alert(
      "Delete Post",
      "Permanently remove this post?",
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

              // 2. Cleanup storage
              if (imageUrl) {
                try {
                  const pathParts = imageUrl.split('post-images/');
                  if (pathParts.length > 1) {
                    const filePath = pathParts[1];
                    await supabase.storage.from('post-images').remove([filePath]);
                  }
                } catch (sErr) { }
              }

              setTabData(prev => prev.filter(p => p.id !== postId));
              setStats(prev => ({ ...prev, posts: Math.max(0, prev.posts - 1) }));
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          }
        }
      ]
    );
  };

  const bgColor = 'transparent';
  const textColor = isDarkMode ? Colors.dark.text : Colors.light.text;
  const subTextColor = isDarkMode ? Colors.dark.textMuted : Colors.light.textMuted;
  const borderColor = isDarkMode ? Colors.dark.divider : Colors.light.divider;
  const cardBg = isDarkMode ? Colors.dark.surface : Colors.light.surface;

  const renderTabContent = () => {
    if (tabData.length === 0) return <View style={styles.emptyState}><Text style={[styles.emptyTitle, { color: isDarkMode ? '#333' : '#CCC' }]}>Nothing here yet</Text></View>;
    return tabData.map((item, index) => (
      <View key={index} style={[styles.listCard, { borderBottomColor: isDarkMode ? '#222' : '#F9F9F9' }]}>
        <TouchableOpacity
          style={styles.cardInfo}
          onPress={() => router.push(`/article-detail?id=${item.post_id || item.id || item.posts?.id}`)}
        >
          <Text style={[styles.cardTitle, { color: textColor }]} numberOfLines={2}>{item.title || item.posts?.title || item.content}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={styles.cardDate}>{timeAgo(item.created_at)}</Text>
            {activeTab === 'Posts' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Eye size={12} color="#AAA" />
                <Text style={styles.cardDate}>{item.views_count || 0}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.cardActions}>
          <TouchableOpacity onPress={(e) => handleMoreOptions(item, e)} style={{ padding: 4 }}>
            <MoreHorizontal size={18} color={isDarkMode ? "#555" : "#AAA"} />
          </TouchableOpacity>
        </View>
      </View>
    ));
  };

  if (loading) return <View style={[styles.centered, { backgroundColor: bgColor }]}><ActivityIndicator size="large" color={isDarkMode ? Colors.dark.secondary : Colors.light.secondary} /></View>;

  return (
    // Step 3: Apply the padding directly here
    <View style={[styles.container, { backgroundColor: bgColor, paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <BlurView intensity={isDarkMode ? 20 : 40} tint={isDarkMode ? 'dark' : 'light'} style={styles.glassHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={textColor} />
          </TouchableOpacity>

          <View style={styles.modernTopRow}>
            <View style={styles.avatarModernContainer}>
              <TouchableOpacity style={styles.avatarModernWrapper} onPress={pickImage} disabled={uploading}>
                {profile?.avatar_full_url ? (
                  <Image source={{ uri: profile.avatar_full_url }} style={styles.avatarModernImage} />
                ) : (
                  <View style={[styles.avatarModernGraphic, { backgroundColor: isDarkMode ? '#222' : '#E5E5E5' }]}>
                    {isOwnProfile && <Camera size={20} color={isDarkMode ? "#555" : "#999"} />}
                  </View>
                )}
                {uploading && <View style={styles.loader}><ActivityIndicator color="#FFF" /></View>}
              </TouchableOpacity>
              <View style={styles.avatarGlow} />
            </View>

            <View style={styles.infoModernColumn}>
              <Text style={[styles.usernameModern, { color: textColor }]}>{profile?.username || 'USER'}</Text>
              <View style={styles.bentoStatsGrid}>
                <TouchableOpacity
                  style={[styles.bentoStatCard, { backgroundColor: cardBg }]}
                  onPress={() => router.push({ pathname: '/followers-list', params: { userId: profile?.id, type: 'followers' } })}
                >
                  <Text style={[styles.bentoStatNum, { color: textColor }]}>{stats.followers}</Text>
                  <Text style={[styles.bentoStatLabel, { color: subTextColor }]}>FOLLOWERS</Text>
                </TouchableOpacity>
                <View style={[styles.bentoStatCard, { backgroundColor: cardBg }]}>
                  <Text style={[styles.bentoStatNum, { color: textColor }]}>{stats.posts}</Text>
                  <Text style={[styles.bentoStatLabel, { color: subTextColor }]}>POSTS</Text>
                </View>
                <View style={[styles.bentoStatCard, { backgroundColor: cardBg }]}>
                  <Text style={[styles.bentoStatNum, { color: textColor }]}>{stats.likes}</Text>
                  <Text style={[styles.bentoStatLabel, { color: subTextColor }]}>LIKES</Text>
                </View>
              </View>
            </View>
          </View>

          {profile?.bio && (
            <View style={styles.modernBioContainer}>
              <Text style={[styles.modernBioText, { color: subTextColor }]}>{profile.bio}</Text>
            </View>
          )}
        </BlurView>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => Share.share({ message: `Pulse Profile: ${profile?.username}` })}
          >
            <BlurView intensity={30} tint={isDarkMode ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, { borderRadius: 14 }]} />
            <Text style={styles.shareBtnText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.premiumEditBtn}
            onPress={isOwnProfile ? () => router.push('/settings') : toggleFollow}
          >
            <LinearGradient
              colors={isDarkMode ? ['#8F9AFF', '#FFB1EE'] : ['#5E9BFF', '#FF8E59']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientBtnBg}
            >
              <Text style={styles.premiumEditBtnText}>
                {isOwnProfile ? 'Settings' : (isFollowing ? (followStatus === 'pending' ? 'Requested' : 'Following') : 'Follow')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={[styles.tabContainer, { borderBottomColor: borderColor }]}>
          {['Activity', 'Posts', 'Likes'].map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tabItem, activeTab === tab && styles.activeTabItem]}
            >
              <Text style={[styles.tabText, activeTab === tab && { color: textColor }]}>{tab}</Text>
              {activeTab === tab && (
                <LinearGradient
                  colors={isDarkMode ? ['#8F9AFF', '#FFB1EE'] : ['#5E9BFF', '#FF8E59']}
                  style={styles.activeTabUnderline}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.contentArea}>
          {renderTabContent()}

          {isOwnProfile && (
            <TouchableOpacity
              style={[styles.logoutButton, { borderTopColor: borderColor }]}
              onPress={handleSignOut}
            >
              <LogOut size={18} color="#FF3B30" />
              <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <PostMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        anchor={menuAnchor}
        options={activePost ? getMenuOptions(activePost) : []}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  glassHeader: {
    margin: 15,
    padding: 20,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
    marginLeft: -5,
  },
  modernTopRow: { flexDirection: 'row', alignItems: 'center' },
  avatarModernContainer: { position: 'relative' },
  avatarModernWrapper: {
    width: 90,
    height: 90,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    zIndex: 1,
  },
  avatarModernImage: { width: 90, height: 90 },
  avatarModernGraphic: { width: 90, height: 90, justifyContent: 'center', alignItems: 'center' },
  avatarGlow: {
    position: 'absolute',
    top: -5,
    bottom: -5,
    left: -5,
    right: -5,
    borderRadius: 35,
    backgroundColor: '#8F9AFF',
    opacity: 0.2,
    zIndex: 0,
  },
  infoModernColumn: { marginLeft: 20, flex: 1 },
  usernameModern: { fontSize: 28, fontFamily: 'ClashGrotesk-Bold', marginBottom: 12 },
  bentoStatsGrid: { flexDirection: 'row', gap: 8 },
  bentoStatCard: {
    flex: 1,
    padding: 8,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  bentoStatNum: { fontSize: 14, fontFamily: 'ClashGrotesk-Bold' },
  bentoStatLabel: { fontSize: 8, fontFamily: 'ClashGrotesk-Medium', opacity: 0.6, marginTop: 2 },
  modernBioContainer: { marginTop: 20, paddingHorizontal: 5 },
  modernBioText: { fontSize: 14, fontFamily: 'ClashGrotesk', lineHeight: 22, opacity: 0.9 },
  actionRow: { flexDirection: 'row', paddingHorizontal: 15, gap: 10, marginBottom: 25 },
  shareBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  shareBtnText: { color: Colors.light.primary, fontSize: 14, fontFamily: 'ClashGrotesk-Bold', zIndex: 1 },
  premiumEditBtn: {
    flex: 2,
    height: 48,
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradientBtnBg: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumEditBtnText: { color: '#1C1917', fontSize: 14, fontFamily: 'ClashGrotesk-Bold' },
  tabContainer: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 15, marginBottom: 5 },
  tabItem: { paddingVertical: 14, paddingHorizontal: 15, marginRight: 10, alignItems: 'center' },
  activeTabItem: {},
  activeTabUnderline: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  tabText: { color: '#999', fontSize: 14, fontFamily: 'ClashGrotesk-Bold' },
  contentArea: { paddingHorizontal: 15, paddingBottom: 50 },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyTitle: { fontSize: 16, marginTop: 10, fontFamily: 'ClashGrotesk-Bold' },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, marginBottom: 6, fontFamily: 'ClashGrotesk-Bold', lineHeight: 22 },
  cardDate: { fontSize: 12, color: '#999', fontFamily: 'ClashGrotesk' },
  cardActions: { flexDirection: 'row', alignItems: 'center' },
  loader: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    paddingVertical: 15,
    borderTopWidth: 1,
  },
  logoutText: {
    color: '#FF3B30',
    fontWeight: '700',
    fontSize: 16,
    marginLeft: 10
  }
});