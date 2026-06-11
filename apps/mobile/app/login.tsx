import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { login } from '../src/api/auth';
import { saveTokens } from '../src/lib/secure-storage';
import { useAuthStore } from '../src/store/auth-store';

export default function LoginScreen() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      router.replace('/(tabs)/pedidos');
    } catch {
      setError('Email o contraseña incorrectos');
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
        <TextInput
          className="w-full bg-white/10 text-white rounded-2xl px-5 py-4 text-base mb-4"
          placeholder="Contraseña"
          placeholderTextColor="#6B7280"
          secureTextEntry
          autoComplete="current-password"
          returnKeyType="done"
          onSubmitEditing={handleLogin}
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text className="text-red-400 text-sm mb-4 text-center">{error}</Text> : null}

        <TouchableOpacity
          className="w-full bg-brand-500 rounded-2xl py-5 items-center"
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="white" />
            : <Text className="text-white font-bold text-base">Entrar</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
