import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, StyleSheet, Text, View, Button, Alert, TextInput, TouchableOpacity, ScrollView, Animated, Dimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, query, where, onSnapshot, orderBy, limit, getDocs } from "firebase/firestore"; 
import { db } from '../firebaseConfig';
import i18n from '../i18n';
import { Audio } from 'expo-av';
import Svg, { Line, Circle, Path } from 'react-native-svg';

// Beautiful SVG Hangman Component
const HangmanSVG = ({ wrongCount }: { wrongCount: number }) => {
  return (
    <View style={styles.hangmanContainer}>
      <Svg height="250" width="200" viewBox="0 0 200 250">
        {/* Base */}
        <Line x1="10" y1="230" x2="100" y2="230" stroke="#8B4513" strokeWidth="6"/>
        
        {/* Pole */}
        <Line x1="30" y1="230" x2="30" y2="20" stroke="#8B4513" strokeWidth="6"/>
        
        {/* Top beam */}
        <Line x1="30" y1="20" x2="120" y2="20" stroke="#8B4513" strokeWidth="6"/>
        
        {/* Noose */}
        <Line x1="120" y1="20" x2="120" y2="50" stroke="#8B4513" strokeWidth="4"/>
        
        {/* Head (appears at 1 wrong) */}
        {wrongCount >= 1 && (
          <Circle cx="120" cy="65" r="15" stroke="#000" strokeWidth="3" fill="#FFE4B5"/>
        )}
        
        {/* Face details (appears at 1 wrong) */}
        {wrongCount >= 1 && (
          <>
            {/* Eyes */}
            <Circle cx="115" cy="62" r="2" fill="#000"/>
            <Circle cx="125" cy="62" r="2" fill="#000"/>
            {/* Mouth */}
            <Path d="M 115 70 Q 120 75 125 70" stroke="#000" strokeWidth="2" fill="none"/>
          </>
        )}
        
        {/* Body (appears at 2 wrong) */}
        {wrongCount >= 2 && (
          <Line x1="120" y1="80" x2="120" y2="150" stroke="#000" strokeWidth="4"/>
        )}
        
        {/* Left arm (appears at 3 wrong) */}
        {wrongCount >= 3 && (
          <Line x1="120" y1="100" x2="90" y2="130" stroke="#000" strokeWidth="3"/>
        )}
        
        {/* Right arm (appears at 4 wrong) */}
        {wrongCount >= 4 && (
          <Line x1="120" y1="100" x2="150" y2="130" stroke="#000" strokeWidth="3"/>
        )}
        
        {/* Left leg (appears at 5 wrong) */}
        {wrongCount >= 5 && (
          <Line x1="120" y1="150" x2="90" y2="190" stroke="#000" strokeWidth="3"/>
        )}
        
        {/* Right leg (appears at 6 wrong - game over) */}
        {wrongCount >= 6 && (
          <Line x1="120" y1="150" x2="150" y2="190" stroke="#000" strokeWidth="3"/>
        )}
        
        {/* X eyes when dead (appears at 6 wrong) */}
        {wrongCount >= 6 && (
          <>
            <Line x1="112" y1="58" x2="118" y2="66" stroke="#FF0000" strokeWidth="2"/>
            <Line x1="118" y1="58" x2="112" y2="66" stroke="#FF0000" strokeWidth="2"/>
            <Line x1="122" y1="58" x2="128" y2="66" stroke="#FF0000" strokeWidth="2"/>
            <Line x1="128" y1="58" x2="122" y2="66" stroke="#FF0000" strokeWidth="2"/>
          </>
        )}
      </Svg>
    </View>
  );
};

const CATEGORIES = [
  'ANIMALS', 'CITIES', 'FRUITS', 'COUNTRIES', 'PROFESSIONS', 'MOVIES',
  'SPORTS', 'FAMOUS_BRANDS', 'MUSICAL_INSTRUMENTS', 'THINGS_IN_A_HOUSE',
];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const LetterCarousel = ({ guessedLetters, onSelectLetter }: { guessedLetters: string[], onSelectLetter: (letter: string) => void }) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [showScrollHint, setShowScrollHint] = useState(true);
  const [isAtEnd, setIsAtEnd] = useState(false);

  // Safety check for props
  const safeGuessedLetters = guessedLetters || [];
  const safeOnSelectLetter = onSelectLetter || (() => {});

  // Gentle pulse animation for the scroll hint
  useEffect(() => {
    if (showScrollHint) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      
      // Hide hint after 4 seconds
      const timeout = setTimeout(() => {
        setShowScrollHint(false);
        pulse.stop();
      }, 4000);
      
      return () => {
        clearTimeout(timeout);
        pulse.stop();
      };
    }
  }, [showScrollHint]);

  const handleLetterPress = (letter: string) => {
    try {
      if (!letter || typeof letter !== 'string') {
        console.warn('Invalid letter:', letter);
        return;
      }
      
      if (safeGuessedLetters && !safeGuessedLetters.includes(letter) && safeOnSelectLetter) {
        safeOnSelectLetter(letter);
        setShowScrollHint(false); // Hide hint after first interaction
      }
    } catch (error) {
      console.error('Error in letter press:', error);
    }
  };

  const handleScroll = (event: any) => {
    try {
      if (!event || !event.nativeEvent) {
        return;
      }
      
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      
      if (contentOffset && contentSize && layoutMeasurement) {
        const isAtEnd = contentOffset.x >= (contentSize.width - layoutMeasurement.width - 10);
        setIsAtEnd(isAtEnd);
        setShowScrollHint(false); // Hide hint when user starts scrolling
      }
    } catch (error) {
      console.error('Error in scroll handler:', error);
    }
  };

  return (
    <View style={styles.carouselContainer}>
      <View style={styles.carouselWrapper}>
        <ScrollView 
          ref={scrollViewRef}
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
          style={styles.carouselScrollView}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          decelerationRate="fast"
        >
          {ALPHABET.map((letter) => {
          try {
            const isGuessed = safeGuessedLetters ? safeGuessedLetters.includes(letter) : false;
            return (
              <TouchableOpacity
                key={letter}
                style={[styles.letterCard, isGuessed && styles.letterCardDisabled]}
                onPress={() => handleLetterPress(letter)}
                disabled={isGuessed}
                activeOpacity={0.7}
              >
                <Text style={[styles.letterText, isGuessed && styles.letterTextDisabled]}>
                  {letter}
                </Text>
              </TouchableOpacity>
            );
          } catch (error) {
            console.error('Error rendering letter:', letter, error);
            return null;
          }
        })}
        </ScrollView>
        
        {/* Right fade indicator - shows when there are more letters to scroll */}
        {!isAtEnd && (
          <View style={styles.rightFadeIndicator}>
            {showScrollHint && (
              <Animated.View 
                style={[
                  styles.scrollHintContainer,
                  {
                    transform: [{ scale: pulseAnim }]
                  }
                ]}
              >
                <Text style={styles.scrollHintText}>👉</Text>
                <Text style={styles.scrollHintSubText}>Scroll</Text>
              </Animated.View>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const WordInputScreen = ({ category, onSubmit, onBack }: { category: string, onSubmit: (word: string) => void, onBack: () => void }) => {
  const [word, setWord] = useState('');

  return (
    <View style={styles.inputContainer}>
      <Text style={styles.subtitle}>{i18n.t('categories.' + category as any)}</Text>
      <Text style={styles.instructions}>{i18n.t('enterAWord')}</Text>
      <TextInput
        style={styles.input} value={word} onChangeText={setWord}
        placeholder="SECRET WORD" autoCapitalize="characters"
        autoCorrect={false} maxLength={20}
      />
      <View style={styles.buttonWrapper}>
        <Button 
          title={word.trim() ? i18n.t('createGame') : i18n.t('enterAWord')} 
          onPress={() => onSubmit(word)} 
          disabled={!word.trim()} 
        />
      </View>
      <View style={styles.buttonWrapper}>
        <Button title={i18n.t('backToCategories')} onPress={onBack} color="#888" />
      </View>
    </View>
  );
};


export default function MainMenuScreen() {
  const [gamePhase, setGamePhase] = useState<'main_menu' | 'choose_category' | 'enter_word' | 'game_created' | 'browse_games' | 'playing_game'>('main_menu');
  const [category, setCategory] = useState<string>('');
  const [createdGameId, setCreatedGameId] = useState<string | null>(null);  
  const [availableGames, setAvailableGames] = useState<any[]>([]);
  const [currentGameData, setCurrentGameData] = useState<any>(null);
  const [guessedLetters, setGuessedLetters] = useState<string[]>([]);
  const [lastPlayedGameId, setLastPlayedGameId] = useState<string | null>(null);
  const [isProcessingGuess, setIsProcessingGuess] = useState(false);
  const [gameEndingSoundPlayed, setGameEndingSoundPlayed] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [gamesUnsubscribe, setGamesUnsubscribe] = useState<(() => void) | null>(null);

  // This state is our single source of truth.
  const [locale, setLocale] = useState(i18n.locale);

  // Load and cleanup sound
  useEffect(() => {
    async function loadSoundObject() {
      try {
        const { sound: newSound } = await Audio.Sound.createAsync(
          require('../assets/sounds/correct.mp3')
        );
        setSound(newSound);
      } catch (error) {
        console.error("Couldn't load sound", error);
      }
    }
    loadSoundObject();

    return () => {
      // Clean up sound on unmount
      if (sound) {
        sound.unloadAsync().catch(console.error);
      }
    };
  }, []);

  // Cleanup games listener on component unmount
  useEffect(() => {
    return () => {
      if (gamesUnsubscribe) {
        console.log('Component unmounting, cleaning up games listener');
        gamesUnsubscribe();
      }
    };
  }, [gamesUnsubscribe]);

  // Keep track of currently playing sound to prevent overlaps
  const [currentSound, setCurrentSound] = useState<Audio.Sound | null>(null);
  const [isSoundPlaying, setIsSoundPlaying] = useState(false);

  // Play sound function with strict overlap prevention
  async function playSound(soundType: 'correct' | 'wrong' | 'win' | 'lose') {
    console.log(`Attempting to play sound: ${soundType}, isSoundPlaying: ${isSoundPlaying}`);
    
    // If a sound is already playing, ignore this request
    if (isSoundPlaying) {
      console.log(`Ignoring ${soundType} sound - another sound is already playing`);
      return;
    }
    
    setIsSoundPlaying(true);
    
    try {
      // Stop and cleanup any currently playing sound
      if (currentSound) {
        console.log('Stopping previous sound');
        try {
          await currentSound.stopAsync();
          await currentSound.unloadAsync();
        } catch (error) {
          console.warn('Error stopping previous sound:', error);
        }
        setCurrentSound(null);
      }

      // Create a new sound object for each sound to avoid conflicts
      let soundFile;
      switch (soundType) {
        case 'correct':
          soundFile = require('../assets/sounds/correct.mp3');
          break;
        case 'wrong':
          soundFile = require('../assets/sounds/wrong.mp3');
          break;
        case 'win':
          soundFile = require('../assets/sounds/win.mp3');
          break;
        case 'lose':
          soundFile = require('../assets/sounds/lose.mp3');
          break;
        default:
          console.warn(`Unknown sound type: ${soundType}`);
          setIsSoundPlaying(false);
          return;
      }

      console.log(`Actually playing sound: ${soundType}`);
      const { sound: newSound } = await Audio.Sound.createAsync(soundFile);
      setCurrentSound(newSound);
      await newSound.playAsync();
      
      // Clean up after playing
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          console.log(`${soundType} sound finished`);
          newSound.unloadAsync().catch(console.error);
          setCurrentSound(null);
          setIsSoundPlaying(false);
        }
      });
      
      // Fallback cleanup after 3 seconds in case the status update doesn't fire
      setTimeout(() => {
        if (isSoundPlaying) {
          console.log(`Fallback cleanup for ${soundType} sound`);
          setIsSoundPlaying(false);
          if (currentSound === newSound) {
            setCurrentSound(null);
          }
        }
      }, 3000);
      
    } catch (error) {
      console.error(`Couldn't play ${soundType} sound:`, error);
      setIsSoundPlaying(false);
    }
  }

  // This function updates both our state AND the i18n locale.
  const changeLocale = (newLocale: string) => {
    console.log('Changing locale to:', newLocale);
    i18n.locale = newLocale;
    setLocale(newLocale);
    console.log('After change - i18n.locale:', i18n.locale, 'state locale:', newLocale);
  };
  
  const createOnlineGame = async (word: string, category: string) => {
    if (!word || !category) return;
    try {
      const gameDocRef = await addDoc(collection(db, "games"), {
        status: "waiting", category: category, secretWord: word.toUpperCase().trim(),
        guessedLetters: [], wrongGuesses: 0, createdAt: serverTimestamp()
      });
      console.log("Game created with ID: ", gameDocRef.id);
      setCreatedGameId(gameDocRef.id);
      setGamePhase('game_created');
    } catch (e) {
      console.error("Error adding document: ", e);
      Alert.alert("Error", "Could not create the game. Please try again.");
    }
  };

  const rejoinLastGame = async () => {
    if (!lastPlayedGameId) {
      Alert.alert("Error", "No previous game found.");
      return;
    }
    await joinGame(lastPlayedGameId);
  };

  const joinGame = async (gameId: string) => {
    if (!gameId || !gameId.trim()) {
      Alert.alert("Error", "Invalid game ID.");
      return;
    }
    
    try {
      const gameDoc = await getDoc(doc(db, "games", gameId.trim()));
      if (gameDoc.exists()) {
        const gameData = gameDoc.data();
        if (gameData.status === "waiting") {
          // Update game status to "playing" 
          await updateDoc(doc(db, "games", gameId.trim()), {
            status: "playing"
          });
          // Store game data and start playing
          setCurrentGameData({ ...gameData, id: gameId.trim() });
          setGuessedLetters(gameData.guessedLetters || []);
          setLastPlayedGameId(gameId.trim());
          setGameEndingSoundPlayed(false);
          setGamePhase('playing_game');
        } else if (gameData.status === "playing" && gameId.trim() === lastPlayedGameId) {
          // Allow rejoining if this is the last game the player was in
          setCurrentGameData({ ...gameData, id: gameId.trim() });
          setGuessedLetters(gameData.guessedLetters || []);
          setGameEndingSoundPlayed(false);
          setGamePhase('playing_game');
        } else {
          Alert.alert("Error", "This game is no longer available or already in progress.");
        }
      } else {
        Alert.alert("Error", "Game not found.");
      }
    } catch (e: any) {
      console.error("Error joining game: ", e);
      if (e.code === 'permission-denied') {
        Alert.alert("Permission Error", "You don't have permission to access this game. Please check your connection and try again.");
      } else if (e.code === 'unavailable') {
        Alert.alert("Connection Error", "Firebase is unavailable. Please check your internet connection.");
      } else {
        Alert.alert("Error", `Could not join the game: ${e.message || 'Unknown error'}`);
      }
    }
  };

  const makeGuess = async (letter: string) => {
    console.log(`makeGuess called with: ${letter}`);
    
    if (isProcessingGuess) {
      console.log('Already processing a guess, ignoring...');
      return;
    }
    
    setIsProcessingGuess(true);
    
    try {
      if (!currentGameData || !letter || !letter.trim()) {
        console.warn('Invalid game data or letter:', { currentGameData: !!currentGameData, letter });
        setIsProcessingGuess(false);
        return;
      }
      
      if (!guessedLetters) {
        console.warn('guessedLetters is null/undefined');
        setIsProcessingGuess(false);
        return;
      }
      
      const upperLetter = letter.toUpperCase();
      
      if (guessedLetters.includes(upperLetter)) {
        // This shouldn't happen since the letter should be disabled in the carousel
        console.warn('Letter already guessed:', upperLetter);
        setIsProcessingGuess(false);
        return;
      }
      const newGuessedLetters = [...guessedLetters, upperLetter];
      const isCorrect = currentGameData.secretWord.includes(upperLetter);
      const currentWrongCount = currentGameData.wrongGuesses || 0;
      const wrongGuesses = isCorrect ? 
        currentWrongCount : 
        currentWrongCount + 1;

      console.log(`Guess: ${upperLetter}, Correct: ${isCorrect}, Wrong count: ${currentWrongCount} -> ${wrongGuesses}`);

      // Update local state
      setGuessedLetters(newGuessedLetters);
      setCurrentGameData({
        ...currentGameData,
        guessedLetters: newGuessedLetters,
        wrongGuesses: wrongGuesses
      });

      // Update database
      await updateDoc(doc(db, "games", currentGameData.id), {
        guessedLetters: newGuessedLetters,
        wrongGuesses: wrongGuesses
      });

      // Check win/lose conditions first
      const uniqueLettersInWord: string[] = Array.from(new Set(currentGameData.secretWord.split('').filter((char: string) => /[A-Z]/.test(char))));
      const allLettersGuessed = uniqueLettersInWord.every((letter: string) => newGuessedLetters.includes(letter));
      
      console.log(`Secret word: ${currentGameData.secretWord}`);
      console.log(`Unique letters needed: ${uniqueLettersInWord.join(', ')}`);
      console.log(`Guessed letters: ${newGuessedLetters.join(', ')}`);
      console.log(`All letters guessed: ${allLettersGuessed}`);
      
      // Play appropriate sound based on game state
      if (allLettersGuessed) {
        console.log('Game won - playing win sound');
        setGameEndingSoundPlayed(true);
        playSound('win');
        Alert.alert("🎉 You Won!", `The word was: ${currentGameData.secretWord}`);
      } else if (wrongGuesses >= 6) {
        console.log('Game lost - playing lose sound');
        setGameEndingSoundPlayed(true);
        playSound('lose');
        Alert.alert("💀 You Lost!", `The word was: ${currentGameData.secretWord}`);
      } else if (!gameEndingSoundPlayed) {
        // Game continues - play sound for this individual guess ONLY if no game-ending sound was played
        console.log(`Game continues - playing ${isCorrect ? 'correct' : 'wrong'} sound`);
        if (isCorrect) {
          playSound('correct');
        } else {
          playSound('wrong');
        }
      } else {
        console.log('Skipping individual guess sound - game ending sound already played');
      }

    } catch (e) {
      console.error("Error making guess: ", e);
      Alert.alert("Error", "Could not submit guess. Please try again.");
    } finally {
      setIsProcessingGuess(false);
    }
  };

  const handleCategorySelect = (selectedCategory: string) => {
    if (selectedCategory && selectedCategory !== '') {
      setCategory(selectedCategory);
      setGamePhase('enter_word');
    }
  };

  const resetToMainMenu = () => {
    // Clean up games listener when leaving browse games
    if (gamesUnsubscribe) {
      console.log('Cleaning up games listener on menu reset');
      gamesUnsubscribe();
      setGamesUnsubscribe(null);
    }
    
    setGamePhase('main_menu');
    setCategory('');
    setCreatedGameId(null);
    setAvailableGames([]);
    setCurrentGameData(null);
    setGuessedLetters([]);
    // Don't clear lastPlayedGameId - we want to keep it for rejoining
  };

  const goToCreateGame = () => {
    setGamePhase('choose_category');
  };

  const createTestGame = async () => {
    try {
      console.log('Creating test game...');
      
      // Safe array access with fallbacks
      const testWords = ['ELEPHANT', 'GUITAR', 'RAINBOW', 'COMPUTER', 'BUTTERFLY'];
      const testCategories = ['ANIMALS', 'MUSICAL_INSTRUMENTS', 'THINGS_IN_A_HOUSE', 'PROFESSIONS', 'COUNTRIES'];
      
      if (!testWords || testWords.length === 0 || !testCategories || testCategories.length === 0) {
        throw new Error('Test data arrays are invalid');
      }
      
      const randomWord = testWords[Math.floor(Math.random() * testWords.length)];
      const randomCategory = testCategories[Math.floor(Math.random() * testCategories.length)];
      
      if (!randomWord || !randomCategory) {
        throw new Error('Failed to generate random test data');
      }
      
      const gameData = {
        secretWord: randomWord,
        category: randomCategory,
        status: "waiting",
        guessedLetters: [],
        wrongGuesses: 0,
        createdAt: serverTimestamp()
      };

      console.log('Creating game with data:', gameData);
      const docRef = await addDoc(collection(db, "games"), gameData);
      
      if (!docRef || !docRef.id) {
        throw new Error('Failed to create game document');
      }
      
      console.log('Test game created with ID:', docRef.id);
      Alert.alert("✅ Test Game Created!", `Category: ${randomCategory}\nWord: ${randomWord}\nReady to join!`);
      
      // Refresh the games list after a short delay
      setTimeout(() => {
        try {
          loadAvailableGames();
        } catch (refreshError) {
          console.error('Error refreshing games list:', refreshError);
        }
      }, 500);
      
    } catch (error: any) {
      console.error('Error creating test game:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      Alert.alert("Error", `Could not create test game: ${errorMessage}`);
    }
  };

  const loadAvailableGames = async () => {
    try {
      console.log('Loading available games...');
      
      // Clean up existing listener first
      if (gamesUnsubscribe) {
        console.log('Cleaning up previous games listener');
        gamesUnsubscribe();
        setGamesUnsubscribe(null);
      }
      
      // Query for waiting games first, then fall back to all games if none found
      const gamesQuery = query(
        collection(db, "games"), 
        where("status", "==", "waiting"),
        limit(10)
      );
      
      // Use onSnapshot for real-time updates but with better error handling
      const unsubscribe = onSnapshot(gamesQuery, 
        (snapshot) => {
          try {
            console.log('Snapshot received, docs count:', snapshot.docs.length);
            
            const games = snapshot.docs.map(doc => {
              try {
                const data = doc.data();
                console.log('Game data:', { id: doc.id, category: data.category, status: data.status });
                return {
                  id: doc.id,
                  ...data
                };
              } catch (docError) {
                console.error('Error processing game doc:', docError);
                return null;
              }
            })
            .filter(game => game !== null) // Remove any null entries
            // Sort by createdAt on client side
            .sort((a: any, b: any) => {
              try {
                if (!a?.createdAt || !b?.createdAt) return 0;
                return b.createdAt.toMillis() - a.createdAt.toMillis();
              } catch (e) {
                console.warn('Error sorting by timestamp:', e);
                return 0;
              }
            });
            
            console.log('Loaded waiting games:', games.length);
            
            // Simple debug log without nested Firebase query to avoid crashes
            if (games.length === 0) {
              console.log('No waiting games found - all games may be in "playing" status');
            }
            
            setAvailableGames(games);
          } catch (snapshotError) {
            console.error('Error processing snapshot:', snapshotError);
            setAvailableGames([]); // Fallback to empty array
          }
        }, 
        (error) => {
          console.error("Firebase onSnapshot error:", error);
          console.error("Error code:", error.code);
          console.error("Error message:", error.message);
          
          if (error.code === 'permission-denied') {
            Alert.alert("Permission Error", "Access denied. Please check Firebase security rules.");
          } else if (error.code === 'failed-precondition') {
            Alert.alert("Index Error", "Firebase index required. Using basic query instead.");
            // Fallback to simpler approach
            loadGamesWithoutRealtime();
          } else {
            Alert.alert("Error", `Could not load games: ${error.message}`);
          }
        }
      );
      
      // Store unsubscribe function for cleanup
      setGamesUnsubscribe(() => unsubscribe);
      return unsubscribe;
    } catch (error: any) {
      console.error("Error setting up games listener:", error);
      Alert.alert("Error", `Setup failed: ${error.message}`);
    }
  };
  
  // Fallback method without real-time updates
  const loadGamesWithoutRealtime = async () => {
    try {
      const snapshot = await getDocs(query(collection(db, "games"), where("status", "==", "waiting"), limit(10)));
      const games = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }));
      setAvailableGames(games);
    } catch (error: any) {
      console.error("Fallback load failed:", error);
      Alert.alert("Error", "Could not load games even with fallback method.");
    }
  };

  const goToBrowseGames = () => {
    setGamePhase('browse_games');
    loadAvailableGames();
  };

  const LanguageSwitcher = () => {
    return (
      <View style={styles.languageSwitcher}>
          <Button 
            title={locale === 'en' ? "EN ✓" : "EN"} 
            onPress={() => changeLocale('en')} 
            disabled={locale === 'en'} 
          />
          <Button 
            title={locale === 'pt' ? "PT ✓" : "PT"} 
            onPress={() => changeLocale('pt')} 
            disabled={locale === 'pt'} 
          />
      </View>
    );
  };

  // Helper function to display the word with guessed letters
  const displayWord = () => {
    if (!currentGameData) return '';
    return currentGameData.secretWord
      .split('')
      .map((char: string) => {
        if (/[A-Z]/.test(char)) {
          // It's a letter - show it if guessed, otherwise show blank
          return guessedLetters.includes(char) ? char : '_';
        } else {
          // It's not a letter (space, punctuation, etc.) - always show it
          return char;
        }
      })
      .join(' ');
  };



  if (gamePhase === 'playing_game' && currentGameData && currentGameData.secretWord) {
    const wrongCount = currentGameData.wrongGuesses || 0;
    const isGameOver = wrongCount >= 6;
    
    // Safety check for guessed letters
    const safeGuessedLetters = guessedLetters || [];
    
    let isWon = false;
    let uniqueLettersInWord: string[] = [];
    
    try {
      uniqueLettersInWord = Array.from(new Set(currentGameData.secretWord.split('').filter((char: string) => /[A-Z]/.test(char))));
      isWon = uniqueLettersInWord.every((letter: string) => safeGuessedLetters.includes(letter));
    } catch (error) {
      console.error('Error calculating game state:', error);
      isWon = false;
    }

    return (
      <SafeAreaView style={styles.container}>
        <LanguageSwitcher />
        
        {/* Beautiful SVG Hangman - Now the star of the show! */}
        <HangmanSVG wrongCount={wrongCount} />
        
        {/* Word Display */}
        <Text style={styles.wordDisplay}>{displayWord()}</Text>

        {/* Letter Carousel - only show if game is not over */}
        {!isGameOver && !isWon && (
          <LetterCarousel 
            guessedLetters={safeGuessedLetters} 
            onSelectLetter={(letter) => makeGuess(letter)}
          />
        )}

        {/* Back to Menu Button */}
        <View style={styles.buttonWrapper}>
          <Button title={i18n.t('backToMenu')} onPress={resetToMainMenu} color="#888" />
        </View>
      </SafeAreaView>
    );
  }

  if (gamePhase === 'main_menu') {
    return (
      <SafeAreaView style={styles.container}>
        <LanguageSwitcher />
        <Text style={styles.title}>{i18n.t('title')}</Text>
        {lastPlayedGameId && (
          <View style={styles.buttonWrapper}>
            <Button title={i18n.t('continueGame')} onPress={rejoinLastGame} color="#4CAF50" />
          </View>
        )}
        <View style={styles.buttonWrapper}>
          <Button title={i18n.t('createNewGame')} onPress={goToCreateGame} />
        </View>
        <View style={styles.buttonWrapper}>
          <Button title={i18n.t('joinExistingGame')} onPress={goToBrowseGames} />
        </View>
      </SafeAreaView>
    );
  }

  if (gamePhase === 'browse_games') {
    return (
      <SafeAreaView style={styles.container}>
        <LanguageSwitcher />
        <Text style={styles.title}>{i18n.t('title')}</Text>
        <Text style={styles.subtitle}>{i18n.t('availableGames')}</Text>
        
        {availableGames.length === 0 ? (
          <View style={styles.noGamesContainer}>
            <Text style={styles.noGamesText}>{i18n.t('noGamesAvailable')}</Text>
            <Text style={styles.noGamesSubText}>{i18n.t('createFirstGame')}</Text>
          </View>
        ) : (
          <View style={styles.gamesListContainer}>
            {availableGames.map((game) => (
              <TouchableOpacity
                key={game.id}
                style={styles.gameCard}
                onPress={() => joinGame(game.id)}
              >
                <View style={styles.gameCardContent}>
                  <Text style={styles.gameCardCategory}>
                    {i18n.t('categories.' + game.category)}
                  </Text>
                  <Text style={styles.gameCardInfo}>
                    {game.secretWord ? `${game.secretWord.length} letters` : 'Mystery word'}
                  </Text>
                  <Text style={styles.gameCardTime}>
                    {game.createdAt && game.createdAt.toDate ? new Date(game.createdAt.toDate()).toLocaleTimeString() : 'Just now'}
                  </Text>
                </View>
                <View style={styles.joinButton}>
                  <Text style={styles.joinButtonText}>{i18n.t('joinGame')}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        
        <View style={styles.buttonWrapper}>
          <Button title={i18n.t('refreshGames')} onPress={loadAvailableGames} />
        </View>
        <View style={styles.buttonWrapper}>
          <Button title="🎮 Create Test Game" onPress={createTestGame} color="#4CAF50" />
        </View>
        <View style={styles.buttonWrapper}>
          <Button title={i18n.t('backToMenu')} onPress={resetToMainMenu} color="#888" />
        </View>
      </SafeAreaView>
    );
  }

  if (gamePhase === 'game_created' && createdGameId) {
    return (
      <SafeAreaView style={styles.container}>
        <LanguageSwitcher />
        <Text style={styles.title}>{i18n.t('gameCreated')}</Text>
        <Text style={styles.subtitle}>{i18n.t('shareCode')}</Text>
        <Text style={styles.gameIdText}>{createdGameId}</Text>
        <View style={styles.buttonWrapper}>
          <Button title={i18n.t('createAnotherGame')} onPress={resetToMainMenu} />
        </View>
      </SafeAreaView>
    );
  }

  if (gamePhase === 'enter_word') {
    return (
      <SafeAreaView style={styles.container}>
        <LanguageSwitcher />
        <WordInputScreen 
          category={category} 
          onSubmit={(word) => createOnlineGame(word, category)}
          onBack={resetToMainMenu}
        />
      </SafeAreaView>
    );
  }

  if (gamePhase === 'choose_category') {
    return (
      <SafeAreaView style={styles.container}>
        <LanguageSwitcher />
        <Text style={styles.title}>{i18n.t('title')}</Text>
        <Text style={styles.subtitle}>{i18n.t('chooseCategory')}</Text>
        
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={category}
            style={styles.picker}
            onValueChange={(itemValue) => handleCategorySelect(itemValue)}
          >
            <Picker.Item label={i18n.t('chooseCategory')} value="" />
            {CATEGORIES.map(cat => (
              <Picker.Item 
                key={cat} 
                label={i18n.t('categories.' + cat as any)} 
                value={cat} 
              />
            ))}
          </Picker>
        </View>
        <View style={styles.buttonWrapper}>
          <Button title={i18n.t('backToMenu')} onPress={resetToMainMenu} color="#888" />
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
    container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    paddingTop: 100, // Space for language switcher
    paddingBottom: 50, // Add bottom padding for navigation area
  },
  languageSwitcher: {
    position: 'absolute',
    top: 50,
    right: 20,
    flexDirection: 'row',
    zIndex: 1, // Ensure it's above other elements
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 100, // Add horizontal padding to prevent overlap with language switcher
  },
  subtitle: {
    fontSize: 22,
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  instructions: {
    fontSize: 16,
    color: 'gray',
    marginBottom: 10,
    textAlign: 'center',
  },
  pickerContainer: {
    width: '80%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: 'white',
    marginBottom: 20,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  categoryContainer: {
    width: '80%',
    alignItems: 'center',
  },
  buttonWrapper: {
    marginVertical: 10,
    width: 250,
  },
  inputContainer: {
    width: '80%',
    alignItems: 'center',
  },
  input: {
    borderBottomWidth: 2,
    borderColor: 'black',
    width: '100%',
    padding: 10,
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 20,
  },
  gameIdText: {
    fontSize: 28,
    fontWeight: 'bold',
    backgroundColor: '#e0e0e0',
    padding: 20,
    borderRadius: 10,
    letterSpacing: 2,
    marginBottom: 30,
    textAlign: 'center',
  },
  hangmanContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 30,
    backgroundColor: '#f8f8f8',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  hangmanDrawing: {
    fontSize: 18,
    fontFamily: 'monospace',
    backgroundColor: '#f0f0f0',
    padding: 20,
    borderRadius: 8,
    marginVertical: 30,
    textAlign: 'center',
    minHeight: 200,
  },
  wordDisplay: {
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 8,
    marginBottom: 20,
    textAlign: 'center',
    color: '#2196F3',
  },
  guessInfo: {
    fontSize: 18,
    marginBottom: 10,
    textAlign: 'center',
    color: '#666',
  },
  guessedLetters: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    color: '#888',
    fontStyle: 'italic',
  },
  carouselContainer: {
    width: '100%',
    marginBottom: 30,
    paddingVertical: 10,
  },
  carouselTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  carouselScrollView: {
    maxHeight: 80,
  },
  carouselContent: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  letterCard: {
    backgroundColor: '#2196F3',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: '#1976D2',
    marginHorizontal: 6,
  },
  letterCardDisabled: {
    backgroundColor: '#e0e0e0',
    borderColor: '#bdbdbd',
    elevation: 1,
    shadowOpacity: 0.1,
  },
  letterText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  letterTextDisabled: {
    color: '#999',
  },
  carouselWrapper: {
    position: 'relative',
    width: '100%',
  },
  rightFadeIndicator: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  scrollHintContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollHintText: {
    fontSize: 24,
    marginBottom: 2,
  },
  scrollHintSubText: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
  },
  noGamesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  noGamesText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#666',
  },
  noGamesSubText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#888',
    fontStyle: 'italic',
  },
  gamesListContainer: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 20,
  },
  gameCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  gameCardContent: {
    flex: 1,
  },
  gameCardCategory: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 4,
  },
  gameCardInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  gameCardTime: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  joinButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  joinButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
});