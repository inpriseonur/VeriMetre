
import { Platform, View } from 'react-native';

export default function TabBarBackground() {
    return (
        <View
            style={{
                flex: 1,
                backgroundColor: Platform.select({
                    ios: 'rgba(15, 23, 42, 0.8)', // Slate 900 with opacity
                    default: '#0F172A',
                })
            }}
        />
    );
}
