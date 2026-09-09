const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
const sockets = [];
class FakeSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  constructor(url) { this.url = url; this.readyState = 1; this.bufferedAmount = 0; this.sent = []; sockets.push(this); }
  send(value) { this.sent.push(JSON.parse(value)); }
  close() { this.readyState = 3; this.onclose?.({ code: 1000, reason: 'test' }); }
}
function load(relative) {
  const filename = path.resolve(root, relative.endsWith('.ts') ? relative : relative + '.ts');
  if (cache.has(filename)) return cache.get(filename);
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const customRequire = name => {
    if (name.endsWith('/utils/device')) return { DeviceUtils: { getDeviceInfo: async () => ({}), getCameraCapabilities: () => ({}) } };
    if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), name)));
    return require(name);
  };
  vm.runInNewContext(source, { module, exports: module.exports, require: customRequire,
    WebSocket: FakeSocket, console, Date, Set, Math,
    setTimeout: () => 1, clearTimeout: () => {}, setInterval: () => 1, clearInterval: () => {},
  }, { filename });
  cache.set(filename, module.exports);
  return module.exports;
}
(async () => {
  const cameraModule = load('src/camera/CameraService');
  const camera = new cameraModule.CameraService();
  assert.equal(camera.getSettings().resolution, '720p', 'New installs default to the balanced detection profile');
  assert.equal(camera.getSettings().targetFps, 4, 'New installs sample at 4 FPS for temporal tracking');
  const balanced = typeof cameraModule.getStreamEncodingProfile === 'function'
    ? cameraModule.getStreamEncodingProfile('720p')
    : null;
  assert.equal(balanced?.maxEdge, 1280);
  assert.equal(balanced?.jpegQuality, 75);
  const orientation = load('src/camera/orientation');
  for (const mode of ['up', 'right', 'down', 'left']) {
    assert.equal(orientation.getPreviewRotation(mode, mode), 0,
      'Preview bitmap already upright when device and display agree');
  }
  assert.equal(orientation.getPreviewRotation('right', 'up'), 270);
  assert.equal(orientation.getPreviewRotation('left', 'up'), 90);
  assert.equal(orientation.getPreviewRotation('down', 'up'), 180);
  assert.equal(orientation.getPreviewRotation(undefined, 'up'), null);
  assert.equal(orientation.getPreviewRotation('right', undefined), null);

  const { WebSocketConnectionService } = load('src/services/connection/WebSocketConnectionService');
  const service = new WebSocketConnectionService();
  const connection = service.connect({ server: '192.168.1.10', port: 8000, session: 'CAM-NORTH-TEST', token: 'pairing', secure: false, protocol: 'ws', expires: Date.now() + 10000 });
  const socket = sockets[0];
  await socket.onopen();
  socket.onmessage({ data: JSON.stringify({ type: 'REGISTRATION_ACK', timestamp: Date.now(), payload: {
    cameraId: 'CAM-NORTH-TEST', assignedLane: 'North Approach', session_token: 'issued-session',
  } }) });
  const info = await connection;
  assert.equal(info.token, 'issued-session');
  service.requestStartStream();
  assert.equal(service.getState(), 'WAITING', 'Only a server ACK starts streaming');
  assert.equal(socket.sent.at(-1).type, 'START_STREAM');
  assert.equal(socket.sent.at(-1).token, 'issued-session');
  socket.onmessage({ data: JSON.stringify({ type: 'START_STREAM', timestamp: Date.now(), payload: {} }) });
  assert.equal(service.getState(), 'STREAMING');
  service.sendMessage({ type: 'VIDEO_FRAME', timestamp: Date.now(), payload: { frame_id: 'NORTH-test-000001', frame_data: 'test' } });
  assert.equal(socket.sent.at(-1).payload.session_token, 'issued-session');
  assert.equal(service.canCaptureFrame(), true, 'Capture remains decoupled while YOLO processes an earlier frame');
  service.sendMessage({ type: 'VIDEO_FRAME', timestamp: Date.now(), payload: { frame_id: 'NORTH-test-000002', frame_data: 'test' } });
  assert.equal(socket.sent.at(-1).payload.frame_id, 'NORTH-test-000002', 'newer frame IDs remain independently identifiable');
  socket.onmessage({ data: JSON.stringify({ type: 'FRAME_ACK', payload: {
    frame_id: 'wrong-frame', server_processing_ms: 20, queue_wait_ms: 5,
  } }) });
  assert.equal(service.canCaptureFrame(), true, 'An unrelated ACK must not corrupt bounded in-flight tracking');
  socket.onmessage({ data: JSON.stringify({ type: 'FRAME_ACK', payload: {
    frame_id: 'NORTH-test-000001', server_processing_ms: 20, queue_wait_ms: 5,
  } }) });
  assert.equal(service.canCaptureFrame(), true, 'The matching processed-frame ACK releases capture');
  assert.equal(service.getFrameLatency().serverMs, 20);
  for (let i = 0; i < 20; i++) {
    assert.equal(service.canCaptureFrame(), true, 'Dropped backend frames must not stall fresh capture');
    service.sendMessage({ type: 'VIDEO_FRAME', timestamp: Date.now(), payload: { frame_id: `dropped-${i}` } });
  }
  socket.bufferedAmount = 128 * 1024;
  assert.equal(service.canCaptureFrame(), false, 'Actual network congestion still pauses capture');
  socket.bufferedAmount = 0;
  socket.onmessage({ data: JSON.stringify({ type: 'HEARTBEAT_ACK', timestamp: Date.now() / 1000, payload: { client_timestamp: Date.now() - 12 } }) });
  assert.ok(service.getPingLatency() < 1000, 'RTT must not mix milliseconds and seconds');
  await service.disconnect();
  assert.equal(socket.sent.at(-1).payload.node_id, 'CAM-NORTH-TEST');
  const { QRCodeService } = load('src/services/qr/QRCodeService');
  assert.throws(() => QRCodeService.parseQRPayload(JSON.stringify({ server: '192.168.1.10', port: 8000,
    session: 'test', token: 'test', expires: 1, protocol: 'ws', camera_direction: 'north' })), /expired/);
  const eastQR = QRCodeService.parseQRPayload(JSON.stringify({server:'192.168.1.10', port:443,
    session:'opaque-session', token:'pair', expires:Date.now()+10000, protocol:'wss', secure:true, camera_direction:'east'}));
  const east = new WebSocketConnectionService();
  const pendingEast = east.connect(eastQR);
  const eastSocket = sockets.at(-1);
  await eastSocket.onopen();
  assert.equal(eastSocket.url, 'wss://192.168.1.10/ws/camera');
  assert.equal(eastSocket.sent[0].payload.camera_direction, 'east');
  eastSocket.onmessage({data:JSON.stringify({type:'REGISTRATION_ACK', timestamp:Date.now(),
    payload:{cameraId:'opaque-session', assignedLane:'East Approach', session_token:'issued-east'}})});
  await pendingEast;
  await east.disconnect();
  console.log('PASS: issued token, server-controlled streaming, processed-frame backpressure/latency, RTT, identity, QR direction and TLS');
})().catch(error => { console.error(error); process.exitCode = 1; });
