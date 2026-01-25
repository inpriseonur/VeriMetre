import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'expo-router';
import { User } from 'lucide-react-native';
import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';

export default function HeaderProfileButton() {
    const { session } = useAuth();
    const router = useRouter();

    const handlePress = () => {
        if (session) {
            router.push('/profile-modal');
        } else {
            router.push('/login-modal');
        }
    };

    return (
        <TouchableOpacity onPress={handlePress} className="mr-4">
            {session ? (
                <View className="w-8 h-8 rounded-full border border-green-500 overflow-hidden bg-slate-700 items-center justify-center">
                    {session.user.user_metadata?.avatar_url ? (
                        <Image
                            source={{ uri: session.user.user_metadata.avatar_url }}
                            className="w-full h-full"
                        />
                    ) : (
                        <Text className="text-white font-bold text-xs">
                            {session.user.email?.substring(0, 2).toUpperCase()}
                        </Text>
                    )}
                </View>
            ) : (
                <View className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center border border-slate-600">
                    <User size={18} color="#94a3b8" />
                </View>
            )}
        </TouchableOpacity>
    );
}
