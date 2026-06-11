import * as SecureStore from 'expo-secure-store';

export const getItem = (key: string) => SecureStore.getItemAsync(key);
export const setItem = (key: string, value: string) => SecureStore.setItemAsync(key, value);
export const deleteItem = (key: string) => SecureStore.deleteItemAsync(key);

export async function saveTokens(accessToken: string, refreshToken: string) {
  await setItem('access_token', accessToken);
  await setItem('refresh_token', refreshToken);
}

export async function clearTokens() {
  await deleteItem('access_token');
  await deleteItem('refresh_token');
}
