import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { ref, onValue, push } from 'firebase/database';
import type { DataSnapshot } from 'firebase/database';
import { rtdb } from '../lib/firebase';

interface Message {
  id: string;
  from: 'CUSTOMER' | 'DELIVERY';
  text: string;
  ts: number;
}

interface Props {
  orderId: string;
}

export function DeliveryChatPanel({ orderId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const messagesRef = ref(rtdb, `chats/${orderId}/messages`);
    const unsubscribe = onValue(messagesRef, (snapshot: DataSnapshot) => {
      const data = snapshot.val();
      if (!data) { setMessages([]); return; }
      const msgs = Object.entries(data).map(([id, val]) => ({
        id,
        ...(val as Omit<Message, 'id'>),
      }));
      msgs.sort((a, b) => a.ts - b.ts);
      setMessages(msgs);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => unsubscribe();
  }, [orderId]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    await push(ref(rtdb, `chats/${orderId}/messages`), {
      from: 'DELIVERY',
      text: text.trim(),
      ts: Date.now(),
    });
    setText('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingVertical: 12, gap: 8 }}
        renderItem={({ item }) => (
          <View
            className={`max-w-[80%] px-3 py-2 rounded-2xl ${
              item.from === 'DELIVERY'
                ? 'self-end bg-[#FF6B35]'
                : 'self-start bg-white border border-gray-200'
            }`}
          >
            <Text
              className={
                item.from === 'DELIVERY' ? 'text-white text-sm' : 'text-gray-800 text-sm'
              }
            >
              {item.text}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text className="text-center text-gray-400 text-xs py-4">
            Chat activo con el cliente
          </Text>
        }
      />
      <View className="flex-row items-center px-4 py-3 bg-white border-t border-gray-100" style={{ gap: 8 }}>
        <TextInput
          className="flex-1 bg-gray-100 rounded-xl px-4 py-3 text-sm"
          placeholder="Escribe un mensaje..."
          value={text}
          onChangeText={setText}
          returnKeyType="send"
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          className="bg-[#FF6B35] rounded-xl px-4 py-3"
          onPress={sendMessage}
          disabled={!text.trim()}
        >
          <Text className="text-white font-bold text-sm">Enviar</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
