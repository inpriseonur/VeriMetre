import React from 'react';
import { Text, View } from 'react-native';

export default function MarketsScreen() {
    return (
        <View className="flex-1 bg-[#0B1121] items-center justify-center">
            <Text className="text-white text-xl font-bold">Piyasalar</Text>
            <Text className="text-slate-400 mt-2">Çok Yakında</Text>
        </View>
    );
}
