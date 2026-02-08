import { Tabs } from 'expo-router';
import { Bell, Home, Inbox, MessageSquare, Search } from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { useTheme } from '../theme'; // Ensure this path points to your theme.tsx

export default function TabLayout() {
  const { isDarkMode } = useTheme();

  // Theme-based colors
  // const bgColor = isDarkMode ? Colors.dark.background : Colors.light.background; // REMOVED: Managed by global background
  const activeColor = isDarkMode ? Colors.dark.primary : Colors.light.primary;
  const inactiveColor = isDarkMode ? Colors.dark.textMuted : Colors.light.textMuted;
  const borderColor = isDarkMode ? Colors.dark.divider : Colors.light.divider;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarShowLabel: false,
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarStyle: {
          height: 60,
          borderTopWidth: 0.5,
          borderTopColor: borderColor,
          backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 0,
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ tabBarIcon: ({ color }) => <Home color={color} size={26} /> }}
      />
      <Tabs.Screen
        name="subscriptions"
        options={{ tabBarIcon: ({ color }) => <Inbox color={color} size={26} /> }}
      />
      <Tabs.Screen
        name="explore"
        options={{ tabBarIcon: ({ color }) => <Search color={color} size={26} /> }}
      />
      <Tabs.Screen
        name="chat"
        options={{ tabBarIcon: ({ color }) => <MessageSquare color={color} size={26} /> }}
      />
      <Tabs.Screen
        name="activity"
        options={{ tabBarIcon: ({ color }) => <Bell color={color} size={26} /> }}
      />
    </Tabs>
  );
}