import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Flame, BookOpen, Target, TrendingUp, Award } from 'lucide-react-native';
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

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayStudied, setTodayStudied] = useState(false);

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged(async (state) => {
      if (state.user) {
        await loadUserData(state.user.id);
      }
      setLoading(state.isLoading);
    });
    return unsubscribe;
  }, []);

  const loadUserData = async (userId: string) => {
    try {
      const authUser = await blink.auth.me();
      
      // Try to get user data from database
      const existingUsers = await blink.db.users.list({
        where: { id: userId },
        limit: 1
      });

      let userData;
      if (existingUsers.length > 0) {
        const dbUser = existingUsers[0];
        userData = {
          id: userId,
          email: authUser.email,
          displayName: dbUser.displayName || authUser.displayName || authUser.email.split('@')[0],
          currentStreak: dbUser.currentStreak || 0,
          longestStreak: dbUser.longestStreak || 0,
          lastStudyDate: dbUser.lastStudyDate || '',
          totalQuestionsAnswered: dbUser.totalQuestionsAnswered || 0,
          correctAnswers: dbUser.correctAnswers || 0
        };
      } else {
        // Create default user data for new users
        userData = {
          id: userId,
          email: authUser.email,
          displayName: authUser.displayName || authUser.email.split('@')[0],
          currentStreak: 0,
          longestStreak: 0,
          lastStudyDate: '',
          totalQuestionsAnswered: 0,
          correctAnswers: 0
        };
      }

      setUser(userData);
      
      // Check if user studied today
      const today = new Date().toISOString().split('T')[0];
      setTodayStudied(userData.lastStudyDate === today);
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load user data');
    }
  };

  const getStreakColor = (streak: number) => {
    if (streak >= 30) return '#FF6B35'; // Fire red
    if (streak >= 14) return '#FF8C42'; // Orange
    if (streak >= 7) return '#FFA726';  // Light orange
    if (streak >= 3) return '#FFB74D';  // Yellow orange
    return '#F59E0B'; // Default amber
  };

  const getMotivationalMessage = () => {
    if (!user) return '';
    
    if (user.currentStreak === 0) {
      return "Start your PMP journey today! 🚀";
    } else if (user.currentStreak < 3) {
      return "Great start! Keep building that streak! 💪";
    } else if (user.currentStreak < 7) {
      return "You're on fire! Don't break the chain! 🔥";
    } else if (user.currentStreak < 14) {
      return "Incredible dedication! You're unstoppable! ⭐";
    } else {
      return "PMP Master in the making! 🏆";
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authContainer}>
          <Text style={styles.authText}>Please sign in to continue</Text>
        </View>
      </SafeAreaView>
    );
  }

  const accuracyRate = user.totalQuestionsAnswered > 0 
    ? Math.round((user.correctAnswers / user.totalQuestionsAnswered) * 100) 
    : 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.nameText}>{user.displayName}!</Text>
        </View>

        {/* Streak Card */}
        <LinearGradient
          colors={['#2563EB', '#3B82F6']}
          style={styles.streakCard}
        >
          <View style={styles.streakHeader}>
            <Flame 
              size={32} 
              color={getStreakColor(user.currentStreak)} 
              fill={user.currentStreak > 0 ? getStreakColor(user.currentStreak) : 'transparent'}
            />
            <Text style={styles.streakTitle}>Study Streak</Text>
          </View>
          
          <Text style={styles.streakNumber}>{user.currentStreak}</Text>
          <Text style={styles.streakSubtext}>
            {user.currentStreak === 1 ? 'day' : 'days'} in a row
          </Text>
          
          {user.longestStreak > 0 && (
            <Text style={styles.longestStreak}>
              Best: {user.longestStreak} {user.longestStreak === 1 ? 'day' : 'days'}
            </Text>
          )}
          
          <Text style={styles.motivationText}>{getMotivationalMessage()}</Text>
        </LinearGradient>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <BookOpen size={24} color="#2563EB" />
            <Text style={styles.statNumber}>{user.totalQuestionsAnswered}</Text>
            <Text style={styles.statLabel}>Questions</Text>
          </View>
          
          <View style={styles.statCard}>
            <Target size={24} color="#10B981" />
            <Text style={styles.statNumber}>{accuracyRate}%</Text>
            <Text style={styles.statLabel}>Accuracy</Text>
          </View>
          
          <View style={styles.statCard}>
            <Award size={24} color="#F59E0B" />
            <Text style={styles.statNumber}>{user.correctAnswers}</Text>
            <Text style={styles.statLabel}>Correct</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={[styles.primaryButton, todayStudied && styles.completedButton]}
            onPress={() => router.push('/practice')}
          >
            <BookOpen size={24} color="white" />
            <Text style={styles.primaryButtonText}>
              {todayStudied ? 'Continue Practice' : 'Start Daily Practice'}
            </Text>
          </TouchableOpacity>

          <View style={styles.secondaryButtons}>
            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={() => router.push('/stats')}
            >
              <TrendingUp size={20} color="#2563EB" />
              <Text style={styles.secondaryButtonText}>Progress</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={() => router.push('/streak')}
            >
              <Flame size={20} color="#F59E0B" />
              <Text style={styles.secondaryButtonText}>Streaks</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Daily Goal */}
        <View style={styles.goalCard}>
          <Text style={styles.goalTitle}>Daily Goal</Text>
          <Text style={styles.goalDescription}>
            Answer 5 questions to maintain your streak
          </Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${Math.min((user.totalQuestionsAnswered % 5) * 20, 100)}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {user.totalQuestionsAnswered % 5}/5 questions today
          </Text>
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
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#64748B',
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  authText: {
    fontSize: 18,
    color: '#64748B',
    textAlign: 'center',
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  welcomeText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '400',
  },
  nameText: {
    fontSize: 28,
    color: '#1E293B',
    fontWeight: '700',
    marginTop: 4,
  },
  streakCard: {
    margin: 20,
    marginTop: 10,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  streakTitle: {
    fontSize: 18,
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
  },
  streakNumber: {
    fontSize: 48,
    color: 'white',
    fontWeight: '800',
    marginBottom: 4,
  },
  streakSubtext: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  longestStreak: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 12,
  },
  motivationText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '500',
    textAlign: 'center',
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
  actionContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  completedButton: {
    backgroundColor: '#10B981',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  secondaryButtonText: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  goalCard: {
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
  goalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  goalDescription: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
});