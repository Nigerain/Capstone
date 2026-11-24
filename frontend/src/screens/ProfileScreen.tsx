import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AuthButton } from '../components/AuthParts';
import { Screen } from '../components/Screen';
import { logOut } from '../services/auth';
import { useAuthStore } from '../store/useAuthStore';
import { spacing, typography } from '../theme';

// Show signed in user and log out
export const ProfileScreen = () => {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [busy, setBusy] = useState(false);

  const handleLogOut = async () => {
    setBusy(true);
    try {
      await logOut();
      setUser(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={typography.heading}>
        {user ? `Hi, ${user.firstName}` : 'Profile'}
      </Text>
      <Text style={typography.subtitle}>Coming soon</Text>
      {user ? (
        <AuthButton
          label="Log Out"
          busyLabel="Logging out"
          busy={busy}
          onPress={handleLogOut}
          style={styles.logOut}
        />
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  logOut: { marginTop: spacing.xl },
});
