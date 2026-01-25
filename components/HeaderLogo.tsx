import React from 'react';
import { Text, View } from 'react-native';

export default function HeaderLogo() {
    return (
        <View className="flex-row items-center">
            {/* Optional: Add Logo Icon here if requested later */}
            <Text className="text-white text-xl font-bold tracking-tighter">
                Veri<Text className="text-[#F97316]">Matik</Text>
            </Text>
        </View>
    );
}
