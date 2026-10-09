// import React, {
//   createContext,
//   useContext,
//   useEffect,
//   useState,
//   useCallback,
// } from 'react';
// import NetInfo, {NetInfoState} from '@react-native-community/netinfo';
// import {View, Text, StyleSheet, Dimensions} from 'react-native';

// // Define the context type
// interface NetworkContextType {
//   isConnected: boolean | null;
//   addRetryCallback: (id: string, callback: () => void) => void;
//   removeRetryCallback: (id: string) => void;
// }

// // Create the context with default values
// const NetworkContext = createContext<NetworkContextType>({
//   isConnected: null,
//   addRetryCallback: () => {},
//   removeRetryCallback: () => {},
// });

// // Custom hook to use the context
// export const useNetwork = () => useContext(NetworkContext);

// // The provider component
// export const NetworkProvider: React.FC<{children: React.ReactNode}> = ({
//   children,
// }) => {
//   const [isConnected, setIsConnected] = useState<boolean | null>(true);
//   const [showMessage, setShowMessage] = useState(false);
//   const [previousConnected, setPreviousConnected] = useState<boolean | null>(
//     true,
//   );
//   const [retryCallbacks, setRetryCallbacks] = useState<
//     Record<string, () => void>
//   >({});

//   // Add a callback to be executed when internet connectivity is restored
//   const addRetryCallback = useCallback((id: string, callback: () => void) => {
//     setRetryCallbacks(prev => ({
//       ...prev,
//       [id]: callback,
//     }));
//   }, []);

//   // Remove a callback
//   const removeRetryCallback = useCallback((id: string) => {
//     setRetryCallbacks(prev => {
//       const newCallbacks = {...prev};
//       delete newCallbacks[id];
//       return newCallbacks;
//     });
//   }, []);

//   useEffect(() => {
//     // Execute all retry callbacks when internet is restored
//     if (isConnected === true && previousConnected === false) {
//       // Execute all registered callbacks
//       Object.values(retryCallbacks).forEach(callback => {
//         try {
//           callback();
//         } catch (error) {
//           console.error('Error executing network retry callback:', error);
//         }
//       });
//     }

//     setPreviousConnected(isConnected);
//   }, [isConnected, previousConnected, retryCallbacks]);

//   useEffect(() => {
//     // Subscribe to network info updates
//     const unsubscribe = NetInfo.addEventListener(state => {
//       setIsConnected(state.isConnected);
//       setShowMessage(!state.isConnected);
//     });

//     // Initial check
//     NetInfo.fetch().then(state => {
//       setIsConnected(state.isConnected);
//       setShowMessage(!state.isConnected);
//     });

//     // Cleanup on unmount
//     return () => {
//       unsubscribe();
//     };
//   }, []);

//   return (
//     <NetworkContext.Provider
//       value={{isConnected, addRetryCallback, removeRetryCallback}}>
//       {children}
//       {showMessage && (
//         <View style={styles.offlineContainer}>
//           <Text style={styles.offlineText}>No internet connection</Text>
//         </View>
//       )}
//     </NetworkContext.Provider>
//   );
// };

// const {width} = Dimensions.get('window');

// const styles = StyleSheet.create({
//   offlineContainer: {
//     position: 'absolute',
//     top: 0,
//     left: 0,
//     right: 0,
//     backgroundColor: '#b52424',
//     padding: 10,
//     alignItems: 'center',
//     width: width,
//     zIndex: 1000,
//   },
//   offlineText: {
//     color: '#fff',
//     fontWeight: 'bold',
//   },
// });

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { View, Text, StyleSheet, Platform } from 'react-native';

interface NetworkContextType {
  isConnected: boolean | null;
  addRetryCallback: (id: string, callback: () => void) => void;
  removeRetryCallback: (id: string) => void;
}

const NetworkContext = createContext<NetworkContextType>({
  isConnected: null,
  addRetryCallback: () => {},
  removeRetryCallback: () => {},
});

const debugLog = (tag: string, data?: unknown) => {
  try {
    console.log(
      `[Network] ${tag}`,
      data === undefined ? '' : JSON.stringify(data),
    );
  } catch {
    console.log(`[Network] ${tag}`);
  }
};

export const useNetwork = () => useContext(NetworkContext);

const OFFLINE_BANNER_DELAY_MS = 2000; // ignore short blips when switching networks
const RESTORE_DELAY_MS = 800; // let the connection settle before retrying

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);

  const callbacksRef = useRef<Record<string, () => void>>({});
  const sawOfflineRef = useRef(false); // set immediately on ANY offline signal
  const offlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addRetryCallback = useCallback((id: string, cb: () => void) => {
    callbacksRef.current[id] = cb;
  }, []);

  const removeRetryCallback = useCallback((id: string) => {
    delete callbacksRef.current[id];
  }, []);

  useEffect(() => {
    const runCallbacks = () => {
      debugLog('Network restored: running retry callbacks', {
        ids: Object.keys(callbacksRef.current),
      });
      Object.values(callbacksRef.current).forEach(cb => {
        try {
          cb();
        } catch (e) {
          console.error('Network retry callback failed:', e);
        }
      });
    };

    const handle = (state: NetInfoState) => {
      const offline =
        state.isConnected === false || state.isInternetReachable === false;
      const online =
        state.isConnected === true && state.isInternetReachable !== false;

      debugLog('NetInfo', {
        connected: state.isConnected,
        reachable: state.isInternetReachable,
        type: state.type,
      });

      if (offline) {
        sawOfflineRef.current = true; // remember even a short blip
        if (restoreTimer.current) {
          clearTimeout(restoreTimer.current);
          restoreTimer.current = null;
        }
        if (!offlineTimer.current) {
          // only show the banner if it stays offline
          offlineTimer.current = setTimeout(() => {
            offlineTimer.current = null;
            setIsConnected(false);
          }, OFFLINE_BANNER_DELAY_MS);
        }
      } else if (online) {
        if (offlineTimer.current) {
          clearTimeout(offlineTimer.current);
          offlineTimer.current = null;
        }
        setIsConnected(true);

        if (sawOfflineRef.current && !restoreTimer.current) {
          restoreTimer.current = setTimeout(() => {
            restoreTimer.current = null;
            sawOfflineRef.current = false;
            runCallbacks();
          }, RESTORE_DELAY_MS);
        }
      }
      // null / unknown state: do nothing, wait for a definite answer
    };

    const unsubscribe = NetInfo.addEventListener(handle);
    NetInfo.fetch().then(handle);

    return () => {
      unsubscribe();
      if (offlineTimer.current) clearTimeout(offlineTimer.current);
      if (restoreTimer.current) clearTimeout(restoreTimer.current);
    };
  }, []);

  const value = useMemo(
    () => ({ isConnected, addRetryCallback, removeRetryCallback }),
    [isConnected, addRetryCallback, removeRetryCallback],
  );

  return (
    <NetworkContext.Provider value={value}>
      {children}
      {isConnected === false && (
        <View style={styles.offlineContainer} pointerEvents="none">
          <Text style={styles.offlineText}>No internet connection</Text>
        </View>
      )}
    </NetworkContext.Provider>
  );
};

const styles = StyleSheet.create({
  offlineContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#b52424',
    paddingTop: Platform.OS === 'ios' ? 54 : 10, // clears the notch / Dynamic Island
    paddingBottom: 8,
    alignItems: 'center',
    zIndex: 1000,
  },
  offlineText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
