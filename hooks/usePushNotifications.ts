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
        try {
            const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.expoConfig?.slug;
            const tokenResponse = await Notifications.getExpoPushTokenAsync({
                projectId,
            });
            token = tokenResponse.data;
        } catch (e) {
            console.error('Error fetching push token', e);
        }
    } else {
        console.log('Must use physical device for Push Notifications');
    }

    return token;
}

export function usePushNotifications() {
    const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
    const [notification, setNotification] = useState<Notifications.Notification | undefined>();

    const notificationListener = useRef<Notifications.Subscription>();
    const responseListener = useRef<Notifications.Subscription>();
    const { session } = useAuth();

    useEffect(() => {
        registerForPushNotificationsAsync().then(async (token) => {
            setExpoPushToken(token);

            if (token) {
                const userId = session?.user?.id ?? null;
                const platform = Platform.OS;

                try {
                    // Check if token exists
                    const { data: existingTokens, error: fetchError } = await supabase
                        .from('user_push_tokens')
                        .select('*')
                        .eq('token', token);

                    if (fetchError) {
                        console.error('Error fetching existing token:', fetchError);
                        return;
                    }

                    if (existingTokens && existingTokens.length > 0) {
                        // Token exists, update it
                        const { error: updateError } = await supabase
                            .from('user_push_tokens')
                            .update({
                                user_id: userId,
                                platform: platform,
                                last_used_at: new Date().toISOString(),
                            })
                            .eq('token', token);

                        if (updateError) {
                            console.error('Error updating push token:', updateError);
                        } else {
                            console.log('Push token updated for user:', userId);
                        }
                    } else {
                        // Token does not exist, insert it
                        const { error: insertError } = await supabase
                            .from('user_push_tokens')
                            .insert({
                                token: token,
                                user_id: userId,
                                platform: platform,
                                created_at: new Date().toISOString(),
                                last_used_at: new Date().toISOString(),
                            });

                        if (insertError) {
                            console.error('Error inserting push token:', insertError);
                        } else {
                            console.log('Push token inserted for user:', userId);
                        }
                    }

                } catch (err) {
                    console.error('Exception handling push token:', err);
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
    }, [session]); // Dependent on session to re-run logic when login/logout happens

    return {
        expoPushToken,
        notification,
    };
}
