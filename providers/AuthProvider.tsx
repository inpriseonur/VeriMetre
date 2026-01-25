import { supabase } from '@/lib/supabase';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

// Configure Google Sign-In (Should be called once, maybe here or in _layout)
GoogleSignin.configure({
    scopes: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, // From .env
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, // Optional (if using newer generic flow, webClientId might suffice for Supabase)
    offlineAccess: true,
    forceCodeForRefreshToken: true,
});

type AuthContextType = {
    session: Session | null;
    user: User | null;
    isLoading: boolean;
    isGuest: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    setGuestMode: () => void;
};

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    isLoading: true,
    isGuest: false,
    signInWithGoogle: async () => { },
    signOut: async () => { },
    setGuestMode: () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGuest, setIsGuest] = useState(false);

    useEffect(() => {
        // 1. Check existing session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session ? session.user : null);
            setIsLoading(false);
        });

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            console.log("Auth State Changed:", _event);
            setSession(session);
            setUser(session ? session.user : null);

            if (session) {
                setIsGuest(false);
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

    const signInWithGoogle = async () => {
        try {
            setIsLoading(true);
            await GoogleSignin.hasPlayServices();

            // Initiate Google Sign-In
            const userInfo = await GoogleSignin.signIn();

            // Get ID Token (Depends on version; newer versions return explicit data object)
            // Note: @react-native-google-signin/google-signin v13+ structure is slightly different
            // Assuming standard response here. If idToken is missing, check webClientId config.

            if (userInfo.idToken) {
                const { data, error } = await supabase.auth.signInWithIdToken({
                    provider: 'google',
                    token: userInfo.idToken,
                });

                if (error) {
                    console.error("Supabase Auth Error:", error);
                    throw error;
                }
                // Session update handled by onAuthStateChange
            } else {
                throw new Error('No ID token present!');
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
        } finally {
            setIsLoading(false);
        }
    };

    const signOut = async () => {
        setIsLoading(true);
        try {
            await GoogleSignin.signOut(); // Sign out from Google
            await supabase.auth.signOut(); // Sign out from Supabase
            setIsGuest(false);
        } catch (error) {
            console.error("Sign Out Error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const setGuestMode = () => {
        setIsGuest(true);
    };

    return (
        <AuthContext.Provider value={{
            session,
            user,
            isLoading,
            isGuest,
            signInWithGoogle,
            signOut,
            setGuestMode
        }}>
            {children}
        </AuthContext.Provider>
    );
};
