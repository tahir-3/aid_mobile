import React, { useEffect } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { DURATION, EASE_IN_OUT, EASE_OUT } from '../../lib/motion';

/**
 * Animated View that is NOT registered with NativeWind's cssInterop.
 *
 * lib/motion.ts registers `Animated.View` with cssInterop so `className` works on
 * it, but with NativeWind 4.2 + Reanimated 4 that wrapper can drop plain `style`
 * props (that is what made the bottom sheet transparent). Everything here passes
 * layout/colors through `style` on this component, or puts `className` on a plain
 * child View instead.
 */
export const PlainAnimatedView = Animated.createAnimatedComponent(View);

/** Items after this index mount without delay so long lists stay snappy. */
const STAGGER_LIMIT = 10;
const STAGGER_STEP = 45;

export const staggerDelay = (index: number, step = STAGGER_STEP) =>
  index < STAGGER_LIMIT ? index * step : 0;

type EnterProps = {
  children: React.ReactNode;
  /** Position in a list → staggered delay (first STAGGER_LIMIT items only). */
  index?: number;
  /** Extra delay in ms added before the stagger. */
  delay?: number;
  /** 'up' = fade + rise (default), 'fade' = opacity only. */
  variant?: 'up' | 'fade';
  style?: StyleProp<ViewStyle>;
};

/**
 * Entrance animation for one item (list row, card, form field).
 * Layout animations skip themselves when the OS "reduce motion" setting is on.
 */
export function EnterView({ children, index = 0, delay = 0, variant = 'up', style }: EnterProps) {
  const d = delay + staggerDelay(index);
  const entering =
    variant === 'fade'
      ? FadeIn.duration(DURATION.enter).delay(d)
      : FadeInDown.duration(DURATION.enter)
          .delay(d)
          .withInitialValues({ opacity: 0, transform: [{ translateY: 14 }] });

  return (
    <PlainAnimatedView entering={entering} style={style}>
      {children}
    </PlainAnimatedView>
  );
}

/** Wraps every direct child in an EnterView with an increasing delay (forms, sections). */
export function Stagger({
  children,
  delay = 0,
  step = STAGGER_STEP,
}: {
  children: React.ReactNode;
  delay?: number;
  step?: number;
}) {
  let i = 0;
  return (
    <>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        const d = delay + Math.min(i++, STAGGER_LIMIT) * step;
        return <EnterView delay={d}>{child}</EnterView>;
      })}
    </>
  );
}

/**
 * Waving hand: a few waves on mount, then a short wave every few seconds.
 * Static when "reduce motion" is on.
 */
export function WavingHand({ size = 28 }: { size?: number }) {
  const reduced = useReducedMotion();
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    const wave = withSequence(
      withTiming(18, { duration: 140, easing: EASE_OUT }),
      withTiming(-10, { duration: 140, easing: EASE_IN_OUT }),
      withTiming(18, { duration: 140, easing: EASE_IN_OUT }),
      withTiming(-6, { duration: 140, easing: EASE_IN_OUT }),
      withTiming(0, { duration: 160, easing: EASE_OUT })
    );
    rotation.set(
      withDelay(
        400,
        withRepeat(withSequence(wave, withDelay(3500, withTiming(0, { duration: 1 }))), -1)
      )
    );
    return () => cancelAnimation(rotation);
  }, [reduced, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    // Pivot near the wrist (bottom of the glyph).
    transform: [{ rotate: `${rotation.get()}deg` }],
    transformOrigin: '70% 90%',
  }));

  return (
    <PlainAnimatedView style={animatedStyle}>
      <Text style={{ fontSize: size }}>👋</Text>
    </PlainAnimatedView>
  );
}

/**
 * Animates a bar from 0 to `value` along one axis (charts).
 * `axis="height"` grows upward; `axis="scaleX"` fills from the right (RTL).
 */
export function GrowBar({
  value,
  axis,
  delay = 0,
  style,
  children,
}: {
  value: number;
  axis: 'height' | 'scaleX';
  delay?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? value : 0);

  useEffect(() => {
    progress.set(
      reduced ? value : withDelay(delay, withTiming(value, { duration: 650, easing: EASE_OUT }))
    );
  }, [value, delay, reduced, progress]);

  const animatedStyle = useAnimatedStyle(() =>
    axis === 'height'
      ? { height: progress.get() }
      : { transform: [{ scaleX: progress.get() }], transformOrigin: 'right' }
  );

  return <PlainAnimatedView style={[style, animatedStyle]}>{children}</PlainAnimatedView>;
}
