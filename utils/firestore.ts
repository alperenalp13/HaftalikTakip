import { db } from '@/constants/firebaseConfig';
import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';

export interface UserActivity {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
}

const activitiesCollection = (userId: string) =>
  collection(db, `users/${userId}/activities`);

export async function addActivity(
  userId: string,
  activityName: string
): Promise<UserActivity> {
  const newActivityRef = await addDoc(activitiesCollection(userId), {
    name: activityName,
    userId: userId,
    createdAt: new Date(),
  });
  const newActivity: UserActivity = {
    id: newActivityRef.id,
    name: activityName,
    userId: userId,
    createdAt: new Date(),
  };
  return newActivity;
}

export async function getActivities(userId: string): Promise<UserActivity[]> {
  const q = query(activitiesCollection(userId));
  const querySnapshot = await getDocs(q);
  const activities: UserActivity[] = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    activities.push({
      id: doc.id,
      name: data.name,
      userId: data.userId,
      createdAt: data.createdAt ? data.createdAt.toDate() : new Date(), // Convert Timestamp to Date
    } as UserActivity);
  });
  // Sort activities by creation date, newest first
  activities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return activities;
}

export async function updateActivity(
  userId: string,
  activityId: string,
  newName: string
): Promise<void> {
  const activityDocRef = doc(activitiesCollection(userId), activityId);
  await updateDoc(activityDocRef, { name: newName });
}

export async function deleteActivity(
  userId: string,
  activityId: string
): Promise<void> {
  const activityDocRef = doc(activitiesCollection(userId), activityId);
  await deleteDoc(activityDocRef);
}

// Function to save weekly activity entries
export interface WeeklyActivityEntry {
  id?: string; // Firestore document ID
  activityId: string;
  userId: string;
  weekId: string;
  date: string; // YYYY-MM-DD
  textualValue: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const weeklyEntriesCollection = (userId: string, weekId: string) =>
  collection(db, `users/${userId}/weeklyEntries/${weekId}/entries`);

export async function saveWeeklyEntry(
  userId: string,
  weekId: string,
  entry: Partial<WeeklyActivityEntry>
): Promise<WeeklyActivityEntry> {
  // Try to find existing entry
  const q = query(
    weeklyEntriesCollection(userId, weekId),
    where('activityId', '==', entry.activityId),
    where('date', '==', entry.date)
  );
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    // Update existing entry
    const existingDocRef = querySnapshot.docs[0].ref;
    await updateDoc(existingDocRef, {
      textualValue: entry.textualValue || null,
      updatedAt: new Date(),
    });
    return { id: existingDocRef.id, ...entry, updatedAt: new Date() } as WeeklyActivityEntry;
  } else {
    // Add new entry
    const newEntryRef = await addDoc(weeklyEntriesCollection(userId, weekId), {
      ...entry,
      userId,
      weekId,
      textualValue: entry.textualValue || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { id: newEntryRef.id, ...entry, userId, weekId, createdAt: new Date(), updatedAt: new Date() } as WeeklyActivityEntry;
  }
}

export async function getWeeklyEntriesForWeek(
  userId: string,
  weekId: string
): Promise<WeeklyActivityEntry[]> {
  const q = query(weeklyEntriesCollection(userId, weekId));
  const querySnapshot = await getDocs(q);
  const entries: WeeklyActivityEntry[] = [];
  querySnapshot.forEach((doc) => {
    entries.push({ id: doc.id, ...doc.data() } as WeeklyActivityEntry);
  });
  return entries;
}

// Utility to get week ID and range - can be moved to a separate utils file if preferred
export function getWeekId(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getUTCDay(); // Sunday - Saturday : 0 - 6
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
  const weekStart = new Date(date.setUTCDate(diff));
  return weekStart.toISOString().split('T')[0];
}

export function getWeekRange(weekId: string) {
  const startDate = new Date(weekId + 'T00:00:00Z');
  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + 6);
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}
