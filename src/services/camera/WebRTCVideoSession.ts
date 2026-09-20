/** Camera ownership and signalling are independent of navigation and heartbeats. */
const LOCAL_PREVIEW_FPS = 24;
const OUTBOUND_VIDEO_FPS = 8;
const ICE_GATHERING_TIMEOUT_MS = 1500;
const CONNECTION_TIMEOUT_MS = 5000;
const FIRST_BACKEND_FRAME_TIMEOUT_MS = 6000;
const BACKEND_FRAME_STALL_TIMEOUT_MS = 6000;

export interface NormalizedWebRTCStats {
  sentFps: number | null;
  packetsLost: number | null;
  jitterMs: number | null;
  frameWidth: number | null;
  frameHeight: number | null;
  encodeMsPerFrame: number | null;
  jitterBufferDelayMs: number | null;
}

const bounded = (value: any, maximum: number): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.min(value, maximum)
    : null;

export function normalizeWebRTCStats(
  reports: any,
  previous: any = null,
  elapsedMs = 1000,
): NormalizedWebRTCStats {
  const rows = Array.isArray(reports) ? reports : Array.from(reports?.values?.() || []);
  const outbound = rows.find((row: any) => row?.type === 'outbound-rtp' && !row.isRemote && (row.kind === 'video' || row.mediaType === 'video'));
  const remote = rows.find((row: any) => row?.type === 'remote-inbound-rtp' && (row.kind === 'video' || row.mediaType === 'video'));
  const inbound = rows.find((row: any) => row?.type === 'inbound-rtp' && (row.kind === 'video' || row.mediaType === 'video'));
  const source = rows.find((row: any) => row?.type === 'media-source' && (row.kind === 'video' || row.mediaType === 'video'));
  const seconds = elapsedMs > 0 ? elapsedMs / 1000 : 0;
  const frameDelta = outbound && previous && outbound.framesEncoded >= previous.framesEncoded
    ? outbound.framesEncoded - previous.framesEncoded : null;
  const encodeDelta = outbound && previous && outbound.totalEncodeTime >= previous.totalEncodeTime
    ? outbound.totalEncodeTime - previous.totalEncodeTime : null;
  const jitterDelay = inbound?.jitterBufferEmittedCount > 0
    ? (inbound.jitterBufferDelay / inbound.jitterBufferEmittedCount) * 1000 : null;
  return {
    sentFps: bounded(outbound?.framesPerSecond ?? (frameDelta != null && seconds ? frameDelta / seconds : null), 240),
    packetsLost: bounded(remote?.packetsLost, 1_000_000_000),
    jitterMs: bounded(remote?.jitter == null ? null : remote.jitter * 1000, 60_000),
    frameWidth: bounded(outbound?.frameWidth ?? source?.width, 16_384),
    frameHeight: bounded(outbound?.frameHeight ?? source?.height, 16_384),
    encodeMsPerFrame: bounded(encodeDelta != null && frameDelta ? (encodeDelta / frameDelta) * 1000 : null, 60_000),
    jitterBufferDelayMs: bounded(jitterDelay, 60_000),
  };
}

export class WebRTCVideoSession {
  private pc: any = null;
  private stream: any = null;
  private generation = 0;
  private unsubscribe: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(private connection: any, private rtc: any) {}
  async start(
    facing: string,
    preview: (stream: any) => void,
    failed: (message: string) => void,
    progress: (phase: string) => void = () => {},
  ) {
    const generation = ++this.generation;
    const active = () => generation === this.generation;
    const fail = (error: any) => { if (active()) { this.stop(); failed(String(error?.message || error)); } };
    try {
      progress('camera');
      const stream = await this.rtc.mediaDevices.getUserMedia({audio:false,
        video:{facingMode:facing === 'front' ? 'user' : 'environment',width:1280,height:720,frameRate:LOCAL_PREVIEW_FPS}});
      if (!active()) { stream.getTracks().forEach((t:any)=>t.stop()); stream.release(); return; }
      this.stream = stream;
      preview(stream);
      progress('signalling');
      this.timer = setTimeout(() => fail('WebRTC connection timed out. Check that the phone and server are on the same network, then retry.'), CONNECTION_TIMEOUT_MS);
      const pc = this.pc = new this.rtc.RTCPeerConnection({iceServers:[]});
      for (const track of stream.getVideoTracks()) {
        const transceiver = pc.addTransceiver(track,{direction:'sendonly'});
        try {
          const parameters = transceiver.sender.getParameters();
          parameters.encodings = parameters.encodings?.length ? parameters.encodings : [{}];
          parameters.encodings[0].maxFramerate = OUTBOUND_VIDEO_FPS;
          await transceiver.sender.setParameters(parameters);
          const applied = transceiver.sender.getParameters();
          if (applied.encodings?.[0]?.maxFramerate !== OUTBOUND_VIDEO_FPS) {
            throw new Error('Native WebRTC did not apply the requested frame-rate cap.');
          }
        } catch {
          throw new Error('This device cannot enforce the WebRTC frame-rate cap. Retry WebRTC after restarting the app.');
        }
      }
      pc.addEventListener('connectionstatechange', () => {
        if (pc.connectionState === 'connected') {
          if (this.timer) clearTimeout(this.timer);
          progress('awaiting backend frame');
          this.timer = setTimeout(
            () => fail('The backend did not acknowledge a WebRTC frame. Retrying the video connection is required.'),
            FIRST_BACKEND_FRAME_TIMEOUT_MS,
          );
        }
        if (['failed','disconnected'].includes(pc.connectionState)) fail('WebRTC video connection was lost. Retry the video connection.');
      });
      this.unsubscribe = this.connection.onMessage(async (message:any) => {
        if (!active()) return;
        try {
          if (message.type === 'WEBRTC_ANSWER') {
            progress('answer');
            await pc.setRemoteDescription(message.payload);
            progress('connecting');
          }
          if (message.type === 'FRAME_ACK') {
            if (this.timer) clearTimeout(this.timer);
            this.timer = setTimeout(
              () => fail('The backend stopped acknowledging WebRTC frames. Retry the video connection.'),
              BACKEND_FRAME_STALL_TIMEOUT_MS,
            );
            progress('connected');
          }
          if (message.type === 'ERROR' && message.payload?.error_code === 'WEBRTC_FAILED') fail(message.payload.message);
        } catch (error) { fail(error); }
      });
      const offer = await pc.createOffer();
      if (!active()) return;
      // No CVO negotiation: libwebrtc must rotate encoded pixels for receivers
      // such as aiortc that cannot interpret RTP orientation metadata.
      offer.sdp = offer.sdp.split(/\r?\n/).filter((line:string)=>!line.includes('urn:3gpp:video-orientation')).join('\r\n');
      await pc.setLocalDescription(offer);
      const iceDeadline = Date.now() + ICE_GATHERING_TIMEOUT_MS;
      while (active() && pc.iceGatheringState !== 'complete'
             && !/a=candidate:/m.test(pc.localDescription?.sdp || '')
             && Date.now() < iceDeadline) {
        await new Promise(r=>setTimeout(r,50));
      }
      if (!active()) return;
      if (!/a=candidate:/m.test(pc.localDescription?.sdp || '')) {
        fail('WebRTC could not find a local network path. Check Wi-Fi access and retry.');
        return;
      }
      if (active() && !this.connection.sendMessage({type:'WEBRTC_OFFER',timestamp:Date.now(),payload:{sdp:pc.localDescription.sdp,type:'offer'}}))
        fail('Signalling socket unavailable');
      else if (active()) progress('offer');
    } catch (error) { fail(error); }
  }
  stop() {
    ++this.generation;
    if(this.timer) clearTimeout(this.timer);
    this.timer=null;
    this.unsubscribe?.(); this.unsubscribe=null;
    if(this.pc) {
      this.pc.close(); this.pc=null;
      this.connection.sendMessage({type:'WEBRTC_STOP',timestamp:Date.now(),payload:{}});
    }
    if(this.stream) { this.stream.getTracks().forEach((t:any)=>t.stop()); this.stream.release(); this.stream=null; }
  }
}
