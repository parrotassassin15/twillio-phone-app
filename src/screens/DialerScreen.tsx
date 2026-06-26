import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useCall } from '../contexts/CallContext';
import { Config } from '../config';
import { IncomingCallOverlay } from '../components/IncomingCallOverlay';
import { TransferModal } from '../components/TransferModal';

const COLORS = {
  bg: '#0a1628',
  card: '#142b49',
  accent: '#ba5663',
  green: '#00F82D',
  red: '#ff4757',
  text: '#fff',
  muted: '#85888e',
  border: '#2a3f5f',
  key: '#1a375d',
  keyBorder: 'rgba(82,82,82,0.3)',
  displayBg: '#0e1e35',
};

const DIGITS = [
  ['1', ''],
  ['2', 'ABC'],
  ['3', 'DEF'],
  ['4', 'GHI'],
  ['5', 'JKL'],
  ['6', 'MNO'],
  ['7', 'PQRS'],
  ['8', 'TUV'],
  ['9', 'WXYZ'],
  ['*', ''],
  ['0', '+'],
  ['#', ''],
] as const;

function formatPhone(raw: string): string {
  const d = raw.replace(/[^\d]/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1')
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw;
}

function resolveContact(raw: string): string | undefined {
  const digits = raw.replace(/[^\d]/g, '');
  for (const [key, name] of Object.entries(Config.CONTACTS)) {
    if (key.replace(/[^\d]/g, '') === digits) return name;
  }
  return undefined;
}

function formatTimer(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function DialerScreen() {
  const {
    status,
    isMuted,
    callerId,
    remoteNumber,
    callStartTime,
    setCallerId,
    dial,
    hangUp,
    toggleMute,
    sendDigit,
    pendingInvite,
  } = useCall();

  const [digits, setDigits] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [showTransfer, setShowTransfer] = useState(false);
  const [callerIdOpen, setCallerIdOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const zeroTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inCall = status === 'connected' || status === 'connecting';

  // ── Call timer ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (status === 'connected' && callStartTime) {
      setElapsed(Date.now() - callStartTime);
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - callStartTime);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, callStartTime]);

  // ── Keypad press ───────────────────────────────────────────────────────

  const handleKey = useCallback(
    (digit: string) => {
      if (inCall) {
        sendDigit(digit);
      } else {
        setDigits(prev => prev + digit);
      }
    },
    [inCall, sendDigit],
  );

  const handleZeroLongPress = useCallback(() => {
    if (!inCall) setDigits(prev => prev + '+');
  }, [inCall]);

  const handleBackspace = useCallback(() => {
    if (!inCall) setDigits(prev => prev.slice(0, -1));
  }, [inCall]);

  // ── Call ───────────────────────────────────────────────────────────────

  const handleCall = useCallback(async () => {
    const target = digits.trim();
    if (!target) return;
    try {
      await dial(target);
    } catch (err: any) {
      Alert.alert('Call failed', err?.message ?? String(err));
    }
  }, [digits, dial]);

  // ── Derived display values ─────────────────────────────────────────────

  const displayNumber = inCall
    ? formatPhone(remoteNumber)
    : digits
      ? formatPhone(digits)
      : '';

  const contactName = inCall ? resolveContact(remoteNumber) : resolveContact(digits);

  const statusLabel =
    status === 'connecting'
      ? `Calling ${formatPhone(remoteNumber)}…`
      : status === 'connected'
        ? 'Connected'
        : '';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Caller ID selector */}
        <View style={styles.callerIdWrap}>
          <TouchableOpacity
            style={styles.callerIdBtn}
            onPress={() => setCallerIdOpen(o => !o)}
            accessibilityLabel="Select caller ID">
            <Icon name="phone-outgoing" size={14} color={COLORS.muted} />
            <Text style={styles.callerIdText}>
              {Config.CALLER_IDS.find(c => c.number === callerId)?.label ?? callerId}
            </Text>
            <Icon name={callerIdOpen ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.muted} />
          </TouchableOpacity>
          {callerIdOpen && (
            <View style={styles.callerIdDropdown}>
              {Config.CALLER_IDS.map(c => (
                <TouchableOpacity
                  key={c.number}
                  style={[styles.callerIdOption, c.number === callerId && styles.callerIdOptionActive]}
                  onPress={() => {
                    setCallerId(c.number);
                    setCallerIdOpen(false);
                  }}>
                  <Text style={styles.callerIdOptionText}>{c.label}</Text>
                  <Text style={styles.callerIdOptionNum}>{c.number}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Display */}
        <View style={styles.display}>
          {contactName ? (
            <Text style={styles.contactName}>{contactName}</Text>
          ) : null}
          <Text style={[styles.number, !displayNumber && styles.numberEmpty]}>
            {displayNumber || 'Enter a number'}
          </Text>
          {status === 'connected' && (
            <Text style={styles.timer}>{formatTimer(elapsed)}</Text>
          )}
          {statusLabel ? (
            <Text style={styles.statusLabel}>{statusLabel}</Text>
          ) : null}
        </View>

        {/* Keypad */}
        <View style={styles.pad}>
          {DIGITS.map(([digit, sub]) => (
            <TouchableOpacity
              key={digit}
              style={styles.key}
              onPress={() => handleKey(digit)}
              onLongPress={digit === '0' ? handleZeroLongPress : undefined}
              onPressIn={digit === '0' ? () => {
                zeroTimerRef.current = setTimeout(handleZeroLongPress, 500);
              } : undefined}
              onPressOut={() => {
                if (zeroTimerRef.current) clearTimeout(zeroTimerRef.current);
              }}
              accessibilityLabel={`Dial ${digit}`}>
              <Text style={styles.keyNum}>{digit}</Text>
              {sub ? <Text style={styles.keySub}>{sub}</Text> : null}
            </TouchableOpacity>
          ))}
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {/* Mute */}
          <TouchableOpacity
            style={[styles.actionBtn, isMuted && styles.actionBtnActive]}
            onPress={toggleMute}
            disabled={!inCall}
            accessibilityLabel="Mute">
            <Icon
              name={isMuted ? 'microphone-off' : 'microphone'}
              size={20}
              color={isMuted ? COLORS.accent : inCall ? COLORS.text : COLORS.keyBorder}
            />
          </TouchableOpacity>

          {/* Transfer (only visible during a call) */}
          {status === 'connected' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.transferBtn]}
              onPress={() => setShowTransfer(true)}
              accessibilityLabel="Transfer call">
              <Icon name="phone-forward" size={20} color="#00b8ff" />
            </TouchableOpacity>
          )}

          {/* Call / Hangup */}
          {!inCall ? (
            <TouchableOpacity
              style={[styles.callBtn, (!digits) && styles.callBtnDisabled]}
              onPress={handleCall}
              disabled={!digits}
              accessibilityLabel="Call">
              <Icon name="phone" size={26} color={COLORS.text} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.hangupBtn}
              onPress={hangUp}
              accessibilityLabel="Hang up">
              <Icon name="phone-hangup" size={26} color={COLORS.text} />
            </TouchableOpacity>
          )}

          {/* Backspace */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleBackspace}
            disabled={inCall || !digits}
            accessibilityLabel="Backspace">
            <Icon
              name="backspace"
              size={20}
              color={!inCall && digits ? COLORS.muted : COLORS.keyBorder}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Incoming call overlay (global, shown from any tab via this screen) */}
      {pendingInvite && <IncomingCallOverlay />}

      {/* Transfer modal */}
      <TransferModal visible={showTransfer} onClose={() => setShowTransfer(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 16, alignItems: 'center' },

  callerIdWrap: { width: '100%', marginBottom: 12, zIndex: 10 },
  callerIdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.displayBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
  },
  callerIdText: { flex: 1, color: COLORS.muted, fontSize: 13 },
  callerIdDropdown: {
    backgroundColor: COLORS.displayBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    marginTop: 4,
  },
  callerIdOption: { padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  callerIdOptionActive: { backgroundColor: 'rgba(186,86,99,0.1)' },
  callerIdOptionText: { color: COLORS.text, fontSize: 14 },
  callerIdOptionNum: { color: COLORS.muted, fontSize: 11, marginTop: 2 },

  display: {
    width: '100%',
    backgroundColor: COLORS.displayBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
    marginBottom: 16,
  },
  contactName: { color: COLORS.accent, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  number: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
  numberEmpty: { color: COLORS.muted, fontSize: 15, fontWeight: '400', letterSpacing: 0 },
  timer: { color: '#ffc107', fontSize: 14, fontWeight: '600', marginTop: 4 },
  statusLabel: { color: COLORS.muted, fontSize: 12, marginTop: 4 },

  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    gap: 10,
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  key: {
    width: '30%',
    backgroundColor: COLORS.key,
    borderWidth: 1,
    borderColor: COLORS.keyBorder,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  keyNum: { color: COLORS.text, fontSize: 22, fontWeight: '700' },
  keySub: { color: COLORS.muted, fontSize: 9, letterSpacing: 2, marginTop: 2 },

  actions: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(82,82,82,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnActive: { backgroundColor: 'rgba(186,86,99,0.2)' },
  transferBtn: { backgroundColor: 'rgba(0,184,255,0.15)' },
  callBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.green,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  callBtnDisabled: { opacity: 0.4 },
  hangupBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.red,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
});
