import React, {useEffect} from 'react';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {WebRTCPreview} from '../components/WebRTCPreview';
import {useConnection} from '../hooks/useConnection';
import {RootStackParamList} from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Streaming'>;

/** The active camera screen intentionally has one transport: WebRTC video. */
export const StreamingScreen: React.FC<Props> = ({navigation}) => {
  const {connectionState}=useConnection();
  useEffect(()=>{
    if(connectionState==='WAITING') navigation.replace('Waiting');
    if(connectionState==='DISCONNECTED' || connectionState==='ERROR') {
      navigation.replace('Disconnected',{reason:'Connection ended'});
    }
  },[connectionState,navigation]);
  return <WebRTCPreview/>;
};
