import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { createApi } from './api';
export async function registerPushDevice(backend) {
  if (Platform.OS === 'web') throw new Error('Push notifications require an iOS or Android app.');
  const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
  if (!projectId) throw new Error('Add your Expo project ID to app.json before enabling push notifications.');
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('monitoring-alerts', {
      name: 'Monitoring alerts',
      importance: 4,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === 'granted' ? current : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Notification permission was not granted.');
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const api = createApi(backend.url, backend.token);
  await api.post('/api/notifications/devices/', { token, platform: Platform.OS });
  return true;
}
