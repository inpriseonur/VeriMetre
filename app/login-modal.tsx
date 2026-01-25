import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import React from 'react';
import { Image, StatusBar, Text, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';

export default function LoginModal() {
    const { signInWithGoogle, isLoading } = useAuth();
    const router = useRouter();

    return (
        <View className="flex-1 bg-[#0B1121]">
            <StatusBar barStyle="light-content" />

            {/* Close Button */}
            <View className="flex-row justify-end p-4 mt-2">
                <TouchableOpacity onPress={() => router.back()} className="p-2 bg-slate-800 rounded-full">
                    <X size={24} color="white" />
                </TouchableOpacity>
            </View>

            <View className="flex-1 justify-center items-center px-6">
                {/* Logo Area */}
                <View className="items-center mb-12">
                    <View className="mb-6">
                        <Image
                            source={require('@/assets/images/VeriMatik_Logo1.png')}
                            style={{ width: 120, height: 120 }}
                            resizeMode="contain"
                        />
                    </View>
                    <Text className="text-white text-3xl font-bold tracking-tighter">
                        Veri<Text className="text-[#F97316]">Matik</Text>
                    </Text>
                    <Text className="text-slate-400 text-center mt-2 font-medium">
                        Ekonomik veriler, BES portföy takibi ve{'\n'}Konut ve Otomobil analizler tek yerde.
                    </Text>
                </View>

                {/* Buttons */}
                <View className="w-full gap-4">
                    <TouchableOpacity
                        onPress={async () => {
                            const success = await signInWithGoogle();
                            // If successful, close the modal.
                            // If user cancelled (success=false), stay on modal.
                            if (success) {
                                router.back();
                            }
                        }}
                        disabled={isLoading}
                        className="flex-row items-center justify-center bg-white h-14 rounded-xl active:bg-slate-100"
                    >
                        {isLoading ? (
                            <Text className="text-black font-bold text-lg">Giriş Yapılıyor...</Text>
                        ) : (
                            <>
                                <Ionicons name="logo-google" size={24} color="#000" style={{ marginRight: 12 }} />
                                <Text className="text-black font-bold text-lg">Google ile Giriş Yap</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Footer */}
                <Text className="text-slate-600 text-xs text-center mt-12">
                    Giriş yaparak tüm özelliklere erişebilirsiniz.
                </Text>
            </View>
        </View>
    );
}
