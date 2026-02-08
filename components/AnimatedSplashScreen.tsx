import React, { useEffect } from 'react';
import { Dimensions, Image, StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import { ThemedBackground } from './ThemedBackground';

const { width } = Dimensions.get('window');

interface AnimatedSplashScreenProps {
    onAnimationFinish: () => void;
}

export function AnimatedSplashScreen({ onAnimationFinish }: AnimatedSplashScreenProps) {
    const scale = useSharedValue(0.3);
    const opacity = useSharedValue(0);

    useEffect(() => {
        scale.value = withSequence(
            withTiming(1.1, { duration: 1000, easing: Easing.out(Easing.back(1.5)) }),
            withTiming(1, { duration: 500 })
        );
        opacity.value = withTiming(1, { duration: 800 }, (finished) => {
            if (finished) {
                // Wait a bit before finishing
                setTimeout(() => {
                    runOnJS(onAnimationFinish)();
                }, 1200);
            }
        });
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    return (
        <View style={styles.container}>
            <ThemedBackground style={StyleSheet.absoluteFillObject} />
            <Animated.View style={[styles.logoContainer, animatedStyle]}>
                <Image
                    source={require('../assets/images/logo.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#11131A', // Matches dark theme background
    },
    logoContainer: {
        width: width * 0.4,
        height: width * 0.4,
        borderRadius: (width * 0.4) * 0.2,
        overflow: 'hidden',
        backgroundColor: 'transparent',
    },
    logo: {
        width: '100%',
        height: '100%',
    },
});
