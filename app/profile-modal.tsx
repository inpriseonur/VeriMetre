import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'expo-router';
import { LogOut, Mail, Shield, X } from 'lucide-react-native';
import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';

export default function ProfileModal() {
    const { session, signOut } = useAuth();
    const router = useRouter();

    if (!session) return null;

    const { user } = session;

    const handleSignOut = async () => {
        await signOut();
        router.back();
    };

    return (
        <View className="flex-1 bg-[#0B1121] p-5">
            {/* Header */}
            <View className="flex-row justify-between items-center mt-2 mb-8">
                <Text className="text-white text-xl font-bold">Profilim</Text>
                <TouchableOpacity onPress={() => router.back()} className="p-2 bg-slate-800 rounded-full">
                    <X size={24} color="white" />
                </TouchableOpacity>
            </View>

            {/* User Card */}
            <View className="items-center mb-8">
                <View className="w-24 h-24 rounded-full border-2 border-green-500 p-1 mb-4">
                    {user.user_metadata?.avatar_url ? (
                        <Image
                            source={{ uri: user.user_metadata.avatar_url }}
                            className="w-full h-full rounded-full"
                        />
                    ) : (
                        <View className="w-full h-full rounded-full bg-slate-700 items-center justify-center">
                            <Text className="text-white text-3xl font-bold">
                                {user.email?.substring(0, 2).toUpperCase()}
                            </Text>
                        </View>
                    )}
                </View>
                <Text className="text-white text-xl font-bold">{user.user_metadata?.full_name || 'Kullanıcı'}</Text>
                <View className="flex-row items-center mt-1">
                    <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                    <Text className="text-green-500 font-medium">Aktif Üye</Text>
                </View>
            </View>

            {/* Info Section */}
            <View className="bg-slate-800/50 rounded-2xl p-4 border border-white/5 space-y-4 mb-8">
                <View className="flex-row items-center border-b border-white/5 pb-3 mb-3">
                    <Mail size={20} color="#94a3b8" />
                    <View className="ml-3">
                        <Text className="text-slate-500 text-xs">Email Adresi</Text>
                        <Text className="text-white font-medium">{user.email}</Text>
                    </View>
                </View>

                <View className="flex-row items-center">
                    <Shield size={20} color="#F97316" />
                    <View className="ml-3">
                        <Text className="text-slate-500 text-xs">Üyelik Tipi</Text>
                        <Text className="text-white font-medium">Standart (Free)</Text>
                    </View>
                </View>
            </View>

            {/* Logout Button */}
            <TouchableOpacity
                onPress={handleSignOut}
                className="flex-row items-center justify-center bg-red-500/10 p-4 rounded-xl border border-red-500/20 active:bg-red-500/20"
            >
                <LogOut size={20} color="#ef4444" style={{ marginRight: 10 }} />
                <Text className="text-red-500 font-bold">Çıkış Yap</Text>
            </TouchableOpacity>

        </View>
    );
}
