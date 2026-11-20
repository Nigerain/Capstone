import { useAuthStore } from '../store/useAuthStore';
import { PlaceholderScreen } from './PlaceholderScreen';

// TEMPORARY: greets the signed-in user until the real Profile screen is built.
export const ProfileScreen = () => {
  const user = useAuthStore((s) => s.user);
  return (
    <PlaceholderScreen title={user ? `Hi, ${user.firstName}` : 'Profile'} />
  );
};
