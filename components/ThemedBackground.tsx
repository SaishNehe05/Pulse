import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import { useTheme } from '../app/theme';
import { Colors } from '../constants/theme';

const { width, height } = Dimensions.get('window');

interface ThemedBackgroundProps {
    children?: React.ReactNode;
    style?: ViewStyle;
}

const Blob = ({ color, size, initialPos, moveRange, duration, delay = 0, opacity = 1 }: {
    color: string[],
    size: number,
    initialPos: { x: number, y: number },
    moveRange: { x: number, y: number },
    duration: number,
    delay?: number,
    opacity?: number
}) => {
    const scale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const rotation = useSharedValue(0);

    useEffect(() => {
        // Pulse/Scale animation - rhythmic growth
        scale.value = withDelay(
            delay,
            withRepeat(
                withTiming(1.3, {
                    duration: duration * 0.75,
                    easing: Easing.bezier(0.445, 0.05, 0.55, 0.95),
                }),
                -1,
                true
            )
        );

        // Subtle wobbling rotation
        rotation.value = withDelay(
            delay,
            withRepeat(
                withTiming(20, {
                    duration: duration * 1.5,
                    easing: Easing.inOut(Easing.sin),
                }),
                -1,
                true
            )
        );

        // Circular/Swaying movement - oscillating around the initial point
        // instead of starting AT the point and moving away.
        translateX.value = withDelay(
            delay,
            withRepeat(
                withSequence(
                    withTiming(moveRange.x, { duration: duration, easing: Easing.inOut(Easing.sin) }),
                    withTiming(-moveRange.x, { duration: duration, easing: Easing.inOut(Easing.sin) })
                ),
                -1,
                true
            )
        );

        translateY.value = withDelay(
            delay,
            withRepeat(
                withSequence(
                    withTiming(-moveRange.y, { duration: duration * 0.8, easing: Easing.inOut(Easing.sin) }),
                    withTiming(moveRange.y, { duration: duration * 0.8, easing: Easing.inOut(Easing.sin) })
                ),
                -1,
                true
            )
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity,
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
            { rotate: `${rotation.value}deg` }
        ],
    }));

    return (
        <Animated.View style={[
            styles.glowContainer,
            {
                width: size,
                height: size,
                borderRadius: size / 2,
                top: initialPos.y,
                left: initialPos.x,
            },
            animatedStyle
        ]}>
            <LinearGradient
                colors={color as any}
                style={[styles.radialGradient, { borderRadius: size / 2 }]}
                start={{ x: 0.5, y: 0.5 }}
                end={{ x: 1, y: 1 }}
            />
        </Animated.View>
    );
};

export function ThemedBackground({ children, style }: ThemedBackgroundProps) {
    const { isDarkMode } = useTheme();
    const bgColor = isDarkMode ? Colors.dark.background : Colors.light.background;

    const BLOB_SIZE = width * 1.7;
    const BLOB_OFFSET = width * 1.0;
    const DURATION = 50000;

    const lightGlows = [
        {
            color: ['rgba(94,155,255,0.45)', 'transparent'],
            size: BLOB_SIZE,
            x: -BLOB_OFFSET,
            y: -BLOB_OFFSET,
            move: { x: width * 0.03, y: height * 0.02 },
            duration: DURATION,
            delay: 0
        },
        {
            color: ['rgba(255,142,89,0.4)', 'transparent'],
            size: BLOB_SIZE,
            x: width - BLOB_SIZE + BLOB_OFFSET,
            y: height - BLOB_SIZE + BLOB_OFFSET,
            move: { x: -width * 0.03, y: -height * 0.02 },
            duration: DURATION,
            delay: 2000
        },
    ];

    const darkGlows = [
        {
            color: ['rgba(143,154,255,0.5)', 'transparent'],
            size: BLOB_SIZE,
            x: -BLOB_OFFSET,
            y: -BLOB_OFFSET,
            move: { x: width * 0.03, y: height * 0.02 },
            duration: DURATION,
            delay: 0
        },
        {
            color: ['rgba(255,142,89,0.45)', 'transparent'],
            size: BLOB_SIZE,
            x: width - BLOB_SIZE + BLOB_OFFSET,
            y: height - BLOB_SIZE + BLOB_OFFSET,
            move: { x: -width * 0.03, y: -height * 0.02 },
            duration: DURATION,
            delay: 2000
        },
    ];

    const currentGlows = isDarkMode ? darkGlows : lightGlows;

    return (
        <View style={[styles.container, { backgroundColor: bgColor }, style]}>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                {currentGlows.map((glow, index) => (
                    <Blob
                        key={index}
                        color={glow.color}
                        size={glow.size}
                        initialPos={{ x: glow.x, y: glow.y }}
                        moveRange={glow.move}
                        duration={glow.duration}
                        delay={glow.delay}
                        opacity={0.8}
                    />
                ))}
                <BlurView intensity={isDarkMode ? 80 : 70} style={StyleSheet.absoluteFill} tint={isDarkMode ? 'dark' : 'light'} />
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
        overflow: 'hidden',
    },
    radialGradient: {
        flex: 1,
    }
});
