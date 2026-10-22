import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInput,
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
import { AuthError, signUp, type SignUpInput } from '../services/auth';
import { useAuthStore } from '../store/useAuthStore';
import { colors, fonts, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

// Built from the Figma frame "Signup Screen".
const CONTENT_WIDTH = 312;
const MIN_PASSWORD = 8;

export function SignupScreen({ navigation }: Props) {
  const setUser = useAuthStore((s) => s.setUser);
  const [showPassword, setShowPassword] = useState(false);

  // Lets "next" on the keyboard jump to the following field.
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    defaultValues: { firstName: '', lastName: '', email: '', password: '' },
    mode: 'onTouched', // check a field when the user leaves it, then as they fix it
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const user = await signUp({
        ...values,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
      });
      setUser(user);
      // Back to the tabs, on the Profile tab they were trying to open.
      navigation.navigate('Tabs', { screen: 'Profile' });
    } catch (error) {
      const message =
        error instanceof AuthError
          ? error.message
          : 'Something went wrong. Please try again.';
      if (error instanceof AuthError && error.field) {
        setError(error.field, { message }, { shouldFocus: true });
      } else {
        setError('root', { message });
      }
    }
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View style={styles.content}>
            <View style={styles.intro}>
              <Text style={typography.heading} accessibilityRole="header">
                Create your account
              </Text>
              <Text style={styles.subtitle}>
                Start comparing grocery prices near you in seconds.
              </Text>
            </View>

            <View style={styles.fields}>
              <Controller
                control={control}
                name="firstName"
                rules={{
                  validate: (v) =>
                    v.trim().length > 0 || 'Enter your first name.',
                }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormField
                    label="First name"
                    icon="user"
                    placeholder="Jordan"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.firstName?.message}
                    autoCapitalize="words"
                    autoComplete="given-name"
                    textContentType="givenName"
                    returnKeyType="next"
                    submitBehavior="submit"
                    onSubmitEditing={() => lastNameRef.current?.focus()}
                  />
                )}
              />

              <Controller
                control={control}
                name="lastName"
                rules={{
                  validate: (v) =>
                    v.trim().length > 0 || 'Enter your last name.',
                }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormField
                    ref={lastNameRef}
                    label="Last name"
                    icon="user"
                    placeholder="Smith"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.lastName?.message}
                    autoCapitalize="words"
                    autoComplete="family-name"
                    textContentType="familyName"
                    returnKeyType="next"
                    submitBehavior="submit"
                    onSubmitEditing={() => emailRef.current?.focus()}
                  />
                )}
              />

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
                    ref={emailRef}
                    label="Email"
                    icon="mail"
                    placeholder="you@email.com"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.email?.message}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="next"
                    submitBehavior="submit"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                )}
              />

              <Controller
                control={control}
                name="password"
                rules={{
                  minLength: {
                    value: MIN_PASSWORD,
                    message: `Use at least ${MIN_PASSWORD} characters.`,
                  },
                  required: `Use at least ${MIN_PASSWORD} characters.`,
                }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormField
                    ref={passwordRef}
                    label="Password"
                    icon="lock"
                    placeholder={`At least ${MIN_PASSWORD} characters`}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.password?.message}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="done"
                    onSubmitEditing={onSubmit}
                    right={
                      <PasswordToggle
                        shown={showPassword}
                        onToggle={() => setShowPassword((shown) => !shown)}
                      />
                    }
                  />
                )}
              />
            </View>

            <Text style={styles.terms}>
              By continuing you agree to our{' '}
              <Text style={styles.termsLink}>Terms</Text> and{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text>.
            </Text>

            {errors.root?.message ? (
              <Text style={styles.formError} accessibilityLiveRegion="polite">
                {errors.root.message}
              </Text>
            ) : null}

            <AuthButton
              label="Create Account"
              busyLabel="Creating account"
              busy={isSubmitting}
              onPress={onSubmit}
              style={styles.primaryButton}
            />

            <OrDivider style={styles.divider} />

            <GoogleButton />
          </View>

          <Pressable
            // replace, not navigate: switching between Sign up and Log in
            // shouldn't pile screens onto the back stack.
            onPress={() => navigation.replace('Login')}
            hitSlop={8}
            accessibilityRole="link"
            style={styles.loginLink}
          >
            <Text style={styles.loginText}>
              Already have an account?{' '}
              <Text style={styles.loginBold}>Log in</Text>
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
  // flexGrow lets the "Log in" link sit at the bottom on tall phones.
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.lg,
  },
  content: {
    width: '100%',
    maxWidth: CONTENT_WIDTH,
    alignSelf: 'center',
    marginTop: 29, // 37 below the back button in the design
  },
  intro: { gap: 7 },
  subtitle: {
    fontFamily: fonts.headingRegular,
    fontSize: 15,
    color: '#5B5555',
  },
  fields: { marginTop: 21, gap: 14 },
  terms: {
    marginTop: 10,
    fontFamily: fonts.headingRegular,
    fontSize: 12,
    color: '#737070',
  },
  termsLink: {
    fontFamily: fonts.heading,
    color: colors.text,
    textDecorationLine: 'underline',
  },
  formError: {
    marginTop: spacing.md,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
  },
  primaryButton: { marginTop: 9 },
  divider: { marginVertical: spacing.sm },
  loginLink: { marginTop: 'auto', paddingTop: spacing.xl, alignSelf: 'center' },
  loginText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#9E8B8B',
    textAlign: 'center',
  },
  loginBold: { fontFamily: fonts.bodyBold, color: colors.text },
});
