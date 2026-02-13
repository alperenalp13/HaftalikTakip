import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import {
  getActivities,
  getWeeklyEntriesForWeek,
  saveWeeklyEntry,
  getWeekId,
  getWeekRange,
  UserActivity,
  WeeklyActivityEntry,
} from '@/utils/firestore';
import debounce from 'lodash.debounce';

const DAYS_OF_WEEK = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

export default function HomeScreen() {
  const { user, loading: authLoading, logout } = useAuth();
  const [currentWeekId, setCurrentWeekId] = useState('');
  const [weekRange, setWeekRange] = useState({ startDate: '', endDate: '' });
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
  const [weeklyEntries, setWeeklyEntries] = useState<WeeklyActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initialize currentWeekId on first load
  useEffect(() => {
    if (!authLoading) {
      const today = new Date();
      const initialWeekId = getWeekId(today.toISOString().split('T')[0]);
      setCurrentWeekId(initialWeekId);
    }
  }, [authLoading]);

  // Data fetching logic wrapped in useCallback
  const handleFetchAllData = useCallback(async () => {
    if (!user?.uid || !currentWeekId) return;
    try {
      const activities = await getActivities(user.uid);
      setUserActivities(activities);

      const entries = await getWeeklyEntriesForWeek(user.uid, currentWeekId);
      setWeeklyEntries(entries);

      setWeekRange(getWeekRange(currentWeekId));
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Hata', 'Veriler getirilirken bir sorun oluştu.');
    }
  }, [user?.uid, currentWeekId]);

  // Fetch user activities and weekly entries when userId or currentWeekId changes
  useEffect(() => {
    if (!authLoading && user?.uid && currentWeekId) {
      setIsLoading(true);
      handleFetchAllData().finally(() => setIsLoading(false));
    } else if (!user && !authLoading) {
      // Not authenticated, and auth state is loaded, stop loading.
      setIsLoading(false);
    }
  }, [user?.uid, currentWeekId, authLoading, handleFetchAllData]);

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await handleFetchAllData(); // Re-fetch data
    setIsRefreshing(false);
  }, [handleFetchAllData]);

  const saveEntryImmediate = useCallback(
    async (activityId: string, date: string, value: string) => {
      if (!user?.uid) return;
      try {
        const entryToSave: Partial<WeeklyActivityEntry> = {
          activityId,
          date,
          textualValue: value || null, // Save null if empty string
        };
        const savedEntry = await saveWeeklyEntry(user.uid, currentWeekId, entryToSave);
        // Update local state with the saved entry, especially its ID if it was new
        setWeeklyEntries((prevEntries) => {
          const newEntries = [...prevEntries];
          const index = newEntries.findIndex(
            (e) => e.activityId === activityId && e.date === date
          );
          if (index > -1) {
            newEntries[index] = { ...newEntries[index], ...savedEntry, id: savedEntry.id || newEntries[index].id };
          } else {
            // This case should ideally not happen if optimistic update is done correctly
            newEntries.push(savedEntry);
          }
          return newEntries;
        });
        console.log('Entry saved immediately:', savedEntry);
      } catch (error) {
        console.error('Error saving entry immediately:', error);
        Alert.alert('Hata', 'Giriş kaydedilirken bir sorun oluştu.');
      }
    },
    [user?.uid, currentWeekId]
  );

  const debouncedSaveEntry = useCallback(
    debounce((activityId: string, date: string, value: string) => {
      // Call the immediate save function after debounce period
      saveEntryImmediate(activityId, date, value);
    }, 1500), // Debounce for 1.5 seconds
    [saveEntryImmediate]
  );

  // Handle value change for TextInput
  const handleValueChange = (activityId: string, date: string, value: string) => {
    // Optimistically update local state
    setWeeklyEntries((prevEntries) => {
      const newEntries = [...prevEntries];
      let existingEntry = newEntries.find(
        (e) => e.activityId === activityId && e.date === date
      );

      if (existingEntry) {
        existingEntry.textualValue = value;
        existingEntry.updatedAt = new Date(); // Update updatedAt for optimistic UI
      } else {
        newEntries.push({
          id: '', // Will be filled by Firestore if new
          activityId,
          userId: user?.uid || '', // Should be present due to auth check
          weekId: currentWeekId,
          date,
          textualValue: value,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      return newEntries;
    });

    // Call debounced save
    debouncedSaveEntry(activityId, date, value);
  };

  // Handle saving when editing ends (e.g., on blur)
  const handleEndEditing = useCallback(
    (activityId: string, date: string, value: string) => {
      // Cancel any pending debounced saves for this input
      // This is crucial to ensure the final value is saved immediately
      debouncedSaveEntry.cancel();
      // Trigger an immediate save
      saveEntryImmediate(activityId, date, value);
    },
    [debouncedSaveEntry, saveEntryImmediate]
  );

  const navigateWeek = (direction: 'prev' | 'next') => {
    const currentWeekStart = new Date(weekRange.startDate + 'T00:00:00Z');
    let newDate = new Date(currentWeekStart);

    if (direction === 'prev') {
      newDate.setUTCDate(currentWeekStart.getUTCDate() - 7);
    } else {
      newDate.setUTCDate(currentWeekStart.getUTCDate() + 7);
    }
    const newWeekId = getWeekId(newDate.toISOString().split('T')[0]);
    setCurrentWeekId(newWeekId);
  };

  const handleLogout = async () => {
    try {
      await logout();
      // Optionally, navigate to login screen or show success message
    } catch (error) {
      Alert.alert('Çıkış Hatası', 'Çıkış yapılırken bir sorun oluştu.');
    }
  };

  const renderActivityCell = (activity: UserActivity, dayIndex: number) => {
    if (!weekRange.startDate) return null;

    const currentDay = new Date(weekRange.startDate);
    currentDay.setUTCDate(currentDay.getUTCDate() + dayIndex);
    const dateString = currentDay.toISOString().split('T')[0];

    const entry = weeklyEntries.find(
      (e) => e.activityId === activity.id && e.date === dateString
    );

    return (
      <View style={styles.inputCell} key={activity.id + dateString}>
        <TextInput
          style={styles.input}
          placeholder="Not Girin"
          value={entry?.textualValue || ''}
          onChangeText={(value) => handleValueChange(activity.id, dateString, value)}
          onEndEditing={(e) => handleEndEditing(activity.id, dateString, e.nativeEvent.text)}
        />
      </View>
    );
  };

  if (isLoading || authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Yükleniyor...</Text>
      </View>
    );
  }

  // If no user activities are defined, prompt user to add them
  if (userActivities.length === 0) {
    return (
      <View style={styles.noActivitiesContainer}>
        <Text style={styles.noActivitiesText}>Henüz bir aktivite tanımlamadınız.</Text>
        <TouchableOpacity onPress={() => Alert.alert('Aktivite Ekle', 'Aktiviteler sekmesinden yeni aktiviteler ekleyebilirsiniz.')}>
          <Text style={styles.addActivitiesButtonText}>Aktiviteler sekmesine gidin.</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView // New ScrollView for the entire content
      contentContainerStyle={styles.scrollContentContainer} // A new style for the content
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigateWeek('prev')} style={styles.navButton}>
          <MaterialIcons name="chevron-left" size={30} color="#007AFF" />
        </TouchableOpacity>
        <View style={styles.weekInfoContainer}>
          <Text style={styles.weekTitle}>{currentWeekId}</Text>
          <Text style={styles.weekRangeText}>
            {weekRange.startDate}  -  {weekRange.endDate}
          </Text>
        </View>
        <TouchableOpacity onPress={() => navigateWeek('next')} style={styles.navButton}>
          <MaterialIcons name="chevron-right" size={30} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <MaterialIcons name="logout" size={24} color="#FF0000" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal contentContainerStyle={styles.tableHorizontalScroll}>
        <View>
          {/* Days Header Row */}
          <View style={styles.row}>
            <Text style={[styles.cell, styles.categoryHeader]}>Aktivite</Text>
            {DAYS_OF_WEEK.map((day, index) => (
              <Text key={index} style={[styles.cell, styles.dayHeader]}>
                {day}
              </Text>
            ))}
          </View>

          {/* Activity Rows */}
          <ScrollView contentContainerStyle={styles.tableVerticalScroll}>
            {userActivities.map((activity, activityIndex) => (
              <View key={activity.id} style={styles.row}>
                <Text style={[styles.cell, styles.categoryText]}>{activity.name}</Text>
                {DAYS_OF_WEEK.map((_, dayIndex) =>
                  renderActivityCell(activity, dayIndex)
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noActivitiesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noActivitiesText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    color: '#555',
  },
  addActivitiesButtonText: {
    fontSize: 16,
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  scrollContentContainer: {
    flexGrow: 1,
    paddingTop: 50,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  navButton: {
    padding: 10,
  },
    weekTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      textAlign: 'center',
      lineHeight: 20,
    },
    weekRangeText: {
      fontSize: 14,
      color: '#666',
      textAlign: 'center',
      lineHeight: 14,
    },        weekInfoContainer: {
          marginTop: -10, // Re-added adjustment
        },
        tableHorizontalScroll: {
          flexGrow: 1,
        },      logoutButton: {
        padding: 10,
        marginLeft: 10, // Re-add the original margin for spacing
      },  tableVerticalScroll: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  cell: {
    width: 100, // Adjust cell width as needed
    padding: 8,
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#eee',
    height: '100%', // Ensure cells take full height of row
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  categoryHeader: {
    width: 150, // Wider for category names
    fontWeight: 'bold',
    backgroundColor: '#f0f0f0',
  },
  dayHeader: {
    fontWeight: 'bold',
    backgroundColor: '#f0f0f0',
  },
  categoryText: {
    width: 150, // Wider for category names
    textAlign: 'left',
    paddingLeft: 10,
    fontWeight: '500',
  },
  inputCell: {
    width: 100,
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: '#eee',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 30, // Adjusted height for better fit
    fontSize: 12,
    paddingVertical: 0,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    paddingHorizontal: 5,
    backgroundColor: '#fff',
  },
});