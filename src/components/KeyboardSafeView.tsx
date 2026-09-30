/**
 * Keeps typing fields above the on-screen keyboard.
 *
 * Android now draws apps edge to edge, so the window is no longer shrunk when the keyboard
 * opens ("adjustResize" has no effect) and fields at the bottom end up hidden behind it.
 * This view measures how much of itself the keyboard covers and adds that much bottom
 * padding; a ScrollView inside then shrinks and Android scrolls the focused field into view.
 * iOS uses the standard KeyboardAvoidingView.
 */
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleProp, View, ViewStyle } from 'react-native';

export function KeyboardSafeView({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const ref = useRef<View>(null);
  const [pad, setPad] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'ios') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      const keyboardTop = e.endCoordinates.screenY;
      ref.current?.measureInWindow((_x, y, _w, h) => {
        // Only the part of this view that is really under the keyboard.
        setPad(Math.max(0, Math.round(y + h - keyboardTop)));
      });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setPad(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView style={style} behavior="padding">
        {children}
      </KeyboardAvoidingView>
    );
  }
  return (
    <View ref={ref} style={[style, pad ? { paddingBottom: pad } : null]}>
      {children}
    </View>
  );
}
