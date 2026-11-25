import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SecondaryButton } from '../components/SecondaryButton';
import { SettingsRow } from '../components/SettingsRow';
import { TrustScoreCard } from '../components/TrustScoreCard';
import { useHideTabBarOnScroll } from '../hooks/useHideTabBarOnScroll';
import { logOut, type AuthUser } from '../services/auth';
import { useAuthStore } from '../store/useAuthStore';
import { colors, fonts, spacing } from '../theme';

// TODO: the team's support email. Left empty, the email app opens with
// only the subject filled in, and they choose who to send it to.
const SUPPORT_EMAIL = '';

// "JG" from Jordan Garcia; just "J" if there's no last name.
function initials(user: AuthUser) {
  return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
}

// "Oct 2026" from an ISO date.
function monthYear(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

// Built from the Figma frame "Profile Tab – v2". Only reachable when signed in:
// the Profile tab opens Sign up for signed-out users (see TabNavigator).
export function ProfileScreen() {
  const navigation = useNavigation();
  const tabBarHeight = useBottomTabBarHeight();
  const hideTabBarOnScroll = useHideTabBarOnScroll();

  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [loggingOut, setLoggingOut] = useState(false);

  // Shown for a moment after logging out, before Home opens.
  if (!user) return <View style={styles.screen} />;

  const handleLogOut = async () => {
    setLoggingOut(true);
    try {
      await logOut();
      // With Firebase, App.tsx's watcher also clears the user; mock mode needs this.
      setUser(null);
      navigation.navigate('Tabs', { screen: 'Home' });
    } catch {
      Alert.alert('Couldn’t log out', 'Please try again.');
    } finally {
      setLoggingOut(false);
    }
  };

  const confirmLogOut = () =>
    Alert.alert('Log out?', 'You’ll need to log in again to add prices.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: handleLogOut },
    ]);

  const openHelp = async () => {
    const subject = encodeURIComponent('Grocery PricePal help & feedback');
    try {
      await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`);
    } catch {
      // No email app set up, e.g. on a simulator.
      Alert.alert(
        'No email app found',
        'Set up an email app on this phone to send us feedback.'
      );
    }
  };

  const fullName = `${user.firstName} ${user.lastName}`.trim();

  return (
    <ScrollView
      style={styles.screen}
      // Extra bottom space so Log out isn't hidden behind the tab bar.
      contentContainerStyle={[
        styles.content,
        { paddingBottom: tabBarHeight + spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
      {...hideTabBarOnScroll}
    >
      <View style={styles.header}>
        <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no">
          <Text style={styles.avatarText}>{initials(user)}</Text>
        </View>
        <Text style={styles.name} accessibilityRole="header">
          {fullName}
        </Text>
        {user.memberSince ? (
          <Text style={styles.memberSince}>
            Member since {monthYear(user.memberSince)}
          </Text>
        ) : null}
      </View>

      <TrustScoreCard />

      <View style={styles.settings}>
        <SettingsRow icon="help-circle" label="Help & feedback" onPress={openHelp} />
      </View>

      <SecondaryButton
        label="Log out"
        busy={loggingOut}
        busyLabel="Logging out"
        onPress={confirmLogOut}
      />
    </ScrollView>
  );
}

const AVATAR_SIZE = 72;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.lg,
    gap: 14,
  },
  header: { alignItems: 'center', gap: 6 },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.positive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.headingSemibold,
    fontSize: 28,
    color: colors.onDark,
  },
  name: {
    fontFamily: fonts.headingSemibold,
    fontSize: 22,
    color: colors.darkButton,
    textAlign: 'center',
  },
  memberSince: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  settings: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.pickerRowBorder,
    backgroundColor: colors.pickerRow,
    overflow: 'hidden', // keeps the pressed-row color inside the rounded corners
  },
});
