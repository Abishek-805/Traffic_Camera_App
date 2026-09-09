import React, {useEffect, useState} from 'react';
import {AppState, View, StyleSheet} from 'react-native';
import {Text, Button} from 'react-native-paper';
import {useConnection} from '../hooks/useConnection';
import {ConnectionServiceFactory} from '../services/connection/ConnectionServiceFactory';
import {WebRTCVideoSession} from '../services/camera/WebRTCVideoSession';
import {activateKeepAwakeAsync, deactivateKeepAwake} from 'expo-keep-awake';

export function WebRTCPreview({onFallback}: {onFallback:(reason:string)=>void}) {
  const {connectionInfo,connectionState,requestStopStream,disconnect}=useConnection();
  const [stream,setStream]=useState<any>(null);
  const [rtc,setRtc]=useState<any>(null);
  const [foreground,setForeground]=useState(AppState.currentState==='active');
  useEffect(()=>{const sub=AppState.addEventListener('change',state=>setForeground(state==='active'));return()=>sub.remove();},[]);
  useEffect(()=>{
    if(!foreground || connectionState!=='STREAMING') return;
    let session:WebRTCVideoSession|undefined;
    try {
      const native=require('react-native-webrtc');
      setRtc(native);
      session=new WebRTCVideoSession(ConnectionServiceFactory.getInstance(),native);
      session.start('back',setStream,onFallback);
      activateKeepAwakeAsync('traffic-video').catch(()=>{});
    } catch(error) { onFallback('Video capture unavailable; using camera samples'); }
    return()=>{session?.stop();setStream(null);deactivateKeepAwake('traffic-video');};
  },[foreground,connectionState,onFallback]);
  const Video=rtc?.RTCView;
  return <View style={{flex:1,backgroundColor:'#0b101b'}}>
    {Video && stream && <Video streamURL={stream.toURL()} style={StyleSheet.absoluteFill} objectFit="contain"/>}
    <View style={{padding:24,paddingTop:54}}>
      <Text style={{color:'white'}}>Video · {connectionInfo?.assignedLane}</Text>
      <Text style={{color:'white'}}>{!foreground?'Camera paused in background':stream?'Camera active · connecting/streaming':'Starting video camera'}</Text>
    </View>
    <View style={{marginTop:'auto',padding:24,gap:8}}>
      <Button mode="contained" onPress={requestStopStream}>Pause</Button>
      <Button onPress={()=>disconnect('User disconnected video')}>Disconnect</Button>
      <Button onPress={()=>onFallback('Camera samples selected')}>Use camera samples</Button>
    </View>
  </View>;
}
