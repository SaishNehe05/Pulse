import { createMaterialTopTabNavigator, MaterialTopTabNavigationEventMap, MaterialTopTabNavigationOptions } from '@react-navigation/material-top-tabs';
import { withLayoutContext } from 'expo-router';
import { Bell, Home, Inbox, MessageSquare, Search } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import { useUnreadCounts } from '../../hooks/useUnreadCounts';
import { useTheme } from '../theme';

const { Navigator } = createMaterialTopTabNavigator();

export const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  any,
  MaterialTopTabNavigationEventMap
>(Navigator);


// ...

export default function TabLayout() {
  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { unreadMessages, unreadNotifications } = useUnreadCounts();

  const activeColor = isDarkMode ? Colors.dark.primary : Colors.light.primary;
  const inactiveColor = isDarkMode ? Colors.dark.textMuted : Colors.light.textMuted;
  const borderColor = isDarkMode ? Colors.dark.divider : Colors.light.divider;

  const TAB_BAR_HEIGHT = 60 + Math.max(insets.bottom, 20);

  return (
    <MaterialTopTabs
      tabBarPosition="bottom"
      screenOptions={{
        animationEnabled: false,
        sceneStyle: { backgroundColor: 'transparent' }, // Allow ThemedBackground to show through
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarShowLabel: false,
        tabBarIndicatorStyle: { height: 0 }, // Hide top indicator

        tabBarStyle: {
          borderTopWidth: 0.5,
          borderTopColor: borderColor,
          backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface,
          elevation: 0,
          shadowOpacity: 0,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: TAB_BAR_HEIGHT,
          zIndex: 10,
          justifyContent: 'center',
        },
        tabBarContentContainerStyle: {
          height: TAB_BAR_HEIGHT,
          flexDirection: 'row',
          alignItems: 'stretch', // Crucial: Force items to stretch vertically
          justifyContent: 'center',
        },
        tabBarItemStyle: {
          height: '100%', // Ensure item takes full height of the stretched container
          justifyContent: 'flex-start', // Align icon to top
          paddingTop: 15,
          paddingBottom: insets.bottom, // Keep padding to position icon but allow full click area
          backgroundColor: 'transparent',
        },
        tabBarPressColor: 'transparent', // Disable ripple if desired, or leave default
      }}
    >
      <MaterialTopTabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color }) => <Home color={color} size={26} />,
        }}
      />
      <MaterialTopTabs.Screen
        name="subscriptions"
        options={{
          tabBarIcon: ({ color }) => <Inbox color={color} size={26} />,
        }}
      />
      <MaterialTopTabs.Screen
        name="explore"
        options={{
          tabBarIcon: ({ color }) => <Search color={color} size={26} />,
        }}
      />
      <MaterialTopTabs.Screen
        name="chat"
        options={{
          tabBarIcon: ({ color }) => (
            <View>
              <MessageSquare color={color} size={26} />
              {unreadMessages > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadMessages}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <MaterialTopTabs.Screen
        name="activity"
        options={{
          tabBarIcon: ({ color }) => (
            <View>
              <Bell color={color} size={26} />
              {unreadNotifications > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadNotifications}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
    </ MaterialTopTabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: Colors.light.secondary,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: 'ClashGrotesk-Bold',
  }
});