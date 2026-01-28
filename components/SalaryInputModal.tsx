import { upsertUserSalary } from '@/lib/marketService';
import { useAuth } from '@/providers/AuthProvider';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface SalaryInputModalProps {
    visible: boolean;
    onClose: () => void;
    currentSalary?: number;
    onSuccess: (data: { amount: number, validFrom: string }) => void;
    isPremium: boolean;
    hasHistory: boolean;
    lastSalaryDate?: string;
}

const MONTHS = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

export const SalaryInputModal: React.FC<SalaryInputModalProps> = ({
    visible,
    onClose,
    currentSalary,
    onSuccess,
    isPremium,
    hasHistory,
    lastSalaryDate
}) => {
    const { user, isGuest } = useAuth();
    const [amount, setAmount] = useState(currentSalary?.toString() || '');
    // Default to Jan 1st of Current Year or last salary date if available
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset or pre-fill amount when modal opens or currentSalary changes
    React.useEffect(() => {
        if (visible) {
            setAmount(currentSalary?.toString() || '');

            // Date Logic:
            // If editing existing (hasHistory), set to lastSalaryDate
            // If new (no history), set to today or default
            if (lastSalaryDate) {
                setSelectedDate(new Date(lastSalaryDate));
            } else {
                setSelectedDate(new Date(new Date().getFullYear(), 0, 1));
            }

            setShowDatePicker(false);
            setError(null);
        }
    }, [visible, currentSalary, lastSalaryDate]);

    const handleDatePress = () => {
        // Free User Rule: Cannot change date if history exists (must settle for update only)
        if (!isPremium && hasHistory) {
            Alert.alert(
                "Premium Özellik",
                "Mevcut paketinizde sadece son maaş girişinizi düzenleyebilirsiniz. Yeni bir dönem için maaş eklemek isterseniz Premium'a geçmelisiniz.",
                [{ text: "Tamam" }]
            );
            return;
        }
        setShowDatePicker(!showDatePicker);
    };

    const handleSubmit = async () => {
        if (!amount || isNaN(Number(amount))) {
            setError('Lütfen geçerli bir tutar giriniz.');
            return;
        }

        const numericAmount = parseFloat(amount);
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate.getDate()).padStart(2, '0');
        const validFrom = `${year}-${month}-${day}`;

        // Date Validations for Premium / New Entries
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Ignore time

        const selectedTime = new Date(selectedDate);
        selectedTime.setHours(0, 0, 0, 0);

        if (selectedTime > today) {
            setError('İleri tarihli maaş girişi yapılamaz.');
            return;
        }

        if (lastSalaryDate) {
            const lastDate = new Date(lastSalaryDate);
            lastDate.setHours(0, 0, 0, 0);

            // If not Premium, strict update check is mostly handled by UI blocking, but safety check:
            if (!isPremium && selectedTime.getTime() !== lastDate.getTime()) {
                setError('Free pakette tarih değiştirilemez.');
                return;
            }

            // Premium Check: Cannot enter date OLDER than last salary (unless it IS the last salary date, which implies update)
            if (isPremium && selectedTime < lastDate) {
                setError('Bir önceki maaş tarihinden daha eski bir tarih girilemez.');
                return;
            }
        }

        const dataPayload = { amount: numericAmount, validFrom };

        // If Guest or Not Logged In, skip DB save and pass amount to parent for "Auth & Save" flow
        if (!user || isGuest) {
            onSuccess(dataPayload);
            onClose();
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { success, error: serviceError } = await upsertUserSalary(numericAmount, validFrom);

            if (!success) {
                throw serviceError || new Error('Kaydetme başarısız.');
            }

            onSuccess(dataPayload);
            onClose();
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Maaş kaydedilirken bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    const handleMonthSelect = (monthIndex: number) => {
        const newDate = new Date(selectedDate);
        newDate.setMonth(monthIndex);
        setSelectedDate(newDate);
    };

    const handleYearChange = (delta: number) => {
        const newDate = new Date(selectedDate);
        newDate.setFullYear(newDate.getFullYear() + delta);
        setSelectedDate(newDate);
    };

    const isDateLocked = !isPremium && hasHistory;

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-center items-center bg-black/50">
                <View className="bg-[#151C2F] w-[90%] p-6 rounded-2xl border border-slate-700">
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-white text-xl font-bold">Maaş Girişi</Text>
                        <TouchableOpacity onPress={onClose}>
                            <MaterialIcons name="close" size={24} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>

                    {error && (
                        <View className="bg-red-500/10 p-3 rounded-lg mb-4 border border-red-500/20">
                            <Text className="text-red-400 text-sm text-center">{error}</Text>
                        </View>
                    )}

                    <View className="mb-4">
                        <Text className="text-slate-400 text-sm mb-2 font-medium">Net Maaş Tutarı (TL)</Text>
                        <TextInput
                            className="bg-[#0B1121] text-white p-4 rounded-xl border border-slate-700 text-lg font-bold"
                            placeholder="0"
                            placeholderTextColor="#475569"
                            keyboardType="numeric"
                            value={amount}
                            onChangeText={setAmount}
                        />
                    </View>

                    <View className="mb-6">
                        <Text className="text-slate-400 text-sm mb-2 font-medium">Geçerlilik Başlangıcı</Text>
                        <TouchableOpacity
                            onPress={handleDatePress}
                            activeOpacity={isDateLocked ? 1 : 0.7}
                            className={`bg-[#0B1121] p-4 rounded-xl border border-slate-700 flex-row justify-between items-center ${isDateLocked ? 'opacity-70' : ''}`}
                        >
                            <Text className={`text-lg font-medium ${isDateLocked ? 'text-slate-500' : 'text-white'}`}>
                                {selectedDate.getDate()} {MONTHS[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                            </Text>
                            {isDateLocked ? (
                                <MaterialIcons name="lock" size={20} color="#64748b" />
                            ) : (
                                <MaterialIcons name="calendar-today" size={20} color="#94a3b8" />
                            )}
                        </TouchableOpacity>

                        {isDateLocked && (
                            <Text className="text-xs text-yellow-600/80 mt-2 ml-1">
                                * Free pakette tarih değiştirilemez. Yeni dönem eklemek için Premium'a geçin.
                            </Text>
                        )}

                        {showDatePicker && !isDateLocked && (
                            <View className="mt-2 bg-[#0B1121] rounded-xl border border-slate-700 p-2">
                                <View className="flex-row justify-between items-center bg-slate-800/50 p-2 rounded-lg mb-2">
                                    <TouchableOpacity onPress={() => handleYearChange(-1)} className="p-1">
                                        <MaterialIcons name="chevron-left" size={24} color="white" />
                                    </TouchableOpacity>
                                    <Text className="text-white font-bold text-lg">{selectedDate.getFullYear()}</Text>
                                    <TouchableOpacity onPress={() => handleYearChange(1)} className="p-1">
                                        <MaterialIcons name="chevron-right" size={24} color="white" />
                                    </TouchableOpacity>
                                </View>
                                <View className="flex-row flex-wrap justify-between">
                                    {MONTHS.map((m, index) => (
                                        <TouchableOpacity
                                            key={m}
                                            onPress={() => handleMonthSelect(index)}
                                            className={`w-[30%] p-2 rounded-lg mb-2 items-center ${selectedDate.getMonth() === index ? 'bg-blue-600' : 'bg-slate-800/30'}`}
                                        >
                                            <Text className={`text-xs ${selectedDate.getMonth() === index ? 'text-white font-bold' : 'text-slate-400'}`}>
                                                {m}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={loading}
                        className="bg-blue-600 p-4 rounded-xl items-center shadow-lg shadow-blue-900/20"
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white font-bold text-lg tracking-wide">
                                {isDateLocked ? 'Güncelle' : 'Kaydet'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};
