import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInputInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AuthButton,
  BackButton,
  EMAIL_PATTERN,
  GoogleButton,
  OrDivider,
  PasswordToggle,
} from '../components/AuthParts';
import { FormField } from '../components/FormField';
import type { RootStackParamList } from '../navigation/types';
import { AuthError, logIn, type LogInInput } from '../services/auth';
import { useAuthStore } from '../store/useAuthStore';
import { colors, fonts, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

// Built from the Figma frame "Login Screen".
const FIELD_WIDTH = 313;
const BUTTON_WIDTH = 271;

export function LoginScreen({ navigation }: Props) {
  const setUser = useAuthStore((s) => s.setUser);
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LogInInput>({
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const user = await logIn({ ...values, email: values.email.trim() });
      setUser(user);
      navigation.navigate('Tabs', { screen: 'Profile' });
    } catch (error) {
      setError('root', {
        message:
          error instanceof AuthError
            ? error.message
            : 'Something went wrong. Please try again.',
      });
    }
  });

  // TODO(firebase): sendPasswordResetEmail once Firebase Auth is connected.
  const showForgotPassword = () =>
    Alert.alert(
      'Coming soon',
      'Password reset isn’t set up yet. Ask the team to reset it for now.'
    );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Not in the Figma frame: added so there's a way out without logging in. */}
        <View style={styles.topBar}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View style={styles.intro}>
            <Image
              source={require('../../assets/nav-image.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <Text
              style={[typography.heading, styles.title]}
              accessibilityRole="header"
            >
              Welcome back
            </Text>
            <Text style={styles.subtitle}>
              Log in to keep tracking the best grocery prices near you.
            </Text>
          </View>

          <View style={styles.fields}>
            <Controller
              control={control}
              name="email"
              rules={{
                validate: (v) =>
                  EMAIL_PATTERN.test(v.trim()) ||
                  'Enter a valid email, like you@email.com.',
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField
                  label="Email"
                  icon="mail"
                  placeholder="you@email.com"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email?.message}
                  fieldStyle={styles.field}
                  labelStyle={styles.label}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="username"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              // Only "is it filled in?" here. Length rules belong to sign up,
              // and hinting at them on login helps people guessing passwords.
              rules={{ required: 'Enter your password.' }}
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField
                  ref={passwordRef}
                  label="Password"
                  icon="lock"
                  placeholder="••••••••"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                  fieldStyle={styles.field}
                  labelStyle={styles.label}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={() => onSubmit()}
                  right={
                    <PasswordToggle
                      shown={showPassword}
                      onToggle={() => setShowPassword((shown) => !shown)}
                    />
                  }
                />
              )}
            />

            <Pressable
              onPress={showForgotPassword}
              hitSlop={8}
              accessibilityRole="button"
              style={styles.forgot}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          </View>

          {errors.root?.message ? (
            <Text style={styles.formError} accessibilityLiveRegion="polite">
              {errors.root.message}
            </Text>
          ) : null}

          <AuthButton
            label="Log In"
            busyLabel="Logging in"
            busy={isSubmitting}
            onPress={onSubmit}
            style={styles.loginButton}
          />

          <OrDivider style={styles.divider} />

          <GoogleButton style={styles.googleButton} />

          <Pressable
            // replace, not navigate: switching between Log in and Sign up
            // shouldn't pile screens onto the back stack.
            onPress={() => navigation.replace('Signup')}
            hitSlop={8}
            accessibilityRole="link"
            style={styles.signupLink}
          >
            <Text style={styles.signupText}>
              Don’t have an account?{' '}
              <Text style={styles.signupBold}>Sign up</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  topBar: { paddingHorizontal: spacing.gutter, paddingVertical: spacing.sm },
  // flexGrow lets the "Sign up" link sit at the bottom on tall phones.
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.lg,
  },
  intro: { alignItems: 'center', marginTop: spacing.md },
  logo: { width: 41, height: 39 },
  title: { marginTop: spacing.sm, textAlign: 'center' },
  subtitle: {
    marginTop: 5,
    maxWidth: 345,
    fontFamily: fonts.headingRegular,
    fontSize: 15,
    color: '#787878',
    textAlign: 'center',
  },
  fields: {
    width: '100%',
    maxWidth: FIELD_WIDTH,
    alignSelf: 'center',
    marginTop: 42,
    gap: 18,
  },
  field: { height: 47, backgroundColor: colors.surface },
  label: { marginLeft: spacing.sm },
  forgot: { alignSelf: 'flex-end', marginTop: -9 }, // 9 below the field
  forgotText: {
    fontFamily: fonts.headingRegular,
    fontSize: 13,
    color: '#858080',
  },
  formError: {
    marginTop: spacing.md,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
  },
  loginButton: {
    width: '100%',
    maxWidth: BUTTON_WIDTH,
    alignSelf: 'center',
    marginTop: spacing.xl,
  },
  divider: {
    width: '100%',
    maxWidth: FIELD_WIDTH,
    alignSelf: 'center',
    marginTop: 22,
  },
  googleButton: {
    width: '100%',
    maxWidth: BUTTON_WIDTH,
    alignSelf: 'center',
    marginTop: 14,
  },
  signupLink: {
    marginTop: 'auto',
    paddingTop: spacing.xl,
    alignSelf: 'center',
  },
  signupText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#9E8B8B',
    textAlign: 'center',
  },
  signupBold: { fontFamily: fonts.heading, color: colors.text },
});
