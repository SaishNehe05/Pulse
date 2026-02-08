import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, LogOut, MoreHorizontal } from 'lucide-react-native';
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
        const { data: followCheck } = await supabase.from('follows').select('*').eq('follower_id', currentUser.id).eq('following_id', targetId).maybeSingle();
        setIsFollowing(!!followCheck);
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

  const handleDeletePost = async (postId: number, imageUrl: string | null) => {
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
          <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </TouchableOpacity>

        <View style={styles.cardActions}>
          <TouchableOpacity onPress={(e) => handleMoreOptions(item, e)} style={{ padding: 4 }}>
            <MoreHorizontal size={18} color={isDarkMode ? "#555" : "#AAA"} />
          </TouchableOpacity>
        </View>
      </View>
    ));
  };

  if (loading) return <View style={[styles.centered, { backgroundColor: bgColor }]}><ActivityIndicator size="large" color={Colors.light.primary} /></View>;

  return (
    // Step 3: Apply the padding directly here
    <View style={[styles.container, { backgroundColor: bgColor, paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.topSection}>
          <View style={styles.infoLeft}>
            <Text style={[styles.usernameTextMain, { color: textColor }]}>{profile?.username || 'USER'}</Text>
            <Text style={[styles.subscribersText, { color: subTextColor }]}>{stats.followers} Subscribers</Text>
          </View>

          <TouchableOpacity style={styles.avatarContainer} onPress={pickImage} disabled={uploading}>
            {profile?.avatar_full_url ? (
              <Image source={{ uri: profile.avatar_full_url }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarGraphic, { backgroundColor: isDarkMode ? '#333' : '#1A1A1A' }]}>
                {isOwnProfile && <Camera size={20} color="#FFF" style={{ opacity: 0.6 }} />}
              </View>
            )}
            {uploading && <View style={styles.loader}><ActivityIndicator color="#FFF" /></View>}
          </TouchableOpacity>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.shareBtn} onPress={() => Share.share({ message: `Pulse Profile: ${profile?.username}` })}>
            <Text style={styles.shareBtnText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.editBtn, { backgroundColor: cardBg }]}
            onPress={isOwnProfile ? () => router.push('/settings') : undefined}
          >
            <Text style={[styles.editBtnText, { color: textColor }]}>{isOwnProfile ? 'Settings' : 'Follow'}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.tabContainer, { borderBottomColor: borderColor }]}>
          {['Activity', 'Posts', 'Likes'].map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tabItem, activeTab === tab && [styles.activeTabItem, { borderBottomColor: textColor }]]}
            >
              <Text style={[styles.tabText, activeTab === tab && { color: textColor }]}>{tab}</Text>
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
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topSection: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, marginBottom: 25 },
  infoLeft: { flex: 1, justifyContent: 'center' },
  usernameTextMain: { fontSize: 32, fontFamily: 'ClashGrotesk-Bold' },
  subscribersText: { fontSize: 16, marginTop: 10, fontFamily: 'ClashGrotesk-Medium' },
  avatarContainer: { width: 90, height: 90, justifyContent: 'center', alignItems: 'center' },
  avatarGraphic: { width: 85, height: 85, borderRadius: 42.5, borderWidth: 4, borderColor: Colors.light.primary, borderBottomWidth: 10, borderRightWidth: 10, justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: 85, height: 85, borderRadius: 42.5, borderWidth: 2, borderColor: Colors.light.primary },
  loader: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 42.5, justifyContent: 'center', alignItems: 'center' },
  actionRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 20 },
  shareBtn: { flex: 1, backgroundColor: Colors.light.primary, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  shareBtnText: { color: '#1C1917', fontSize: 15, fontFamily: 'ClashGrotesk-Bold' },
  editBtn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  editBtnText: { fontSize: 15, fontFamily: 'ClashGrotesk-Bold' },
  tabContainer: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 10 },
  tabItem: { paddingVertical: 14, paddingHorizontal: 15 },
  activeTabItem: { borderBottomWidth: 2 },
  tabText: { color: '#AAA', fontSize: 14, fontFamily: 'ClashGrotesk-Bold' },
  contentArea: { paddingHorizontal: 20, paddingBottom: 50 },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyTitle: { fontSize: 16, marginTop: 10, fontFamily: 'ClashGrotesk-Bold' },
  listCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18, borderBottomWidth: 1 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, marginBottom: 4, fontFamily: 'ClashGrotesk-Bold' },
  cardDate: { fontSize: 12, color: '#AAA', fontFamily: 'ClashGrotesk' },
  cardActions: { flexDirection: 'row', alignItems: 'center' },
  deleteRowBtn: { marginRight: 15 },
  deleteRowText: { color: '#FF3B30', fontWeight: '600', fontSize: 13 },
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