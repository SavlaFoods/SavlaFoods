import { Alert } from 'react-native';

let alertOpen = false;

// Shows one alert at a time so a burst of failures doesn't stack popups
export const debugAlert = (title: string, lines: Record<string, any>) => {
  if (alertOpen) return;
  alertOpen = true;

  const message = Object.entries(lines)
    .map(([k, v]) => {
      const val = typeof v === 'string' ? v : JSON.stringify(v);
      return `${k}: ${val}`;
    })
    .join('\n')
    .slice(0, 900); // iOS truncates very long alerts

  Alert.alert(title, message, [
    { text: 'OK', onPress: () => (alertOpen = false) },
  ]);
};
