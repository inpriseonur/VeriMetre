import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

// Configure how notifications should handle when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification!');
            return;
        }

        // Get the Expo Push Token
        // We use the projectId from app config if available
        try {
            const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
            token = (await Notifications.getExpoPushTokenAsync({
                projectId,
            })).data;
            console.log('Expo Push Token generated:', token);
        } catch (e) {
            console.error('Error fetching push token', e);
        }
    } else {
        console.log('Must use physical device for Push Notifications');
    }

    return token;
}

export function usePushNotifications() {
    // Initialize with undefined explicitly to satisfy strict typing if needed, or rely on inference
    const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
    const [notification, setNotification] = useState<Notifications.Notification | undefined>();

    const notificationListener = useRef<Notifications.Subscription>();
    const responseListener = useRef<Notifications.Subscription>();
    const { session } = useAuth();

    useEffect(() => {
        // Only register if user is logged in
        if (!session?.user) return;

        registerForPushNotificationsAsync().then(async (token) => {
            setExpoPushToken(token);

            if (token && session.user.id) {
                // Save token to Supabase
                try {
                    const { error } = await supabase
                        .from('user_push_tokens')
                        .upsert({
                            user_id: session.user.id,
                            token: token,
                            platform: Platform.OS,
                            last_used_at: new Date().toISOString(),
                        }, { onConflict: 'user_id, token' });

                    if (error) {
                        console.error('Error saving push token to Supabase:', error);
                    } else {
                        console.log('Push token upserted to Supabase for user:', session.user.id);
                    }
                } catch (err) {
                    console.error('Exception saving push token:', err);
                }
            }
        });

        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            setNotification(notification);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            console.log(response);
        });

        return () => {
            if (notificationListener.current) {
                notificationListener.current.remove();
            }
            if (responseListener.current) {
                responseListener.current.remove();
            }
        };
    }, [session]);

    return {
        expoPushToken,
        notification,
    };
}
