// client/src/screens/SettingsScreen.tsx
// Purpose: Provide toggles for sound and vibration effects and a back button.
// You could extend this to persist settings or handle logout.

import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const SettingsScreen: React.FC<Props> = ({ navigation }) => {
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

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.buttonText}>Back to Lobby</Text>
      </TouchableOpacity>
    </View>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1023',
    alignItems: 'center',
    paddingTop: 80,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#52E5A7',
    marginBottom: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '80%',
    marginBottom: 24,
  },
  label: {
    color: '#E8ECF1',
    fontSize: 18,
  },
  button: {
    backgroundColor: '#52E5A7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 40,
  },
  buttonText: {
    color: '#0B1023',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
