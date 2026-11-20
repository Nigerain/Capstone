import { Feather } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../navigation/types';
import { useScanStore } from '../store/useScanStore';
import { colors, fonts, spacing } from '../theme';
import {
  frameToPhotoCrop,
  prepareScanImage,
  type Rect,
} from '../utils/scanImage';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanPrice'>;

// Built from the Figma frame "Submission (scan) Screen".
// Figma's frame is 332 x 202 inside a 393-wide screen, centered a bit above middle.
const FRAME_SIDE_INSET = 31;
const FRAME_ASPECT = 202 / 332;
const FRAME_CENTER_Y = 0.42; // fraction of the screen height

export function CameraScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const isFocused = useIsFocused();
  const setPhoto = useScanStore((s) => s.setPhoto);

  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const frame = getFrame(size.width, size.height);
  const close = () => navigation.popToTop();

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  const takePhoto = async () => {
    if (!cameraRef.current || !cameraReady || busy) return;
    setBusy(true);
    try {
      const picture = await cameraRef.current.takePictureAsync({
        quality: 0.9,
      });
      const photoSize = { width: picture.width, height: picture.height };
      // Send only what was inside the frame: better OCR, smaller upload.
      const crop = frame ? frameToPhotoCrop(frame, size, photoSize) : undefined;
      const image = await prepareScanImage(picture.uri, photoSize, crop);
      setPhoto({ ...image, source: 'camera' });
      setTorchOn(false);
      navigation.navigate('ScanProcessing');
    } catch {
      Alert.alert('Couldn’t take the photo', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const pickFromLibrary = async () => {
    if (busy) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setBusy(true);
    try {
      // No frame to crop to here, so just shrink it.
      const image = await prepareScanImage(asset.uri, {
        width: asset.width,
        height: asset.height,
      });
      setPhoto({ ...image, source: 'library' });
      navigation.navigate('ScanProcessing');
    } catch {
      Alert.alert('Couldn’t open that photo', 'Please try a different one.');
    } finally {
      setBusy(false);
    }
  };

  // Still checking the permission: show the plain dark background.
  if (!permission) return <View style={styles.screen} />;

  if (!permission.granted) {
    return (
      <PermissionPrompt
        canAskAgain={permission.canAskAgain}
        onAllow={requestPermission}
        onClose={close}
        onManual={() => navigation.navigate('ManualEntry')}
      />
    );
  }

  return (
    <View style={styles.screen} onLayout={handleLayout}>
      {/* Only run the camera while this screen is showing. */}
      {isFocused && (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torchOn}
          onCameraReady={() => setCameraReady(true)}
        />
      )}

      {frame && <ScanFrame frame={frame} />}

      <SafeAreaView
        style={styles.overlay}
        edges={['top', 'bottom']}
        pointerEvents="box-none"
      >
        <View style={styles.topBar}>
          <RoundButton icon="x" label="Close" onPress={close} />
          <Text style={styles.title} accessibilityRole="header">
            Scan Tag
          </Text>
          <RoundButton
            icon={torchOn ? 'zap-off' : 'zap'}
            label={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
            selected={torchOn}
            onPress={() => setTorchOn((on) => !on)}
          />
        </View>

        <View style={styles.bottomBar}>
          <Pressable
            onPress={pickFromLibrary}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Choose a photo from your library"
            style={({ pressed }) => [
              styles.galleryButton,
              pressed && styles.pressed,
            ]}
          >
            <Feather name="square" size={24} color={colors.onDark} />
          </Pressable>

          <Pressable
            onPress={takePhoto}
            disabled={!cameraReady || busy}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            accessibilityState={{ disabled: !cameraReady || busy, busy }}
            style={({ pressed }) => [
              styles.shutter,
              (pressed || !cameraReady) && styles.pressed,
            ]}
          >
            {busy && <ActivityIndicator color={colors.dark} />}
          </Pressable>

          {/* Balances the gallery button so the shutter stays centered. */}
          <View style={styles.bottomSpacer} />
        </View>
      </SafeAreaView>
    </View>
  );
}

// Where the frame sits on screen, in the same coordinates as the camera view.
function getFrame(screenWidth: number, screenHeight: number): Rect | null {
  if (!screenWidth || !screenHeight) return null;
  const width = Math.min(screenWidth - FRAME_SIDE_INSET * 2, 420);
  const height = width * FRAME_ASPECT;
  return {
    x: (screenWidth - width) / 2,
    y: screenHeight * FRAME_CENTER_Y - height / 2,
    width,
    height,
  };
}

const CORNER_ARM = 32;
const CORNER_STROKE = 3;
const EDGE_STROKE = 2;

// Yellow rounded corners joined by thin white edges, with the hint underneath.
function ScanFrame({ frame }: { frame: Rect }) {
  const { x, y, width, height } = frame;
  const edgeW = width - CORNER_ARM * 2;
  const edgeH = height - CORNER_ARM * 2;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.frame, { left: x, top: y, width, height }]}>
        <View style={[styles.corner, styles.topLeft]} />
        <View style={[styles.corner, styles.topRight]} />
        <View style={[styles.corner, styles.bottomLeft]} />
        <View style={[styles.corner, styles.bottomRight]} />

        <View
          style={[
            styles.edge,
            { top: 0, left: CORNER_ARM, width: edgeW, height: EDGE_STROKE },
          ]}
        />
        <View
          style={[
            styles.edge,
            { bottom: 0, left: CORNER_ARM, width: edgeW, height: EDGE_STROKE },
          ]}
        />
        <View
          style={[
            styles.edge,
            { left: 0, top: CORNER_ARM, height: edgeH, width: EDGE_STROKE },
          ]}
        />
        <View
          style={[
            styles.edge,
            { right: 0, top: CORNER_ARM, height: edgeH, width: EDGE_STROKE },
          ]}
        />
      </View>

      <Text style={[styles.hint, { top: y + height + spacing.md }]}>
        Align the price tag or receipt{'\n'}within the frame
      </Text>
    </View>
  );
}

function RoundButton({
  icon,
  label,
  selected,
  onPress,
}: {
  icon: 'x' | 'zap' | 'zap-off';
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      hitSlop={8}
      style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
    >
      <Feather
        name={icon}
        size={24}
        color={selected ? colors.scanFrame : colors.onDark}
      />
    </Pressable>
  );
}

function PermissionPrompt({
  canAskAgain,
  onAllow,
  onClose,
  onManual,
}: {
  canAskAgain: boolean;
  onAllow: () => void;
  onClose: () => void;
  onManual: () => void;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <RoundButton icon="x" label="Close" onPress={onClose} />
      </View>
      <View style={styles.permissionBody}>
        <Feather name="camera" size={40} color={colors.onDark} />
        <Text style={styles.permissionTitle}>Allow camera access</Text>
        <Text style={styles.permissionText}>
          {canAskAgain
            ? 'We use the camera to read price tags, so you don’t have to type them in.'
            : 'Camera access is turned off. You can turn it on for Grocery PricePal in Settings.'}
        </Text>
        <Pressable
          onPress={canAskAgain ? onAllow : () => Linking.openSettings()}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.permissionButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.permissionButtonText}>
            {canAskAgain ? 'Allow camera' : 'Open Settings'}
          </Text>
        </Pressable>
        <Pressable onPress={onManual} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.permissionLink}>Enter it manually instead</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const ROUND_SIZE = 47;
const CORNER_RADIUS = 10;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.camera },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 19,
    paddingTop: spacing.sm,
  },
  title: {
    fontFamily: fonts.headingSemibold,
    fontSize: 18,
    color: colors.scanTitle,
  },
  roundButton: {
    width: ROUND_SIZE,
    height: ROUND_SIZE,
    borderRadius: ROUND_SIZE / 2,
    backgroundColor: colors.cameraControl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: spacing.xl,
  },
  galleryButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(21, 19, 19, 0.3)', // Figma: #151313 at 30%
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.onDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSpacer: { width: 48 },
  frame: { position: 'absolute' },
  corner: {
    position: 'absolute',
    width: CORNER_ARM,
    height: CORNER_ARM,
    borderColor: colors.scanFrame,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_STROKE,
    borderLeftWidth: CORNER_STROKE,
    borderTopLeftRadius: CORNER_RADIUS,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_STROKE,
    borderRightWidth: CORNER_STROKE,
    borderTopRightRadius: CORNER_RADIUS,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_STROKE,
    borderLeftWidth: CORNER_STROKE,
    borderBottomLeftRadius: CORNER_RADIUS,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_STROKE,
    borderRightWidth: CORNER_STROKE,
    borderBottomRightRadius: CORNER_RADIUS,
  },
  edge: { position: 'absolute', backgroundColor: colors.onDark },
  hint: {
    position: 'absolute',
    left: 0,
    right: 0,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.onDark,
    textAlign: 'center',
  },
  permissionBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.gutter * 1.5,
    gap: spacing.md,
  },
  permissionTitle: {
    fontFamily: fonts.heading,
    fontSize: 22,
    color: colors.scanTitle,
    marginTop: spacing.sm,
  },
  permissionText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.border,
    textAlign: 'center',
  },
  permissionButton: {
    marginTop: spacing.md,
    backgroundColor: colors.onDark,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  permissionButtonText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 16,
    color: colors.dark,
  },
  permissionLink: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.onDark,
    textDecorationLine: 'underline',
    marginTop: spacing.xs,
  },
  pressed: { opacity: 0.6 },
});
