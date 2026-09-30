/**
 * BillScan splash in the OpsNest theme (design option B): navy gradient, BillScan icon
 * and name in the centre, "Scan · Check · Report", a teal→blue loading bar, and
 * "A product of OpsNest" with the OpsNest logo at the bottom.
 *
 * The native splash shows the same BillScan icon on the same navy colour, so when this
 * view takes over (and hides the native one) the icon stays still and the text fades in.
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { fonts } from '@/theme';
import logo from '../../assets/brand/opsnest-logo-512.png';
import tile from '../../assets/brand/billscan-tile-512.png';

export const OPSNEST = {
  navy: '#0B1B34',
  navyMid: '#0D2443',
  navyLow: '#0F344E',
  teal: '#19D3C5',
  blue: '#3B82F6',
  muted: '#8FA3BF',
} as const;


/** Minimum time the splash stays up, so it reads as a deliberate brand moment. */
const MIN_MS = 1400;
const LOGO = 120; // same visible size as the native splash image

export function BrandSplash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [fadeIn] = useState(() => new Animated.Value(0));
  const [progress] = useState(() => new Animated.Value(0));
  const [out] = useState(() => new Animated.Value(1));
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 450, delay: 120, useNativeDriver: true, easing: Easing.out(Easing.cubic) }).start();
    Animated.timing(progress, { toValue: 0.85, duration: MIN_MS, useNativeDriver: false, easing: Easing.out(Easing.quad) }).start();
    const t = setTimeout(() => setMinElapsed(true), MIN_MS);
    return () => clearTimeout(t);
  }, [fadeIn, progress]);

  useEffect(() => {
    if (!ready || !minElapsed) return;
    Animated.timing(progress, { toValue: 1, duration: 200, useNativeDriver: false }).start(() => {
      Animated.timing(out, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => onDone());
    });
  }, [ready, minElapsed, progress, out, onDone]);

  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const rise = fadeIn.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { opacity: out, zIndex: 100 }]}
      onLayout={() => SplashScreen.hideAsync().catch(() => {})}
      accessibilityLabel="BillScan by OpsNest is starting"
    >
      <LinearGradient colors={[OPSNEST.navy, OPSNEST.navyMid, OPSNEST.navyLow]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      {/* soft blue glow, top right (as on the OpsNest site) */}
      <View style={styles.glow} />

      {/* Same icon, size and position as the native splash, so the hand-over is seamless */}
      <View style={styles.center}>
        <Image source={tile} style={{ width: LOGO, height: LOGO }} contentFit="contain" />
      </View>

      <Animated.View style={[styles.below, { opacity: fadeIn, transform: [{ translateY: rise }] }]}>
        <Text style={styles.word}>
          Bill<Text style={{ color: OPSNEST.teal }}>Scan</Text>
        </Text>
        <View style={styles.pill}>
          <Text style={styles.pillText}>Scan · Check · Report</Text>
        </View>
        <View style={styles.track}>
          <Animated.View style={{ width: barWidth, height: '100%' }}>
            <LinearGradient colors={[OPSNEST.teal, OPSNEST.blue]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fill} />
          </Animated.View>
        </View>
      </Animated.View>

      <Animated.View style={[styles.bottom, { opacity: fadeIn }]}>
        <Text style={styles.productOf}>A PRODUCT OF</Text>
        <View style={styles.brandRow}>
          <Image source={logo} style={{ width: 28, height: 28 }} contentFit="contain" />
          <Text style={styles.brandWord}>
            Ops<Text style={{ color: OPSNEST.teal }}>Nest</Text>
          </Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    top: -140,
    right: -140,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: '#1B4A7E',
    opacity: 0.35,
  },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  below: { position: 'absolute', left: 0, right: 0, top: '50%', marginTop: LOGO / 2 + 20, alignItems: 'center' },
  word: { fontFamily: fonts.bold, fontSize: 36, color: '#FFFFFF', letterSpacing: -0.3 },
  pill: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(25,211,197,0.45)',
    backgroundColor: 'rgba(25,211,197,0.08)',
  },
  pillText: { fontFamily: fonts.bold, fontSize: 12, color: OPSNEST.teal },
  track: { width: 130, height: 4, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden', marginTop: 28 },
  fill: { flex: 1, borderRadius: 4 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 52, alignItems: 'center', gap: 8 },
  productOf: { fontFamily: fonts.medium, fontSize: 10, letterSpacing: 1.6, color: OPSNEST.muted },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandWord: { fontFamily: fonts.bold, fontSize: 19, color: '#FFFFFF' },
});
