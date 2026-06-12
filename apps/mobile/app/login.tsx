import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { login } from '../src/api/auth';
import { saveTokens } from '../src/lib/secure-storage';
import { useAuthStore } from '../src/store/auth-store';
import { connectSocket } from '../src/lib/socket';
import { registerPushToken } from '../src/lib/notifications';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function LoginScreen() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) { setError('Ingresa tu email y contraseña'); return; }
    setLoading(true);
    setError('');
    try {
      const data = await login(email, password);
      await saveTokens(data.access_token, data.refresh_token);
      setAuth({
        accessToken: data.access_token,
        businessId: data.business.id,
        businessName: data.business.name,
        userName: data.user.name,
        role: data.user.role,
      });
      connectSocket(data.access_token);
      registerPushToken();
      router.push('/(tabs)/pedidos');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        setError('Email o contraseña incorrectos');
      } else if (!status) {
        setError('Sin conexión al servidor. Verifica tu red.');
      } else {
        setError(`Error ${status}. Intenta de nuevo.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-brand-900"
    >
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-brand-500 text-4xl font-black mb-2">PideFacil</Text>
        <Text className="text-gray-400 text-base mb-12">Panel del negocio</Text>

        <TextInput
          className="w-full bg-white/10 text-white rounded-2xl px-5 py-4 text-base mb-4"
          placeholder="Email"
          placeholderTextColor="#6B7280"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          returnKeyType="next"
          value={email}
          onChangeText={setEmail}
        />

        <View className="w-full mb-4">
          <TextInput
            className="w-full bg-white/10 text-white rounded-2xl px-5 py-4 text-base pr-14"
            placeholder="Contraseña"
            placeholderTextColor="#6B7280"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity
            className="absolute right-4 top-4"
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={22}
              color="#6B7280"
            />
          </TouchableOpacity>
        </View>

        {error ? <Text className="text-red-400 text-sm mb-4 text-center">{error}</Text> : null}

        <TouchableOpacity
          className="w-full bg-brand-500 rounded-2xl py-5 items-center mb-4"
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="white" />
            : <Text className="text-white font-bold text-base">Entrar</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/forgot-password')}>
          <Text className="text-gray-400 text-sm">¿Olvidaste tu contraseña?</Text>
        </TouchableOpacity>
      </View>
      <Text className="text-gray-600 text-xs text-center pb-8">v{APP_VERSION}</Text>
    </KeyboardAvoidingView>
  );
}
