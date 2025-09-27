# Hangman (Me Enforque)

A beautiful, real-time, multiplayer Hangman game built with React Native, Expo, Firebase, and TypeScript. Supports both English and Portuguese with full localization.

![screenshot](assets/images/partial-react-logo.png)

## 🚀 Features

- 🎨 Modern, mobile-first UI with SVG hangman graphics
- 🔥 Real-time multiplayer using Firebase Firestore
- 🌍 Internationalization: English & Portuguese (PT as default)
- 🔒 Secure config: Firebase keys via environment variables & EAS secrets
- 📦 Easy APK builds with Expo Application Services (EAS)
- 🔊 Sound effects for win/lose/correct/incorrect
- 🏷️ Category-based word selection

## 📱 Screenshots

> Add screenshots here for best effect!

## 🛠️ Getting Started

### Prerequisites
- Node.js (18+ recommended)
- Yarn or npm
- Expo CLI (`npm install -g expo-cli`)

### Clone the repository
```sh
git clone https://github.com/hmoreira/hangman.git
cd hangman
```

### Install dependencies
```sh
yarn install
# or
npm install
```

### Set up environment variables
Create a `.env` file in the root directory:
```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```
> For production builds, these are managed securely via EAS secrets.

### Start the app locally
```sh
npx expo start
```
Scan the QR code with Expo Go or run on an Android/iOS emulator.

### Build APK with EAS
```sh
eas build --platform android --profile preview
```

## 🌐 Internationalization
- Default language: Portuguese (PT)
- Switch between PT/EN in the app
- All UI, categories, and win/lose messages are localized

## 🔒 Security
- **No Firebase keys in code**: All sensitive config is loaded from environment variables or EAS secrets
- `.env` is git-ignored

## 🤝 Contributing
Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## 📄 License
MIT

---

> Made with ❤️ by [hmoreira](https://github.com/hmoreira)
