import Animated, { Easing } from 'react-native-reanimated';
import { cssInterop } from 'nativewind';

/**
 * NativeWind only knows about the built-in React Native components.
 * Register Reanimated's wrappers so `className` keeps working on animated views.
 */
cssInterop(Animated.View, { className: 'style' });
cssInterop(Animated.Text, { className: 'style' });

/** Strong ease-out — the default for UI that enters or responds to a press. */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/** For elements moving from one place to another on screen. */
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

export const DURATION = {
  pressIn: 120,
  pressOut: 180,
  enter: 320,
  sheet: 320,
} as const;
