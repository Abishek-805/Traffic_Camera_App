const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync('src/services/camera/WebRTCVideoSession.ts', 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleResult = {exports:{}};
vm.runInNewContext(source, {module:moduleResult,exports:moduleResult.exports,require,Date,Error,Promise,setTimeout,clearTimeout});
const {WebRTCVideoSession} = moduleResult.exports;
let released = 0, stopped = 0, captureConstraints;
const stream = {getTracks:()=>[{stop:()=>stopped++}],getVideoTracks:()=>[{}],release:()=>released++,toURL:()=> 'camera'};
class Peer {
  constructor(){this.events={}; this.iceGatheringState='complete'; Peer.last=this;}
  addEventListener(k,f){this.events[k]=f;}
  removeEventListener(k){delete this.events[k];}
  addTransceiver(){return {sender:{getParameters:()=>this.senderParameters || {encodings:[{}]},setParameters:async p=>{this.senderParameters=p;}}};}
  async createOffer(){return {type:'offer',sdp:'v=0\r\na=extmap:4 urn:3gpp:video-orientation\r\na=sendonly\r\n'};}
  async setLocalDescription(d){this.localDescription={...d,sdp:`${d.sdp}a=candidate:1 1 UDP 1 192.168.1.2 5000 typ host\r\n`};}
  async setRemoteDescription(d){this.remoteDescription=d;}
  close(){this.closed=true;}
}
const sent=[];let listener;
const connection={sendMessage:m=>(sent.push(m),true),onMessage:f=>(listener=f,()=>listener=null)};
const rtc={RTCPeerConnection:Peer,mediaDevices:{getUserMedia:async c=>{assert.equal(c.audio,false);captureConstraints=c;return stream;}}};
(async()=>{
 const session=new WebRTCVideoSession(connection,rtc);
 await session.start('back',()=>{},()=>{});
 assert.equal(captureConstraints.video.width,1280);
 assert.equal(captureConstraints.video.height,720);
 assert.equal(captureConstraints.video.frameRate,24,'local preview must remain smooth');
 assert.equal(Peer.last.senderParameters.encodings[0].maxFramerate,8,'network video must be capped independently');
 assert.equal(sent[0].type,'WEBRTC_OFFER');
 assert.ok(!sent[0].payload.sdp.includes('video-orientation'));
 listener({type:'WEBRTC_ANSWER',payload:{sdp:'answer',type:'answer'}});
 await Promise.resolve();
 assert.equal(Peer.last.remoteDescription.sdp,'answer');
 session.stop();session.stop();
 assert.equal(released,1);assert.equal(stopped,1);assert.equal(Peer.last.closed,true);
 assert.equal(listener,null);
 assert.equal(sent.filter(x=>x.type==='WEBRTC_STOP').length,1);
 // getUserMedia resolving after stop must release its camera and never signal.
 let resolve; const lateRtc={...rtc,mediaDevices:{getUserMedia:()=>new Promise(r=>resolve=r)}};
 const late=new WebRTCVideoSession(connection,lateRtc);
 const task=late.start('back',()=>{},()=>{});late.stop();resolve(stream);await task;
 assert.equal(released,2);assert.equal(sent.filter(x=>x.type==='WEBRTC_OFFER').length,1);
 // A peer that never discovers a LAN candidate must fail quickly and remain
 // WebRTC-only instead of silently changing the transport.
 class NoIcePeer extends Peer {
   constructor(){super();this.iceGatheringState='gathering';}
   async setLocalDescription(d){this.localDescription=d;}
 }
 const noIceRtc={...rtc,RTCPeerConnection:NoIcePeer};
 const failures=[];
 const offersBefore=sent.filter(x=>x.type==='WEBRTC_OFFER').length;
 const noIce=new WebRTCVideoSession(connection,noIceRtc);
 const started=Date.now();
 await noIce.start('back',()=>{},message=>failures.push(message));
 assert.ok(Date.now()-started<2500,'ICE discovery must not hang for 10-30 seconds');
 assert.match(failures[0],/local network path/i);
 assert.equal(sent.filter(x=>x.type==='WEBRTC_OFFER').length,offersBefore,'an offer without a candidate must not be sent');

 class CompleteWithoutCandidatePeer extends Peer {
   async setLocalDescription(d){this.localDescription=d;this.iceGatheringState='complete';}
 }
 const completeWithoutCandidateRtc={...rtc,RTCPeerConnection:CompleteWithoutCandidatePeer};
 const completeFailures=[];
 const completeWithoutCandidate=new WebRTCVideoSession(connection,completeWithoutCandidateRtc);
 await completeWithoutCandidate.start('back',()=>{},message=>completeFailures.push(message));
 assert.match(completeFailures[0],/local network path/i,'complete ICE without a candidate must fail');
 assert.equal(sent.filter(x=>x.type==='WEBRTC_OFFER').length,offersBefore,'candidate-free complete ICE must not signal');

 class UnsupportedCapPeer extends Peer {
   addTransceiver(){return {sender:{getParameters:()=>({encodings:[{}]}),setParameters:async()=>{throw new Error('unsupported');}}};}
 }
 const unsupportedCapRtc={...rtc,RTCPeerConnection:UnsupportedCapPeer};
 const capFailures=[];
 const unsupportedCap=new WebRTCVideoSession(connection,unsupportedCapRtc);
 await unsupportedCap.start('back',()=>{},message=>capFailures.push(message));
 assert.match(capFailures[0],/frame-rate cap/i,'unsupported outbound cap must fail instead of sending 24 FPS');
 assert.equal(sent.filter(x=>x.type==='WEBRTC_OFFER').length,offersBefore,'uncapped video must not be signalled');

 class IgnoredCapPeer extends Peer {
   addTransceiver(){
     return {sender:{getParameters:()=>({encodings:[{}]}),setParameters:async parameters=>parameters}};
   }
 }
 const ignoredCapRtc={...rtc,RTCPeerConnection:IgnoredCapPeer};
 const ignoredCapFailures=[];
 const ignoredCap=new WebRTCVideoSession(connection,ignoredCapRtc);
 await ignoredCap.start('back',()=>{},message=>ignoredCapFailures.push(message));
 assert.match(ignoredCapFailures[0],/frame-rate cap/i,'a silently ignored native cap must fail read-back verification');
 assert.equal(sent.filter(x=>x.type==='WEBRTC_OFFER').length,offersBefore,'an unverified cap must not be signalled');

 class CandidatePeer extends NoIcePeer {
   async setLocalDescription(d){this.localDescription={...d,sdp:`${d.sdp}a=candidate:1 1 UDP 1 192.168.1.2 5000 typ host\r\n`};}
 }
 const candidateRtc={...rtc,RTCPeerConnection:CandidatePeer};
 const candidateSession=new WebRTCVideoSession(connection,candidateRtc);
 const candidateStarted=Date.now();
 await candidateSession.start('back',()=>{},()=>{});
 assert.ok(Date.now()-candidateStarted<500,'a discovered LAN candidate must be signalled immediately');
 assert.equal(sent.filter(x=>x.type==='WEBRTC_OFFER').length,offersBefore+1);
 candidateSession.stop();

 const streamingScreen=fs.readFileSync('src/screens/StreamingScreen.tsx','utf8');
 const previewScreen=fs.readFileSync('src/components/WebRTCPreview.tsx','utf8');
 assert.ok(!streamingScreen.includes('<SampledStreamingScreen'), 'streaming must not fall back to sampled JPEG transport');
 assert.match(streamingScreen,/connectionState\s*===\s*'WAITING'/, 'server pause must still leave the streaming screen');
 assert.match(streamingScreen,/navigation\.replace\('Disconnected'/, 'disconnect must still leave the streaming screen');
 assert.match(previewScreen,/Retry WebRTC/, 'a failed WebRTC connection must offer an explicit retry');
 console.log('WebRTC timing, smooth preview, bounded upload, signalling, retry-only failure, cleanup and orientation passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
