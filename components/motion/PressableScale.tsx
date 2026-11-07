import React from 'react';
import {
  GestureResponderEvent,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { cssInterop } from 'nativewind';
import { DURATION, EASE_OUT } from '../../lib/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const StyledAnimatedPressable = cssInterop(AnimatedPressable, { className: 'style' });

export type PressableScaleProps = PressableProps & {
  className?: string;
  /** Final scale while pressed. Defaults to 0.97. */
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

/**
 * Pressable with press-in feedback. The scale runs on the UI thread, so it
 * stays responsive even while JS is busy (navigation, queries, sync).
 */
export function PressableScale({
  className,
  scaleTo = 0.97,
  style,
  children,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: PressableScaleProps) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.get();

    if (reduced) {
      return { opacity: 1 - p * 0.18 };
    }

    return { transform: [{ scale: 1 - p * (1 - scaleTo) }] };
  });

  const handlePressIn = (event: GestureResponderEvent) => {
    if (!disabled) {
      progress.set(withTiming(1, { duration: DURATION.pressIn, easing: EASE_OUT }));
    }
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    progress.set(withTiming(0, { duration: DURATION.pressOut, easing: EASE_OUT }));
    onPressOut?.(event);
  };

  return (
    <StyledAnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      className={className}
      style={[animatedStyle, style]}>
      {children}
    </StyledAnimatedPressable>
  );
}
