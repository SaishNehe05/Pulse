import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming
} from 'react-native-reanimated';
import { useTheme } from '../app/theme';
import { Colors } from '../constants/theme';

const { width, height } = Dimensions.get('window');

interface ThemedBackgroundProps {
    children?: React.ReactNode;
    style?: ViewStyle;
}

const Blob = ({ color, style, delay = 0 }: { color: string[], style: any, delay?: number }) => {
    const scale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);

    useEffect(() => {
        const duration = 8000;

        scale.value = withRepeat(
            withTiming(1.2, { duration: duration, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );

        translateX.value = withRepeat(
            withTiming(30, { duration: duration * 1.5, easing: Easing.inOut(Easing.quad) }),
            -1,
            true
        );

        translateY.value = withRepeat(
            withTiming(30, { duration: duration * 1.2, easing: Easing.inOut(Easing.quad) }),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
            { translateX: translateX.value },
            { translateY: translateY.value }
        ]
    }));

    return (
        <Animated.View style={[styles.glowContainer, style, animatedStyle]}>
            <LinearGradient
                colors={color as any}
                style={styles.radialGradient}
                start={{ x: 0.5, y: 0.5 }}
                end={{ x: 1, y: 1 }}
            />
        </Animated.View>
    );
};

export function ThemedBackground({ children, style }: ThemedBackgroundProps) {
    const { isDarkMode } = useTheme();

    // Theme colors
    const bgColor = isDarkMode ? Colors.dark.background : Colors.light.background;

    // Glow configurations
    const lightGlows = (
        <>
            <Blob
                color={['rgba(94,155,255,0.25)', 'transparent']}
                style={{ top: -100, right: -100 }}
            />
            <Blob
                color={['rgba(255,177,238,0.22)', 'transparent']}
                style={{ bottom: -100, left: -100 }}
                delay={2000}
            />
        </>
    );

    const darkGlows = (
        <>
            <Blob
                color={['rgba(143,154,255,0.3)', 'transparent']}
                style={{ top: -100, left: -100 }}
            />
            <Blob
                color={['rgba(255,142,89,0.25)', 'transparent']}
                style={{ bottom: -100, right: -100 }}
                delay={2000}
            />
        </>
    );

    return (
        <View style={[styles.container, { backgroundColor: bgColor }, style]}>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                {isDarkMode ? darkGlows : lightGlows}
                <BlurView intensity={90} style={StyleSheet.absoluteFill} tint={isDarkMode ? 'dark' : 'light'} />
            </View>
            <View style={{ flex: 1 }}>
                {children}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    glowContainer: {
        position: 'absolute',
        width: width * 1.2,
        height: width * 1.2,
        borderRadius: width * 0.6,
        overflow: 'hidden',
    },
    radialGradient: {
        flex: 1,
        borderRadius: width * 0.6,
    }
});
