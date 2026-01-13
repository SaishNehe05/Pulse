import { TouchableOpacity, StyleSheet, Text } from 'react-native';
import { MessageSquarePlus } from 'lucide-react-native';

export default function FAB() {
  return (
    <TouchableOpacity style={styles.fab}>
      <MessageSquarePlus color="white" size={28} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute', bottom: 30, right: 20,
    backgroundColor: '#FF6719', width: 60, height: 60,
    borderRadius: 18, justifyContent: 'center', alignItems: 'center',
    elevation: 5, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5,
  }
});