import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../navigation/types';
import {
  problemForError,
  problemForResult,
  scanPriceTag,
} from '../services/scanService';
import { useScanStore } from '../store/useScanStore';
import { colors, fonts, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanProcessing'>;

// Built from the Figma frame "Scan – Processing".
// Sends the photo for OCR, then replaces itself with the next screen, so the
// back gesture from there skips this spinner and lands on the camera.
export function ScanProcessingScreen({ navigation }: Props) {
  const photo = useScanStore((s) => s.photo);
  const setResult = useScanStore((s) => s.setResult);

  useEffect(() => {
    if (!photo) {
      navigation.goBack();
      return;
    }

    const controller = new AbortController();

    scanPriceTag(photo, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setResult(result);
        const problem = problemForResult(result);
        if (problem) navigation.replace('ScanProblem', { problem });
        else navigation.replace('ScanConfirm');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setResult(null);
        navigation.replace('ScanProblem', { problem: problemForError(error) });
      });

    // Leaving this screen (Cancel, X, back gesture) stops the request.
    return () => controller.abort();
  }, [photo, navigation, setResult]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => navigation.popToTop()}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          style={({ pressed }) => [
            styles.roundButton,
            pressed && styles.pressed,
          ]}
        >
          <Feather name="x" size={24} color={colors.onDark} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Reading Tag
        </Text>
        <View style={styles.roundSpacer} />
      </View>

      <View style={styles.body}>
        <View style={styles.photoFrame}>
          {photo && (
            <Image
              source={{ uri: photo.uri }}
              style={styles.photo}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          )}
          <View style={styles.dim} />
          <Corner style={styles.topLeft} />
          <Corner style={styles.topRight} />
          <Corner style={styles.bottomLeft} />
          <Corner style={styles.bottomRight} />
        </View>

        <Spinner />
        <Text style={styles.status} accessibilityLiveRegion="polite">
          Reading price tag…
        </Text>
        <Text style={styles.detail}>Finding the price, item and size</Text>
      </View>

      <Pressable
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Cancel and go back to the camera"
        hitSlop={12}
        style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </SafeAreaView>
  );
}

// Yellow arc spinning on a faint ring, like the Figma spinner.
function Spinner() {
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.spinner} accessibilityRole="progressbar">
      <View style={styles.spinnerTrack} />
      <Animated.View style={[styles.spinnerArc, { transform: [{ rotate }] }]} />
    </View>
  );
}

function Corner({ style }: { style: object }) {
  return <View style={[styles.corner, style]} pointerEvents="none" />;
}

const ROUND_SIZE = 47;
const SPINNER_SIZE = 40;
const CORNER_ARM = 34;
const CORNER_STROKE = 3;
const CORNER_OFFSET = -CORNER_STROKE - 1; // corners sit just outside the photo

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.camera },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 19,
    paddingTop: spacing.sm,
  },
  roundButton: {
    width: ROUND_SIZE,
    height: ROUND_SIZE,
    borderRadius: ROUND_SIZE / 2,
    backgroundColor: colors.cameraControl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundSpacer: { width: ROUND_SIZE },
  title: {
    fontFamily: fonts.headingSemibold,
    fontSize: 18,
    color: colors.scanTitle,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  photoFrame: {
    width: '100%',
    maxWidth: 420,
    aspectRatio: 331 / 202,
    borderRadius: 16,
    backgroundColor: '#8F8780', // Figma placeholder behind the photo
  },
  photo: { ...StyleSheet.absoluteFill, borderRadius: 16 },
  // Figma: black at 35% over the photo while it's being read.
  dim: {
    ...StyleSheet.absoluteFill,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  corner: {
    position: 'absolute',
    width: CORNER_ARM,
    height: CORNER_ARM,
    borderColor: colors.scanFrame,
  },
  topLeft: {
    top: CORNER_OFFSET,
    left: CORNER_OFFSET,
    borderTopWidth: CORNER_STROKE,
    borderLeftWidth: CORNER_STROKE,
    borderTopLeftRadius: 16,
  },
  topRight: {
    top: CORNER_OFFSET,
    right: CORNER_OFFSET,
    borderTopWidth: CORNER_STROKE,
    borderRightWidth: CORNER_STROKE,
    borderTopRightRadius: 16,
  },
  bottomLeft: {
    bottom: CORNER_OFFSET,
    left: CORNER_OFFSET,
    borderBottomWidth: CORNER_STROKE,
    borderLeftWidth: CORNER_STROKE,
    borderBottomLeftRadius: 16,
  },
  bottomRight: {
    bottom: CORNER_OFFSET,
    right: CORNER_OFFSET,
    borderBottomWidth: CORNER_STROKE,
    borderRightWidth: CORNER_STROKE,
    borderBottomRightRadius: 16,
  },
  spinner: {
    width: SPINNER_SIZE,
    height: SPINNER_SIZE,
    marginTop: 23,
  },
  spinnerTrack: {
    ...StyleSheet.absoluteFill,
    borderRadius: SPINNER_SIZE / 2,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  spinnerArc: {
    ...StyleSheet.absoluteFill,
    borderRadius: SPINNER_SIZE / 2,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: colors.scanFrame,
    borderRightColor: colors.scanFrame,
  },
  status: {
    fontFamily: fonts.bodySemibold,
    fontSize: 17,
    color: colors.onDark,
    marginTop: spacing.md,
  },
  detail: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.onDarkMuted,
    marginTop: 6,
  },
  cancel: {
    alignSelf: 'center',
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  cancelText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 15,
    color: colors.onDark,
  },
  pressed: { opacity: 0.6 },
});
