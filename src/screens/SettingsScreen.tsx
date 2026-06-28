import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import { useAgent } from '../contexts/AgentContext';

const C = {
  bg:     '#0a1628',
  card:   '#142b49',
  border: '#2a3f5f',
  text:   '#d0d0d0',
  muted:  '#85888e',
  accent: '#ba5663',
  green:  '#4caf50',
  yellow: '#ffc107',
  red:    '#f44336',
};

const STATUS_COLOR: Record<string, string> = {
  online:  C.green,
  busy:    C.yellow,
  offline: C.red,
};

function Row({ label, value, icon }: { label: string; value: string | null | undefined; icon: string }) {
  return (
    <View style={s.row}>
      <Icon name={icon} size={16} color={C.muted} style={s.rowIcon} />
      <View style={s.rowBody}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowValue}>{value ?? '—'}</Text>
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.card}>{children}</View>
    </View>
  );
}

export function SettingsScreen() {
  const { userEmail, userName, logout } = useAuth();
  const {
    agentDisplayName,
    agentExtension,
    agentIdentity,
    agentStatus,
    scheduleActive,
    nextScheduleChange,
    schedule,
    deviceId,
    registering,
    registrationError,
  } = useAgent();

  const confirmLogout = () =>
    Alert.alert('Sign out', 'Sign out of LS Phone?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);

  const statusColor = STATUS_COLOR[agentStatus] ?? C.muted;

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Staff profile */}
        <Section title="Staff Profile">
          <Row label="Name"  value={userName}  icon="account" />
          <Row label="Email" value={userEmail} icon="email-outline" />
        </Section>

        {/* Agent / softphone */}
        <Section title="Agent Profile">
          {registering ? (
            <Text style={s.muted}>Registering…</Text>
          ) : registrationError ? (
            <Text style={s.errorText}>{registrationError}</Text>
          ) : (
            <>
              <Row label="Display name" value={agentDisplayName} icon="badge-account-horizontal-outline" />
              <Row label="Extension"    value={agentExtension}   icon="dialpad" />
              <Row label="Identity"     value={agentIdentity}    icon="identifier" />
              <Row label="Device ID"    value={deviceId}         icon="cellphone" />

              {/* Status badge */}
              <View style={s.row}>
                <Icon name="circle" size={16} color={statusColor} style={s.rowIcon} />
                <View style={s.rowBody}>
                  <Text style={s.rowLabel}>Status</Text>
                  <Text style={[s.rowValue, { color: statusColor, textTransform: 'capitalize' }]}>
                    {agentStatus}
                  </Text>
                </View>
              </View>
            </>
          )}
        </Section>

        {/* Schedule */}
        <Section title="Schedule">
          <View style={s.row}>
            <Icon
              name={scheduleActive ? 'calendar-check' : 'calendar-remove'}
              size={16}
              color={scheduleActive ? C.green : C.muted}
              style={s.rowIcon}
            />
            <View style={s.rowBody}>
              <Text style={s.rowLabel}>Schedule active</Text>
              <Text style={[s.rowValue, { color: scheduleActive ? C.green : C.muted }]}>
                {scheduleActive ? 'Yes' : 'No'}
              </Text>
            </View>
          </View>
          {nextScheduleChange ? (
            <Row label="Next change" value={nextScheduleChange} icon="clock-outline" />
          ) : null}
          {schedule.length > 0 && (
            <View style={s.scheduleBlock}>
              {schedule.map((w, i) => (
                <Text key={i} style={s.scheduleRow}>
                  {DAYS[w.day_of_week] ?? 'Daily'}{'  '}{w.start_time} – {w.end_time}
                </Text>
              ))}
            </View>
          )}
        </Section>

        {/* Sign out */}
        <TouchableOpacity style={s.logoutBtn} onPress={confirmLogout} accessibilityLabel="Sign out">
          <Icon name="logout" size={18} color="#fff" style={s.logoutIcon} />
          <Text style={s.logoutText}>Sign out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 40 },

  section:      { marginBottom: 20 },
  sectionTitle: { color: C.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },

  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  rowIcon: { marginRight: 12, width: 18, textAlign: 'center' },
  rowBody: { flex: 1 },
  rowLabel: { color: C.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  rowValue: { color: C.text, fontSize: 14, marginTop: 2 },

  muted:     { color: C.muted, padding: 16, fontSize: 14 },
  errorText: { color: C.accent, padding: 16, fontSize: 14 },

  scheduleBlock: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 4,
  },
  scheduleRow: { color: C.text, fontSize: 13 },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
  },
  logoutIcon: { marginRight: 8 },
  logoutText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
