import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, type RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fetchSmsThread, sendSms, type SmsMessage } from '../services/api';
import { Config } from '../config';
import type { SmsStackParams } from '../navigation/AppNavigator';

const COLORS = {
  bg: '#0a1628',
  border: '#2a3f5f',
  accent: '#ba5663',
  blue: '#00b8ff',
  text: '#d0d0d0',
  muted: '#85888e',
  outBubble: '#1a375d',
  inBubble: 'rgba(186,86,99,0.12)',
};

type Route = RouteProp<SmsStackParams, 'SMSThread'>;

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 86400) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({ msg }: { msg: SmsMessage }) {
  const isOut = msg.direction === 'outbound';
  return (
    <View style={[styles.bubbleWrap, isOut ? styles.bubbleWrapOut : styles.bubbleWrapIn]}>
      <View style={[styles.bubble, isOut ? styles.bubbleOut : styles.bubbleIn]}>
        <Text style={styles.bubbleText}>{msg.body}</Text>
        {msg.lory_handled && (
          <Text style={styles.loryTag}>🤖 Lory</Text>
        )}
      </View>
      <Text style={styles.bubbleTime}>{formatTime(msg.date)}</Text>
    </View>
  );
}

export function SMSThreadScreen() {
  const { params } = useRoute<Route>();
  const { number } = params;
  const fromNumber = Config.CALLER_IDS[0].number;

  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try {
      const msgs = await fetchSmsThread(number);
      setMessages(msgs);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [number]);

  useEffect(() => { load(); }, [load]);

  const handleSend = async () => {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      await sendSms(number, text, fromNumber);
      setBody('');
      await load();
    } catch (err: any) {
      Alert.alert('Send failed', err?.message ?? String(err));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item, i) => `${item.id}-${i}`}
          renderItem={({ item }) => <MessageBubble msg={item} />}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Composer */}
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={body}
            onChangeText={setBody}
            placeholder="Message…"
            placeholderTextColor={COLORS.muted}
            multiline
            maxLength={1600}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!body.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!body.trim() || sending}
            accessibilityLabel="Send message">
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Icon name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  listContent: { paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  bubbleWrap: { maxWidth: '80%', gap: 2 },
  bubbleWrapOut: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleWrapIn: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleOut: {
    backgroundColor: COLORS.outBubble,
    borderBottomRightRadius: 4,
  },
  bubbleIn: {
    backgroundColor: COLORS.inBubble,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { color: COLORS.text, fontSize: 14, lineHeight: 20 },
  loryTag: { color: COLORS.muted, fontSize: 10, marginTop: 4 },
  bubbleTime: { color: COLORS.muted, fontSize: 10 },
  composer: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'flex-end',
    backgroundColor: '#0e1e35',
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    color: COLORS.text,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
