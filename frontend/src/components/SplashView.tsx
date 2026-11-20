import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Animated, Image, StyleSheet } from 'react-native';

import { colors } from '../theme';

// Keep the logo up at least this long so it doesn't just flash by.
const MIN_VISIBLE_MS = 900;
const FADE_MS = 400;

type Props = {
  ready: boolean; // true once fonts (and anything else the app waits on) are loaded
  onFinish: () => void; // called after the fade-out ends
};

export function SplashView({ ready, onFinish }: Props) {
  const [opacity] = useState(() => new Animated.Value(1));
  const [minTimePassed, setMinTimePassed] = useState(false);
  const leaving = ready && minTimePassed;

  useEffect(() => {
    const timer = setTimeout(() => setMinTimePassed(true), MIN_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onFinish();
    });
  }, [leaving, opacity, onFinish]);

  return (
    <Animated.View
      style={[styles.container, { opacity }]}
      pointerEvents={leaving ? 'none' : 'auto'}
      // This view is on screen now, so the native splash can go.
      onLayout={() => SplashScreen.hide()}
    >
      <Image
        source={require('../../assets/logo-image.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="Grocery PricePal"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Same size as the logo in the Figma Splash Screen and in app.json.
  logo: { width: 227, height: 216 },
});
