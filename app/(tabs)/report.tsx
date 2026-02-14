import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Button, // Import Button for export
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import {
  getActivities,
  getWeeklyEntriesForWeek,
  getWeekId,
  getWeekRange,
  UserActivity,
  WeeklyActivityEntry,
} from '@/utils/firestore';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing'; // Import expo-sharing
import * as FileSystem from 'expo-file-system';

const DAYS_OF_WEEK = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const { width } = Dimensions.get('window');

export default function ReportScreen() {
  const { user } = useAuth();
  const [currentWeekId, setCurrentWeekId] = useState('');
  const [weekRange, setWeekRange] = useState({ startDate: '', endDate: '' });
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
  const [weeklyEntries, setWeeklyEntries] = useState<WeeklyActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [analysisReport, setAnalysisReport] = useState<string[]>([]);

  // Initialize currentWeekId on first load and when screen is focused
  useFocusEffect(
    useCallback(() => {
      const today = new Date();
      const initialWeekId = getWeekId(today.toISOString().split('T')[0]);
      setCurrentWeekId(initialWeekId);
    }, [])
  );

  // Fetch data and perform analysis
  useEffect(() => {
    if (user?.uid && currentWeekId) {
      const fetchAndAnalyze = async () => {
        setIsLoading(true);
        try {
          const activities = await getActivities(user.uid);
          setUserActivities(activities);

          const entries = await getWeeklyEntriesForWeek(user.uid, currentWeekId);
          setWeeklyEntries(entries);
          setWeekRange(getWeekRange(currentWeekId));

          performMockAnalysis(activities, entries);
        } catch (error) {
          console.error('Error fetching data for report:', error);
          Alert.alert('Hata', 'Rapor verileri getirilirken bir sorun oluştu.');
        } finally {
          setIsLoading(false);
        }
      };
      fetchAndAnalyze();
    }
  }, [user?.uid, currentWeekId]);

  const performMockAnalysis = (activities: UserActivity[], entries: WeeklyActivityEntry[]) => {
    const report: string[] = [];

    if (activities.length === 0) {
      report.push('Henüz tanımlanmış bir aktiviteniz bulunmamaktadır. Aktiviteler sekmesinden aktivite ekleyebilirsiniz.');
      setAnalysisReport(report);
      return;
    }

    report.push(`**Haftalık Aktivite Raporu (${weekRange.startDate} - ${weekRange.endDate})**\n`);

    const activityCounts: { [key: string]: { total: number; filled: number; keywords: { [key: string]: number } } } = {};
    activities.forEach(act => {
      activityCounts[act.id] = { total: 0, filled: 0, keywords: {} };
    });

    const dailyConsistency: { [key: string]: number } = {};
    DAYS_OF_WEEK.forEach(day => (dailyConsistency[day] = 0));

    entries.forEach(entry => {
      if (activityCounts[entry.activityId]) {
        activityCounts[entry.activityId].total++;
        if (entry.textualValue && entry.textualValue.trim() !== '') {
          activityCounts[entry.activityId].filled++;
          const dayName = DAYS_OF_WEEK[new Date(entry.date).getUTCDay() === 0 ? 6 : new Date(entry.date).getUTCDay() - 1]; // Adjust to start from Monday
          dailyConsistency[dayName]++;

          const lowerValue = entry.textualValue.toLowerCase();
          ['tamamladım', 'vaktinde kıldım', 'geç kıldım', 'kaza', 'yapamadım'].forEach(keyword => {
            if (lowerValue.includes(keyword)) {
              activityCounts[entry.activityId].keywords[keyword] = (activityCounts[entry.activityId].keywords[keyword] || 0) + 1;
            }
          });
        }
      }
    });

    let overallFilled = 0;
    let overallTotal = 0;

    activities.forEach(act => {
      const counts = activityCounts[act.id];
      overallTotal += counts.total;
      overallFilled += counts.filled;

      const percentage = counts.total > 0 ? (counts.filled / counts.total) * 100 : 0;
      report.push(`- **${act.name}:** Haftanın ${counts.filled} günü takip edildi. (%${percentage.toFixed(0)})`);

      Object.entries(counts.keywords).forEach(([keyword, count]) => {
        report.push(`  - "${keyword}" ifadesi ${count} kez kullanıldı.`);
      });
    });

    const overallPercentage = overallTotal > 0 ? (overallFilled / overallTotal) * 100 : 0;
    report.push(`\n**Genel Durum:** Toplam ${overallTotal} aktiviteden ${overallFilled} tanesi kaydedildi. (%${overallPercentage.toFixed(0)})`);

    let bestDay = '';
    let maxEntries = -1;
    let worstDay = '';
    let minEntries = Infinity;

    Object.entries(dailyConsistency).forEach(([day, count]) => {
        if (count > maxEntries) {
            maxEntries = count;
            bestDay = day;
        }
        if (count < minEntries) {
            minEntries = count;
            worstDay = day;
        }
    });
    if (bestDay && worstDay) {
        report.push(`Haftanın en istikrarlı günü: **${bestDay}** (${maxEntries} giriş). En az giriş yapılan gün: **${worstDay}** (${minEntries} giriş).`);
    }


    setAnalysisReport(report);
  };

  const handleExport = async () => {
    if (!user?.uid || userActivities.length === 0) { // Check userActivities here
      Alert.alert('Uyarı', 'Dışa aktarılacak veri bulunamadı veya kullanıcı giriş yapmadı.');
      return;
    }

    const csvContent = generateCsvContent(userActivities, weeklyEntries, weekRange);
    const fileName = `Haftalik_Takip_Raporu_${weekRange.startDate}.csv`;
    const baseDirectory = FileSystem.cacheDirectory;
    if (!baseDirectory) {
      Alert.alert(
        'Hata',
        'Cihazınızda geçici depolama dizini bulunamadı. Lütfen uygulamanızı güncellemeyi, farklı bir cihazda denemeyi veya geliştirici ile iletişime geçmeyi düşünün.'
      );
      return;
    }
    const fileUri = `${baseDirectory}${fileName}`;

    try {
      await FileSystem.writeAsStringAsync(fileUri, csvContent);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Hata', 'Cihazınızda dosya paylaşımı desteklenmiyor.');
      }
    } catch (error) {
      console.error('Dosya dışa aktarılırken hata oluştu:', error);
      Alert.alert('Hata', 'Dosya dışa aktarılırken bir sorun oluştu.');
    }
  };

  const generateCsvContent = (
    activities: UserActivity[],
    entries: WeeklyActivityEntry[],
    weekRange: { startDate: string; endDate: string }
  ) => {
    let csv = `Haftalık Aktivite Raporu,${weekRange.startDate} - ${weekRange.endDate}\n\n`;

    // Header row for days
    csv += 'Aktivite;' + DAYS_OF_WEEK.join(';') + '\n';

    // Data rows
    activities.forEach((activity) => {
      let row = `${activity.name};`;
      DAYS_OF_WEEK.forEach((_, dayIndex) => {
        const currentDay = new Date(weekRange.startDate);
        currentDay.setUTCDate(currentDay.getUTCDate() + dayIndex);
        const dateString = currentDay.toISOString().split('T')[0];

        const entry = entries.find(
          (e) => e.activityId === activity.id && e.date === dateString
        );
        row += `"${entry?.textualValue || ''}";`; // Quote values to handle commas/semicolons in text
      });
      csv += row + '\n';
    });

    return csv;
  };


  const navigateWeek = (direction: 'prev' | 'next') => {
    const currentWeekStart = new Date(weekRange.startDate);
    let newDate = new Date(currentWeekStart);

    if (direction === 'prev') {
      newDate.setUTCDate(currentWeekStart.getUTCDate() - 7);
    } else {
      newDate.setUTCDate(currentWeekStart.getUTCDate() + 7);
    }
    const newWeekId = getWeekId(newDate.toISOString().split('T')[0]);
    setCurrentWeekId(newWeekId);
  };

  const renderReportLine = (line: string, index: number) => {
    // Basic markdown-like bold parsing for **text**
    const parts = line.split(/(\*\*.*?\*\*)/g);
    return (
      <Text key={index} style={styles.reportLine}>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <Text key={i} style={styles.boldText}>
                {part.substring(2, part.length - 2)}
              </Text>
            );
          }
          return part;
        })}
      </Text>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Rapor Oluşturuluyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.reportHeader}>
          <TouchableOpacity onPress={() => navigateWeek('prev')} style={styles.navButton}>
            <MaterialIcons name="chevron-left" size={30} color="#007AFF" />
          </TouchableOpacity>
          <View style={styles.weekInfoContainer}>
            <Text style={styles.weekTitleNav}>{currentWeekId}</Text>
            <Text style={styles.weekRangeTextNav}>
              {weekRange.startDate} - {weekRange.endDate}
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigateWeek('next')} style={styles.navButton}>
            <MaterialIcons name="chevron-right" size={30} color="#007AFF" />
          </TouchableOpacity>
        </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Haftalık Rapor</Text>
        {analysisReport.map((line, index) => renderReportLine(line, index))}
        <Button title="CSV Olarak Dışa Aktar" onPress={handleExport} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  reportHeader: {
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
  weekInfoContainer: {
    marginTop: -10,
  },
  weekTitleNav: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 20,
  },
  weekRangeTextNav: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 14,
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 20,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  weekRangeText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  reportLine: {
    fontSize: 16,
    marginBottom: 5,
    textAlign: 'left',
    width: '100%', // Take full width to align text
  },
  boldText: {
    fontWeight: 'bold',
  },
});