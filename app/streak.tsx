import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Flame, Calendar, Award, Target, TrendingUp } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { blink } from '@/lib/blink';

interface User {
  id: string;
  email: string;
  displayName: string;
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: string;
  totalQuestionsAnswered: number;
  correctAnswers: number;
}

interface StudySession {
  id: string;
  userId: string;
  sessionDate: string;
  questionsAnswered: number;
  correctAnswers: number;
  sessionDuration: number;
}

export default function Streak() {
  const [user, setUser] = useState<User | null>(null);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarDays, setCalendarDays] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged(async (state) => {
      if (state.user) {
        await loadUserData(state.user.id);
        await loadStudySessions(state.user.id);
      }
      setLoading(state.isLoading);
    });
    return unsubscribe;
  }, []);

  const loadUserData = async (userId: string) => {
    try {
      const existingUsers = await blink.db.users.list({
        where: { id: userId },
        limit: 1
      });

      if (existingUsers.length > 0) {
        const dbUser = existingUsers[0];
        const authUser = await blink.auth.me();
        
        setUser({
          id: userId,
          email: authUser.email,
          displayName: dbUser.displayName || authUser.displayName || authUser.email.split('@')[0],
          currentStreak: dbUser.currentStreak || 0,
          longestStreak: dbUser.longestStreak || 0,
          lastStudyDate: dbUser.lastStudyDate || '',
          totalQuestionsAnswered: dbUser.totalQuestionsAnswered || 0,
          correctAnswers: dbUser.correctAnswers || 0
        });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadStudySessions = async (userId: string) => {
    try {
      const sessions = await blink.db.studySessions.list({
        where: { userId },
        orderBy: { sessionDate: 'desc' },
        limit: 30 // Last 30 days
      });
      
      setStudySessions(sessions);
      generateCalendarDays(sessions);
    } catch (error) {
      console.error('Error loading study sessions:', error);
    }
  };

  const generateCalendarDays = (sessions: StudySession[]) => {
    const today = new Date();
    const days = [];
    const sessionDates = new Set(sessions.map(s => s.sessionDate));

    // Generate last 30 days
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const session = sessions.find(s => s.sessionDate === dateStr);
      
      days.push({
        date: dateStr,
        day: date.getDate(),
        hasStudied: sessionDates.has(dateStr),
        isToday: dateStr === today.toISOString().split('T')[0],
        session: session || null
      });
    }

    setCalendarDays(days);
  };

  const getStreakColor = (streak: number) => {
    if (streak >= 30) return '#FF6B35'; // Fire red
    if (streak >= 14) return '#FF8C42'; // Orange
    if (streak >= 7) return '#FFA726';  // Light orange
    if (streak >= 3) return '#FFB74D';  // Yellow orange
    return '#F59E0B'; // Default amber
  };

  const getStreakMessage = () => {
    if (!user) return '';
    
    if (user.currentStreak === 0) {
      return "Start your streak today! 🚀";
    } else if (user.currentStreak === 1) {
      return "Great start! Keep it going! 💪";
    } else if (user.currentStreak < 7) {
      return `${user.currentStreak} days strong! 🔥`;
    } else if (user.currentStreak < 14) {
      return `Amazing ${user.currentStreak}-day streak! ⭐`;
    } else if (user.currentStreak < 30) {
      return `Incredible ${user.currentStreak}-day streak! 🏆`;
    } else {
      return `Legendary ${user.currentStreak}-day streak! 👑`;
    }
  };

  const getMotivationalTip = () => {
    const tips = [
      "Study for just 10 minutes daily to maintain your streak!",
      "Consistency beats intensity. Small daily efforts compound!",
      "Each question you answer brings you closer to PMP success!",
      "Your future self will thank you for today's effort!",
      "Champions are made through daily habits, not occasional efforts!"
    ];
    return tips[Math.floor(Math.random() * tips.length)];
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading streak data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#2563EB" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Study Streak</Text>
          <View style={styles.headerRight} />
        </View>
        
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Please sign in to view your streak</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#2563EB" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Study Streak</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Current Streak Card */}
        <LinearGradient
          colors={['#2563EB', '#3B82F6']}
          style={styles.streakCard}
        >
          <View style={styles.streakHeader}>
            <Flame 
              size={40} 
              color={getStreakColor(user.currentStreak)} 
              fill={user.currentStreak > 0 ? getStreakColor(user.currentStreak) : 'transparent'}
            />
            <View style={styles.streakInfo}>
              <Text style={styles.streakNumber}>{user.currentStreak}</Text>
              <Text style={styles.streakLabel}>
                {user.currentStreak === 1 ? 'Day Streak' : 'Days Streak'}
              </Text>
            </View>
          </View>
          
          <Text style={styles.streakMessage}>{getStreakMessage()}</Text>
          
          {user.longestStreak > 0 && (
            <View style={styles.bestStreak}>
              <Award size={16} color="rgba(255, 255, 255, 0.8)" />
              <Text style={styles.bestStreakText}>
                Best: {user.longestStreak} {user.longestStreak === 1 ? 'day' : 'days'}
              </Text>
            </View>
          )}
        </LinearGradient>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Target size={24} color="#10B981" />
            <Text style={styles.statNumber}>
              {user.totalQuestionsAnswered > 0 
                ? Math.round((user.correctAnswers / user.totalQuestionsAnswered) * 100)
                : 0}%
            </Text>
            <Text style={styles.statLabel}>Accuracy</Text>
          </View>
          
          <View style={styles.statCard}>
            <TrendingUp size={24} color="#2563EB" />
            <Text style={styles.statNumber}>{user.totalQuestionsAnswered}</Text>
            <Text style={styles.statLabel}>Total Questions</Text>
          </View>
          
          <View style={styles.statCard}>
            <Calendar size={24} color="#F59E0B" />
            <Text style={styles.statNumber}>{studySessions.length}</Text>
            <Text style={styles.statLabel}>Study Days</Text>
          </View>
        </View>

        {/* Calendar View */}
        <View style={styles.calendarCard}>
          <Text style={styles.calendarTitle}>Last 30 Days</Text>
          <Text style={styles.calendarSubtitle}>Your study activity</Text>
          
          <View style={styles.calendarGrid}>
            {calendarDays.map((day, index) => (
              <View
                key={index}
                style={[
                  styles.calendarDay,
                  day.hasStudied && styles.studiedDay,
                  day.isToday && styles.todayDay,
                  day.isToday && day.hasStudied && styles.todayStudiedDay
                ]}
              >
                <Text style={[
                  styles.calendarDayText,
                  day.hasStudied && styles.studiedDayText,
                  day.isToday && styles.todayDayText
                ]}>
                  {day.day}
                </Text>
              </View>
            ))}
          </View>
          
          <View style={styles.calendarLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.unstudiedDot]} />
              <Text style={styles.legendText}>No study</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.studiedDot]} />
              <Text style={styles.legendText}>Studied</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.todayDot]} />
              <Text style={styles.legendText}>Today</Text>
            </View>
          </View>
        </View>

        {/* Motivational Card */}
        <View style={styles.motivationCard}>
          <Text style={styles.motivationTitle}>💡 Daily Tip</Text>
          <Text style={styles.motivationText}>{getMotivationalTip()}</Text>
        </View>

        {/* Recent Sessions */}
        {studySessions.length > 0 && (
          <View style={styles.sessionsCard}>
            <Text style={styles.sessionsTitle}>Recent Study Sessions</Text>
            {studySessions.slice(0, 5).map((session, index) => (
              <View key={session.id} style={styles.sessionItem}>
                <View style={styles.sessionDate}>
                  <Calendar size={16} color="#64748B" />
                  <Text style={styles.sessionDateText}>
                    {new Date(session.sessionDate).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.sessionStats}>
                  <Text style={styles.sessionStatsText}>
                    {session.correctAnswers}/{session.questionsAnswered} correct
                  </Text>
                  <Text style={styles.sessionAccuracy}>
                    {Math.round((session.correctAnswers / session.questionsAnswered) * 100)}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Action Button */}
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={styles.practiceButton}
            onPress={() => router.push('/practice')}
          >
            <Flame size={20} color="white" />
            <Text style={styles.practiceButtonText}>Continue Streak</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  headerRight: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#64748B',
    textAlign: 'center',
  },
  streakCard: {
    margin: 20,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  streakInfo: {
    marginLeft: 16,
    alignItems: 'center',
  },
  streakNumber: {
    fontSize: 48,
    fontWeight: '800',
    color: 'white',
  },
  streakLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  streakMessage: {
    fontSize: 18,
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  bestStreak: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bestStreakText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 6,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  calendarCard: {
    margin: 20,
    marginTop: 0,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  calendarSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 16,
  },
  calendarDay: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  studiedDay: {
    backgroundColor: '#10B981',
  },
  todayDay: {
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  todayStudiedDay: {
    backgroundColor: '#10B981',
    borderColor: '#059669',
  },
  calendarDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  studiedDayText: {
    color: 'white',
  },
  todayDayText: {
    color: '#2563EB',
  },
  calendarLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  unstudiedDot: {
    backgroundColor: '#F1F5F9',
  },
  studiedDot: {
    backgroundColor: '#10B981',
  },
  todayDot: {
    backgroundColor: '#2563EB',
  },
  legendText: {
    fontSize: 12,
    color: '#64748B',
  },
  motivationCard: {
    margin: 20,
    marginTop: 0,
    backgroundColor: '#FEF3C7',
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  motivationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8,
  },
  motivationText: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
  },
  sessionsCard: {
    margin: 20,
    marginTop: 0,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sessionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  sessionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sessionDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionDateText: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 6,
  },
  sessionStats: {
    alignItems: 'flex-end',
  },
  sessionStatsText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  sessionAccuracy: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  actionContainer: {
    padding: 20,
  },
  practiceButton: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
  },
  practiceButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});