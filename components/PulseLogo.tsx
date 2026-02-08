import React from 'react';
import { Image, StyleSheet, View, ViewStyle } from 'react-native';

interface PulseLogoProps {
    size?: number;
    style?: ViewStyle;
}

/**
 * PulseLogo Component
 * Now uses the high-fidelity design image
 */
export const PulseLogo: React.FC<PulseLogoProps> = ({ size = 100, style }) => {
    return (
        <View style={[styles.container, { width: size, height: size, borderRadius: size * 0.2, overflow: 'hidden' }, style]}>
            <Image
                source={require('../assets/images/logo.png')}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    }
});

export default PulseLogo;
