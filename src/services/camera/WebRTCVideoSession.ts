/** Camera ownership and signalling are independent of navigation and heartbeats. */
export class WebRTCVideoSession {
  private pc: any = null;
  private stream: any = null;
  private generation = 0;
  private unsubscribe: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(private connection: any, private rtc: any) {}
  async start(facing: string, preview: (stream: any) => void, failed: (message: string) => void) {
    const generation = ++this.generation;
    const active = () => generation === this.generation;
    const fail = (error: any) => { if (active()) { this.stop(); failed(String(error?.message || error)); } };
    try {
      this.timer = setTimeout(() => fail('Video connection timed out'), 15000);
      const stream = await this.rtc.mediaDevices.getUserMedia({audio:false,
        video:{facingMode:facing === 'front' ? 'user' : 'environment',width:1280,height:720,frameRate:5}});
      if (!active()) { stream.getTracks().forEach((t:any)=>t.stop()); stream.release(); return; }
      this.stream = stream;
      preview(stream);
      const pc = this.pc = new this.rtc.RTCPeerConnection({iceServers:[]});
      for (const track of stream.getVideoTracks()) pc.addTransceiver(track,{direction:'sendonly'});
      pc.addEventListener('connectionstatechange', () => {
        if (pc.connectionState === 'connected' && this.timer) { clearTimeout(this.timer); this.timer=null; }
        if (['failed','disconnected'].includes(pc.connectionState)) fail('Video connection lost; using camera samples');
      });
      this.unsubscribe = this.connection.onMessage(async (message:any) => {
        if (!active()) return;
        try {
          if (message.type === 'WEBRTC_ANSWER') await pc.setRemoteDescription(message.payload);
          if (message.type === 'ERROR' && message.payload?.error_code === 'WEBRTC_FAILED') fail(message.payload.message);
        } catch (error) { fail(error); }
      });
      const offer = await pc.createOffer();
      if (!active()) return;
      // No CVO negotiation: libwebrtc must rotate encoded pixels for receivers
      // such as aiortc that cannot interpret RTP orientation metadata.
      offer.sdp = offer.sdp.split(/\r?\n/).filter((line:string)=>!line.includes('urn:3gpp:video-orientation')).join('\r\n');
      await pc.setLocalDescription(offer);
      while (active() && pc.iceGatheringState !== 'complete') await new Promise(r=>setTimeout(r,50));
      if (active() && !this.connection.sendMessage({type:'WEBRTC_OFFER',timestamp:Date.now(),payload:{sdp:pc.localDescription.sdp,type:'offer'}}))
        fail('Signalling socket unavailable');
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
