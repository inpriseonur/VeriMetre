import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/providers/AuthProvider';

export default function LoginScreen() {
    const { signInWithGoogle, setGuestMode, isLoading } = useAuth();

    return (
        <SafeAreaView className="flex-1 bg-[#0B1121]">
            <StatusBar barStyle="light-content" backgroundColor="#0B1121" />

            <View className="flex-1 justify-center items-center px-6">
                {/* Logo Area */}
                <View className="items-center mb-12">
                    <View className="w-32 h-32 bg-slate-800 rounded-3xl items-center justify-center mb-6 shadow-2xl shadow-sky-500/20 border border-white/10">
                        {/* Placeholder for Logo - You can replace with <Image> */}
                        <Text className="text-5xl">📊</Text>
                    </View>
                    <Text className="text-white text-3xl font-bold tracking-tighter">
                        Veri<Text className="text-[#F97316]">Matik</Text>
                    </Text>
                    <Text className="text-slate-400 text-center mt-2 font-medium">
                        Piyasa verileri, portföy takibi ve{'\n'}ekonomik analizler tek yerde.
                    </Text>
                </View>

                {/* Buttons */}
                <View className="w-full gap-4">
                    <TouchableOpacity
                        onPress={signInWithGoogle}
                        disabled={isLoading}
                        className="flex-row items-center justify-center bg-white h-14 rounded-xl active:bg-slate-100"
                    >
                        <Ionicons name="logo-google" size={24} color="#000" style={{ marginRight: 12 }} />
                        <Text className="text-black font-bold text-lg">Google ile Giriş Yap</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={setGuestMode}
                        className="flex-row items-center justify-center bg-slate-800 h-14 rounded-xl border border-white/10 active:bg-slate-700"
                    >
                        <Text className="text-white font-semibold text-lg">Misafir Olarak Devam Et</Text>
                    </TouchableOpacity>
                </View>

                {/* Footer */}
                <Text className="text-slate-600 text-xs text-center mt-12">
                    Giriş yaparak Kullanım Koşulları ve Gizlilik Politikasını kabul etmiş olursunuz.
                </Text>
            </View>
        </SafeAreaView>
    );
}
