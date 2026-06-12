import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { forgotPassword } from '../src/api/auth';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email) { setError('Ingresa tu email'); return; }
    setLoading(true);
    setError('');
    try {
      await forgotPassword(email);
      router.push({ pathname: '/reset-password', params: { email } });
    } catch {
      setError('No encontramos una cuenta con ese email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-brand-900"
    >
      <View className="flex-1 px-8 pt-16">
        <TouchableOpacity onPress={() => router.back()} className="mb-8">
          {/* @ts-ignore - @expo/vector-icons not yet typed for React 19 */}
          <Ionicons name="arrow-back" size={24} color="#FF6B35" />
        </TouchableOpacity>

        <Text className="text-white text-2xl font-black mb-2">Recuperar contraseña</Text>
        <Text className="text-gray-400 text-sm mb-10">
          Te enviaremos un código de 6 dígitos a tu correo.
        </Text>

        <TextInput
          className="w-full bg-white/10 text-white rounded-2xl px-5 py-4 text-base mb-4"
          placeholder="Email"
          placeholderTextColor="#6B7280"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          value={email}
          onChangeText={setEmail}
        />

        {error ? <Text className="text-red-400 text-sm mb-4">{error}</Text> : null}

        <TouchableOpacity
          className="w-full bg-brand-500 rounded-2xl py-5 items-center"
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="white" />
            : <Text className="text-white font-bold text-base">Enviar código</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
