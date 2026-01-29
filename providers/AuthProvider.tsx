import { supabase } from '@/lib/supabase';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { Session, User } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

// Configure Google Sign-In (Should be called once, maybe here or in _layout)
try {
    GoogleSignin.configure({
        scopes: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, // From .env
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, // Optional (if using newer generic flow, webClientId might suffice for Supabase)
        offlineAccess: true,
        forceCodeForRefreshToken: true,
    });
} catch (e) {
    console.warn('GoogleSignin configuration failed. Native module might be missing.', e);
}

type AuthContextType = {
    session: Session | null;
    user: User | null;
    isLoading: boolean;
    isGuest: boolean;
    isPremium: boolean;
    subscriptionEndDate: string | null;
    resetKey: number; // Increments on logout to signal components to clear their data
    signInWithGoogle: () => Promise<boolean>;
    signOut: () => Promise<void>;
    setGuestMode: () => void;
};

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    isLoading: true,
    isGuest: false,
    isPremium: false,
    subscriptionEndDate: null,
    resetKey: 0,
    signInWithGoogle: async () => false,
    signOut: async () => { },
    setGuestMode: () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGuest, setIsGuest] = useState(false);
    const [isPremium, setIsPremium] = useState(false);
    const [subscriptionEndDate, setSubscriptionEndDate] = useState<string | null>(null);
    const [resetKey, setResetKey] = useState(0);

    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('is_premium, subscription_end_date')
                .eq('id', userId)
                .single();

            if (data) {
                console.log("Profile data fetched:", data);
                setIsPremium(data.is_premium || false);
                setSubscriptionEndDate(data.subscription_end_date || null);
            } else {
                console.log("No profile data found for user:", userId);
            }
        } catch (err) {
            console.error('Error fetching profile:', err);
        }
    };

    useEffect(() => {
        // 1. Check existing session
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            setSession(session);
            const currentUser = session ? session.user : null;
            setUser(currentUser);

            if (currentUser) {
                await fetchProfile(currentUser.id);
            }

            setIsLoading(false);
        });

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            console.log("Auth State Changed:", _event, session?.user?.email);
            setSession(session);
            const currentUser = session ? session.user : null;
            setUser(currentUser);

            if (session) {
                setIsGuest(false);
                if (currentUser) {
                    console.log("Fetching profile for:", currentUser.id);
                    await fetchProfile(currentUser.id);
                }
            } else {
                setIsPremium(false);
            }
            setIsLoading(false);
        });

        // 3. Handle App State for token refresh (Optimization)
        const handleAppStateChange = (state: AppStateStatus) => {
            if (state === 'active') {
                supabase.auth.startAutoRefresh();
            } else {
                supabase.auth.stopAutoRefresh();
            }
        };
        const appStateListener = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription.unsubscribe();
            appStateListener.remove();
        };
    }, []);

    const signInWithGoogle = async (): Promise<boolean> => {
        try {
            setIsLoading(true);
            await GoogleSignin.hasPlayServices();

            // Initiate Google Sign-In
            const userInfo = await GoogleSignin.signIn();

            // Handle different versions of the library (v10 vs v11+)
            // @ts-ignore
            const idToken = userInfo.idToken || userInfo.data?.idToken;

            if (idToken) {
                const { data, error } = await supabase.auth.signInWithIdToken({
                    provider: 'google',
                    token: idToken,
                });

                if (error) {
                    console.error("Supabase Auth Error:", error);
                    throw error;
                }
                return true; // Success
            } else {
                // If no token, user might have cancelled or closed the window without error code
                console.warn('Google Sign-In: No ID token present in response.');
                return false; // Silent return, don't alert user
            }
        } catch (error: any) {
            console.error("Google Sign-In Error:", error);
            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                // User cancelled
            } else if (error.code === statusCodes.IN_PROGRESS) {
                // Operation in progress
            } else {
                alert("Giriş başarısız oldu: " + error.message);
            }
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const router = useRouter();

    const signOut = async () => {
        // Do not set isLoading(true) to prevent Splash Screen flicker
        try {
            await GoogleSignin.signOut(); // Sign out from Google
            await supabase.auth.signOut(); // Sign out from Supabase

            // Reset State
            setSession(null);
            setUser(null);
            setIsGuest(false);
            setIsPremium(false);

            // Increment resetKey - Components watching this will clear their data
            setResetKey(prev => prev + 1);

            // Navigate to home - Use expo-router's methods
            router.replace('/');

        } catch (error) {
            console.error("Sign Out Error:", error);
        }
    };

    const setGuestMode = () => {
        setIsGuest(true);
        setIsPremium(false); // Guests are not premium
    };

    return (
        <AuthContext.Provider value={{
            session,
            user,
            isLoading,
            isGuest,
            isPremium,
            subscriptionEndDate,
            resetKey,
            signInWithGoogle,
            signOut,
            setGuestMode
        }}>
            {children}
        </AuthContext.Provider>
    );
};
