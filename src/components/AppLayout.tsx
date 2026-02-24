import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Header from './Header';
import { useDisplayName } from '../contexts/DisplayNameContext';
import { useCartNavigation } from '../hooks/useCartNavigation';
import { TabBar } from './BottomTabNavigator';

interface LayoutWrapperProps {
  children: React.ReactNode;
  showHeader?: boolean;
  showTabBar?: boolean;
  route: any;
}

export const LayoutWrapper: React.FC<LayoutWrapperProps> = ({
  children,
  showHeader = true,
  showTabBar = true,
  route,
}) => {
  const { displayName } = useDisplayName();
  const { cartItemCount, handleCartPress, handleAccountSwitch } =
    useCartNavigation();

  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {showHeader && (
        <Header
          displayName={displayName}
          cartItemCount={cartItemCount}
          onCartPress={handleCartPress}
          onAccountSwitch={handleAccountSwitch}
        />
      )}

      <View style={styles.content}>{children}</View>

      {showTabBar && (
        <View style={{ paddingBottom: insets.bottom }}>
          <TabBar route={route} />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
  },
});
