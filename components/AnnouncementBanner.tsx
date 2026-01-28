import { getActiveAnnouncement } from '@/lib/marketService';
import { Announcement } from '@/types/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { AlertTriangle, Bell, Info, Megaphone, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { LayoutAnimation, Text, TouchableOpacity, View } from 'react-native';

const STORAGE_KEY = 'closed_announcements';

export const AnnouncementBanner = () => {
    const [announcement, setAnnouncement] = useState<Announcement | null>(null);
    const [visible, setVisible] = useState(false);
    const router = useRouter();

    useEffect(() => {
        checkAnnouncement();
    }, []);

    const checkAnnouncement = async () => {
        try {
            // 1. Fetch active from RPC
            const active = await getActiveAnnouncement();
            if (!active) return;

            // 2. Check local storage
            const closedIdsStr = await AsyncStorage.getItem(STORAGE_KEY);
            const closedIds: number[] = closedIdsStr ? JSON.parse(closedIdsStr) : [];

            if (closedIds.includes(active.id)) {
                return; // Already closed
            }

            setAnnouncement(active);
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setVisible(true);

        } catch (error) {
            console.error('Announcement check failed:', error);
        }
    };

    const handleClose = async () => {
        if (!announcement) return;
        try {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setVisible(false);

            // Persist valid close
            const closedIdsStr = await AsyncStorage.getItem(STORAGE_KEY);
            const closedIds: number[] = closedIdsStr ? JSON.parse(closedIdsStr) : [];
            if (!closedIds.includes(announcement.id)) {
                closedIds.push(announcement.id);
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(closedIds));
            }
        } catch (error) {
            console.error('Error closing announcement:', error);
        }
    };

    const handlePress = async () => {
        if (!announcement) return;
        // Mark as seen/closed so it doesn't pop up again?
        // User didn't explicitly say "Close on Click", but said "Duyuru ID'sini AsyncStorage'a kaydet (Bir daha gösterme)".
        // So yes, clicking also "closes" it for future sessions.
        await handleClose();

        if (announcement.target_screen) {
            // Safe navigation
            // Assuming target_screen is a valid route string like "(tabs)/markets"
            // If it is just "Emlak", we might want a map, but sticking to router.push with what comes.
            // If the user literally enters "Emlak" in DB, this will fail.
            // I'll add a simple map just in case based on my previous analysis.
            let route = announcement.target_screen;
            const lowerTarget = route.toLowerCase();

            if (lowerTarget.includes('emlak') || lowerTarget.includes('real')) route = '/(tabs)/real-estate';
            else if (lowerTarget.includes('piyasa') || lowerTarget.includes('market')) route = '/(tabs)/markets';
            else if (lowerTarget.includes('portfolio') || lowerTarget.includes('portföy')) route = '/(tabs)/portfolio';
            else if (lowerTarget.includes('auto') || lowerTarget.includes('oto')) route = '/(tabs)/auto';
            // Else assume it is a valid route

            // Ensure it starts with / if not present (simple fix)
            if (!route.startsWith('/')) route = '/' + route;

            console.log('Navigating to announcement route:', route);

            try {
                router.push(route as any);
            } catch (e) {
                console.warn('Navigation failed to:', route, e);
            }
        } else {
            console.warn('Announcement has no target_screen');
        }
    };

    if (!visible || !announcement) return null;

    console.log('Rendering Banner:', announcement);

    // Icon Mapping
    let Icon = Megaphone;
    if (announcement.icon_name) {
        const name = announcement.icon_name.toLowerCase();
        if (name.includes('alert') || name.includes('warn')) Icon = AlertTriangle;
        else if (name.includes('info')) Icon = Info;
        else if (name.includes('bell')) Icon = Bell;
    }

    // Color Mapping
    let bgColor = 'bg-blue-600'; // default
    let borderColor = 'border-blue-500';
    if (announcement.bg_color) {
        const color = announcement.bg_color.toLowerCase();
        if (color === 'red' || color === 'danger') {
            bgColor = 'bg-red-600';
            borderColor = 'border-red-500';
        }
        else if (color === 'yellow' || color === 'warning' || color === 'orange') {
            bgColor = 'bg-orange-600';
            borderColor = 'border-orange-500';
        }
        else if (color === 'green' || color === 'success') {
            bgColor = 'bg-green-600';
            borderColor = 'border-green-500';
        }
        else if (color === 'purple') {
            bgColor = 'bg-purple-600';
            borderColor = 'border-purple-500';
        }
    }

    return (
        <View className="px-5 mt-4 mb-2">
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={handlePress}
                className={`${bgColor} rounded-xl p-4 border ${borderColor} flex-row items-center shadow-lg relative overflow-hidden`}
            >
                {/* Decorative Background Circle */}
                <View className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full" />

                {/* Icon */}
                <View className="bg-white/20 p-2.5 rounded-lg mr-4">
                    <Icon size={24} color="white" />
                </View>

                {/* Text Content */}
                <View className="flex-1 mr-6">
                    <Text className="text-white font-bold text-base mb-0.5 leading-5">
                        {announcement.title}
                    </Text>
                    <Text className="text-blue-50 text-xs leading-4" numberOfLines={2}>
                        {announcement.message}
                    </Text>
                </View>

                {/* Close Button (Absolute Top Right) */}
                <TouchableOpacity
                    onPress={(e) => {
                        e.stopPropagation();
                        handleClose();
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-black/10 rounded-full"
                >
                    <X size={14} color="white" />
                </TouchableOpacity>
            </TouchableOpacity>
        </View>
    );
};
