// client/src/screens/OnlineRoomScreen.tsx
// Purpose: Online multiplayer room flow: create/join, ready list, host start, leave/reconnect.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { useAuth } from '../context/AuthContext';
import { createOnlineRoom, joinOnlineRoom, RoomSummary } from '../services/api';
import { joinRoomSocket, leaveOnlineRoom, onRoomUpdate, setReady, startOnlineGame } from '../services/network';

type Props = NativeStackScreenProps<RootStackParamList, 'OnlineRoom'>;

export default function OnlineRoomScreen({ route, navigation }: Props) {
  const { token, user } = useAuth();
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [joinCode, setJoinCode] = useState(route.params.joinCode ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    const setup = async () => {
      try {
        if (route.params.create) {
          const res = await createOnlineRoom(token, route.params.players, route.params.rounds);
          setRoom(res.room);
          await joinRoomSocket(token, res.room.code);
        }
      } catch (error) {
        Alert.alert('Room error', error instanceof Error ? error.message : 'Unable to create room.');
      }
    };
    setup();
  }, [route.params.create, route.params.players, route.params.rounds, token]);

  useEffect(() => {
    if (!room) return;
    const offRoom = onRoomUpdate(setRoom);
    return () => offRoom();
  }, [room]);

  const join = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const res = await joinOnlineRoom(token, joinCode.trim().toUpperCase());
      setRoom(res.room);
      await joinRoomSocket(token, res.room.code);
    } catch (error) {
      Alert.alert('Join failed', error instanceof Error ? error.message : 'Unable to join room.');
    } finally {
      setBusy(false);
    }
  };

  const toggleReady = async () => {
    if (!token || !room || !user) return;
    const current = room.players.find(player => player.userId === user.userId)?.ready ?? false;
    await setReady(token, room.code, !current);
  };

  const start = async () => {
    if (!token || !room) return;
    try {
      await startOnlineGame(token, room.code);
      navigation.replace('Game', { players: room.players.length, rounds: route.params.rounds, mode: 'online', roomCode: room.code, online: true });
    } catch (error) {
      Alert.alert('Cannot start', error instanceof Error ? error.message : 'Try again.');
    }
  };

  const leave = async () => {
    if (token && room) await leaveOnlineRoom(token, room.code);
    navigation.goBack();
  };

  if (!room) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Join Online Room</Text>
        <TextInput style={styles.input} placeholder="Room code" placeholderTextColor="#9BA3C7" value={joinCode} onChangeText={setJoinCode} autoCapitalize="characters" />
        <Pressable style={styles.button} disabled={busy} onPress={join}><Text style={styles.buttonText}>Join Room</Text></Pressable>
        <Pressable style={styles.linkButton} onPress={() => navigation.goBack()}><Text style={styles.link}>Back</Text></Pressable>
      </View>
    );
  }

  const isHost = room.hostUserId === user?.userId;
  const allReady = room.players.length >= 2 && room.players.every(player => player.ready);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Room {room.code}</Text>
      <Text style={styles.subtitle}>{room.players.length}/{room.maxPlayers} players • {room.rounds} rounds</Text>
      {room.players.map(player => (
        <View key={player.userId} style={styles.playerRow}>
          <Text style={styles.avatar}>{player.avatarInitial}</Text>
          <Text style={styles.playerName}>{player.displayName}{player.isHost ? ' 👑' : ''}</Text>
          <Text style={styles.status}>{player.connected ? 'Online' : 'Offline'} • {player.ready ? 'Ready' : 'Not ready'}</Text>
        </View>
      ))}
      <Pressable style={styles.button} onPress={toggleReady}><Text style={styles.buttonText}>Toggle Ready</Text></Pressable>
      {isHost && <Pressable style={[styles.button, !allReady && styles.disabled]} disabled={!allReady} onPress={start}><Text style={styles.buttonText}>Start Game</Text></Pressable>}
      <Pressable style={styles.linkButton} onPress={leave}><Text style={styles.link}>Leave Room</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1023', padding: 20, justifyContent: 'center' },
  title: { color: '#52E5A7', fontSize: 32, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: '#E8ECF1', textAlign: 'center', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#2A2F57', borderRadius: 12, color: '#E8ECF1', padding: 14, backgroundColor: '#121737', marginBottom: 12 },
  playerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#121737', borderRadius: 12, padding: 12, marginBottom: 10 },
  avatar: { color: '#52E5A7', fontWeight: '800', width: 32 },
  playerName: { color: '#E8ECF1', flex: 1, fontWeight: '700' },
  status: { color: '#9BA3C7', fontSize: 12 },
  button: { backgroundColor: '#52E5A7', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#0B1023', fontWeight: '800' },
  linkButton: { alignItems: 'center', marginTop: 16 },
  link: { color: '#FFCC66', textDecorationLine: 'underline' },
});
