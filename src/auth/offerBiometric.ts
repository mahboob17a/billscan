import { Alert } from 'react-native';
import { setBiometricEnabled, wasBiometricOffered } from '@/lib/secureStorage';
import { biometricAvailable } from './AuthProvider';

/** First sign-in on this phone: offer quick unlock with fingerprint / face. */
export async function offerBiometric(setBiometric: (on: boolean) => Promise<string | null>) {
  if (!(await wasBiometricOffered()) && (await biometricAvailable())) {
    Alert.alert(
      'Unlock with fingerprint?',
      'Next time, open BillScan with your fingerprint or face instead of your password. The app also locks itself after 5 minutes in the background.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => setBiometricEnabled(false) },
        { text: 'Turn on', onPress: () => setBiometric(true) },
      ],
    );
  }
}
