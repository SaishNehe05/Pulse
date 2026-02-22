# Notification Style Customization Guide

## Overview
You can customize notifications in three main areas:
1. **Android Notification Channels** - Controls Android notification appearance
2. **Foreground Behavior** - How notifications appear when app is open
3. **Notification Content** - The actual message, title, icon, etc. (sent from backend)

---

## 1. Android Notification Channel Customization

**Location:** `hooks/useNotifications.tsx` (lines 61-73)

### Current Settings:
```tsx
await Notifications.setNotificationChannelAsync('default', {
    name: 'Pulse Notifications',
    description: 'Notifications for likes, comments, and follows',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#5E9BFF',
    sound: 'default',
    enableVibrate: true,
    enableLights: true,
    showBadge: true,
});
```

### Customization Options:

#### **Importance Levels:**
```tsx
importance: Notifications.AndroidImportance.MAX      // Heads-up notification
importance: Notifications.AndroidImportance.HIGH     // Makes sound
importance: Notifications.AndroidImportance.DEFAULT  // No sound
importance: Notifications.AndroidImportance.LOW      // No sound, minimized
importance: Notifications.AndroidImportance.MIN      // No sound, no visual
```

#### **Vibration Patterns:**
```tsx
vibrationPattern: [0, 250, 250, 250]  // Current: short pulses
vibrationPattern: [0, 500, 200, 500]  // Long-short-long
vibrationPattern: [0, 1000]           // Single long vibration
vibrationPattern: [0, 100, 100, 100, 100, 100]  // Multiple short pulses
```

#### **LED Colors:**
```tsx
lightColor: '#5E9BFF'  // Blue (current)
lightColor: '#FF3B30'  // Red
lightColor: '#00E676'  // Green
lightColor: '#FFD700'  // Gold
```

#### **Custom Sound:**
To use a custom sound:
1. Add sound file to `assets/sounds/notification.mp3`
2. Update the channel:
```tsx
sound: 'notification.mp3'
```

---

## 2. Foreground Notification Behavior

**Location:** `hooks/useNotifications.tsx` (lines 8-16)

### Current Settings:
```tsx
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,      // Show notification banner
        shouldPlaySound: true,      // Play sound
        shouldSetBadge: true,       // Update app badge count
        shouldShowBanner: true,     // Show banner at top
        shouldShowList: true,       // Add to notification list
    }),
});
```

### Customization Options:

#### **Silent Notifications:**
```tsx
shouldPlaySound: false,  // No sound when app is open
```

#### **Hide When App is Open:**
```tsx
shouldShowAlert: false,
shouldShowBanner: false,
```

#### **Conditional Behavior:**
```tsx
handleNotification: async (notification) => {
    // Different behavior based on notification type
    const isImportant = notification.request.content.data.type === 'message';
    
    return {
        shouldShowAlert: isImportant,
        shouldPlaySound: isImportant,
        shouldSetBadge: true,
        shouldShowBanner: isImportant,
        shouldShowList: true,
    };
},
```

---

## 3. Notification Content (Backend)

When sending notifications from your backend, you control:

### Basic Structure:
```javascript
{
  to: 'ExponentPushToken[...]',
  sound: 'default',
  title: 'New Like! ❤️',
  body: '@username liked your post',
  data: { 
    type: 'like',
    post_id: '123',
    actor_id: 'user-456'
  },
  badge: 1,
  priority: 'high',
  channelId: 'default'
}
```

### Customization Options:

#### **Title & Body:**
```javascript
// Like notification
title: '❤️ New Like',
body: '@username liked "Your Post Title"'

// Comment notification
title: '💬 New Comment',
body: '@username: "This is amazing!"'

// Follow notification
title: '👤 New Follower',
body: '@username started following you'
```

#### **Icons & Images:**
```javascript
{
  title: 'New Post',
  body: 'Check out this amazing content!',
  // Large image in notification
  image: 'https://your-cdn.com/post-image.jpg',
  // Small icon (Android)
  icon: 'https://your-cdn.com/icon.png',
}
```

#### **Priority:**
```javascript
priority: 'high',    // Immediate delivery
priority: 'normal',  // Standard delivery
priority: 'default', // Default behavior
```

#### **Sound:**
```javascript
sound: 'default',           // System default
sound: 'custom_sound.mp3',  // Custom sound
sound: null,                // Silent
```

#### **Badge Count:**
```javascript
badge: 5,  // Show number on app icon
```

---

## 4. Multiple Notification Channels (Android)

Create different channels for different notification types:

```tsx
// In useNotifications.tsx
if (Platform.OS === 'android') {
    // Channel for messages
    await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#5E9BFF',
        sound: 'message_sound.mp3',
    });
    
    // Channel for likes/comments
    await Notifications.setNotificationChannelAsync('interactions', {
        name: 'Likes & Comments',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 100],
        lightColor: '#FF3B30',
        sound: 'default',
    });
    
    // Channel for follows
    await Notifications.setNotificationChannelAsync('social', {
        name: 'New Followers',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 200],
        lightColor: '#00E676',
    });
}
```

Then specify the channel when sending:
```javascript
{
  to: token,
  channelId: 'messages',  // Use specific channel
  title: 'New Message',
  body: 'You have a new message'
}
```

---

## 5. App.json Configuration

**Location:** `app.json`

### Android Icon:
```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/images/notification-icon.png",
          "color": "#5E9BFF"
        }
      ]
    ]
  }
}
```

**Icon Requirements:**
- Size: 96x96 pixels
- Format: PNG with transparency
- Style: Simple, monochrome design
- Background: Transparent

---

## Quick Customization Examples

### Example 1: Subtle Notifications
```tsx
// In setNotificationHandler
shouldShowAlert: false,  // Don't show banner
shouldPlaySound: false,  // Silent
shouldSetBadge: true,    // Just update badge
```

### Example 2: Urgent Notifications
```tsx
// Android channel
importance: Notifications.AndroidImportance.MAX,
vibrationPattern: [0, 500, 200, 500, 200, 500],
sound: 'urgent.mp3',
```

### Example 3: Different Sounds per Type
```tsx
handleNotification: async (notification) => {
    const type = notification.request.content.data.type;
    
    return {
        shouldShowAlert: true,
        shouldPlaySound: type === 'message', // Only sound for messages
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    };
},
```

---

## Testing Your Changes

1. **Rebuild the app** after changing notification settings
2. **Test on physical device** (notifications don't work in simulators)
3. **Check Android settings** - Users can override your channel settings

## Summary

- **Android Channel**: Controls system-level notification behavior
- **Foreground Handler**: Controls behavior when app is open
- **Backend Content**: Controls the actual notification message and appearance
- **App.json**: Controls notification icon and basic config
