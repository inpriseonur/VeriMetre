import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';

interface SkeletonProps {
    width?: number | string;
    height?: number | string;
    borderRadius?: number;
    style?: StyleProp<ViewStyle>;
    color?: string;
    children?: React.ReactNode;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    width,
    height,
    borderRadius = 8,
    style,
    color = '#1e293b', // slate-800
    children
}) => {
    const opacity = useSharedValue(0.5);

    useEffect(() => {
        opacity.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 1000 }),
                withTiming(0.5, { duration: 1000 })
            ),
            -1,
            true // reverse
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const baseStyle: ViewStyle = {
        backgroundColor: children ? undefined : color,
        borderRadius: borderRadius,
        width: width as number | undefined,
        height: height as number | undefined,
    };

    return (
        <Animated.View style={[baseStyle, style, animatedStyle]}>
            {children}
        </Animated.View>
    );
};
