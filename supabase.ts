import 'react-native-url-polyfill/auto'; // MUST be the first line
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lkvjnjhiiakhuenbbeaw.supabase.co'; 
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdmpuamhpaWFraHVlbmJiZWF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNTMwNzAsImV4cCI6MjA4MzYyOTA3MH0.1VLYy6L_1d5kUEeIB1dJ2f52ZjxRvloBSOO0ELbcaRY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});