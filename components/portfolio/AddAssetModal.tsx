import { Search, TrendingUp, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

import { savePortfolioAsset } from '@/lib/localStorageService';
import { FundItem, searchFunds } from '@/lib/marketService';

interface AddAssetModalProps {
    visible: boolean;
    onClose: () => void;
    onAssetAdded: () => void;
}

export default function AddAssetModal({ visible, onClose, onAssetAdded }: AddAssetModalProps) {
    const [step, setStep] = useState<'search' | 'quantity'>('search');
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState<FundItem[]>([]);
    const [loading, setLoading] = useState(false);

    // Selection
    const [selectedAsset, setSelectedAsset] = useState<FundItem | null>(null);
    const [quantity, setQuantity] = useState('');

    useEffect(() => {
        if (visible) {
            // Reset state when opening
            setStep('search');
            setSearchQuery('');
            setQuantity('');
            setSelectedAsset(null);
            loadDefaultFunds(); // Load popular funds
        }
    }, [visible]);

    const loadDefaultFunds = async () => {
        setLoading(true);
        const data = await searchFunds("");
        if (data) {
            setResults(data);
        }
        setLoading(false);
    };

    const handleSearch = async (text: string) => {
        setSearchQuery(text);
        setLoading(true); // User wants immediate feedback usually
        const data = await searchFunds(text);
        if (data) {
            setResults(data);
        }
        setLoading(false);
    };

    const handleSelect = (item: FundItem) => {
        setSelectedAsset(item);
        setStep('quantity');
    };

    const handleSave = async () => {
        if (!selectedAsset) return;
        const qty = parseFloat(quantity.replace(',', '.'));
        if (isNaN(qty) || qty <= 0) {
            alert("Lütfen geçerli bir adet giriniz.");
            return;
        }

        await savePortfolioAsset({
            id: selectedAsset.code, // Unique ID for Funds
            symbol: selectedAsset.code,
            name: selectedAsset.title,
            quantity: qty,
            price: selectedAsset.price,
            lastUpdated: new Date().toISOString()
        });

        onAssetAdded(); // Refresh parent
        onClose(); // Close modal
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1, backgroundColor: '#0B1121' }}
            >
                <View className="flex-1 p-5">
                    {/* Header */}
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-white text-xl font-bold">
                            {step === 'search' ? 'Fon Ekle' : 'Adet Girin'}
                        </Text>
                        <TouchableOpacity onPress={onClose} className="p-2 bg-slate-800 rounded-full">
                            <X size={20} color="white" />
                        </TouchableOpacity>
                    </View>

                    {/* Step 1: Search */}
                    {step === 'search' && (
                        <>
                            <View className="bg-slate-800 rounded-xl flex-row items-center px-4 py-3 mb-4 border border-white/10">
                                <Search size={20} color="#94a3b8" />
                                <TextInput
                                    className="flex-1 ml-3 text-white font-medium h-full"
                                    placeholder="Fon Kodu veya Adı Ara..."
                                    placeholderTextColor="#64748b"
                                    value={searchQuery}
                                    onChangeText={handleSearch}
                                    autoFocus
                                />
                            </View>

                            {/* Header for Default List */}
                            {searchQuery === '' && !loading && (
                                <View className="flex-row items-center gap-2 mb-3 mt-2">
                                    <TrendingUp size={16} color="#F97316" />
                                    <Text className="text-[#F97316] font-bold text-sm">Popüler Fonlar</Text>
                                </View>
                            )}

                            {loading ? (
                                <ActivityIndicator color="#F97316" className="mt-10" />
                            ) : (
                                <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
                                    {results.map(item => (
                                        <TouchableOpacity
                                            key={item.code}
                                            className="bg-[#151C2F] p-4 mb-3 rounded-xl border border-white/5 flex-row justify-between items-center"
                                            onPress={() => handleSelect(item)}
                                        >
                                            <View className="flex-1 mr-4">
                                                <View className="flex-row items-center gap-2 mb-1">
                                                    <View className="bg-slate-800 px-2 py-0.5 rounded">
                                                        <Text className="text-white font-bold text-xs">{item.code}</Text>
                                                    </View>
                                                </View>
                                                <Text className="text-slate-400 text-xs" numberOfLines={1}>{item.title}</Text>
                                            </View>
                                            <Text className="text-white font-bold">
                                                {item.price.toLocaleString('tr-TR', { minimumFractionDigits: 4 })} ₺
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            )}
                        </>
                    )}

                    {/* Step 2: Quantity */}
                    {step === 'quantity' && selectedAsset && (
                        <View className="flex-1 items-center pt-10">
                            <Text className="text-slate-400 text-lg mb-2">{selectedAsset.title}</Text>
                            <View className="bg-slate-800 px-4 py-1 rounded-full mb-8 border border-white/10">
                                <Text className="text-white font-bold text-xl">{selectedAsset.code}</Text>
                            </View>

                            <Text className="text-slate-500 text-sm mb-1">Güncel Fiyat</Text>
                            <Text className="text-white text-3xl font-bold mb-10">
                                {selectedAsset.price.toLocaleString('tr-TR', { minimumFractionDigits: 4 })} ₺
                            </Text>

                            <View className="w-full bg-slate-800/50 p-6 rounded-2xl border border-white/10 mb-8">
                                <Text className="text-slate-400 text-sm mb-2 text-center">Kaç Adet?</Text>
                                <TextInput
                                    className="text-white text-center text-4xl font-bold w-full"
                                    placeholder="0"
                                    placeholderTextColor="#475569"
                                    keyboardType="decimal-pad"
                                    value={quantity}
                                    onChangeText={setQuantity}
                                    ref={(ref) => {
                                        // Auto-focus with slight delay to ensure modal transition finishes
                                        if (ref && step === 'quantity') {
                                            setTimeout(() => ref.focus(), 100);
                                        }
                                    }}
                                />
                            </View>

                            <TouchableOpacity
                                className="w-full bg-[#F97316] py-4 rounded-xl items-center shadow-lg shadow-orange-500/20"
                                onPress={handleSave}
                            >
                                <Text className="text-white font-bold text-lg">Portföyüme Ekle</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                className="mt-4 p-3"
                                onPress={() => setStep('search')}
                            >
                                <Text className="text-slate-400">Geri Dön</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
