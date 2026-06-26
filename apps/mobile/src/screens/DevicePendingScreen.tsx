import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  onRetry: () => void;
}

export function DevicePendingScreen({ onRetry }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⏳</Text>
      <Text style={styles.title}>Dispositivo pendiente de aprobación</Text>
      <Text style={styles.subtitle}>
        Pide al administrador que apruebe este dispositivo en el panel de PideFacil
        (Sucursales → Dispositivos).
      </Text>
      <TouchableOpacity style={styles.button} onPress={onRetry}>
        <Text style={styles.buttonText}>Ya lo aprobaron, intentar de nuevo</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1A2E', paddingHorizontal: 32 },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginBottom: 8, textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', marginBottom: 32 },
  button: { backgroundColor: '#FF6B35', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 12 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
