import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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

// Keypad laid out as rows so each row can flex-grow equally
const DIGIT_ROWS = [
  [['1', ''],    ['2', 'ABC'], ['3', 'DEF']],
  [['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO']],
  [['7', 'PQRS'],['8', 'TUV'], ['9', 'WXYZ']],
  [['*', ''],    ['0', '+'],   ['#', '']],
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
  const pendingExtRef = useRef('');
  const prevStatusRef = useRef(status);

  const inCall = status === 'connected' || status === 'connecting';

  useEffect(() => {
    if (status === 'connected' && callStartTime) {
      setElapsed(Date.now() - callStartTime);
      timerRef.current = setInterval(() => setElapsed(Date.now() - callStartTime), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status, callStartTime]);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (prev !== 'connected' && status === 'connected' && pendingExtRef.current) {
      const ext = pendingExtRef.current;
      pendingExtRef.current = '';
      const timers: ReturnType<typeof setTimeout>[] = [];
      for (let i = 0; i < ext.length; i++) {
        timers.push(setTimeout(() => sendDigit(ext[i]), 1500 + i * 250));
      }
      return () => timers.forEach(clearTimeout);
    }
  }, [status, sendDigit]);

  const handleKey = useCallback(
    (digit: string) => {
      if (inCall) sendDigit(digit);
      else setDigits(prev => prev + digit);
    },
    [inCall, sendDigit],
  );

  const handleZeroLongPress = useCallback(() => {
    if (!inCall) setDigits(prev => prev + '+');
  }, [inCall]);

  const handleBackspace = useCallback(() => {
    if (!inCall) setDigits(prev => prev.slice(0, -1));
  }, [inCall]);

  const handleCall = useCallback(async () => {
    const [mainPart, ...extParts] = digits.trim().split(',');
    const target = mainPart.trim();
    if (!target) return;
    pendingExtRef.current = extParts.join('').replace(/[^0-9*#]/g, '');
    try {
      await dial(target);
    } catch (err: any) {
      Alert.alert('Call failed', err?.message ?? String(err));
    }
  }, [digits, dial]);

  const rawDisplay    = inCall ? remoteNumber : digits;
  const commaIdx      = rawDisplay.indexOf(',');
  const mainRaw       = commaIdx >= 0 ? rawDisplay.slice(0, commaIdx) : rawDisplay;
  const extRaw        = commaIdx >= 0 ? rawDisplay.slice(commaIdx + 1) : '';
  const displayNumber = mainRaw ? formatPhone(mainRaw) : '';
  const contactName   = resolveContact(mainRaw);
  const statusLabel   =
    status === 'connecting' ? `Calling ${formatPhone(remoteNumber)}…`
    : status === 'connected' ? 'Connected'
    : '';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

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
                  onPress={() => { setCallerId(c.number); setCallerIdOpen(false); }}>
                  <Text style={styles.callerIdOptionText}>{c.label}</Text>
                  <Text style={styles.callerIdOptionNum}>{c.number}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Display */}
        <View style={styles.display}>
          {contactName ? <Text style={styles.contactName}>{contactName}</Text> : null}
          <Text style={[styles.number, !displayNumber && styles.numberEmpty]}>
            {displayNumber || 'Enter a number'}
            {extRaw ? <Text style={styles.extPart}>{` ,${extRaw}`}</Text> : null}
          </Text>
          {status === 'connected' && <Text style={styles.timer}>{formatTimer(elapsed)}</Text>}
          {statusLabel ? <Text style={styles.statusLabel}>{statusLabel}</Text> : null}
        </View>

        {/* Extension separator */}
        {!inCall && digits && !digits.includes(',') && (
          <TouchableOpacity
            style={styles.extChip}
            onPress={() => setDigits(d => d + ',')}
            accessibilityLabel="Add extension">
            <Icon name="dialpad" size={11} color="#00b8ff" />
            <Text style={styles.extChipText}>+ ext</Text>
          </TouchableOpacity>
        )}

        {/* Keypad — flex: 1 so it fills available space */}
        <View style={styles.pad}>
          {DIGIT_ROWS.map((row, ri) => (
            <View key={ri} style={styles.padRow}>
              {row.map(([digit, sub]) => (
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
          ))}
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, isMuted && styles.actionBtnActive]}
            onPress={toggleMute}
            disabled={!inCall}
            accessibilityLabel="Mute">
            <Icon
              name={isMuted ? 'microphone-off' : 'microphone'}
              size={22}
              color={isMuted ? COLORS.accent : inCall ? COLORS.text : COLORS.muted}
            />
          </TouchableOpacity>

          {status === 'connected' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.transferBtn]}
              onPress={() => setShowTransfer(true)}
              accessibilityLabel="Transfer call">
              <Icon name="phone-forward" size={22} color="#00b8ff" />
            </TouchableOpacity>
          )}

          {!inCall ? (
            <TouchableOpacity
              style={[styles.callBtn, !mainRaw.trim() && styles.callBtnDisabled]}
              onPress={handleCall}
              disabled={!mainRaw.trim()}
              accessibilityLabel="Call">
              <Icon name="phone" size={28} color={COLORS.text} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.hangupBtn} onPress={hangUp} accessibilityLabel="Hang up">
              <Icon name="phone-hangup" size={28} color={COLORS.text} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleBackspace}
            disabled={inCall || !digits}
            accessibilityLabel="Backspace">
            <Icon
              name="backspace"
              size={22}
              color={!inCall && digits ? COLORS.text : COLORS.muted}
            />
          </TouchableOpacity>
        </View>
      </View>

      {pendingInvite && <IncomingCallOverlay />}
      <TransferModal visible={showTransfer} onClose={() => setShowTransfer(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },

  callerIdWrap: { marginBottom: 8, zIndex: 10 },
  callerIdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  callerIdText: { flex: 1, color: COLORS.text, fontSize: 13 },
  callerIdDropdown: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    marginTop: 4,
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 20,
  },
  callerIdOption: { padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  callerIdOptionActive: { backgroundColor: 'rgba(186,86,99,0.1)' },
  callerIdOptionText: { color: COLORS.text, fontSize: 14 },
  callerIdOptionNum: { color: COLORS.muted, fontSize: 11, marginTop: 2 },

  display: {
    backgroundColor: COLORS.displayBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 68,
    marginBottom: 10,
  },
  contactName: { color: COLORS.accent, fontSize: 12, fontWeight: '600', marginBottom: 2 },
  number: { color: COLORS.text, fontSize: 26, fontWeight: '700', letterSpacing: 2, fontFamily: 'monospace' },
  numberEmpty: { color: COLORS.muted, fontSize: 14, fontWeight: '400', letterSpacing: 0 },
  extPart: { color: '#00b8ff', fontSize: 20, fontWeight: '500', letterSpacing: 1 },
  extChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,184,255,0.12)',
    marginBottom: 6,
  },
  extChipText: { color: '#00b8ff', fontSize: 11, fontWeight: '600' },
  timer: { color: '#ffc107', fontSize: 13, fontWeight: '600', marginTop: 2 },
  statusLabel: { color: COLORS.muted, fontSize: 11, marginTop: 2 },

  // flex: 1 lets the pad take all remaining vertical space
  pad: { flex: 1, gap: 8, marginBottom: 10 },
  padRow: { flex: 1, flexDirection: 'row', gap: 10 },
  key: {
    flex: 1,
    backgroundColor: COLORS.key,
    borderWidth: 1,
    borderColor: COLORS.keyBorder,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyNum: { color: COLORS.text, fontSize: 22, fontWeight: '700' },
  keySub: { color: COLORS.muted, fontSize: 9, letterSpacing: 2, marginTop: 1 },

  actions: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  actionBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnActive: { backgroundColor: 'rgba(186,86,99,0.2)' },
  transferBtn: { backgroundColor: 'rgba(0,184,255,0.15)' },
  callBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  callBtnDisabled: { opacity: 0.5 },
  hangupBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
});
