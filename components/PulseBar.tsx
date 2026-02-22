import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../app/theme';
import { Colors } from '../constants/theme';
import { supabase } from '../supabase';

export default function PulseBar() {
    const { isDarkMode } = useTheme();
    const router = useRouter();
    const [pulses, setPulses] = useState<any[]>([]);
    const [myPulse, setMyPulse] = useState<any>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userHasPulse, setUserHasPulse] = useState(false);
    const [seenStatuses, setSeenStatuses] = useState<{ [key: string]: boolean }>({});

    useFocusEffect(
        useCallback(() => {
            fetchPulses();
        }, [])
    );

    const checkSeenStatus = async (userPulseList: any[]) => {
        try {
            const statuses: { [key: string]: boolean } = {};
            for (const p of userPulseList) {
                const key = `pulse_seen_${p.user_id}`;
                const seenAt = await AsyncStorage.getItem(key);

                // Be more robust: compare timestamps if they exist
                if (seenAt && p.latest_pulse) {
                    const seenTime = new Date(seenAt).getTime();
                    const pulseTime = new Date(p.latest_pulse).getTime();
                    statuses[p.user_id] = seenTime >= pulseTime;
                } else {
                    statuses[p.user_id] = false;
                }
            }
            setSeenStatuses(statuses);
        } catch (e) {
            console.error('Error checking seen status:', e);
        }
    };

    const fetchPulses = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setCurrentUser(user);

            // 1. Get people I follow
            const { data: following } = await supabase
                .from('follows')
                .select('following_id')
                .eq('follower_id', user.id);

            const followingIds = following?.map(f => f.following_id) || [];
            followingIds.push(user.id);

            // 2. Get active pulses with media preview
            const { data } = await supabase
                .from('pulses')
                .select(`
                    user_id,
                    created_at,
                    expires_at,
                    media_url,
                    profiles:user_id (username, avatar_url)
                `)
                .in('user_id', followingIds)
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false });

            if (data) {
                // Group by user, keeping only the LATEST pulse for the preview
                const grouped = data.reduce((acc: any, curr: any) => {
                    if (!acc[curr.user_id]) {
                        acc[curr.user_id] = {
                            user_id: curr.user_id,
                            username: curr.profiles?.username,
                            avatar_url: curr.profiles?.avatar_url,
                            latest_pulse: curr.created_at,
                            media_url: curr.media_url, // Keep fetching media for preview
                            count: 0
                        };
                    }
                    acc[curr.user_id].count++;
                    return acc;
                }, {});

                const pulseList = Object.values(grouped);

                const ownPulse = pulseList.find((p: any) => p.user_id === user.id);
                setMyPulse(ownPulse);
                setUserHasPulse(!!ownPulse);

                const others = pulseList.filter((p: any) => p.user_id !== user.id);
                setPulses(others);

                // Check seen status
                await checkSeenStatus(pulseList);
            }
        } catch (err) {
            console.log('Error fetching pulses:', err);
        }
    };

    const getPublicUrl = (bucket: string, path: string | null) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
    };

    const handleAddPulse = () => {
        router.push('/create-pulse');
    };

    const handleViewPulse = (userId: string) => {
        router.push({ pathname: '/view-pulse', params: { userId } });
    };

    return (
        <View style={styles.container}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* PERMANENT ADD PULSE CARD */}
                <LinearGradient
                    colors={isDarkMode ? [Colors.dark.primary, Colors.dark.secondary] : [Colors.light.primary, Colors.light.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardBorder}
                >
                    <TouchableOpacity
                        style={[styles.card, { backgroundColor: isDarkMode ? '#1A1A1A' : '#F2F4F6' }]}
                        onPress={handleAddPulse}
                    >
                        <LinearGradient
                            colors={isDarkMode ? [Colors.dark.primary, Colors.dark.secondary] : [Colors.light.primary, Colors.light.secondary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.createPlaceholder}
                        >
                            <Plus size={24} color="#FFF" />
                        </LinearGradient>
                        <View style={styles.cardContent}>
                            <Text style={styles.createLabel}>New</Text>
                            <Text style={styles.cardUsername} numberOfLines={1}>Pulse</Text>
                        </View>
                    </TouchableOpacity>
                </LinearGradient>

                {/* MY PULSE CARD (Only if exists) */}
                {userHasPulse && (
                    <LinearGradient
                        colors={isDarkMode ? [Colors.dark.primary, Colors.dark.secondary] : [Colors.light.primary, Colors.light.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.cardBorder}
                    >
                        <TouchableOpacity
                            style={[styles.card, { backgroundColor: isDarkMode ? '#1A1A1A' : '#F2F4F6' }]}
                            onPress={() => handleViewPulse(currentUser?.id)}
                        >
                            <Image
                                source={{ uri: getPublicUrl('pulses', myPulse?.media_url) || undefined }}
                                style={styles.cardBg}
                                resizeMode="cover"
                            />

                            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.cardOverlay} />

                            {!seenStatuses[currentUser?.id] && (
                                <View style={styles.indicatorRing}>
                                    <LinearGradient colors={isDarkMode ? [Colors.dark.secondary, Colors.dark.primary] : [Colors.light.secondary, Colors.light.primary]} style={styles.indicatorInner} />
                                </View>
                            )}

                            <View style={styles.cardContent}>
                                <Text style={styles.cardUsername} numberOfLines={1}>You</Text>
                            </View>

                            {/* Avatar Badge */}
                            {currentUser?.user_metadata?.avatar_url && (
                                <View style={styles.miniAvatarContainer}>
                                    <Image source={{ uri: currentUser.user_metadata.avatar_url }} style={styles.miniAvatar} />
                                </View>
                            )}
                        </TouchableOpacity>
                    </LinearGradient>
                )}

                {/* OTHER USERS CARDS */}
                {pulses.map((pulse: any) => (
                    <LinearGradient
                        key={pulse.user_id}
                        colors={isDarkMode ? [Colors.dark.primary, Colors.dark.secondary] : [Colors.light.primary, Colors.light.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.cardBorder}
                    >
                        <TouchableOpacity style={[styles.card, { backgroundColor: isDarkMode ? '#1A1A1A' : '#F2F4F6' }]} onPress={() => handleViewPulse(pulse.user_id)}>
                            {/* Media Preview Background */}
                            <Image
                                source={{ uri: getPublicUrl('pulses', pulse.media_url) || undefined }}
                                style={styles.cardBg}
                                resizeMode="cover"
                            />

                            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.cardOverlay} />

                            {!seenStatuses[pulse.user_id] && (
                                <View style={styles.indicatorRing}>
                                    <LinearGradient colors={isDarkMode ? [Colors.dark.secondary, Colors.dark.primary] : [Colors.light.secondary, Colors.light.primary]} style={styles.indicatorInner} />
                                </View>
                            )}

                            <View style={styles.cardContent}>
                                <Text style={styles.cardUsername} numberOfLines={1}>{pulse.username}</Text>
                            </View>

                            <View style={styles.miniAvatarContainer}>
                                <Image source={{ uri: getPublicUrl('avatars', pulse.avatar_url) || undefined }} style={styles.miniAvatar} />
                            </View>
                        </TouchableOpacity>
                    </LinearGradient>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 10,
        marginBottom: 0,
    },
    headerTitle: {
        paddingHorizontal: 16,
        marginBottom: 10,
        fontSize: 18,
        fontFamily: 'ClashGrotesk-Bold'
    },
    scrollContent: {
        paddingHorizontal: 16,
        gap: 12,
    },
    cardBorder: {
        width: 104,
        height: 154,
        padding: 2,
        borderRadius: 18,
    },
    card: {
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
    },
    cardBg: {
        width: '100%',
        height: '100%',
    },
    createPlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center'
    },
    cardOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '50%'
    },
    cardContent: {
        position: 'absolute',
        bottom: 10,
        left: 8,
        right: 8
    },
    createLabel: {
        color: '#FFF',
        fontSize: 12,
        fontFamily: 'ClashGrotesk-Bold',
        marginBottom: 2
    },
    cardUsername: {
        color: '#FFF',
        fontSize: 11,
        fontFamily: 'ClashGrotesk-Medium',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2
    },
    miniAvatarContainer: {
        position: 'absolute',
        top: 8,
        left: 8,
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 2,
        borderColor: '#FFF', // or theme background
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#DDD'
    },
    miniAvatar: {
        width: 30,
        height: 30,
        borderRadius: 15
    },
    indicatorRing: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 1
    },
    indicatorInner: {
        width: 8,
        height: 8,
        borderRadius: 4
    }
});
