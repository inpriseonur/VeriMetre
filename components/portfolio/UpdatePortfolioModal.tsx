import { Banknote, Save, X } from 'lucide-react-native';
import React, { useState } from 'react';
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

import { Portfolio, PortfolioItem, addPortfolioTransaction, upsertPortfolioItem } from '@/lib/portfolioService';

interface UpdatePortfolioModalProps {
    visible: boolean;
    onClose: () => void;
    onUpdated: () => void;
    portfolio: Portfolio;
    currentItems: PortfolioItem[];
}

export default function UpdatePortfolioModal({ visible, onClose, onUpdated, portfolio, currentItems }: UpdatePortfolioModalProps) {
    const [activeTab, setActiveTab] = useState<'CASH' | 'ASSETS'>('CASH');
    const [loading, setLoading] = useState(false);

    // Cash Flow State
    const [cashAmount, setCashAmount] = useState('');

    // Assets State (Local Map: fundCode -> newQuantity)
    // Initialize with current quantities
    // Using a simple state to track changes? 
    // Or just let user tap on an item to edit it?
    // Let's implement "Edit Item" list style.

    // For MVP Rebalance: Simplify. 
    // User sees list, taps item -> Changes Quantity -> Saved immediately or Bulk?
    // User flow says: "Varlık Güncellemesi: Mevcut fonlar listelenir, kullanıcı adetlerini güncelleyebilir"
    // Let's do instant update for simplicity or a list with inputs. List with inputs is dangerous for long lists.
    // Let's do: List, tap to "Edit Quantity" modal/view.

    const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
    const [editQuantity, setEditQuantity] = useState('');

    const handleCashTransaction = async () => {
        if (!cashAmount) return;
        const amount = parseFloat(cashAmount.replace(',', '.'));
        if (isNaN(amount) || amount <= 0) {
            alert("Geçerli bir tutar giriniz.");
            return;
        }

        setLoading(true);
        try {
            await addPortfolioTransaction(portfolio.id, 'DEPOSIT', amount);
            setCashAmount('');
            alert('Nakit girişi kaydedildi.');
            onUpdated();
        } catch (e: any) {
            console.error(e);
            alert('Hata: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAssetUpdate = async () => {
        if (!editingItem) return;
        const qty = parseFloat(editQuantity.replace(',', '.'));
        if (isNaN(qty) || qty < 0) {
            alert("Geçerli bir adet giriniz.");
            return;
        }

        setLoading(true);
        try {
            await upsertPortfolioItem(portfolio.id, editingItem.fund_code, qty);
            setEditingItem(null);
            setEditQuantity('');
            onUpdated(); // Refresh list to see new value
        } catch (e: any) {
            console.error(e);
            alert('Hata: ' + e.message);
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
                <View className="flex-1 pt-5 px-5">
                    {/* Header */}
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-white text-xl font-bold">Portföy Güncelle</Text>
                        <TouchableOpacity onPress={onClose} className="p-2 bg-slate-800 rounded-full">
                            <X size={20} color="white" />
                        </TouchableOpacity>
                    </View>

                    {/* Tabs */}
                    <View className="flex-row bg-slate-800 p-1 rounded-xl mb-6">
                        <TouchableOpacity
                            onPress={() => setActiveTab('CASH')}
                            className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'CASH' ? 'bg-[#151C2F]' : ''}`}
                        >
                            <Text className={`font-bold ${activeTab === 'CASH' ? 'text-white' : 'text-slate-400'}`}>Nakit Girişi</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setActiveTab('ASSETS')}
                            className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'ASSETS' ? 'bg-[#151C2F]' : ''}`}
                        >
                            <Text className={`font-bold ${activeTab === 'ASSETS' ? 'text-white' : 'text-slate-400'}`}>Varlık Düzenle</Text>
                        </TouchableOpacity>
                    </View>

                    {activeTab === 'CASH' ? (
                        <View className="flex-1">
                            <View className="bg-slate-800/50 p-5 rounded-2xl border border-white/10 mb-4">
                                <Text className="text-slate-400 text-sm mb-2">Bu ay ne kadar ödeme yaptınız?</Text>
                                <View className="flex-row items-center gap-2 mb-4">
                                    <Text className="text-white text-3xl font-bold">₺</Text>
                                    <TextInput
                                        className="flex-1 text-white text-3xl font-bold"
                                        placeholder="0,00"
                                        placeholderTextColor="#475569"
                                        keyboardType="decimal-pad"
                                        value={cashAmount}
                                        onChangeText={setCashAmount}
                                        autoFocus
                                    />
                                </View>
                                <Text className="text-slate-500 text-xs">
                                    Bu tutar 'Toplam Yatırılan' maliyetinize eklenecektir. Varlık adetlerini 'Varlık Düzenle' sekmesinden güncelleyebilirsiniz.
                                </Text>
                            </View>

                            <TouchableOpacity
                                className={`bg-[#F97316] py-3 rounded-xl items-center flex-row justify-center gap-2 ${loading ? 'opacity-70' : ''}`}
                                onPress={handleCashTransaction}
                                disabled={loading}
                            >
                                {loading ? <ActivityIndicator color="white" /> : (
                                    <>
                                        <Banknote size={20} color="white" />
                                        <Text className="text-white font-bold">Nakit Girişi Kaydet</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View className="flex-1">
                            {/* If Editing an Item */}
                            {editingItem ? (
                                <View className="bg-slate-800 p-5 rounded-2xl border border-white/10">
                                    <Text className="text-white font-bold text-lg mb-1">{editingItem.fund_code}</Text>
                                    <Text className="text-slate-400 text-sm mb-4">{editingItem.fund_definitions?.title}</Text>

                                    <Text className="text-slate-400 text-xs mb-2">Güncel Adet</Text>
                                    <TextInput
                                        className="bg-[#0B1121] text-white p-4 rounded-xl border border-white/10 font-bold text-lg mb-4"
                                        keyboardType="decimal-pad"
                                        value={editQuantity}
                                        onChangeText={setEditQuantity}
                                        autoFocus
                                    />

                                    <View className="flex-row gap-3">
                                        <TouchableOpacity
                                            className="flex-1 bg-slate-700 py-3 rounded-xl items-center"
                                            onPress={() => setEditingItem(null)}
                                        >
                                            <Text className="text-white font-bold">İptal</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            className="flex-1 bg-blue-600 py-3 rounded-xl items-center"
                                            onPress={handleAssetUpdate}
                                            disabled={loading}
                                        >
                                            {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Kaydet</Text>}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <ScrollView className="flex-1">
                                    <Text className="text-slate-400 text-xs mb-2">Adetini güncellemek istediğiniz fonu seçin:</Text>
                                    {currentItems.map(item => (
                                        <TouchableOpacity
                                            key={item.id}
                                            className="bg-[#151C2F] mb-3 p-4 rounded-xl border border-white/5 flex-row justify-between items-center"
                                            onPress={() => {
                                                setEditingItem(item);
                                                setEditQuantity(item.quantity.toString());
                                            }}
                                        >
                                            <View>
                                                <Text className="text-white font-bold">{item.fund_code}</Text>
                                                <Text className="text-slate-400 text-xs">{item.quantity.toLocaleString('tr-TR')} Adet</Text>
                                            </View>
                                            <View className="bg-slate-800 p-2 rounded-lg">
                                                <Save size={16} color="#3b82f6" />
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            )}
                        </View>
                    )}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
