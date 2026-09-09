const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync('src/services/camera/WebRTCVideoSession.ts', 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleResult = {exports:{}};
vm.runInNewContext(source, {module:moduleResult,exports:moduleResult.exports,require,Date,Error,Promise,setTimeout,clearTimeout});
const {WebRTCVideoSession} = moduleResult.exports;
let released = 0, stopped = 0;
const stream = {getTracks:()=>[{stop:()=>stopped++}],getVideoTracks:()=>[{}],release:()=>released++,toURL:()=> 'camera'};
class Peer {
  constructor(){this.events={}; this.iceGatheringState='complete'; Peer.last=this;}
  addEventListener(k,f){this.events[k]=f;}
  removeEventListener(k){delete this.events[k];}
  addTransceiver(){return {sender:{getParameters:()=>({encodings:[{}]}),setParameters:async()=>{}}};}
  async createOffer(){return {type:'offer',sdp:'v=0\r\na=extmap:4 urn:3gpp:video-orientation\r\na=sendonly\r\n'};}
  async setLocalDescription(d){this.localDescription=d;}
  async setRemoteDescription(d){this.remoteDescription=d;}
  close(){this.closed=true;}
}
const sent=[];let listener;
const connection={sendMessage:m=>(sent.push(m),true),onMessage:f=>(listener=f,()=>listener=null)};
const rtc={RTCPeerConnection:Peer,mediaDevices:{getUserMedia:async c=>{assert.equal(c.audio,false);return stream;}}};
(async()=>{
 const session=new WebRTCVideoSession(connection,rtc);
 await session.start('back',()=>{},()=>{});
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
 console.log('WebRTC signaling, video-only capture, orientation SDP, idempotent cleanup and late-camera cancellation passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
