import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, User } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { supabase } from '../supabase';
import { useTheme } from './theme';

export default function FollowersListScreen() {
    const { isDarkMode } = useTheme();
    const { userId, type } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const theme = isDarkMode ? Colors.dark : Colors.light;
    const isFollowers = type === 'followers';

    useEffect(() => {
        fetchUsers();
    }, [userId, type]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const targetId = userId;
            if (!targetId) return;

            let query;
            if (isFollowers) {
                // People following the target user
                query = supabase
                    .from('follows')
                    .select(`
            follower:profiles!follower_id (
              id,
              username,
              avatar_url
            )
          `)
                    .eq('following_id', targetId)
                    .eq('status', 'accepted');
            } else {
                // People the target user is following
                query = supabase
                    .from('follows')
                    .select(`
            following:profiles!following_id (
              id,
              username,
              avatar_url
            )
          `)
                    .eq('follower_id', targetId)
                    .eq('status', 'accepted');
            }

            const { data, error } = await query;
            if (error) throw error;

            const formattedUsers = (data || []).map((item: any) => {
                const profile = isFollowers ? item.follower : item.following;
                if (profile.avatar_url) {
                    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(profile.avatar_url);
                    profile.avatar_full_url = urlData.publicUrl;
                }
                return profile;
            });

            setUsers(formattedUsers);
        } catch (err: any) {
            console.error("Error fetching users:", err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchUsers();
    };

    const renderUser = ({ item }: { item: any }) => (
        <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.userCard, { backgroundColor: theme.surface, borderColor: theme.divider }]}
            onPress={() => router.push({ pathname: '/profile', params: { userId: item.id } })}
        >
            <View style={[styles.avatarContainer, { borderColor: theme.divider }]}>
                {item.avatar_full_url ? (
                    <Image source={{ uri: item.avatar_full_url }} style={styles.image} />
                ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: isDarkMode ? '#222' : '#F0F0F0' }]}>
                        <User size={20} color={theme.textMuted} />
                    </View>
                )}
            </View>
            <View style={styles.userInfo}>
                <Text style={[styles.username, { color: theme.text }]}>{item.username || 'User'}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { backgroundColor: 'transparent', paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>
                    {isFollowers ? 'Followers' : 'Following'}
                </Text>
            </View>

            {loading && !refreshing ? (
                <View style={styles.center}>
                    <ActivityIndicator color={theme.secondary} size="large" />
                </View>
            ) : (
                <FlatList
                    data={users}
                    keyExtractor={(item) => item.id}
                    renderItem={renderUser}
                    contentContainerStyle={styles.listContainer}
                    onRefresh={onRefresh}
                    refreshing={refreshing}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <View style={[styles.iconCircle, { backgroundColor: theme.surface }]}>
                                <User size={40} color={theme.textMuted} />
                            </View>
                            <Text style={[styles.emptyTitle, { color: theme.text }]}>No users found</Text>
                            <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                                {isFollowers ? "This user doesn't have any followers yet." : "This user isn't following anyone yet."}
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 10,
        marginBottom: 10,
    },
    headerTitle: {
        fontSize: 24,
        fontFamily: 'ClashGrotesk-Bold',
        flex: 1,
        textAlign: 'center',
        marginRight: 40, // Offset the back button space to center the title
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContainer: {
        padding: 20,
        paddingBottom: 40,
    },
    userCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
    },
    avatarContainer: {
        width: 48,
        height: 48,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        marginRight: 15,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    avatarFallback: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    userInfo: {
        flex: 1,
    },
    username: {
        fontSize: 16,
        fontFamily: 'ClashGrotesk-Bold',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        marginTop: 100,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 20,
        fontFamily: 'ClashGrotesk-Bold',
        marginBottom: 10,
    },
    emptySubtitle: {
        fontSize: 14,
        fontFamily: 'ClashGrotesk',
        textAlign: 'center',
        opacity: 0.7,
    },
});
