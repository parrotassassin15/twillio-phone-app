import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fetchSmsConversations, type SmsConversation } from '../services/api';
import { Config } from '../config';
import type { SmsStackParams } from '../navigation/AppNavigator';

const COLORS = {
  bg: '#0a1628',
  border: '#2a3f5f',
  accent: '#ba5663',
  green: '#00F82D',
  text: '#d0d0d0',
  muted: '#85888e',
  card: '#142b49',
};

function resolveContact(raw: string): string | undefined {
  const digits = raw.replace(/[^\d]/g, '');
  for (const [key, name] of Object.entries(Config.CONTACTS)) {
    if (key.replace(/[^\d]/g, '') === digits) return name;
  }
  return undefined;
}

function formatPhone(raw: string): string {
  const d = raw.replace(/[^\d]/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1')
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw;
}

function relativeTime(dateStr: string): string {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

type Nav = NativeStackNavigationProp<SmsStackParams, 'SMSList'>;

function ConvoRow({
  item,
  onPress,
}: {
  item: SmsConversation;
  onPress: () => void;
}) {
  const contact = item.contact_name ?? resolveContact(item.partner);
  const displayName = contact ?? formatPhone(item.partner);

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowName} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.rowTime}>{relativeTime(item.last_time)}</Text>
        </View>
        <View style={styles.rowBottom}>
          <Text style={styles.preview} numberOfLines={1}>
            {item.last_direction === 'outbound' ? 'You: ' : ''}
            {item.last_message}
          </Text>
          {item.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
        {item.has_lory && (
          <Text style={styles.loryTag}>🤖 Lory handled</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export function SMSScreen() {
  const nav = useNavigation<Nav>();
  const [conversations, setConversations] = useState<SmsConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setConversations(await fetchSmsConversations());
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openThread = (convo: SmsConversation) => {
    const contact = convo.contact_name ?? resolveContact(convo.partner);
    nav.navigate('SMSThread', {
      number: convo.partner,
      contactName: contact ?? undefined,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Messages</Text>
        <TouchableOpacity onPress={load} style={styles.refreshBtn}>
          <Icon name="refresh" size={18} color={COLORS.muted} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Icon name="alert-circle" size={32} color={COLORS.muted} />
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.center}>
          <Icon name="message-off" size={32} color={COLORS.muted} />
          <Text style={styles.emptyText}>No messages yet</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => item.partner}
          renderItem={({ item }) => (
            <ConvoRow item={item} onPress={() => openThread(item)} />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  topBarTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  refreshBtn: { padding: 6, borderRadius: 6, backgroundColor: 'rgba(42,63,95,0.3)' },
  separator: { height: 1, backgroundColor: 'rgba(42,63,95,0.3)' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(186,86,99,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: COLORS.accent, fontSize: 18, fontWeight: '700' },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  rowName: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  rowTime: { color: COLORS.muted, fontSize: 11 },
  rowBottom: { flexDirection: 'row', alignItems: 'center' },
  preview: { color: COLORS.muted, fontSize: 12, flex: 1 },
  unreadBadge: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  loryTag: { color: COLORS.muted, fontSize: 10, marginTop: 3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { color: COLORS.muted, fontSize: 13 },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
  },
  retryText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
