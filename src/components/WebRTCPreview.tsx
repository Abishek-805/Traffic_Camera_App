import React, {useEffect, useState} from 'react';
import {AppState, View, StyleSheet} from 'react-native';
import {Text, Button} from 'react-native-paper';
import {useConnection} from '../hooks/useConnection';
import {ConnectionServiceFactory} from '../services/connection/ConnectionServiceFactory';
import {WebRTCVideoSession} from '../services/camera/WebRTCVideoSession';
import {activateKeepAwakeAsync, deactivateKeepAwake} from 'expo-keep-awake';
import {CameraLogger} from '../utils/logger';

export function WebRTCPreview() {
  const {connectionInfo,connectionState,requestStopStream,disconnect}=useConnection();
  const [stream,setStream]=useState<any>(null);
  const [rtc,setRtc]=useState<any>(null);
  const [error,setError]=useState('');
  const [phase,setPhase]=useState('camera');
  const [retryNonce,setRetryNonce]=useState(0);
  const [foreground,setForeground]=useState(AppState.currentState==='active');
  useEffect(()=>{const sub=AppState.addEventListener('change',state=>setForeground(state==='active'));return()=>sub.remove();},[]);
  useEffect(()=>{
    if(!foreground || connectionState!=='STREAMING') return;
    let session:WebRTCVideoSession|undefined;
    const startedAt=Date.now();
    const reportPhase=(nextPhase:string)=>{
      setPhase(nextPhase);
      CameraLogger.log('WEBRTC_PHASE',{phase:nextPhase,elapsedMs:Date.now()-startedAt});
    };
    setError('');
    setStream(null);
    try {
      const native=require('react-native-webrtc');
      setRtc(native);
      session=new WebRTCVideoSession(ConnectionServiceFactory.getInstance(),native);
      session.start('back',setStream,message=>{
        setStream(null);
        setError(message);
        CameraLogger.log('WEBRTC_FAILURE',{message,elapsedMs:Date.now()-startedAt});
      },reportPhase);
      activateKeepAwakeAsync('traffic-video').catch(()=>{});
    } catch(caught:any) {
      const message=caught?.message || 'WebRTC video capture is unavailable on this device.';
      setError(message);
      CameraLogger.log('WEBRTC_FAILURE',{message,elapsedMs:Date.now()-startedAt});
    }
    return()=>{session?.stop();setStream(null);deactivateKeepAwake('traffic-video');};
  },[foreground,connectionState,retryNonce]);
  const Video=rtc?.RTCView;
  const statusText = error
    ? 'WebRTC video is not connected'
    : stream
      ? phase === 'connected' ? 'Camera active · WebRTC connected' : `Camera active · ${phase}`
      : 'Starting video camera';
  return <View style={{flex:1,backgroundColor:'#0b101b'}}>
    {Video && stream && <Video streamURL={stream.toURL()} style={StyleSheet.absoluteFill} objectFit="contain"/>}
    <View style={{padding:24,paddingTop:54}}>
      <Text style={{color:'white'}}>Video · {connectionInfo?.assignedLane}</Text>
      <Text style={{color:'white'}}>{!foreground?'Camera paused in background':statusText}</Text>
      {error ? <Text style={{color:'#ff8a80',marginTop:8}}>{error}</Text> : null}
    </View>
    <View style={{marginTop:'auto',padding:24,gap:8}}>
      {error ? <Button mode="contained" onPress={()=>setRetryNonce(value=>value+1)}>Retry WebRTC</Button> : null}
      <Button mode="contained" onPress={requestStopStream}>Pause</Button>
      <Button onPress={()=>disconnect('User disconnected video')}>Disconnect</Button>
    </View>
  </View>;
}
