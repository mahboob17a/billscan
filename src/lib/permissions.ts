/**
 * Permissions BillScan uses, and their current state.
 *  - Camera: scanning bills. (The Android document scanner runs inside Google Play services,
 *    but asking up front makes the purpose clear and covers phones without it.)
 *  - Photos: choosing a bill photo already taken. Android 13+ uses the system photo picker,
 *    which needs no permission; older phones ask.
 *  - Files: none needed — BillScan stores its data inside the app, and you pick every file
 *    you share or restore yourself.
 */
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';

export type PermState = 'granted' | 'denied' | 'blocked' | 'undetermined' | 'not-needed';

function toState(p: { granted: boolean; canAskAgain: boolean; status: string }): PermState {
  if (p.granted) return 'granted';
  if (p.status === 'undetermined') return 'undetermined';
  return p.canAskAgain ? 'denied' : 'blocked';
}

export async function cameraState(): Promise<PermState> {
  try {
    return toState(await ImagePicker.getCameraPermissionsAsync());
  } catch {
    return 'not-needed';
  }
}

export async function photosState(): Promise<PermState> {
  try {
    return toState(await ImagePicker.getMediaLibraryPermissionsAsync());
  } catch {
    return 'not-needed';
  }
}

export async function requestCamera(): Promise<PermState> {
  const cur = await cameraState();
  if (cur === 'blocked') {
    await Linking.openSettings();
    return cur;
  }
  return toState(await ImagePicker.requestCameraPermissionsAsync());
}

export async function requestPhotos(): Promise<PermState> {
  const cur = await photosState();
  if (cur === 'blocked') {
    await Linking.openSettings();
    return cur;
  }
  return toState(await ImagePicker.requestMediaLibraryPermissionsAsync());
}

export const openAppSettings = () => Linking.openSettings();
