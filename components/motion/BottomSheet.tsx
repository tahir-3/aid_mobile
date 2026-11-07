import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { DURATION, EASE_IN_OUT, EASE_OUT } from '../../lib/motion';

const CLOSE_MS = 300;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

/**
 * Bottom sheet with a spring entrance, a fading backdrop, and a drag handle.
 * Drag work stays on the UI thread; JS is only notified when the sheet closes.
 */
export function BottomSheet({ visible, onClose, children }: BottomSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);

  const translateY = useSharedValue(reduced ? 0 : windowHeight);
  const backdrop = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
      setMounted(true);
    }
  }, [visible]);

  useEffect(() => {
    if (!mounted) return;

    if (visible) {
      backdrop.set(withTiming(1, { duration: 200, easing: EASE_OUT }));
      translateY.set(reduced ? 0 : withSpring(0, { duration: DURATION.sheet, dampingRatio: 0.9 }));
      return;
    }

    backdrop.set(withTiming(0, { duration: 200, easing: EASE_OUT }));
    if (!reduced) {
      // Timing (not spring) keeps the dismiss duration predictable so the modal
      // never unmounts before the sheet has finished leaving the screen.
      translateY.set(withTiming(windowHeight, { duration: 260, easing: EASE_IN_OUT }));
    }
    closeTimer.current = setTimeout(() => setMounted(false), reduced ? 200 : CLOSE_MS);

    return () => {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    };
  }, [visible, mounted, reduced, windowHeight, backdrop, translateY]);

  // Keep the offscreen resting position in sync with rotation while closed,
  // otherwise the sheet can start its entrance from a stale height.
  useEffect(() => {
    if (!visible && !mounted) {
      translateY.set(reduced ? 0 : windowHeight);
    }
  }, [visible, mounted, reduced, windowHeight, translateY]);

  const pan = Gesture.Pan()
    .activeOffsetY(4)
    .onBegin(() => {
      dragStart.set(translateY.get());
    })
    .onUpdate((event) => {
      const next = dragStart.get() + event.translationY;
      // Rubber-band when the user pulls the sheet above its resting position.
      translateY.set(next < 0 ? next * 0.15 : next);
    })
    .onEnd((event) => {
      const shouldClose = translateY.get() > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY;

      if (shouldClose) {
        translateY.set(withTiming(windowHeight, { duration: 240, easing: EASE_IN_OUT }));
        scheduleOnRN(onClose);
      } else {
        translateY.set(
          withSpring(0, { duration: 300, dampingRatio: 0.85, velocity: event.velocityY })
        );
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.get() }));

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.fill}>
        <View style={styles.fill}>
          {/* Animated views ONLY animate (opacity / translateY). All colors live on
              plain Views inside them: lib/motion.ts wraps Animated.View with
              NativeWind's cssInterop, which (NativeWind 4.2 + Reanimated 4) drops
              non-animated style props → the sheet rendered transparent. */}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, backdropStyle]}>
            <View style={[StyleSheet.absoluteFill, styles.backdrop]} />
          </Animated.View>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <KeyboardAvoidingView
            pointerEvents="box-none"
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboard}>
            <Animated.View style={[styles.sheetFrame, sheetStyle]}>
              <View style={styles.sheet}>
                <GestureDetector gesture={pan}>
                  <View style={styles.handleArea}>
                    <View style={styles.handle} />
                  </View>
                </GestureDetector>
                {children}
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  keyboard: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  sheetFrame: { maxHeight: '90%' },
  handleArea: { paddingTop: 12, paddingBottom: 8 },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  sheet: {
    backgroundColor: '#090E14', // theme `background`
    overflow: 'hidden',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 32,
  },
});
