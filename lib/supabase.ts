
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://cihwjzlcymletbsywfdj.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpaHdqemxjeW1sZXRic3l3ZmRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NDEyNTIsImV4cCI6MjA4NDUxNzI1Mn0.1de_4ZbTdVEOoHua5Q6xF785VZ4USgw5lu2WgBiJ4Cc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
    },
});
