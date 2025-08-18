// src/screens/SettingsScreen.tsx
// Purpose: Provide toggles for sound and vibration effects as well as a logout
// option.  Adjust settings in your state or persist them as needed.

import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const [sound, setSound] = useState(true);
  const [vibrate, setVibrate] = useState(true);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Sound</Text>
        <Switch
          value={sound}
          onValueChange={setSound}
          thumbColor={sound ? '#52E5A7' : '#444'}
          trackColor={{ false: '#555', true: '#52E5A7' }}
        />
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Vibrate</Text>
        <Switch
          value={vibrate}
          onValueChange={setVibrate}
          thumbColor={vibrate ? '#52E5A7' : '#444'}
          trackColor={{ false: '#555', true: '#52E5A7' }}
        />
      </View>

      {/* You could implement an actual logout by clearing session state here */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.buttonText}>Back to Lobby</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1023',
    alignItems: 'center',
    paddingTop: 80
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#52E5A7',
    marginBottom: 32
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '80%',
    marginBottom: 24
  },
  label: {
    color: '#E8ECF1',
    fontSize: 18
  },
  button: {
    backgroundColor: '#52E5A7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 40
  },
  buttonText: {
    color: '#0B1023',
    fontSize: 16,
    fontWeight: 'bold'
  }
});
