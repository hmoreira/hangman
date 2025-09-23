import React, { useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet, Text, View, Button, Alert, TextInput } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from "firebase/firestore"; 
import { db } from '../firebaseConfig';
import i18n from '../i18n';
import { Audio } from 'expo-av';

const CATEGORIES = [
  'ANIMALS', 'CITIES', 'FRUITS', 'COUNTRIES', 'PROFESSIONS', 'MOVIES',
  'SPORTS', 'FAMOUS_BRANDS', 'MUSICAL_INSTRUMENTS', 'THINGS_IN_A_HOUSE',
];

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
  const [gamePhase, setGamePhase] = useState<'main_menu' | 'choose_category' | 'enter_word' | 'game_created' | 'join_game' | 'playing_game'>('main_menu');
  const [category, setCategory] = useState<string>('');
  const [createdGameId, setCreatedGameId] = useState<string | null>(null);  
  const [joinGameId, setJoinGameId] = useState<string>('');
  const [currentGameData, setCurrentGameData] = useState<any>(null);
  const [guessedLetters, setGuessedLetters] = useState<string[]>([]);
  const [currentGuess, setCurrentGuess] = useState<string>('');
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
    if (!gameId.trim()) {
      Alert.alert("Error", "Please enter a game code.");
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
        Alert.alert("Error", "Game not found. Please check the code and try again.");
      }
    } catch (e) {
      console.error("Error joining game: ", e);
      Alert.alert("Error", "Could not join the game. Please try again.");
    }
  };

  const makeGuess = async (letter: string) => {
    if (!currentGameData || !letter.trim()) return;
    
    const upperLetter = letter.toUpperCase();
    if (guessedLetters.includes(upperLetter)) {
      Alert.alert("Already guessed", "You already guessed this letter!");
      return;
    }

    try {
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
      setCurrentGuess('');

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
    setJoinGameId('');
    setCurrentGameData(null);
    setGuessedLetters([]);
    setCurrentGuess('');
  };

  const goToCreateGame = () => {
    setGamePhase('choose_category');
  };

  const goToJoinGame = () => {
    setGamePhase('join_game');
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

  if (gamePhase === 'playing_game' && currentGameData) {
    const wrongCount = currentGameData.wrongGuesses || 0;
    const isGameOver = wrongCount >= 6;
    const uniqueLettersInWord: string[] = Array.from(new Set(currentGameData.secretWord.split('').filter((char: string) => /[A-Z]/.test(char))));
    const isWon = uniqueLettersInWord.every((letter: string) => guessedLetters.includes(letter));

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
        {guessedLetters.length > 0 && (
          <Text style={styles.guessedLetters}>
            Guessed: {guessedLetters.join(', ')}
          </Text>
        )}

        {/* Guess Input - only show if game is not over */}
        {!isGameOver && !isWon && (
          <>
            <Text style={styles.instructions}>Guess a letter:</Text>
            <TextInput
              style={styles.input}
              value={currentGuess}
              onChangeText={setCurrentGuess}
              placeholder="Enter letter"
              maxLength={1}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <View style={styles.buttonWrapper}>
              <Button 
                title={currentGuess.trim() ? "Guess Letter" : "Enter a letter"} 
                onPress={() => makeGuess(currentGuess)} 
                disabled={!currentGuess.trim()} 
              />
            </View>
          </>
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
          <Button title={i18n.t('joinExistingGame')} onPress={goToJoinGame} />
        </View>
      </SafeAreaView>
    );
  }

  if (gamePhase === 'join_game') {
    return (
      <SafeAreaView style={styles.container}>
        <LanguageSwitcher />
        <Text style={styles.title}>{i18n.t('title')}</Text>
        <Text style={styles.subtitle}>{i18n.t('enterGameCode')}</Text>
        <TextInput
          style={styles.input}
          value={joinGameId}
          onChangeText={setJoinGameId}
          placeholder="GAME CODE"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={20}
        />
        <View style={styles.buttonWrapper}>
          <Button 
            title={joinGameId.trim() ? i18n.t('joinGame') : i18n.t('enterGameCode')} 
            onPress={() => joinGame(joinGameId)} 
            disabled={!joinGameId.trim()} 
          />
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
});