import { TrendingUp } from 'lucide-react-native';
import React from 'react';
import { Text, View } from 'react-native';

export default function HeaderLogo() {
    return (
        <View className="flex-row items-center gap-2">
            <View className="bg-orange-500/20 p-1.5 rounded-lg">
                <TrendingUp size={24} color="#F97316" />
            </View>
            <Text className="text-white text-2xl font-bold tracking-tight">
                Veri<Text className="text-[#F97316]">Matik</Text>
            </Text>
        </View>
    );
}
