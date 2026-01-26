import { Briefcase, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

import { createPortfolio } from '@/lib/portfolioService';

interface CreatePortfolioModalProps {
    visible: boolean;
    onClose: () => void;
    onCreated: () => void;
}

export default function CreatePortfolioModal({ visible, onClose, onCreated }: CreatePortfolioModalProps) {
    const [name, setName] = useState('');
    const [initialPrincipal, setInitialPrincipal] = useState('');
    const [loading, setLoading] = useState(false);

    // Type is hardcoded to 'BES' for now as requested, but UI can show it
    const [type, setType] = useState<'BES'>('BES');

    const handleCreate = async () => {
        if (!name.trim()) {
            alert('Lütfen portföy adı giriniz.');
            return;
        }

        try {
            setLoading(true);
            // Parse principal (handle Turkish comma)
            const principal = initialPrincipal ? parseFloat(initialPrincipal.replace(',', '.')) : 0;

            await createPortfolio(name, type, isNaN(principal) ? 0 : principal);

            // Success
            setName('');
            setInitialPrincipal('');
            onCreated();
            onClose();
        } catch (error: any) {
            console.error(error);
            alert('Portföy oluşturulurken hata: ' + error.message);
        } finally {
            setLoading(false);
        }
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
                    <View className="flex-row justify-between items-center mb-8">
                        <Text className="text-white text-xl font-bold">Yeni Portföy Oluştur</Text>
                        <TouchableOpacity onPress={onClose} className="p-2 bg-slate-800 rounded-full">
                            <X size={20} color="white" />
                        </TouchableOpacity>
                    </View>

                    <View className="gap-6">
                        {/* Name Input */}
                        <View>
                            <Text className="text-slate-400 text-sm font-medium mb-2">Portföy Adı</Text>
                            <View className="bg-slate-800 rounded-xl flex-row items-center px-4 py-4 border border-white/10">
                                <Briefcase size={20} color="#94a3b8" />
                                <TextInput
                                    className="flex-1 ml-3 text-white font-medium"
                                    placeholder="Örn: Oğlumun BES'i"
                                    placeholderTextColor="#64748b"
                                    value={name}
                                    onChangeText={setName}
                                    autoFocus
                                />
                            </View>
                        </View>

                        {/* Type Selection (Read Only for now) */}
                        <View>
                            <Text className="text-slate-400 text-sm font-medium mb-2">Portföy Tipi</Text>
                            <View className="bg-slate-800 rounded-xl px-4 py-4 border border-white/10 opacity-80">
                                <Text className="text-white font-bold">Bireysel Emeklilik (BES)</Text>
                            </View>
                            <Text className="text-slate-600 text-xs mt-1">Şimdilik sadece BES portföyleri desteklenmektedir.</Text>
                        </View>

                        {/* Principal Input */}
                        <View>
                            <Text className="text-slate-400 text-sm font-medium mb-2">Başlangıç Yatırımı (Maliyet)</Text>
                            <View className="bg-slate-800 rounded-xl flex-row items-center px-4 py-4 border border-white/10">
                                <Text className="text-slate-400 font-bold text-lg">₺</Text>
                                <TextInput
                                    className="flex-1 ml-3 text-white font-medium"
                                    placeholder="0,00"
                                    placeholderTextColor="#64748b"
                                    keyboardType="decimal-pad"
                                    value={initialPrincipal}
                                    onChangeText={setInitialPrincipal}
                                />
                            </View>
                            <Text className="text-slate-500 text-xs mt-1">
                                Şu ana kadar cebinizden çıkan toplam net parayı girebilirsiniz. Kâr/Zarar hesabı için kullanılır.
                            </Text>
                        </View>

                        {/* Submit Button */}
                        <TouchableOpacity
                            className={`mt-4 bg-[#F97316] py-4 rounded-xl items-center shadow-lg shadow-orange-500/20 ${loading ? 'opacity-70' : ''}`}
                            onPress={handleCreate}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className="text-white font-bold text-lg">Oluştur</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
