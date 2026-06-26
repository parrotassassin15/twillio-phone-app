import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useCall } from '../contexts/CallContext';
import { Config } from '../config';
import { TransferModal } from '../components/TransferModal';

const COLORS = {
  bg: '#0a1628',
  card: '#142b49',
  border: '#2a3f5f',
  accent: '#ba5663',
  green: '#00F82D',
  blue: '#00b8ff',
  text: '#d0d0d0',
  muted: '#85888e',
};

function formatPhone(raw: string): string {
  const d = raw.replace(/[^\d]/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1')
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw;
}

export function ExtensionsScreen() {
  const { dial, status: callStatus, transfer } = useCall();
  const [transferOpen, setTransferOpen] = useState(false);
  const inCall = callStatus === 'connected';

  const handleDial = async (number: string, name: string) => {
    if (callStatus !== 'idle') {
      Alert.alert('Busy', 'You are already in a call');
      return;
    }
    try {
      await dial(number);
    } catch (err: any) {
      Alert.alert(`Failed to call ${name}`, err?.message ?? String(err));
    }
  };

  const handleTransfer = async (number: string, name: string) => {
    if (!inCall) {
      Alert.alert('Transfer', 'Transfer is only available during an active call');
      return;
    }
    try {
      await transfer(number);
      Alert.alert('Transfer', `Transferring to ${name}`);
    } catch (err: any) {
      Alert.alert('Transfer failed', err?.message ?? String(err));
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="headset" size={16} color={COLORS.accent} />
            <Text style={styles.cardTitle}>Team Extensions</Text>
            <Text style={styles.cardSub}>Dial direct · transfer during a call</Text>
          </View>

          {Config.EXTENSIONS.map((ext, i) => (
            <View
              key={ext.ext}
              style={[styles.extRow, i < Config.EXTENSIONS.length - 1 && styles.extRowBorder]}>
              <View style={styles.extBadge}>
                <Text style={styles.extBadgeText}>{ext.ext}</Text>
              </View>
              <View style={styles.extInfo}>
                <Text style={styles.extName}>{ext.name}</Text>
                <Text style={styles.extNum}>{formatPhone(ext.number)}</Text>
              </View>
              <View style={styles.extActions}>
                <TouchableOpacity
                  style={styles.dialBtn}
                  onPress={() => handleDial(ext.number, ext.name)}
                  disabled={callStatus !== 'idle'}
                  accessibilityLabel={`Call ${ext.name}`}>
                  <Icon name="phone" size={13} color={COLORS.green} />
                  <Text style={[styles.extBtnText, { color: COLORS.green }]}>Dial</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.xferBtn, !inCall && styles.btnDisabled]}
                  onPress={() => handleTransfer(ext.number, ext.name)}
                  disabled={!inCall}
                  accessibilityLabel={`Transfer to ${ext.name}`}>
                  <Icon name="phone-forward" size={13} color={inCall ? COLORS.blue : COLORS.muted} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {inCall && (
          <TouchableOpacity
            style={styles.openTransferBtn}
            onPress={() => setTransferOpen(true)}>
            <Icon name="phone-forward" size={16} color={COLORS.blue} />
            <Text style={styles.openTransferText}>Transfer to another number…</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <TransferModal visible={transferOpen} onClose={() => setTransferOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 16, gap: 16 },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cardTitle: { color: '#fff', fontSize: 13, fontWeight: '600' },
  cardSub: { color: COLORS.muted, fontSize: 11, marginLeft: 'auto' },
  extRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  extRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(42,63,95,0.5)' },
  extBadge: {
    width: 42,
    height: 42,
    borderRadius: 9,
    backgroundColor: 'rgba(186,86,99,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  extBadgeText: {
    color: COLORS.accent,
    fontWeight: '800',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  extInfo: { flex: 1 },
  extName: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  extNum: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  extActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: 'rgba(0,248,45,0.15)',
  },
  xferBtn: {
    width: 32,
    height: 32,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,184,255,0.15)',
  },
  btnDisabled: { opacity: 0.35 },
  extBtnText: { fontSize: 11, fontWeight: '600' },
  openTransferBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
  },
  openTransferText: { color: COLORS.blue, fontSize: 13, fontWeight: '600' },
});
