import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fetchLeads, type Lead } from '../services/api';
import { useCall } from '../contexts/CallContext';

const COLORS = {
  bg: '#0a1628',
  card: '#142b49',
  border: '#2a3f5f',
  accent: '#ba5663',
  green: '#00F82D',
  blue: '#3b82f6',
  text: '#d0d0d0',
  muted: '#85888e',
};

const BADGE: Record<string, { bg: string; color: string }> = {
  handoff: { bg: 'rgba(255,71,87,0.15)', color: '#ff4757' },
  booking: { bg: 'rgba(59,130,246,0.15)', color: COLORS.blue },
  voice_call: { bg: 'rgba(0,248,45,0.15)', color: COLORS.green },
};

function relativeTime(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatPhone(raw: string): string {
  const d = raw.replace(/[^\d]/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1')
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw;
}

function LeadRow({ item, onCall }: { item: Lead; onCall: (phone: string) => void }) {
  const type = item.lead_type ?? '';
  const badge = BADGE[type];

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => item.visitor_phone && onCall(item.visitor_phone)}
      disabled={!item.visitor_phone}
      activeOpacity={item.visitor_phone ? 0.7 : 1}>
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Text style={styles.name}>{item.visitor_name ?? 'Unknown'}</Text>
          <Text style={styles.time}>{relativeTime(item.created_at)}</Text>
        </View>
        {item.visitor_email ? (
          <Text style={styles.detail}>
            <Icon name="email" size={11} color={COLORS.muted} /> {item.visitor_email}
          </Text>
        ) : null}
        {item.visitor_phone ? (
          <Text style={styles.detail}>
            <Icon name="phone" size={11} color={COLORS.muted} /> {formatPhone(item.visitor_phone)}
          </Text>
        ) : null}
        {item.company_name ? (
          <Text style={styles.detail}>
            <Icon name="office-building" size={11} color={COLORS.muted} /> {item.company_name}
          </Text>
        ) : null}
        {badge ? (
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>
              {type.replace('_', ' ')}
            </Text>
          </View>
        ) : null}
        {item.context_summary ? (
          <Text style={styles.summary} numberOfLines={2}>
            {item.context_summary.substring(0, 150)}
          </Text>
        ) : null}
      </View>
      {item.visitor_phone ? (
        <View style={styles.callIcon}>
          <Icon name="phone" size={16} color={COLORS.green} />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export function LeadsScreen() {
  const { dial, status: callStatus } = useCall();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setLeads(await fetchLeads());
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCall = useCallback(
    (phone: string) => {
      if (callStatus !== 'idle') {
        Alert.alert('Busy', 'You are already in a call');
        return;
      }
      dial(phone).catch(err => Alert.alert('Call failed', err?.message));
    },
    [dial, callStatus],
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header with refresh */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Leads</Text>
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
      ) : leads.length === 0 ? (
        <View style={styles.center}>
          <Icon name="fire" size={32} color={COLORS.muted} />
          <Text style={styles.emptyText}>No leads yet</Text>
        </View>
      ) : (
        <FlatList
          data={leads}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => <LeadRow item={item} onCall={handleCall} />}
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
  refreshBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(42,63,95,0.3)',
  },
  separator: { height: 1, backgroundColor: 'rgba(42,63,95,0.5)' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  rowBody: { flex: 1 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  name: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  time: { color: COLORS.muted, fontSize: 11 },
  detail: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 6,
  },
  badgeText: { fontSize: 9, fontWeight: '700' },
  summary: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(42,63,95,0.3)',
  },
  callIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,248,45,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
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
