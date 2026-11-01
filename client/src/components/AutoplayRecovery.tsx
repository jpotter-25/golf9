import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/** An ordinary on-board control, not a native popup that can fail to present. */
export function AutoplayRecovery({ busy, forfeited, error, onTakeControl }: {
  busy: boolean;
  forfeited: boolean;
  error: string | null;
  onTakeControl: () => void;
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title} accessibilityLiveRegion="polite">{forfeited ? 'Match forfeited' : 'Autoplay is playing for you'}</Text>
      {forfeited ? (
        <Text style={styles.body}>A forfeited seat cannot be reclaimed.</Text>
      ) : (
        <Pressable
          onPress={onTakeControl}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Take back control from autoplay"
          accessibilityState={{ disabled: busy, busy }}
          style={({ pressed }) => [styles.button, (busy || pressed) && styles.dimmed]}
        >
          <Text style={styles.buttonText}>{busy ? 'Restoring Control…' : 'Take Back Control'}</Text>
        </Pressable>
      )}
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { width: '100%', gap: 6 },
  title: { color: '#67E0B0', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  body: { color: '#F7FAFC', fontSize: 14, textAlign: 'center' },
  button: { minHeight: 44, borderRadius: 8, backgroundColor: '#67E0B0', paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#1A2943', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  dimmed: { opacity: 0.65 },
  error: { color: '#FFB5BB', fontSize: 13, textAlign: 'center' },
});
