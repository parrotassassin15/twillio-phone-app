import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import Sound from 'react-native-sound';
import {
  Call,
  CallInvite,
  makeCall as twilioMakeCall,
  hangUp as twilioHangUp,
  setMute as twilioSetMute,
  sendDtmf as twilioSendDtmf,
  getCallSid,
  onCallInvite,
  onCancelledCallInvite,
  registerDevice,
} from '../services/twilioService';
import { transferCall } from '../services/api';
import { Config } from '../config';

Sound.setCategory('PlayAndRecord');

type Status = 'idle' | 'connecting' | 'connected' | 'incoming';

type CallContextValue = {
  status: Status;
  activeCall: Call | null;
  pendingInvite: CallInvite | null;
  isMuted: boolean;
  callerId: string;
  remoteNumber: string;
  callStartTime: number | null;
  setCallerId: (id: string) => void;
  dial: (to: string) => Promise<void>;
  hangUp: () => void;
  toggleMute: () => void;
  sendDigit: (digit: string) => void;
  acceptIncoming: () => Promise<void>;
  rejectIncoming: () => void;
  transfer: (to: string) => Promise<void>;
};

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('idle');
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [pendingInvite, setPendingInvite] = useState<CallInvite | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callerId, setCallerId] = useState(Config.CALLER_IDS[0].number);
  const [remoteNumber, setRemoteNumber] = useState('');
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const ringtoneRef = useRef<Sound | null>(null);

  // ── Ringtone helpers ──────────────────────────────────────────────────────

  const startRing = useCallback(() => {
    const ring = new Sound('incoming_call.mp3', Sound.MAIN_BUNDLE, err => {
      if (!err) {
        ring.setNumberOfLoops(-1);
        ring.setVolume(0.8);
        ring.play();
        ringtoneRef.current = ring;
      }
    });
  }, []);

  const stopRing = useCallback(() => {
    ringtoneRef.current?.stop(() => ringtoneRef.current?.release());
    ringtoneRef.current = null;
  }, []);

  // ── Attach call listeners ─────────────────────────────────────────────────

  const attachCallListeners = useCallback(
    (call: Call) => {
      call.on(Call.Event.Connected, () => {
        setStatus('connected');
        setCallStartTime(Date.now());
      });
      call.on(Call.Event.ConnectFailure, () => {
        setStatus('idle');
        setActiveCall(null);
        setCallStartTime(null);
        setRemoteNumber('');
      });
      call.on(Call.Event.Disconnected, () => {
        setStatus('idle');
        setActiveCall(null);
        setIsMuted(false);
        setCallStartTime(null);
        setRemoteNumber('');
        stopRing();
      });
    },
    [stopRing],
  );

  // ── Device registration + incoming call listener ──────────────────────────

  useEffect(() => {
    registerDevice().catch(console.error);

    const offInvite = onCallInvite(invite => {
      setPendingInvite(invite);
      setStatus('incoming');
      const from = invite.getFrom() ?? 'Unknown';
      setRemoteNumber(from);
      startRing();
    });

    const offCancelled = onCancelledCallInvite(() => {
      stopRing();
      setPendingInvite(null);
      setStatus('idle');
      setRemoteNumber('');
    });

    return () => {
      offInvite();
      offCancelled();
    };
  }, [startRing, stopRing]);

  // ── Outbound call ─────────────────────────────────────────────────────────

  const dial = useCallback(
    async (to: string) => {
      if (status !== 'idle') return;
      setStatus('connecting');
      setRemoteNumber(to);
      try {
        const call = await twilioMakeCall(to, callerId);
        setActiveCall(call);
        attachCallListeners(call);
      } catch (err) {
        setStatus('idle');
        setRemoteNumber('');
        throw err;
      }
    },
    [status, callerId, attachCallListeners],
  );

  // ── Accept incoming ───────────────────────────────────────────────────────

  const acceptIncoming = useCallback(async () => {
    if (!pendingInvite) return;
    stopRing();
    const call = await pendingInvite.accept();
    setPendingInvite(null);
    setActiveCall(call);
    attachCallListeners(call);
  }, [pendingInvite, stopRing, attachCallListeners]);

  // ── Reject incoming ───────────────────────────────────────────────────────

  const rejectIncoming = useCallback(() => {
    stopRing();
    pendingInvite?.reject();
    setPendingInvite(null);
    setStatus('idle');
    setRemoteNumber('');
  }, [pendingInvite, stopRing]);

  // ── Hang up ───────────────────────────────────────────────────────────────

  const hangUp = useCallback(() => {
    if (activeCall) twilioHangUp(activeCall);
  }, [activeCall]);

  // ── Mute ─────────────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    if (!activeCall) return;
    const next = !isMuted;
    twilioSetMute(activeCall, next);
    setIsMuted(next);
  }, [activeCall, isMuted]);

  // ── DTMF ─────────────────────────────────────────────────────────────────

  const sendDigit = useCallback(
    (digit: string) => {
      if (activeCall) twilioSendDtmf(activeCall, digit);
    },
    [activeCall],
  );

  // ── Transfer ──────────────────────────────────────────────────────────────

  const transfer = useCallback(
    async (to: string) => {
      if (!activeCall) throw new Error('No active call');
      const sid = getCallSid(activeCall);
      if (!sid) throw new Error('Cannot identify call SID');
      await transferCall(sid, to, callerId);
    },
    [activeCall, callerId],
  );

  return (
    <CallContext.Provider
      value={{
        status,
        activeCall,
        pendingInvite,
        isMuted,
        callerId,
        remoteNumber,
        callStartTime,
        setCallerId,
        dial,
        hangUp,
        toggleMute,
        sendDigit,
        acceptIncoming,
        rejectIncoming,
        transfer,
      }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used inside CallProvider');
  return ctx;
}
