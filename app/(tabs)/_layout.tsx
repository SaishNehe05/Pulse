import { Tabs } from 'expo-router';
import { Home, Inbox, Search, MessageSquare, Bell } from 'lucide-react-native';
import { useTheme } from '../theme'; // Ensure this path points to your theme.tsx

export default function TabLayout() {
  const { isDarkMode } = useTheme();

  // Theme-based colors
  const bgColor = isDarkMode ? '#121212' : '#FFF';
  const activeColor = isDarkMode ? '#FFF' : '#000';
  const inactiveColor = isDarkMode ? '#555' : '#999';
  const borderColor = isDarkMode ? '#222' : '#eee';

  return (
    <Tabs 
      screenOptions={{ 
        headerShown: false, 
        tabBarShowLabel: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: { 
          height: 60, 
          borderTopWidth: 0.5, 
          borderTopColor: borderColor,
          backgroundColor: bgColor, // Dynamically changes background
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