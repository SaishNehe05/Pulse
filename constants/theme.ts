/**
 * Anime Glow Theme System
 * 
 * 🌤️ Light Theme (Soft Glow Day)
 * Background: #F4F5F7 with subtle radial glow
 * Primary: #5E9BFF
 * Secondary: #FF8E59
 * 
 * 🌑 Dark Theme (Night Glow / Anime City)
 * Background: #11131A with ambient glow layers
 * Primary: #8F9AFF
 * Secondary: #FFB1EE
 */


const tintColorLight = '#5E9BFF';
const tintColorDark = '#8F9AFF';

export const Colors = {
  light: {
    text: '#1E2230',
    textMuted: '#6B7285',
    background: '#F4F5F7',
    surface: '#EDEFF3',
    primary: '#5E9BFF',
    secondary: '#FF8E59',
    divider: '#D6DAE2',
    tint: tintColorLight,
    tabIconDefault: '#6B7285',
    tabIconSelected: tintColorLight,
    error: '#FF4C4C',
  },
  dark: {
    text: '#E6E8F0',
    textMuted: '#9AA0B2',
    background: '#11131A',
    surface: '#161925',
    primary: '#8F9AFF',
    secondary: '#FFB1EE',
    divider: '#2A2E3B',
    tint: tintColorDark,
    tabIconDefault: '#9AA0B2',
    tabIconSelected: tintColorDark,
    error: '#FF6B6B',
  },
};
