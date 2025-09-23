import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, StyleSheet, Text, View, Button, Alert, TextInput, TouchableOpacity, ScrollView, Animated, Dimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, query, where, onSnapshot, orderBy, limit, getDocs } from "firebase/firestore"; 
import { db } from '../firebaseConfig';
import i18n from '../i18n';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';

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
      if (guessedLetters && !guessedLetters.includes(letter) && onSelectLetter) {
        onSelectLetter(letter);
        setShowScrollHint(false); // Hide hint after first interaction
      }
    } catch (error) {
      console.error('Error in letter press:', error);
    }
  };

  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isAtEnd = contentOffset.x >= (contentSize.width - layoutMeasurement.width - 10);
    setIsAtEnd(isAtEnd);
    setShowScrollHint(false); // Hide hint when user starts scrolling
  };

  return (
    <View style={styles.carouselContainer}>
      <Text style={styles.carouselTitle}>🔤 {i18n.t('selectLetter')}</Text>
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
            const isGuessed = guessedLetters ? guessedLetters.includes(letter) : false;
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
          })}
        </ScrollView>
        
        {/* Right fade indicator - shows when there are more letters to scroll */}
        {!isAtEnd && (
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.9)', 'rgba(255,255,255,1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.rightFadeIndicator}
            pointerEvents="none"
          >
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
          </LinearGradient>
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
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  // This state is our single source of truth.
  const [locale, setLocale] = useState(i18n.locale);

  // Load and cleanup sound
  useEffect(() => {
    async function loadSoundObject() {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/sounds/correct.mp3')
        );
        setSound(sound);
      } catch (error) {
        console.error("Couldn't load sound", error);
      }
    }
    loadSoundObject();

    return () => {
      sound?.unloadAsync();
    };
  }, []);

  // Play sound function
  async function playSound(soundType: 'correct' | 'wrong' | 'win' | 'lose') {
    if (!sound) return;
    try {
      await sound.unloadAsync();
      switch (soundType) {
        case 'correct':
          await sound.loadAsync(require('../assets/sounds/correct.mp3'));
          break;
        case 'wrong':
          await sound.loadAsync(require('../assets/sounds/wrong.mp3'));
          break;
        case 'win':
          await sound.loadAsync(require('../assets/sounds/win.mp3'));
          break;
        case 'lose':
          await sound.loadAsync(require('../assets/sounds/lose.mp3'));
          break;
      }
      await sound.playAsync();
    } catch (error) {
      console.error("Couldn't play sound", error);
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
    try {
      if (!currentGameData || !letter || !letter.trim()) {
        console.warn('Invalid game data or letter:', { currentGameData: !!currentGameData, letter });
        return;
      }
      
      if (!guessedLetters) {
        console.warn('guessedLetters is null/undefined');
        return;
      }
      
      const upperLetter = letter.toUpperCase();
      
      if (guessedLetters.includes(upperLetter)) {
        // This shouldn't happen since the letter should be disabled in the carousel
        console.warn('Letter already guessed:', upperLetter);
        return;
      }
      const newGuessedLetters = [...guessedLetters, upperLetter];
      const isCorrect = currentGameData.secretWord.includes(upperLetter);
      const currentWrongCount = currentGameData.wrongGuesses || 0;
      const wrongGuesses = isCorrect ? 
        currentWrongCount : 
        currentWrongCount + 1;

      console.log(`Guess: ${upperLetter}, Correct: ${isCorrect}, Wrong count: ${currentWrongCount} -> ${wrongGuesses}`);

      // Play sound for correct or wrong guess
      if (isCorrect) {
        playSound('correct');
      } else {
        playSound('wrong');
      }

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

      // Check win/lose conditions
      const uniqueLettersInWord: string[] = Array.from(new Set(currentGameData.secretWord.split('').filter((char: string) => /[A-Z]/.test(char))));
      const allLettersGuessed = uniqueLettersInWord.every((letter: string) => newGuessedLetters.includes(letter));
      
      console.log(`Secret word: ${currentGameData.secretWord}`);
      console.log(`Unique letters needed: ${uniqueLettersInWord.join(', ')}`);
      console.log(`Guessed letters: ${newGuessedLetters.join(', ')}`);
      console.log(`All letters guessed: ${allLettersGuessed}`);
      
      if (allLettersGuessed) {
        playSound('win');
        Alert.alert("🎉 You Won!", `The word was: ${currentGameData.secretWord}`);
      } else if (wrongGuesses >= 6) {
        playSound('lose');
        Alert.alert("💀 You Lost!", `The word was: ${currentGameData.secretWord}`);
      }

    } catch (e) {
      console.error("Error making guess: ", e);
      Alert.alert("Error", "Could not submit guess. Please try again.");
    }
  };

  const handleCategorySelect = (selectedCategory: string) => {
    if (selectedCategory && selectedCategory !== '') {
      setCategory(selectedCategory);
      setGamePhase('enter_word');
    }
  };

  const resetToMainMenu = () => {
    setGamePhase('main_menu');
    setCategory('');
    setCreatedGameId(null);
    setAvailableGames([]);
    setCurrentGameData(null);
    setGuessedLetters([]);
  };

  const goToCreateGame = () => {
    setGamePhase('choose_category');
  };

  const loadAvailableGames = async () => {
    try {
      console.log('Loading available games...');
      
      // Simplified query to avoid composite index requirement
      const gamesQuery = query(
        collection(db, "games"), 
        where("status", "==", "waiting"),
        limit(10)
      );
      
      // Use onSnapshot for real-time updates but with better error handling
      const unsubscribe = onSnapshot(gamesQuery, 
        (snapshot) => {
          console.log('Snapshot received, docs count:', snapshot.docs.length);
          
          const games = snapshot.docs.map(doc => {
            const data = doc.data();
            console.log('Game data:', { id: doc.id, category: data.category, status: data.status });
            return {
              id: doc.id,
              ...data
            };
          })
          // Sort by createdAt on client side
          .sort((a: any, b: any) => {
            if (!a.createdAt || !b.createdAt) return 0;
            try {
              return b.createdAt.toMillis() - a.createdAt.toMillis();
            } catch (e) {
              console.warn('Error sorting by timestamp:', e);
              return 0;
            }
          });
          
          console.log('Loaded games:', games.length);
          setAvailableGames(games);
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

  // Helper function to get hangman drawing
  const getHangmanDrawing = (wrongCount: number) => {
    console.log(`Drawing hangman for wrong count: ${wrongCount}`);
    const drawings = [
      "",  // 0 wrong
      "  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========", // 1 - Head
      "  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========", // 2 - Body
      "  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========", // 3 - Left arm
      "  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========", // 4 - Right arm
      "  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========", // 5 - Left leg
      "  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n========="  // 6 - Right leg (dead)
    ];
    return drawings[Math.min(wrongCount, 6)];
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
        <Text style={styles.title}>{i18n.t('title')}</Text>
        <Text style={styles.subtitle}>Category: {i18n.t('categories.' + currentGameData.category as any)}</Text>
        
        {/* Hangman Drawing */}
        <Text style={styles.hangmanDrawing}>{getHangmanDrawing(wrongCount)}</Text>
        
        {/* Word Display */}
        <Text style={styles.wordDisplay}>{displayWord()}</Text>
        
        {/* Wrong Guesses Count */}
        <Text style={styles.guessInfo}>Wrong guesses: {wrongCount}/6</Text>
        
        {/* Guessed Letters */}
        {safeGuessedLetters.length > 0 && (
          <Text style={styles.guessedLetters}>
            Guessed: {safeGuessedLetters.join(', ')}
          </Text>
        )}

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
  hangmanDrawing: {
    fontSize: 12,
    fontFamily: 'monospace',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
    textAlign: 'center',
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