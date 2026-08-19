export type SignalKind = "offer" | "answer" | "ice";

export interface PeerRow { id: string; name: string }
export interface SignalRow { id: number; from: string; kind: SignalKind; payload: unknown }
export interface RtcPollResponse { peers: PeerRow[]; signals: SignalRow[] }

export interface PeerInfo {
  id: string;
  name: string;
  connectionState: RTCPeerConnectionState;
  candidateType: string | null;
  rttMs: number | null;
}

export interface P2PRoomOptions {
  room: string;
  selfId: string;
  name?: string;
  iceServers?: RTCIceServer[];
  onPeersChanged?: (peers: PeerInfo[]) => void;
  onMessage?: (from: string, data: unknown, channel: "state" | "reliable") => void;
  onConnected?: () => void;
}

interface PeerSlot {
  pc: RTCPeerConnection;
  state?: RTCDataChannel;
  reliable?: RTCDataChannel;
  makingOffer: boolean;
  ignoreOffer: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  info: PeerInfo;
}

const FAST_POLL_MS = 400;
const IDLE_POLL_MS = 2000;

export function defaultIceServers(): RTCIceServer[] {
  const urls = (import.meta.env.VITE_STUN_URLS as string | undefined)?.split(",").map((u) => u.trim()).filter(Boolean);
  return [{ urls: urls?.length ? urls : ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }];
}

export class P2PRoom {
  private readonly opts: P2PRoomOptions;
  private readonly peers = new Map<string, PeerSlot>();
  private cursor = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private everPolled = false;

  constructor(opts: P2PRoomOptions) {
    this.opts = opts;
  }

  async join(): Promise<void> {
    try { await this.pollOnce(); } catch { /* first poll can fail transiently */ }
    if (this.closed) return;
    this.schedulePoll(this.anyConnecting() ? FAST_POLL_MS : IDLE_POLL_MS);
  }

  close(): void {
    this.closed = true;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    for (const slot of this.peers.values()) slot.pc.close();
    this.peers.clear();
    void fetch("/api/rtc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op: "leave", room: this.opts.room, peer: this.opts.selfId }),
      keepalive: true,
    }).catch(() => {});
  }

  broadcast(data: unknown): void {
    const wire = JSON.stringify({ t: "d", d: data });
    for (const slot of this.peers.values()) if (slot.state?.readyState === "open") slot.state.send(wire);
  }

  send(data: unknown, peerId?: string): void {
    const wire = JSON.stringify({ t: "d", d: data });
    const targets = peerId ? [this.peers.get(peerId)] : [...this.peers.values()];
    for (const slot of targets) if (slot?.reliable?.readyState === "open") slot.reliable.send(wire);
  }

  peerList(): PeerInfo[] {
    return [...this.peers.values()].map((s) => ({ ...s.info }));
  }

  private schedulePoll(delay: number): void {
    if (this.closed) return;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => void this.poll(), delay);
  }

  private anyConnecting(): boolean {
    for (const s of this.peers.values()) if (s.info.connectionState !== "connected") return true;
    return false;
  }

  private async pollOnce(): Promise<void> {
    const params = new URLSearchParams({ room: this.opts.room, peer: this.opts.selfId, name: this.opts.name ?? "", since: String(this.cursor) });
    const res = await fetch(`/api/rtc?${params}`);
    if (this.closed) return;
    if (!res.ok) throw new Error(`signaling poll failed: ${res.status}`);
    const body = (await res.json()) as RtcPollResponse;
    if (!this.everPolled) { this.everPolled = true; this.opts.onConnected?.(); }
    this.reconcileRoster(body.peers);
    const roster = new Set(body.peers.map((p) => p.id));
    for (const sig of body.signals) {
      this.cursor = Math.max(this.cursor, sig.id);
      await this.onSignal(sig.from, sig.kind, sig.payload, roster);
      if (this.closed) return;
    }
  }

  private async poll(): Promise<void> {
    if (this.closed) return;
    try { await this.pollOnce(); } catch { /* retry */ }
    this.schedulePoll(this.anyConnecting() ? FAST_POLL_MS : IDLE_POLL_MS);
  }

  private reconcileRoster(peers: PeerRow[]): void {
    const alive = new Set(peers.map((p) => p.id));
    for (const p of peers) {
      if (p.id === this.opts.selfId) continue;
      const existing = this.peers.get(p.id);
      if (existing) existing.info.name = p.name;
      else this.connectTo(p.id, p.name, this.opts.selfId > p.id);
    }
    for (const [id, slot] of this.peers) {
      if (!alive.has(id)) { slot.pc.close(); this.peers.delete(id); }
    }
    this.opts.onPeersChanged?.(this.peerList());
  }

  private connectTo(peerId: string, name: string, initiator: boolean): PeerSlot {
    const pc = new RTCPeerConnection({ iceServers: this.opts.iceServers ?? defaultIceServers() });
    const slot: PeerSlot = {
      pc, makingOffer: false, ignoreOffer: false, pendingCandidates: [],
      info: { id: peerId, name, connectionState: pc.connectionState, candidateType: null, rttMs: null },
    };
    this.peers.set(peerId, slot);
    pc.onicecandidate = (e) => { if (e.candidate) void this.sendSignal(peerId, "ice", e.candidate.toJSON()); };
    pc.onconnectionstatechange = () => { slot.info.connectionState = pc.connectionState; this.opts.onPeersChanged?.(this.peerList()); };
    pc.ondatachannel = (e) => this.attachChannel(slot, e.channel);
    if (initiator) {
      this.attachChannel(slot, pc.createDataChannel("state", { ordered: false, maxRetransmits: 0 }));
      this.attachChannel(slot, pc.createDataChannel("reliable"));
      void this.makeOffer(slot, peerId);
    }
    return slot;
  }

  private attachChannel(slot: PeerSlot, ch: RTCDataChannel): void {
    if (ch.label === "reliable") slot.reliable = ch;
    else slot.state = ch;
    ch.onmessage = (e) => {
      try {
        const msg = JSON.parse(String(e.data)) as { t?: string; d?: unknown };
        this.opts.onMessage?.(slot.info.id, msg.d, ch.label === "reliable" ? "reliable" : "state");
      } catch { /* ignore */ }
    };
  }

  private async makeOffer(slot: PeerSlot, peerId: string): Promise<void> {
    try {
      slot.makingOffer = true;
      const offer = await slot.pc.createOffer();
      await slot.pc.setLocalDescription(offer);
      await this.sendSignal(peerId, "offer", slot.pc.localDescription);
    } finally {
      slot.makingOffer = false;
    }
  }

  private async onSignal(from: string, kind: SignalKind, payload: unknown, roster: Set<string>): Promise<void> {
    if (!roster.has(from) && from !== this.opts.selfId) return;
    let slot = this.peers.get(from);
    if (!slot) slot = this.connectTo(from, from, false);
    const polite = this.opts.selfId < from;
    try {
      if (kind === "offer") {
        const offerCollision = slot.makingOffer || slot.pc.signalingState !== "stable";
        slot.ignoreOffer = !polite && offerCollision;
        if (slot.ignoreOffer) return;
        await slot.pc.setRemoteDescription(payload as RTCSessionDescriptionInit);
        for (const c of slot.pendingCandidates) await slot.pc.addIceCandidate(c);
        slot.pendingCandidates = [];
        const answer = await slot.pc.createAnswer();
        await slot.pc.setLocalDescription(answer);
        await this.sendSignal(from, "answer", slot.pc.localDescription);
      } else if (kind === "answer") {
        await slot.pc.setRemoteDescription(payload as RTCSessionDescriptionInit);
        for (const c of slot.pendingCandidates) await slot.pc.addIceCandidate(c);
        slot.pendingCandidates = [];
      } else if (kind === "ice") {
        const cand = payload as RTCIceCandidateInit;
        if (slot.pc.remoteDescription) await slot.pc.addIceCandidate(cand);
        else slot.pendingCandidates.push(cand);
      }
    } catch { /* glare / stale */ }
  }

  private async sendSignal(to: string, kind: SignalKind, payload: unknown): Promise<void> {
    await fetch("/api/rtc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op: "signal", room: this.opts.room, from: this.opts.selfId, to, kind, payload }),
    }).catch(() => {});
  }
}
