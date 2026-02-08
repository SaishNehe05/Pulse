import React from 'react';
import { Dimensions, Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useTheme } from '../app/theme';
import { Colors } from '../constants/theme';

interface PostMenuProps {
    visible: boolean;
    onClose: () => void;
    anchor: { x: number; y: number } | null;
    options: { label: string; onPress: () => void; destructive?: boolean }[];
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PostMenu({ visible, onClose, anchor, options }: PostMenuProps) {
    const { isDarkMode } = useTheme();

    if (!anchor) return null;

    const backgroundColor = isDarkMode ? Colors.dark.surface : Colors.light.surface;
    const textColor = isDarkMode ? Colors.dark.text : Colors.light.text;
    const borderColor = isDarkMode ? Colors.dark.divider : Colors.light.divider;

    // Calculate menu position to stay on screen
    const menuWidth = 160;
    let left = anchor.x - menuWidth + 20; // Align right side with anchor
    if (left < 10) left = 10;
    if (left + menuWidth > SCREEN_WIDTH - 10) left = SCREEN_WIDTH - menuWidth - 10;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <View style={[
                        styles.menu,
                        {
                            top: anchor.y + 25,
                            left: left,
                            backgroundColor,
                            borderColor,
                        }
                    ]}>
                        {options.map((option, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.option,
                                    index < options.length - 1 && { borderBottomWidth: 1, borderBottomColor: borderColor }
                                ]}
                                onPress={() => {
                                    option.onPress();
                                    onClose();
                                }}
                            >
                                <Text style={[
                                    styles.optionText,
                                    { color: option.destructive ? '#FF3B30' : textColor }
                                ]}>
                                    {option.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    menu: {
        position: 'absolute',
        width: 160,
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
        // Shadow for iOS
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        // Elevation for Android
        elevation: 5,
    },
    option: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        justifyContent: 'center',
    },
    optionText: {
        fontSize: 15,
        fontWeight: '600',
    },
});
