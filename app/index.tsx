import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Image, StatusBar, StyleSheet, Text } from 'react-native';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SplashScreen() {
    const router = useRouter();
    const opacity = useSharedValue(0);

    useEffect(() => {
        // Animation Sequence:
        // 1. Wait 200ms
        // 2. Fade In (1000ms)
        // 3. Wait 2000ms (Display)
        // 4. Fade Out (500ms)
        // 5. Navigate
        opacity.value = withSequence(
            withDelay(200, withTiming(1, { duration: 1000 })),
            withDelay(2000, withTiming(0, { duration: 500 }, (finished) => {
                if (finished) {
                    runOnJS(navigateToHome)();
                }
            }))
        );
    }, []);

    const navigateToHome = () => {
        router.replace('/(tabs)');
    };

    const animatedStyle = useAnimatedStyle(() => {
        return {
            opacity: opacity.value,
        };
    });

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0B1121" />

            <Animated.View style={[styles.content, animatedStyle]}>
                {/* Logo */}
                <Image
                    source={require('../assets/images/VeriMatik_Logo1.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />

                {/* Brand Name */}
                <Text style={styles.brandName}>VeriMatik</Text>

                {/* Slogan */}
                <Text style={styles.slogan}>Emlaktan Borsaya, Ekonominin Büyük Resmi.</Text>
            </Animated.View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0B1121',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    logo: {
        width: 150,
        height: 150,
        marginBottom: 20,
    },
    brandName: {
        color: 'white',
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 8,
        letterSpacing: 1,
    },
    slogan: {
        color: '#94A3B8', // slate-400
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: 0.5,
    },
});
