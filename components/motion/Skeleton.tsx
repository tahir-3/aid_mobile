import React, { useEffect } from 'react';
import { View, ViewProps } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { EASE_IN_OUT } from '../../lib/motion';

type SkeletonProps = ViewProps & { className?: string };

/** Pulsing placeholder block. Pulse is disabled when the user prefers reduced motion. */
export function Skeleton({ className, style, ...rest }: SkeletonProps) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    if (reduced) {
      opacity.set(0.65);
      return;
    }

    opacity.set(withRepeat(withTiming(1, { duration: 900, easing: EASE_IN_OUT }), -1, true));

    return () => cancelAnimation(opacity);
  }, [opacity, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      className={`bg-slate-700/40 ${className ?? ''}`}
      style={[animatedStyle, style]}
      {...rest}
    />
  );
}

/** Card-shaped loading placeholder used by the list screens. */
export function ListSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <View className="px-4">
      {Array.from({ length: cards }).map((_, index) => (
        <View key={index} className="mb-4 rounded-3xl border border-white/5 bg-surface p-5">
          <View className="mb-4 flex-row justify-end">
            <View className="mr-4 flex-1 items-end gap-2">
              <Skeleton className="h-4 w-32 rounded-lg" />
              <Skeleton className="h-3 w-24 rounded-lg" />
            </View>
            <Skeleton className="h-12 w-12 rounded-2xl" />
          </View>
          <View className="flex-row items-end justify-between border-t border-white/5 pt-4">
            <View className="items-start gap-2">
              <Skeleton className="h-3 w-10 rounded" />
              <Skeleton className="h-6 w-20 rounded-xl" />
            </View>
            <View className="items-end gap-2">
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="h-4 w-12 rounded" />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
