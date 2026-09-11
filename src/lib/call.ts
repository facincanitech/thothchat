import { supabase } from './supabase'

// TURN publico gratuito (OpenRelay/Metered) so como ultimo recurso, caso o Cloudflare
// Realtime (credenciais de curta duracao, buscadas do nosso backend) falhe por algum
// motivo - o OpenRelay se mostrou instavel isoladamente (chamada travando em "conectando").
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:openrelay.metered.ca:80' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
]

export async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) return FALLBACK_ICE_SERVERS
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/turn-credentials`, {
      headers: { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
    })
    if (!res.ok) return FALLBACK_ICE_SERVERS
    const data = await res.json()
    if (!Array.isArray(data.iceServers) || data.iceServers.length === 0) return FALLBACK_ICE_SERVERS
    return data.iceServers as RTCIceServer[]
  } catch {
    return FALLBACK_ICE_SERVERS
  }
}

export type CallKind = 'audio' | 'video'

export type CallPeer = {
  id: string
  name: string
  avatarUrl: string | null
}

export type OutgoingCallRequest = {
  peer: CallPeer
  kind: CallKind
  conversationId: string
}

export type PendingCallRow = {
  id: string
  caller_id: string
  callee_id: string
  conversation_id: string
  kind: CallKind
  status: 'ringing' | 'answered' | 'declined' | 'ended'
  offer_sdp: RTCSessionDescriptionInit
  caller_name: string
  caller_avatar: string | null
  created_at: string
}

export type CallSignal =
  | {
      type: 'call-offer'
      callId: string
      from: string
      fromName: string
      fromAvatar: string | null
      conversationId: string
      kind: CallKind
      sdp: RTCSessionDescriptionInit
    }
  | { type: 'call-answer'; callId: string; from: string; sdp: RTCSessionDescriptionInit }
  | { type: 'call-ice'; callId: string; from: string; candidate: RTCIceCandidateInit }
  | { type: 'call-end'; callId: string; from: string }
  | { type: 'call-decline'; callId: string; from: string }
