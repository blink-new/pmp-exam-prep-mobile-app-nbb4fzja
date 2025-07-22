import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, CheckCircle, XCircle, BookOpen, RotateCcw } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { blink } from '@/lib/blink';

interface Question {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  explanation: string;
  category: string;
  knowledgeArea: string;
  difficulty: string;
}

interface UserAnswer {
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
}

export default function Practice() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [sessionComplete, setSessionComplete] = useState(false);

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged(async (state) => {
      if (state.user) {
        setUser(state.user);
        await loadQuestions();
      }
      setLoading(state.isLoading);
    });
    return unsubscribe;
  }, []);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      // Get 5 random questions for daily practice
      const result = await blink.db.questions.list({
        orderBy: { createdAt: 'desc' },
        limit: 5
      });
      
      if (result && result.length > 0) {
        // Shuffle questions for variety
        const shuffled = [...result].sort(() => Math.random() - 0.5);
        setQuestions(shuffled);
      } else {
        Alert.alert('Error', 'No questions available. Please try again later.');
      }
    } catch (error) {
      console.error('Error loading questions:', error);
      Alert.alert('Error', 'Failed to load questions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (answer: string) => {
    if (showExplanation) return; // Prevent changing answer after submission
    setSelectedAnswer(answer);
  };

  const submitAnswer = async () => {
    if (!selectedAnswer || !user) return;

    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

    // Save user answer
    const userAnswer: UserAnswer = {
      questionId: currentQuestion.id,
      selectedAnswer,
      isCorrect
    };

    setUserAnswers(prev => [...prev, userAnswer]);

    // Save to database
    try {
      await blink.db.userAnswers.create({
        id: `answer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: user.id,
        questionId: currentQuestion.id,
        selectedAnswer,
        isCorrect: isCorrect ? 1 : 0,
        answeredAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error saving answer:', error);
    }

    setShowExplanation(true);
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      completeSession();
    }
  };

  const completeSession = async () => {
    if (!user) return;

    const correctCount = userAnswers.filter(answer => answer.isCorrect).length + 
                        (selectedAnswer === questions[currentQuestionIndex].correctAnswer ? 1 : 0);
    const totalQuestions = questions.length;

    try {
      // Update user stats
      const today = new Date().toISOString().split('T')[0];
      
      // Check if user already has a record
      const existingUsers = await blink.db.users.list({
        where: { id: user.id },
        limit: 1
      });

      if (existingUsers.length > 0) {
        const existingUser = existingUsers[0];
        const lastStudyDate = existingUser.lastStudyDate;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        let newStreak = existingUser.currentStreak;
        
        // Calculate streak
        if (lastStudyDate === today) {
          // Already studied today, don't change streak
        } else if (lastStudyDate === yesterdayStr) {
          // Studied yesterday, increment streak
          newStreak = existingUser.currentStreak + 1;
        } else if (!lastStudyDate || lastStudyDate < yesterdayStr) {
          // Missed days, reset streak to 1
          newStreak = 1;
        }

        const newLongestStreak = Math.max(existingUser.longestStreak, newStreak);

        await blink.db.users.update(user.id, {
          currentStreak: newStreak,
          longestStreak: newLongestStreak,
          lastStudyDate: today,
          totalQuestionsAnswered: existingUser.totalQuestionsAnswered + totalQuestions,
          correctAnswers: existingUser.correctAnswers + correctCount,
          updatedAt: new Date().toISOString()
        });
      } else {
        // Create new user record
        await blink.db.users.create({
          id: user.id,
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
          currentStreak: 1,
          longestStreak: 1,
          lastStudyDate: today,
          totalQuestionsAnswered: totalQuestions,
          correctAnswers: correctCount,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      // Create study session record
      await blink.db.studySessions.create({
        id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: user.id,
        sessionDate: today,
        questionsAnswered: totalQuestions,
        correctAnswers: correctCount,
        sessionDuration: 0, // Could track actual time spent
        createdAt: new Date().toISOString()
      });

      setSessionComplete(true);
    } catch (error) {
      console.error('Error completing session:', error);
      Alert.alert('Error', 'Failed to save progress. Please try again.');
    }
  };

  const restartPractice = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setUserAnswers([]);
    setSessionComplete(false);
    loadQuestions();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading questions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (questions.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#2563EB" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Practice Quiz</Text>
          <View style={styles.headerRight} />
        </View>
        
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No questions available</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadQuestions}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (sessionComplete) {
    const correctCount = userAnswers.filter(answer => answer.isCorrect).length;
    const totalQuestions = questions.length;
    const percentage = Math.round((correctCount / totalQuestions) * 100);

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#2563EB" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Session Complete</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.resultsContainer}>
          <LinearGradient
            colors={percentage >= 80 ? ['#10B981', '#059669'] : percentage >= 60 ? ['#F59E0B', '#D97706'] : ['#EF4444', '#DC2626']}
            style={styles.resultCard}
          >
            <Text style={styles.resultTitle}>Great Job!</Text>
            <Text style={styles.resultScore}>{correctCount}/{totalQuestions}</Text>
            <Text style={styles.resultPercentage}>{percentage}% Correct</Text>
            <Text style={styles.resultMessage}>
              {percentage >= 80 ? 'Excellent work! You\'re ready for the PMP exam!' :
               percentage >= 60 ? 'Good job! Keep practicing to improve.' :
               'Keep studying! Practice makes perfect.'}
            </Text>
          </LinearGradient>

          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.primaryButton} onPress={restartPractice}>
              <RotateCcw size={20} color="white" />
              <Text style={styles.primaryButtonText}>Practice Again</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
              <Text style={styles.secondaryButtonText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#2563EB" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Practice Quiz</Text>
        <View style={styles.headerRight}>
          <Text style={styles.questionCounter}>
            {currentQuestionIndex + 1}/{questions.length}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Question Card */}
        <View style={styles.questionCard}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{currentQuestion.category}</Text>
          </View>
          
          <Text style={styles.questionText}>{currentQuestion.questionText}</Text>
          
          <View style={styles.knowledgeArea}>
            <BookOpen size={16} color="#64748B" />
            <Text style={styles.knowledgeAreaText}>{currentQuestion.knowledgeArea}</Text>
          </View>
        </View>

        {/* Answer Options */}
        <View style={styles.optionsContainer}>
          {[
            { key: 'A', text: currentQuestion.optionA },
            { key: 'B', text: currentQuestion.optionB },
            { key: 'C', text: currentQuestion.optionC },
            { key: 'D', text: currentQuestion.optionD }
          ].map((option) => {
            const isSelected = selectedAnswer === option.key;
            const isCorrect = option.key === currentQuestion.correctAnswer;
            const showResult = showExplanation;

            let optionStyle = [styles.optionButton];
            let textStyle = [styles.optionText];

            if (showResult) {
              if (isCorrect) {
                optionStyle.push(styles.correctOption);
                textStyle.push(styles.correctOptionText);
              } else if (isSelected && !isCorrect) {
                optionStyle.push(styles.incorrectOption);
                textStyle.push(styles.incorrectOptionText);
              }
            } else if (isSelected) {
              optionStyle.push(styles.selectedOption);
              textStyle.push(styles.selectedOptionText);
            }

            return (
              <TouchableOpacity
                key={option.key}
                style={optionStyle}
                onPress={() => handleAnswerSelect(option.key)}
                disabled={showExplanation}
              >
                <View style={styles.optionContent}>
                  <View style={styles.optionLetter}>
                    <Text style={[styles.optionLetterText, textStyle]}>{option.key}</Text>
                  </View>
                  <Text style={textStyle}>{option.text}</Text>
                  {showResult && isCorrect && (
                    <CheckCircle size={20} color="#10B981" />
                  )}
                  {showResult && isSelected && !isCorrect && (
                    <XCircle size={20} color="#EF4444" />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Explanation */}
        {showExplanation && (
          <View style={styles.explanationCard}>
            <Text style={styles.explanationTitle}>Explanation</Text>
            <Text style={styles.explanationText}>{currentQuestion.explanation}</Text>
          </View>
        )}

        {/* Action Button */}
        <View style={styles.actionContainer}>
          {!showExplanation ? (
            <TouchableOpacity
              style={[styles.submitButton, !selectedAnswer && styles.disabledButton]}
              onPress={submitAnswer}
              disabled={!selectedAnswer}
            >
              <Text style={styles.submitButtonText}>Submit Answer</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.nextButton} onPress={nextQuestion}>
              <Text style={styles.nextButtonText}>
                {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Complete Session'}
              </Text>
            </TouchableOpacity>
          )}
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
    minWidth: 32,
  },
  questionCounter: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'white',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 2,
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
    marginTop: 12,
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
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  questionCard: {
    margin: 20,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    lineHeight: 26,
    marginBottom: 16,
  },
  knowledgeArea: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  knowledgeAreaText: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 6,
  },
  optionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  optionButton: {
    backgroundColor: 'white',
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  selectedOption: {
    borderColor: '#2563EB',
    backgroundColor: '#EEF2FF',
  },
  correctOption: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  incorrectOption: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  optionLetter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionLetterText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
    lineHeight: 22,
  },
  selectedOptionText: {
    color: '#2563EB',
  },
  correctOptionText: {
    color: '#10B981',
  },
  incorrectOptionText: {
    color: '#EF4444',
  },
  explanationCard: {
    margin: 20,
    marginTop: 0,
    backgroundColor: '#F8FAFC',
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
  },
  explanationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
  },
  actionContainer: {
    padding: 20,
  },
  submitButton: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#94A3B8',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    padding: 20,
  },
  resultCard: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    marginBottom: 16,
  },
  resultScore: {
    fontSize: 48,
    fontWeight: '800',
    color: 'white',
    marginBottom: 8,
  },
  resultPercentage: {
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
    marginBottom: 16,
  },
  resultMessage: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    opacity: 0.9,
  },
  actionButtons: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButton: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  secondaryButtonText: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '600',
  },
});