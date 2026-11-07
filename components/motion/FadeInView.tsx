import React from 'react';
import { View, ViewProps } from 'react-native';
import Animated, { FadeIn, FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { DURATION } from '../../lib/motion';

type FadeInViewProps = ViewProps & {
  className?: string;
  /** Delay before the entrance starts, in ms. */
  delay?: number;
  duration?: number;
  /** Vertical distance the content travels while fading in. */
  distance?: number;
  /** Only animate opacity (use for containers and content that should not move). */
  fadeOnly?: boolean;
};

/** Fades content in on mount. Layout animation runs on the UI thread. */
export function FadeInView({
  className,
  delay = 0,
  duration = DURATION.enter,
  distance = 12,
  fadeOnly = false,
  children,
  style,
  ...rest
}: FadeInViewProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <View className={className} style={style} {...rest}>
        {children}
      </View>
    );
  }

  const entering = fadeOnly
    ? FadeIn.duration(duration).delay(delay)
    : FadeInUp.duration(duration)
        .delay(delay)
        .withInitialValues({ transform: [{ translateY: distance }] });

  return (
    <Animated.View entering={entering} className={className} style={style} {...rest}>
      {children}
    </Animated.View>
  );
}
