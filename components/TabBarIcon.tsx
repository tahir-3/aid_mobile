import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';

export const TabBarIcon = (props: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
}) => {
  return <Ionicons size={24} style={styles.tabBarIcon} {...props} />;
};

export const styles = StyleSheet.create({
  tabBarIcon: {
    marginBottom: -3,
  },
});
