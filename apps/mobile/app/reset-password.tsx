import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { resetPassword } from '../src/api/auth';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async () => {
    if (!code || code.length !== 6) { setError('El código debe tener 6 dígitos'); return; }
    if (!newPassword || newPassword.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return; }
    setLoading(true);
    setError('');
    try {
      await resetPassword(email, code, newPassword);
      router.replace('/login');
    } catch {
      setError('Código incorrecto o expirado');
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

        <Text className="text-white text-2xl font-black mb-2">Nueva contraseña</Text>
        <Text className="text-gray-400 text-sm mb-10">
          Ingresa el código que enviamos a{'\n'}
          <Text className="text-white font-medium">{email}</Text>
        </Text>

        <TextInput
          className="w-full bg-white/10 text-white rounded-2xl px-5 py-4 text-base mb-4 tracking-widest text-center text-xl font-bold"
          placeholder="000000"
          placeholderTextColor="#6B7280"
          keyboardType="number-pad"
          maxLength={6}
          returnKeyType="next"
          value={code}
          onChangeText={setCode}
        />

        <View className="w-full mb-4">
          <TextInput
            className="w-full bg-white/10 text-white rounded-2xl px-5 py-4 text-base pr-14"
            placeholder="Nueva contraseña"
            placeholderTextColor="#6B7280"
            secureTextEntry={!showPassword}
            returnKeyType="done"
            onSubmitEditing={handleReset}
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <TouchableOpacity
            className="absolute right-4 top-4"
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {/* @ts-ignore - @expo/vector-icons not yet typed for React 19 */}
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={22}
              color="#6B7280"
            />
          </TouchableOpacity>
        </View>

        {error ? <Text className="text-red-400 text-sm mb-4">{error}</Text> : null}

        <TouchableOpacity
          className="w-full bg-brand-500 rounded-2xl py-5 items-center"
          onPress={handleReset}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="white" />
            : <Text className="text-white font-bold text-base">Cambiar contraseña</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
