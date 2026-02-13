import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import {
  addActivity,
  getActivities,
  updateActivity,
  deleteActivity,
  UserActivity,
} from '@/utils/firestore';
import { MaterialIcons } from '@expo/vector-icons';
import debounce from 'lodash.debounce';

export default function ActivitiesScreen() {
  const { user } = useAuth();
  const [newActivityName, setNewActivityName] = useState('');
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [editingActivityName, setEditingActivityName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  const fetchUserActivities = useCallback(async () => {
    if (user?.uid) {
      setIsLoading(true);
      try {
        const fetchedActivities = await getActivities(user.uid);
        setActivities(fetchedActivities);
      } catch (error) {
        console.error('Error fetching activities:', error);
        Alert.alert('Hata', 'Aktiviteler getirilirken bir sorun oluştu.');
      } finally {
        setIsLoading(false);
      }
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchUserActivities();
  }, [fetchUserActivities]);

  const handleAddActivity = async () => {
    if (!newActivityName.trim() || !user?.uid) {
      Alert.alert('Hata', 'Lütfen geçerli bir aktivite adı girin.');
      return;
    }
    setIsAdding(true);
    try {
      await addActivity(user.uid, newActivityName.trim());
      setNewActivityName('');
      await fetchUserActivities(); // Refresh the list
    } catch (error) {
      console.error('Error adding activity:', error);
      Alert.alert('Hata', 'Aktivite eklenirken bir sorun oluştu.');
    } finally {
      setIsAdding(false);
    }
  };

  const startEditing = (activity: UserActivity) => {
    setEditingActivityId(activity.id);
    setEditingActivityName(activity.name);
  };

  const handleUpdateActivity = useCallback(
    debounce(async (activityId: string, newName: string) => {
      if (!newName.trim() || !user?.uid) {
        Alert.alert('Hata', 'Lütfen geçerli bir aktivite adı girin.');
        return;
      }
      try {
        await updateActivity(user.uid, activityId, newName.trim());
        setEditingActivityId(null);
        await fetchUserActivities(); // Refresh the list
      } catch (error) {
        console.error('Error updating activity:', error);
        Alert.alert('Hata', 'Aktivite güncellenirken bir sorun oluştu.');
      }
    }, 1000), // Debounce for 1 second
    [user?.uid, fetchUserActivities]
  );

  const handleDeleteActivity = async (activityId: string) => {
    if (!user?.uid) return;
    Alert.alert(
      'Aktiviteyi Sil',
      'Bu aktiviteyi silmek istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          onPress: async () => {
            try {
              await deleteActivity(user.uid, activityId);
              await fetchUserActivities(); // Refresh the list
            } catch (error) {
              console.error('Error deleting activity:', error);
              Alert.alert('Hata', 'Aktivite silinirken bir sorun oluştu.');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Aktiviteler Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Aktivite Yönetimi</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Yeni aktivite adı"
          value={newActivityName}
          onChangeText={setNewActivityName}
        />
        <Button title={isAdding ? "Ekleniyor..." : "Ekle"} onPress={handleAddActivity} disabled={isAdding} />
      </View>

      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.activityItem}>
            {editingActivityId === item.id ? (
              <TextInput
                style={[styles.activityText, styles.editingInput]}
                value={editingActivityName}
                onChangeText={setEditingActivityName}
                onEndEditing={() => handleUpdateActivity(item.id, editingActivityName)}
                autoFocus
              />
            ) : (
              <Text style={styles.activityText}>{item.name}</Text>
            )}
            <View style={styles.actions}>
              {editingActivityId === item.id ? (
                <TouchableOpacity
                  onPress={() => handleUpdateActivity(item.id, editingActivityName)}
                  style={styles.actionButton}
                >
                  <MaterialIcons name="check" size={24} color="green" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => startEditing(item)}
                  style={styles.actionButton}
                >
                  <MaterialIcons name="edit" size={24} color="blue" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => handleDeleteActivity(item.id)}
                style={styles.actionButton}
              >
                <MaterialIcons name="delete" size={24} color="red" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    padding: 10,
    fontSize: 16,
  },
  activityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  activityText: {
    flex: 1,
    fontSize: 18,
    color: '#555',
  },
  editingInput: {
    borderColor: 'blue',
    borderWidth: 1,
    borderRadius: 5,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  actions: {
    flexDirection: 'row',
    marginLeft: 10,
  },
  actionButton: {
    marginLeft: 10,
    padding: 5,
  },
  list: {
    flex: 1,
  },
});
