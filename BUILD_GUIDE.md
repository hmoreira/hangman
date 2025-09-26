# Hangman App - Optimized APK Build Guide

## Pre-build Optimizations Applied

### 1. App Configuration (app.json)
- Set `supportsTablet: false` for iOS to reduce bundle size
- Configured proper Android package name
- Optimized splash screen colors to match app theme

### 2. EAS Build Configuration (eas.json)
- Created specific build profiles for different purposes:
  - `preview`: For testing APK builds
  - `production`: For release APK builds  
  - `production-aab`: For Google Play Store (smaller download size)

### 3. Metro Bundler Optimization (metro.config.js)
- Enabled minification with optimal settings
- Configured tree shaking to remove unused code
- Optimized asset handling

## Build Commands

### Install EAS CLI (if not already installed)
```bash
npm install -g eas-cli
```

### Login to Expo
```bash
eas login
```

### Build Optimized APK
```bash
# For preview/testing (smaller, faster build)
eas build --platform android --profile preview

# For production release (most optimized)
eas build --platform android --profile production

# For Google Play Store (App Bundle - smallest download)
eas build --platform android --profile production-aab
```

## Additional Size Optimization Tips

### 1. Asset Optimization
- Compress images in `/assets/images/` using tools like TinyPNG
- Convert PNG images to WebP format when possible
- Reduce audio file bitrate for sound effects

### 2. Code Optimization
- Remove unused dependencies from package.json
- Use dynamic imports for large libraries
- Remove console.log statements in production

### 3. Bundle Analysis
After building, you can analyze bundle size:
```bash
npx expo export --platform android
npx @expo/bundle-analyzer dist/
```

## Expected APK Size
With these optimizations, your APK should be approximately:
- Development build: ~50-70MB
- Production build: ~25-40MB  
- App Bundle (AAB): ~15-25MB download size

## Notes
- First build may take 15-30 minutes
- Subsequent builds are cached and faster
- App Bundle (AAB) provides the smallest download size for users
- APK is better for direct distribution/testing