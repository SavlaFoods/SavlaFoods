import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../type/type';
import { migrateAllSecureKeys } from '../utils/migrationHelper';
// import { getSecureItem } from '../utils/secureStorage';
import { getSecureItem, removeSecureItem } from '../utils/secureStorage';
import axios from 'axios';
import { useAuthorization } from '../contexts/AuthorizationContext';
import {
  clearActivity,
  hasSessionExpired,
  recordActivity,
} from '../utils/sessionTimeout';

const SplashScreen: React.FC = () => {
  const navigation =
    useNavigation<NavigationProp<RootStackParamList, 'SplashScreen'>>();
  const [migrationComplete, setMigrationComplete] = useState(false);
  const { initializeAuthorization, isLoading: authLoading } =
    useAuthorization();

  useEffect(() => {
    const initialize = async () => {
      try {
        // Perform migration from AsyncStorage to Keychain
        const results = await migrateAllSecureKeys();
        console.log('Migration results:', results);
        setMigrationComplete(true);

        // // Check if user is already logged in
        // const token = await getSecureItem('userToken');
        // const rar = await getSecureItem('RAR');

        const token = await getSecureItem('userToken');
        const rar = await getSecureItem('RAR');

        console.log('========== SPLASH ==========');
        console.log('TOKEN:', token);
        console.log('RAR:', rar);
        console.log('TOKEN EXISTS:', token !== null);
        console.log('RAR EXISTS:', rar !== null);
        console.log('============================');

        let hasValidSession = token !== null && rar !== null;

        if (hasValidSession) {
          console.log('Setting Authorization Header...');
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          console.log('Token set in axios defaults on app startup');
          await initializeAuthorization();
          console.log('Authorization initialized');
          await recordActivity();
        }
        if (hasValidSession) {
          const expired = await hasSessionExpired();
          if (expired) {
            await removeSecureItem('userToken');
            await removeSecureItem('customerID');
            await removeSecureItem('Disp_name');
            await removeSecureItem('FK_CUST_GROUP_ID');
            await removeSecureItem('RAR');
            await clearActivity();
            delete axios.defaults.headers.common['Authorization'];
            hasValidSession = false;
          }
        } else if (token) {
          // Stale/broken session: token exists but RAR was never saved.
          // Wipe it so we don't loop back into NoAccess.
          console.log('⚠️ Token found without RAR — clearing stale session');
          await removeSecureItem('userToken');
          await removeSecureItem('RAR');
          delete axios.defaults.headers.common['Authorization'];
        }

        // Navigate to appropriate screen after a short delay
        setTimeout(() => {
          if (hasValidSession) {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Main' }],
            });
            console.log('➡️ Navigating to MAIN');
          } else {
            navigation.reset({
              index: 0,
              routes: [{ name: 'OtpVerificationScreen' }],
            });
            console.log('➡️ Navigating to LOGIN');
          }
        }, 1000);
      } catch (error) {
        console.error('❌ Splash Initialization Error:', error);
        // Navigate to login screen on error
        setTimeout(() => {
          navigation.reset({
            index: 0,
            routes: [{ name: 'OtpVerificationScreen' }],
          });
        }, 1000);
      }
    };

    initialize();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/SavlaLogo.jpg')}
        style={styles.logo}
        resizeMode="contain"
        testID="splash-logo"
      />
      <Text style={styles.text}>Savla Foods and Cold Storage</Text>
      {!migrationComplete && (
        <ActivityIndicator style={styles.loader} size="large" color="#63A1D8" />
      )}
      {migrationComplete && authLoading && (
        <Text style={styles.text}>Loading permissions...</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  logo: {
    width: 200,
    height: 200,
    marginTop: 0,
  },
  text: {
    fontSize: 18,
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    marginTop: 10,
  },
  loader: {
    marginTop: 20,
  },
});

export default SplashScreen;
