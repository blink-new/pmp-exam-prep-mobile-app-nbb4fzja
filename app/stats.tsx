import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, TrendingUp, Target, BookOpen, Award, Calendar, CheckCircle, XCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { blink } from '@/lib/blink';

const { width } = Dimensions.get('window');

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

interface UserAnswer {
  id: string;
  userId: string;
  questionId: string;
  selectedAnswer: string;
  isCorrect: number;
  answeredAt: string;
}

interface StudySession {
  id: string;
  userId: string;
  sessionDate: string;
  questionsAnswered: number;
  correctAnswers: number;
  sessionDuration: number;
}

interface CategoryStats {
  category: string;
  total: number;
  correct: number;
  accuracy: number;
}

export default function Stats() {
  const [user, setUser] = useState<User | null>(null);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged(async (state) => {
      if (state.user) {
        await loadUserData(state.user.id);
        await loadUserAnswers(state.user.id);
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

  const loadUserAnswers = async (userId: string) => {
    try {
      const answers = await blink.db.userAnswers.list({
        where: { userId },
        orderBy: { answeredAt: 'desc' },
        limit: 100
      });
      
      setUserAnswers(answers);
      await calculateCategoryStats(answers);
    } catch (error) {
      console.error('Error loading user answers:', error);
    }
  };

  const loadStudySessions = async (userId: string) => {
    try {
      const sessions = await blink.db.studySessions.list({
        where: { userId },
        orderBy: { sessionDate: 'desc' },
        limit: 30
      });
      
      setStudySessions(sessions);
    } catch (error) {
      console.error('Error loading study sessions:', error);
    }
  };

  const calculateCategoryStats = async (answers: UserAnswer[]) => {
    try {
      // Get all questions to map answers to categories
      const questions = await blink.db.questions.list({
        limit: 100
      });

      const questionMap = new Map(questions.map(q => [q.id, q]));
      const categoryMap = new Map<string, { total: number; correct: number }>();

      answers.forEach(answer => {
        const question = questionMap.get(answer.questionId);
        if (question) {
          const category = question.category;
          const current = categoryMap.get(category) || { total: 0, correct: 0 };
          
          categoryMap.set(category, {
            total: current.total + 1,
            correct: current.correct + (Number(answer.isCorrect) > 0 ? 1 : 0)
          });
        }
      });

      const stats: CategoryStats[] = Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        total: data.total,
        correct: data.correct,
        accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0
      })).sort((a, b) => b.total - a.total);

      setCategoryStats(stats);
    } catch (error) {
      console.error('Error calculating category stats:', error);
    }
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return '#10B981';
    if (accuracy >= 60) return '#F59E0B';
    return '#EF4444';
  };

  const getProgressLevel = () => {
    if (!user) return { level: 'Beginner', progress: 0, nextLevel: 'Intermediate' };
    
    const total = user.totalQuestionsAnswered;
    if (total >= 500) return { level: 'Expert', progress: 100, nextLevel: 'Master' };
    if (total >= 200) return { level: 'Advanced', progress: (total - 200) / 300 * 100, nextLevel: 'Expert' };
    if (total >= 50) return { level: 'Intermediate', progress: (total - 50) / 150 * 100, nextLevel: 'Advanced' };
    return { level: 'Beginner', progress: total / 50 * 100, nextLevel: 'Intermediate' };
  };

  const getRecentPerformance = () => {
    const recentAnswers = userAnswers.slice(0, 20); // Last 20 answers
    if (recentAnswers.length === 0) return 0;
    
    const correct = recentAnswers.filter(answer => Number(answer.isCorrect) > 0).length;
    return Math.round((correct / recentAnswers.length) * 100);
  };

  const getStudyStreak = () => {
    if (studySessions.length === 0) return 0;
    
    let streak = 0;
    const today = new Date();
    
    for (let i = 0; i < studySessions.length; i++) {
      const sessionDate = new Date(studySessions[i].sessionDate);
      const daysDiff = Math.floor((today.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === streak) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading progress data...</Text>
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
          <Text style={styles.headerTitle}>Progress Stats</Text>
          <View style={styles.headerRight} />
        </View>
        
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Please sign in to view your progress</Text>
        </View>
      </SafeAreaView>
    );
  }

  const progressLevel = getProgressLevel();
  const recentPerformance = getRecentPerformance();
  const overallAccuracy = user.totalQuestionsAnswered > 0 
    ? Math.round((user.correctAnswers / user.totalQuestionsAnswered) * 100) 
    : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#2563EB" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Progress Stats</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Progress Level Card */}
        <LinearGradient
          colors={['#2563EB', '#3B82F6']}
          style={styles.levelCard}
        >
          <View style={styles.levelHeader}>
            <Award size={32} color="#F59E0B" />
            <View style={styles.levelInfo}>
              <Text style={styles.levelTitle}>{progressLevel.level}</Text>
              <Text style={styles.levelSubtitle}>
                {user.totalQuestionsAnswered} questions answered
              </Text>
            </View>
          </View>
          
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progressLevel.progress}%` }]} />
            </View>
            <Text style={styles.progressText}>
              Progress to {progressLevel.nextLevel}: {Math.round(progressLevel.progress)}%
            </Text>
          </View>
        </LinearGradient>

        {/* Key Metrics */}
        <View style={styles.metricsContainer}>
          <View style={styles.metricCard}>
            <Target size={24} color={getAccuracyColor(overallAccuracy)} />
            <Text style={styles.metricNumber}>{overallAccuracy}%</Text>
            <Text style={styles.metricLabel}>Overall Accuracy</Text>
          </View>
          
          <View style={styles.metricCard}>
            <TrendingUp size={24} color={getAccuracyColor(recentPerformance)} />
            <Text style={styles.metricNumber}>{recentPerformance}%</Text>
            <Text style={styles.metricLabel}>Recent Performance</Text>
          </View>
          
          <View style={styles.metricCard}>
            <Calendar size={24} color="#2563EB" />
            <Text style={styles.metricNumber}>{user.currentStreak}</Text>
            <Text style={styles.metricLabel}>Current Streak</Text>
          </View>
        </View>

        {/* Category Performance */}
        {categoryStats.length > 0 && (
          <View style={styles.categoryCard}>
            <Text style={styles.categoryTitle}>Performance by Category</Text>
            <Text style={styles.categorySubtitle}>Your accuracy in different PMP areas</Text>
            
            {categoryStats.map((category, index) => (
              <View key={index} style={styles.categoryItem}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryName}>{category.category}</Text>
                  <Text style={[styles.categoryAccuracy, { color: getAccuracyColor(category.accuracy) }]}>
                    {category.accuracy}%
                  </Text>
                </View>
                
                <View style={styles.categoryProgress}>
                  <View style={styles.categoryProgressBar}>
                    <View 
                      style={[
                        styles.categoryProgressFill, 
                        { 
                          width: `${category.accuracy}%`,
                          backgroundColor: getAccuracyColor(category.accuracy)
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.categoryStats}>
                    {category.correct}/{category.total} correct
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Recent Activity */}
        {studySessions.length > 0 && (
          <View style={styles.activityCard}>
            <Text style={styles.activityTitle}>Recent Study Sessions</Text>
            <Text style={styles.activitySubtitle}>Your last 7 study sessions</Text>
            
            {studySessions.slice(0, 7).map((session, index) => (
              <View key={session.id} style={styles.sessionItem}>
                <View style={styles.sessionDate}>
                  <Calendar size={16} color="#64748B" />
                  <Text style={styles.sessionDateText}>
                    {new Date(session.sessionDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </Text>
                </View>
                
                <View style={styles.sessionMetrics}>
                  <View style={styles.sessionMetric}>
                    <CheckCircle size={14} color="#10B981" />
                    <Text style={styles.sessionMetricText}>{session.correctAnswers}</Text>
                  </View>
                  
                  <View style={styles.sessionMetric}>
                    <XCircle size={14} color="#EF4444" />
                    <Text style={styles.sessionMetricText}>
                      {session.questionsAnswered - session.correctAnswers}
                    </Text>
                  </View>
                  
                  <Text style={[
                    styles.sessionAccuracy,
                    { color: getAccuracyColor(Math.round((session.correctAnswers / session.questionsAnswered) * 100)) }
                  ]}>
                    {Math.round((session.correctAnswers / session.questionsAnswered) * 100)}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Study Goals */}
        <View style={styles.goalsCard}>
          <Text style={styles.goalsTitle}>Study Goals</Text>
          
          <View style={styles.goalItem}>
            <View style={styles.goalHeader}>
              <BookOpen size={20} color="#2563EB" />
              <Text style={styles.goalName}>Daily Practice</Text>
              <Text style={styles.goalStatus}>
                {user.lastStudyDate === new Date().toISOString().split('T')[0] ? '✅' : '⏳'}
              </Text>
            </View>
            <Text style={styles.goalDescription}>Answer 5 questions daily</Text>
          </View>
          
          <View style={styles.goalItem}>
            <View style={styles.goalHeader}>
              <Target size={20} color="#10B981" />
              <Text style={styles.goalName}>Accuracy Target</Text>
              <Text style={styles.goalStatus}>
                {overallAccuracy >= 80 ? '✅' : overallAccuracy >= 60 ? '🟡' : '🔴'}
              </Text>
            </View>
            <Text style={styles.goalDescription}>Maintain 80% accuracy</Text>
          </View>
          
          <View style={styles.goalItem}>
            <View style={styles.goalHeader}>
              <Award size={20} color="#F59E0B" />
              <Text style={styles.goalName}>Streak Master</Text>
              <Text style={styles.goalStatus}>
                {user.currentStreak >= 7 ? '✅' : user.currentStreak >= 3 ? '🟡' : '⏳'}
              </Text>
            </View>
            <Text style={styles.goalDescription}>Build a 7-day streak</Text>
          </View>
        </View>

        {/* Action Button */}
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={styles.practiceButton}
            onPress={() => router.push('/practice')}
          >
            <BookOpen size={20} color="white" />
            <Text style={styles.practiceButtonText}>Continue Practice</Text>
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
  levelCard: {
    margin: 20,
    padding: 24,
    borderRadius: 16,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  levelInfo: {
    marginLeft: 16,
  },
  levelTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
  },
  levelSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  metricsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  metricCard: {
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
  metricNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  categoryCard: {
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
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  categorySubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
  },
  categoryItem: {
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1E293B',
    flex: 1,
  },
  categoryAccuracy: {
    fontSize: 16,
    fontWeight: '600',
  },
  categoryProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
  },
  categoryProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  categoryStats: {
    fontSize: 12,
    color: '#64748B',
    minWidth: 60,
    textAlign: 'right',
  },
  activityCard: {
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
  activityTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  activitySubtitle: {
    fontSize: 14,
    color: '#64748B',
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
  sessionMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sessionMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sessionMetricText: {
    fontSize: 12,
    color: '#64748B',
  },
  sessionAccuracy: {
    fontSize: 14,
    fontWeight: '600',
  },
  goalsCard: {
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
  goalsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  goalItem: {
    marginBottom: 16,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  goalName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1E293B',
    marginLeft: 8,
    flex: 1,
  },
  goalStatus: {
    fontSize: 16,
  },
  goalDescription: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 28,
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