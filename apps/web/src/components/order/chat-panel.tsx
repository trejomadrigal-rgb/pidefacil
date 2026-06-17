'use client';

import { useState, useEffect, useRef } from 'react';
import { ref, onValue, push } from 'firebase/database';
import { rtdb } from '@/lib/firebase';

interface Message {
  id: string;
  from: 'CUSTOMER' | 'DELIVERY';
  text: string;
  ts: number;
}

interface Props {
  orderId: string;
}

export function ChatPanel({ orderId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rtdb) return;
    const messagesRef = ref(rtdb, `chats/${orderId}/messages`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) { setMessages([]); return; }
      const msgs = Object.entries(data).map(([id, val]) => ({
        id,
        ...(val as Omit<Message, 'id'>),
      }));
      msgs.sort((a, b) => a.ts - b.ts);
      setMessages(msgs);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });
    return () => unsubscribe();
  }, [orderId]);

  const sendMessage = async () => {
    if (!text.trim() || !rtdb) return;
    await push(ref(rtdb, `chats/${orderId}/messages`), {
      from: 'CUSTOMER',
      text: text.trim(),
      ts: Date.now(),
    });
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') sendMessage();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="font-bold text-brand-900 text-sm">💬 Chat con el repartidor</h2>
      </div>
      <div className="h-48 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-gray-400 pt-4">
            El repartidor ya viene en camino. Puedes escribirle aquí.
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                msg.from === 'CUSTOMER'
                  ? 'self-end ml-auto bg-brand-500 text-white'
                  : 'self-start bg-gray-100 text-gray-800'
              }`}
            >
              {msg.text}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
        <input
          type="text"
          className="flex-1 bg-gray-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300"
          placeholder="Escribe un mensaje..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="bg-brand-500 text-white rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50"
          onClick={sendMessage}
          disabled={!text.trim()}
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
