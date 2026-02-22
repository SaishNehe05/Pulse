import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Trash2, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Platform,
    Pressable,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width, height } = Dimensions.get('window');

export default function ViewPulse() {
    const router = useRouter();
    const { userId } = useLocalSearchParams();
    const insets = useSafeAreaInsets();

    const [pulses, setPulses] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        getCurrentUser();
    }, []);

    const getCurrentUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            setCurrentUser(session.user);
        }
    };

    useEffect(() => {
        if (userId) {
            fetchUserPulses(userId as string);
        }
    }, [userId]);

    const fetchUserPulses = async (uid: string) => {
        try {
            // 1. Get User Profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', uid)
                .single();

            setUser(profile);

            // 2. Get Active Pulses
            const { data } = await supabase
                .from('pulses')
                .select('*')
                .eq('user_id', uid)
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: true }); // Oldest first (chronological)

            if (data && data.length > 0) {
                setPulses(data);
            } else {
                router.back(); // No pulses, go back
            }
        } catch (err) {
            console.log(err);
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const handleNext = () => {
        if (currentIndex < pulses.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            router.back(); // Finished all pulses
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    useEffect(() => {
        if (userId && pulses.length > 0) {
            markAsSeen(userId as string, pulses[pulses.length - 1].created_at);
        }
    }, [currentIndex, pulses, userId]);

    const markAsSeen = async (uid: string, timestamp: string) => {
        try {
            const key = `pulse_seen_${uid}`;
            await AsyncStorage.setItem(key, timestamp);
        } catch (e) {
            console.error('Error saving seen state:', e);
        }
    };

    const handleDelete = async () => {
        const pulse = pulses[currentIndex];
        if (!pulse) return;

        Alert.alert(
            "Delete Pulse",
            "Are you sure you want to delete this pulse?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setLoading(true);
                            // 1. Delete from database
                            const { error: dbError } = await supabase
                                .from('pulses')
                                .delete()
                                .eq('id', pulse.id);

                            if (dbError) throw dbError;

                            // 2. Delete from storage
                            if (pulse.media_url) {
                                await supabase.storage.from('pulses').remove([pulse.media_url]);
                            }

                            // 3. Update local state
                            const updatedPulses = pulses.filter(p => p.id !== pulse.id);
                            if (updatedPulses.length === 0) {
                                router.back();
                            } else {
                                setPulses(updatedPulses);
                                if (currentIndex >= updatedPulses.length) {
                                    setCurrentIndex(updatedPulses.length - 1);
                                }
                            }
                        } catch (err: any) {
                            Alert.alert("Error", err.message);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };



    const getPublicUrl = (bucket: string, path: string | null) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator color="#FFF" size="large" />
            </View>
        );
    }

    const currentPulse = pulses[currentIndex];

    return (
        <View style={styles.container}>
            <StatusBar hidden />

            {/* Background Image (Blurred) */}
            {currentPulse && (
                <Image
                    source={{ uri: getPublicUrl('pulses', currentPulse.media_url) || undefined }}
                    style={[styles.media, { opacity: 0.6 }]}
                    resizeMode="cover"
                    blurRadius={Platform.OS === 'ios' ? 30 : 15}
                />
            )}

            {/* Main Pulse Image */}
            {currentPulse && (
                <Image
                    source={{ uri: getPublicUrl('pulses', currentPulse.media_url) || undefined }}
                    style={styles.media}
                    resizeMode="contain"
                />
            )}

            <LinearGradient
                colors={['rgba(0,0,0,0.6)', 'transparent', 'transparent', 'rgba(0,0,0,0.8)']}
                style={styles.overlay}
            />

            {/* Progress Bar */}
            <View style={[styles.progressContainer, { top: insets.top + 10 }]}>
                {pulses.map((_, index) => (
                    <View key={index} style={styles.progressBarBg}>
                        <View
                            style={[
                                styles.progressBarFill,
                                index < currentIndex ? styles.filled : (index === currentIndex ? styles.current : styles.empty)
                            ]}
                        />
                    </View>
                ))}
            </View>

            {/* Header */}
            <View style={[styles.header, { top: insets.top + 25 }]}>
                <View style={styles.userInfo}>
                    {user?.avatar_url ? (
                        <Image source={{ uri: getPublicUrl('avatars', user.avatar_url) || undefined }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder} />
                    )}
                    <Text style={styles.username}>{user?.username || 'User'}</Text>
                    <Text style={styles.time}>{currentPulse ? new Date(currentPulse.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
                </View>

                <View style={styles.headerRight}>
                    {currentUser?.id === userId && (
                        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
                            <Trash2 color="#FF4C4C" size={24} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
                        <X color="#FFF" size={28} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Navigation Touch Areas */}
            <View style={styles.touchLayer}>
                <Pressable style={styles.leftTouch} onPress={handlePrev} />
                <Pressable style={styles.rightTouch} onPress={handleNext} />
            </View>

            {/* Caption footer */}
            {currentPulse?.caption && (
                <View style={[styles.footer, { paddingBottom: insets.bottom + 100 }]}>
                    <Text style={styles.caption}>{currentPulse.caption}</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    loadingContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
    media: { width, height, position: 'absolute' },
    overlay: { ...StyleSheet.absoluteFillObject },

    progressContainer: {
        position: 'absolute',
        left: 10,
        right: 10,
        flexDirection: 'row',
        gap: 4,
        height: 3,
    },
    progressBarBg: {
        flex: 1,
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 2
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 2
    },
    filled: { backgroundColor: '#FFF', width: '100%' },
    current: { backgroundColor: '#FFF', width: '100%' }, // In a real app w/ animation this would be dynamic
    empty: { width: 0 },

    header: {
        position: 'absolute',
        left: 15,
        right: 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 20
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#FFF' },
    avatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#555', borderWidth: 1, borderColor: '#FFF' },
    username: { color: '#FFF', fontSize: 15, fontFamily: 'ClashGrotesk-Bold' },
    time: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: 'ClashGrotesk' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    deleteBtn: { padding: 4 },
    closeBtn: { padding: 4 },

    touchLayer: {
        flexDirection: 'row',
        flex: 1,
        zIndex: 10
    },
    leftTouch: { flex: 1 },
    rightTouch: { flex: 2 }, // Larger area for next

    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        paddingTop: 20,
        zIndex: 15
    },
    caption: {
        color: '#FFF',
        fontSize: 16,
        fontFamily: 'ClashGrotesk-Medium',
        textAlign: 'center'
    }
});
