import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { Audio } from 'expo-av';

// --- Constants ---
const WORD_TO_GUESS = "DEVELOPER";
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
const MAX_WRONG_GUESSES = 6;


// =======================================================
// --- HANGMAN DRAWING COMPONENT ---
// =======================================================
const BODY_PARTS = [
  <Circle key="head" cx="120" cy="70" r="20" stroke="black" strokeWidth="3" fill="none" />,
  <Line key="body" x1="120" y1="90" x2="120" y2="150" stroke="black" strokeWidth="3" />,
  <Line key="right-arm" x1="120" y1="110" x2="90" y2="90" stroke="black" strokeWidth="3" />,
  <Line key="left-arm" x1="120" y1="110" x2="150" y2="90" stroke="black" strokeWidth="3" />,
  <Line key="right-leg" x1="120" y1="150" x2="90" y2="180" stroke="black" strokeWidth="3" />,
  <Line key="left-leg" x1="120" y1="150" x2="150" y2="180" stroke="black" strokeWidth="3" />,
];

function HangmanDrawing({ wrongGuesses }: { wrongGuesses: number }) {
  return (
    <View style={styles.drawingContainer}>
      <Svg height="250" width="200">
        {BODY_PARTS.slice(0, wrongGuesses)}
        <Line x1="120" y1="20" x2="120" y2="50" stroke="black" strokeWidth="3" />
        <Line x1="40" y1="20" x2="120" y2="20" stroke="black" strokeWidth="3" />
        <Line x1="40" y1="230" x2="40" y2="20" stroke="black" strokeWidth="3" />
        <Line x1="10" y1="230" x2="70" y2="230" stroke="black" strokeWidth="3" />
      </Svg>
    </View>
  );
}
// =======================================================


// --- Main Screen Component ---
export default function HangmanGameScreen() {
  const [guessedLetters, setGuessedLetters] = useState<string[]>([]);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    async function loadSoundObject() {
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/sounds/correct.mp3') // <-- UPDATED PATH
      );
      setSound(sound);
    }
    loadSoundObject();

    return () => {
      sound?.unloadAsync();
    };
  }, []);

  async function playSound(soundType: 'correct' | 'wrong' | 'win' | 'lose') {
    if (!sound) return;
    try {
      await sound.unloadAsync();
      switch (soundType) {
        case 'correct':
          await sound.loadAsync(require('../assets/sounds/correct.mp3')); // <-- UPDATED PATH
          break;
        case 'wrong':
          await sound.loadAsync(require('../assets/sounds/wrong.mp3')); // <-- UPDATED PATH
          break;
        case 'win':
          await sound.loadAsync(require('../assets/sounds/win.mp3')); // <-- UPDATED PATH
          break;
        case 'lose':
          await sound.loadAsync(require('../assets/sounds/lose.mp3')); // <-- UPDATED PATH
          break;
      }
      await sound.playAsync();
    } catch (error) {
      console.error("Couldn't play sound", error);
    }
  }
  
  const wrongGuesses = guessedLetters.filter(
    letter => !WORD_TO_GUESS.includes(letter)
  ).length;
  const isGameWon = WORD_TO_GUESS.split('').every(letter => guessedLetters.includes(letter));
  const isGameLost = wrongGuesses >= MAX_WRONG_GUESSES;
  const isGameOver = isGameWon || isGameLost;

  const handleGuess = (letter: string) => {
    if (isGameOver || guessedLetters.includes(letter)) return;
    setGuessedLetters(currentLetters => [...currentLetters, letter]);
  };

  const playAgain = () => {
    setGuessedLetters([]);
  }

  useEffect(() => {
    if (guessedLetters.length === 0) return;
    if (isGameWon) {
      playSound('win');
      Alert.alert("You Won!", "Congratulations!", [{ text: "Play Again", onPress: playAgain }]);
      return;
    }
    if (isGameLost) {
      playSound('lose');
      Alert.alert("You Lost", `The word was: ${WORD_TO_GUESS}`, [{ text: "Play Again", onPress: playAgain }]);
      return;
    }
    const lastGuessedLetter = guessedLetters[guessedLetters.length - 1];
    if (WORD_TO_GUESS.includes(lastGuessedLetter)) {
      playSound('correct');
    } else {
      playSound('wrong');
    }
  }, [guessedLetters]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Hangman</Text>
      
      <HangmanDrawing wrongGuesses={wrongGuesses} />

      <View style={styles.wordContainer}>
        {WORD_TO_GUESS.split('').map((letter, index) => (
          <Text key={index} style={styles.letter}>
            {guessedLetters.includes(letter) ? letter : '_'}
          </Text>
        ))}
      </View>

      <View style={styles.keyboardContainer}>
        {ALPHABET.map((letter) => {
          const isGuessed = guessedLetters.includes(letter);
          return (
            <TouchableOpacity
              key={letter}
              onPress={() => handleGuess(letter)}
              disabled={isGuessed || isGameOver}
              style={[styles.key, isGuessed && styles.keyGuessed]}
            >
              <Text style={styles.keyText}>{letter}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    padding: 10,
    paddingBottom: 30
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  drawingContainer: {
    height: 250,
  },
  wordContainer: {
    flexDirection: 'row',
  },
  letter: {
    fontSize: 32,
    fontWeight: 'bold',
    marginHorizontal: 5,
    borderBottomWidth: 3,
    borderColor: '#000',
    minWidth: 30,
    textAlign: 'center',
  },
  keyboardContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  key: {
    backgroundColor: '#add8e6',
    padding: 10,
    margin: 4,
    borderRadius: 5,
    width: 35,
    alignItems: 'center',
  },
  keyGuessed: {
    backgroundColor: '#d3d3d3',
    opacity: 0.5,
  },
  keyText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});