import * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiClient } from '../api/client';

ExpoNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerPushToken(): Promise<void> {
  const { status } = await ExpoNotifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  try {
    const tokenData = await ExpoNotifications.getExpoPushTokenAsync();
    await apiClient.post('/notifications/device-token', {
      token: tokenData.data,
      platform: Platform.OS === 'android' ? 'ANDROID' : 'IOS',
    });
  } catch (err) {
    // Push token registration is best-effort — never block login
    console.warn('Failed to register push token:', err);
  }
}
