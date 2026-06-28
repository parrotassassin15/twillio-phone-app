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
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fetchCallLogs, type CallRecord } from '../services/api';
import { useCall } from '../contexts/CallContext';
import { Config } from '../config';

const COLORS = {
  bg: '#0a1628',
  card: '#142b49',
  border: '#2a3f5f',
  accent: '#ba5663',
  green: '#00F82D',
  blue: '#00b8ff',
  red: '#ff4757',
  yellow: '#ffc107',
  text: '#d0d0d0',
  muted: '#85888e',
};

function resolveContact(raw: string): string | undefined {
  const digits = raw.replace(/[^\d]/g, '');
  for (const [key, name] of Object.entries(Config.CONTACTS)) {
    if (key.replace(/[^\d]/g, '') === digits) return name;
  }
  return undefined;
}

function formatPhone(raw: string): string {
  if (!raw) return '';
  const d = raw.replace(/[^\d]/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1')
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw;
}

function formatDuration(s: number): string {
  if (!s || s < 1) return '';
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function relativeTime(dateStr: string): string {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

type CallFilter = '' | 'inbound' | 'outbound' | 'extensions';

function CallRow({ item, onPress }: { item: CallRecord; onPress: (num: string) => void }) {
  const num = item.direction === 'outbound' ? item.to : item.from;
  const contact = resolveContact(num);
  const ext = Config.EXTENSIONS.find(e => e.number.replace(/[^\d]/g, '') === num.replace(/[^\d]/g, ''));
  const isMissed =
    item.status === 'no-answer' ||
    item.status === 'busy' ||
    item.status === 'canceled' ||
    item.status === 'failed';

  let iconName = 'phone';
  let iconColor = COLORS.text;
  let iconBg = 'rgba(0,248,45,0.1)';

  if (isMissed) {
    iconName = 'phone-missed';
    iconColor = COLORS.red;
    iconBg = 'rgba(255,71,87,0.1)';
  } else if (item.direction === 'inbound') {
    iconName = 'phone-incoming';
    iconColor = COLORS.blue;
    iconBg = 'rgba(0,184,255,0.1)';
  } else {
    iconName = 'phone-outgoing';
    iconColor = COLORS.green;
    iconBg = 'rgba(0,248,45,0.1)';
  }

  const badgeColor =
    item.status === 'completed'
      ? { bg: 'rgba(0,248,45,0.1)', text: COLORS.green }
      : item.status === 'no-answer'
        ? { bg: 'rgba(255,71,87,0.1)', text: COLORS.red }
        : { bg: 'rgba(255,193,7,0.1)', text: COLORS.yellow };

  return (
    <TouchableOpacity style={styles.row} onPress={() => onPress(num)} activeOpacity={0.7}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Icon name={iconName} size={14} color={iconColor} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowNum}>
          {contact ? <Text style={{ color: COLORS.accent }}>{contact} </Text> : null}
          {formatPhone(num)}
        </Text>
        <View style={styles.rowMeta}>
          <View style={[styles.badge, { backgroundColor: badgeColor.bg }]}>
            <Text style={[styles.badgeText, { color: badgeColor.text }]}>{item.status}</Text>
          </View>
          {ext && (
            <View style={[styles.badge, { backgroundColor: 'rgba(186,86,99,0.1)' }]}>
              <Text style={[styles.badgeText, { color: COLORS.accent }]}>ext {ext.ext}</Text>
            </View>
          )}
          {item.duration > 0 && (
            <Text style={styles.metaText}>{formatDuration(item.duration)}</Text>
          )}
          <Text style={styles.metaText}>{item.direction === 'outbound' ? 'to' : 'from'}</Text>
        </View>
      </View>
      <Text style={styles.rowTime}>{relativeTime(item.start_time)}</Text>
    </TouchableOpacity>
  );
}

function ExtensionSummary({ calls }: { calls: CallRecord[] }) {
  const extData = Config.EXTENSIONS.map(ext => {
    const extDigits = ext.number.replace(/[^\d]/g, '');
    const extCalls = calls.filter(c => {
      const num = (c.direction === 'outbound' ? c.to : c.from).replace(/[^\d]/g, '');
      return num === extDigits;
    });
    return { ...ext, count: extCalls.length, totalDuration: extCalls.reduce((s, c) => s + (c.duration ?? 0), 0) };
  }).filter(e => e.count > 0);

  if (extData.length === 0) return null;

  return (
    <View style={styles.extCard}>
      <View style={styles.extCardHeader}>
        <Icon name="headset" size={13} color={COLORS.accent} />
        <Text style={styles.extCardTitle}>Extensions Dialed</Text>
      </View>
      {extData.map((ext, i) => (
        <View key={ext.ext} style={[styles.extCardRow, i < extData.length - 1 && styles.extCardRowBorder]}>
          <View style={styles.extBadgeBox}>
            <Text style={styles.extBadgeBoxText}>{ext.ext}</Text>
          </View>
          <Text style={styles.extCardName}>{ext.name}</Text>
          <View style={styles.extCardStats}>
            <Text style={styles.extCardCount}>{ext.count}</Text>
            <Text style={styles.extCardCountLabel}> call{ext.count !== 1 ? 's' : ''}</Text>
            {ext.totalDuration > 0 && (
              <Text style={styles.extCardDuration}>  {formatDuration(ext.totalDuration)}</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

export function CallLogScreen() {
  const { dial, status: callStatus } = useCall();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<CallFilter>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const direction = filter === 'extensions' ? '' : filter;
      const data = await fetchCallLogs({ limit: 50, direction });
      if (filter === 'extensions') {
        const extSet = new Set(Config.EXTENSIONS.map(e => e.number.replace(/[^\d]/g, '')));
        setCalls(data.filter(c => {
          const num = (c.direction === 'outbound' ? c.to : c.from).replace(/[^\d]/g, '');
          return extSet.has(num);
        }));
      } else {
        setCalls(data);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleDial = useCallback(
    async (num: string) => {
      if (callStatus !== 'idle') return;
      try {
        await dial(num);
      } catch {}
    },
    [dial, callStatus],
  );

  const FILTERS: { label: string; value: CallFilter }[] = [
    { label: 'All', value: '' },
    { label: 'Inbound', value: 'inbound' },
    { label: 'Outbound', value: 'outbound' },
    { label: 'Extensions', value: 'extensions' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Filters */}
      <View style={styles.filterBar}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterBtn, filter === f.value && styles.filterBtnActive]}
            onPress={() => setFilter(f.value)}>
            <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.refreshBtn} onPress={load}>
          <Icon name="refresh" size={16} color={COLORS.muted} />
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
      ) : calls.length === 0 ? (
        <View style={styles.center}>
          <Icon name="phone-off" size={32} color={COLORS.muted} />
          <Text style={styles.emptyText}>No calls found</Text>
        </View>
      ) : (
        <>
          {filter === 'extensions' && <ExtensionSummary calls={calls} />}
          <FlatList
            data={calls}
            keyExtractor={item => item.sid}
            renderItem={({ item }) => <CallRow item={item} onPress={handleDial} />}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  filterBar: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    alignItems: 'center',
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(42,63,95,0.3)',
  },
  filterBtnActive: { backgroundColor: COLORS.accent },
  filterText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  refreshBtn: {
    marginLeft: 'auto',
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(42,63,95,0.3)',
  },
  list: { padding: 0 },
  separator: { height: 1, backgroundColor: 'rgba(42,63,95,0.5)' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: { flex: 1 },
  rowNum: { color: COLORS.text, fontSize: 13, fontWeight: '500' },
  rowMeta: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 3 },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  badgeText: { fontSize: 9, fontWeight: '600' },
  metaText: { color: COLORS.muted, fontSize: 10 },
  rowTime: { color: COLORS.muted, fontSize: 11 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { color: COLORS.muted, fontSize: 13 },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
  },
  retryText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  extCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    overflow: 'hidden',
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  extCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  extCardTitle: { color: '#fff', fontSize: 12, fontWeight: '600' },
  extCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  extCardRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(42,63,95,0.5)' },
  extBadgeBox: {
    width: 34,
    height: 34,
    borderRadius: 7,
    backgroundColor: 'rgba(186,86,99,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  extBadgeBoxText: { color: COLORS.accent, fontWeight: '700', fontSize: 11, fontFamily: 'monospace' },
  extCardName: { flex: 1, color: COLORS.text, fontSize: 12, fontWeight: '500' },
  extCardStats: { flexDirection: 'row', alignItems: 'center' },
  extCardCount: { color: '#fff', fontSize: 13, fontWeight: '700' },
  extCardCountLabel: { color: COLORS.muted, fontSize: 11 },
  extCardDuration: { color: COLORS.muted, fontSize: 11 },
});
