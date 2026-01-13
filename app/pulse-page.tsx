import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Search, MoreVertical, User, Bell } from 'lucide-react-native';
import { supabase } from '../supabase';
import { useRouter, useFocusEffect } from 'expo-router';

export default function PulseLandingPage() {
  const router = useRouter();
  
  // States
  const [activeTab, setActiveTab] = useState('Posts');
  const [posts, setPosts] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const tabs = ['Posts', 'Notes', 'Chat', 'About'];

  const fetchPulseData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/auth');
        return;
      }

      // 1. Fetch Profile Info
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setProfile(profileData);

      // 2. Fetch User's Real Posts
      const { data: postsData, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 3. Process Images
      const processedPosts = postsData.map(post => {
        let finalUrl = post.image_url;
        if (post.image_url && !post.image_url.startsWith('http')) {
          const { data } = supabase.storage.from('post-images').getPublicUrl(post.image_url);
          finalUrl = data.publicUrl;
        }
        return { ...post, finalUrl };
      });

      setPosts(processedPosts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchPulseData(); }, []));

  // Button Handlers
  const handleSubscribe = () => {
    Alert.alert("Subscription", "You are viewing your own Pulse. Subscribers will see this button on your public profile.");
  };

  const handleMoreOptions = () => {
    Alert.alert("Options", "What would you like to do?", [
      { text: "Edit Profile", onPress: () => router.push('/edit-profile') },
      { text: "Share Pulse", onPress: () => console.log("Share logic here") },
      { text: "Cancel", style: "cancel" }
    ]);
  };

  // Filter content based on active tab
  const filteredContent = activeTab === 'Posts' 
    ? posts.filter(p => p.title !== p.content.substring(0, 50)) // Simplified logic for Articles vs Notes
    : posts;

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}><ActivityIndicator color="#FF6719" /></View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* TOOLBAR */}
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <View style={styles.toolbarRight}>
          <TouchableOpacity style={{ marginRight: 20 }} onPress={() => router.push('/search')}>
            <Search size={24} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleMoreOptions}>
            <MoreVertical size={24} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPulseData(); }} tintColor="#FF6719" />}
      >
        {/* PROFILE HEADER */}
        <View style={styles.headerSection}>
          <TouchableOpacity style={styles.mainIllustration} onPress={() => router.push('/edit-profile')}>
             <User size={60} color="#FF6719" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.subscribeBtn} onPress={handleSubscribe}>
            <Text style={styles.subscribeText}>Subscribe</Text>
          </TouchableOpacity>
          
          <Text style={styles.brandTitle}>{profile?.username || 'User'}</Text>
          <Text style={styles.brandSubtitle}>
            {profile?.bio || "Sharing my thoughts and stories on Pulse."}
          </Text>
        </View>

        {/* TAB BAR */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={{ paddingHorizontal: 20 }}>
          {tabs.map((tab) => (
            <TouchableOpacity 
              key={tab} 
              onPress={() => setActiveTab(tab)} 
              style={[styles.tabItem, activeTab === tab && styles.activeTabItem]}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* CONTENT AREA */}
        <View style={styles.postsContainer}>
          {activeTab === 'About' ? (
            <View style={styles.aboutBox}>
              <Text style={styles.aboutTitle}>About {profile?.username}</Text>
              <Text style={styles.aboutText}>{profile?.bio || "No bio description provided."}</Text>
              <Text style={styles.memberSince}>Member since {new Date(profile?.created_at).getFullYear()}</Text>
            </View>
          ) : activeTab === 'Chat' ? (
            <View style={styles.centered}><Text style={styles.emptyText}>Community chat coming soon!</Text></View>
          ) : (
            posts.length === 0 ? (
              <Text style={styles.emptyText}>No {activeTab.toLowerCase()} yet.</Text>
            ) : (
              posts.map((item) => (
                <TouchableOpacity 
                  key={item.id} 
                  style={styles.postCard}
                  onPress={() => router.push({ pathname: '/article-detail', params: { id: item.id } })}
                >
                  <View style={styles.postHeader}>
                    <View style={styles.authorRow}>
                      <View style={styles.miniAvatar} />
                      <Text style={styles.authorName}>{profile?.username?.toUpperCase() || 'YOU'}</Text>
                    </View>
                    <Text style={styles.dateText}>
                      {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>

                  <View style={styles.postBody}>
                    <View style={styles.postTextContent}>
                      <Text style={styles.postTitle}>{item.title}</Text>
                      <Text style={styles.postSubtitle} numberOfLines={2}>{item.content}</Text>
                      <Text style={styles.readStatus}>
                        {Math.ceil(item.content.length / 200)} MIN READ
                      </Text>
                    </View>
                    {item.finalUrl && (
                      <Image source={{ uri: item.finalUrl }} style={styles.postThumb} />
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { padding: 40, justifyContent: 'center', alignItems: 'center' },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, height: 50, alignItems: 'center' },
  toolbarRight: { flexDirection: 'row' },
  headerSection: { alignItems: 'center', paddingHorizontal: 40, marginTop: 20 },
  mainIllustration: { width: 100, height: 100, borderRadius: 50, marginBottom: 20, backgroundColor: '#FFF0E8', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FF6719' },
  subscribeBtn: { backgroundColor: '#000', paddingHorizontal: 35, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#FF6719' },
  subscribeText: { color: '#FF6719', fontWeight: '700', fontSize: 14 },
  brandTitle: { fontSize: 26, fontWeight: '900', marginTop: 20, color: '#000' },
  brandSubtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginTop: 8, lineHeight: 22 },
  tabScroll: { marginTop: 30, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 10 },
  tabItem: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginRight: 10, backgroundColor: '#f5f5f5' },
  activeTabItem: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#000' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#666' },
  activeTabText: { color: '#000' },
  postsContainer: { paddingHorizontal: 20, marginTop: 20 },
  postCard: { marginBottom: 30, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 20 },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  authorRow: { flexDirection: 'row', alignItems: 'center' },
  miniAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FF6719', marginRight: 8 },
  authorName: { fontSize: 11, fontWeight: '700', color: '#666', letterSpacing: 1 },
  dateText: { fontSize: 11, color: '#999', fontWeight: '600' },
  postBody: { flexDirection: 'row', justifyContent: 'space-between' },
  postTextContent: { flex: 1, paddingRight: 15 },
  postTitle: { fontSize: 18, fontWeight: '800', color: '#000', lineHeight: 22 },
  postSubtitle: { fontSize: 14, color: '#666', marginTop: 6, lineHeight: 18 },
  readStatus: { fontSize: 12, color: '#28a745', fontWeight: '700', marginTop: 10 },
  postThumb: { width: 80, height: 80, borderRadius: 8 },
  emptyText: { textAlign: 'center', color: '#999', fontSize: 15 },
  aboutBox: { padding: 10 },
  aboutTitle: { fontSize: 20, fontWeight: '800', marginBottom: 10 },
  aboutText: { fontSize: 16, lineHeight: 24, color: '#444' },
  memberSince: { marginTop: 20, color: '#999', fontSize: 13 }
});