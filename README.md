# 🎵 WAV - Music Collaboration Network

**WAV** is a mobile platform designed to connect music creators—producers, vocalists, rappers, and songwriters—to discover and collaborate with like-minded artists. Built with React Native and powered by Supabase, WAV provides an intuitive, audio-first experience for finding your next collaborator.

## 🎯 Overview

WAV transforms how musicians discover collaborators by combining a swipe-based discovery interface with real-time audio messaging. Whether you're a producer looking for the perfect vocalist or a songwriter seeking a beat, WAV makes it simple to connect, communicate, and create together.

### Key Capabilities

- **🎛️ Audio-First Design**: Create rich music profiles with audio samples, BPM, key signatures, and linked streaming accounts
- **👆 Smart Discovery**: Swipe-based candidate discovery filtered by music role, genres, and location
- **💬 Real-Time Messaging**: Exchange text messages, voice notes, and audio files with matched collaborators
- **🌊 Waveform Visualization**: Visual waveform displays for audio clips and voice messages
- **🔐 Secure Authentication**: OAuth and email-based sign-in via Supabase
- **📱 Cross-Platform**: Native iOS, Android, and web support via Expo

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Supabase account with configured authentication
- iOS Simulator, Android Emulator, or Expo Go app for testing

### Installation

1. **Clone and install dependencies**

   ```bash
   npm install
   ```

2. **Configure Supabase**
   - Set up your Supabase project and database schema (see `supabase/schema.sql`)
   - Update environment variables in `src/config/env.ts` with your Supabase URL and API key

3. **Start the development server**

   ```bash
   npm start
   ```

4. **Run on your preferred platform**
   ```bash
   npm run ios      # iOS Simulator
   npm run android  # Android Emulator
   npm run web      # Web browser
   ```

## 📁 Project Structure

```
wav/
├── src/
│   ├── components/       # Reusable UI components (AudioWaveform, MainBottomNav)
│   ├── config/          # App configuration (theme, constants, environment)
│   ├── errors/          # Custom error classes (AppError, ServiceError, RepositoryError)
│   ├── lib/             # External integrations (Supabase, storage, real-time sync)
│   ├── models/          # TypeScript data models (User, Profile, Match, Message, Swipe)
│   ├── repositories/    # Data access layer with Supabase implementations
│   ├── screens/         # Screen components organized by flow
│   │   ├── auth/        # Authentication and splash screens
│   │   ├── main/        # Main app screens (Discover, Matches, Chat, Profile, Settings)
│   │   └── onboarding/  # Profile creation and onboarding flow
│   ├── services/        # Business logic layer (Auth, Profile, Swipe, Match, Chat, Audio)
│   ├── types/           # Global TypeScript definitions and Supabase types
│   └── utils/           # Helper functions (formatters, validators)
├── supabase/            # Database schema and serverless functions
│   ├── schema.sql       # PostgreSQL schema with RLS policies
│   └── functions/       # Edge functions for waveform processing
├── assets/              # Images and branding assets
├── scripts/             # Build and utility scripts
└── config files         # TypeScript, Babel, ESLint, Tailwind configuration
```

## 🏗️ Architecture

WAV follows **clean architecture** principles with clear separation of concerns:

### Data Flow

```
Screens → Services → Repositories → Supabase
```

- **Screens**: React components handling UI and user interaction
- **Services**: Business logic layer (AuthService, ProfileService, MatchService, ChatService, etc.)
- **Repositories**: Data access abstractions with Supabase implementations
- **Supabase**: Backend database, authentication, real-time features, and storage

### Key Services

| Service               | Responsibility                             |
| --------------------- | ------------------------------------------ |
| `AuthService`         | User authentication and session management |
| `ProfileService`      | Profile CRUD and profile hydration         |
| `SwipeService`        | Swipe creation and match generation        |
| `MatchService`        | Match retrieval and management             |
| `ChatService`         | Message persistence and retrieval          |
| `AudioService`        | Audio playback orchestration               |
| `NotificationService` | Push notifications via Expo                |

## 🎨 Features

### 1. **User Authentication**

- Email and Google OAuth sign-in
- Session persistence via Supabase Auth
- Email verification guidance for unconfirmed accounts

### 2. **Rich Music Profiles**

- Display name, bio, and avatar
- Primary role: Producer, Vocalist, Rapper, or Songwriter
- Music metadata: DAW, genres, BPM, key signature
- Audio clip upload (up to 60 seconds)
- Style tags and linked music accounts (Spotify, Apple Music, SoundCloud)
- Verification badge support
- Profile photo and audio sample management

### 3. **Discovery & Swiping**

- Candidate feed with pagination (25 profiles per page)
- Swipe left (pass) or right (like)
- Automatic match creation on mutual swipes
- Instant match celebration UI
- Candidate filtering by role, genres, and location

### 4. **Messaging & Collaboration**

- Real-time message synchronization
- Three message types:
  - **Text**: Plain text messages
  - **Voice Notes**: Audio recordings
  - **Audio Files**: Music previews and production files
- Message read receipts
- Typing indicators
- Waveform visualization with sample rate awareness
- Chat audio file storage in Supabase Storage

### 5. **Notifications**

- Push notifications for new messages and matches
- Expo notification system integration
- Background message handling

## 🛠️ Development

### Available Scripts

```bash
npm start              # Start Expo dev server
npm run ios            # Run on iOS Simulator
npm run android        # Run on Android Emulator
npm run web            # Run in web browser
npm run lint           # Run ESLint
npm run waveform:worker # Process audio waveforms (Node.js worker)
npm run reset-project  # Reset to blank project state
```

### Code Quality

The project uses **ESLint** with boundary rules to enforce clean architecture:

- Screens cannot import directly from repositories
- Services are the only layer consuming repositories
- Strict no-restricted-imports rules prevent architectural violations

Lint your changes:

```bash
npm run lint
```

Type checking:

```bash
npx tsc --noEmit
```

### Technology Stack

| Category          | Technologies                                        |
| ----------------- | --------------------------------------------------- |
| **Framework**     | React Native 0.81.5, Expo 54.0.33                   |
| **Language**      | TypeScript 5.9                                      |
| **Styling**       | TailwindCSS 3.4.17, NativeWind 4.2.1                |
| **Navigation**    | React Navigation with Bottom Tabs & Stack Navigator |
| **Database**      | Supabase (PostgreSQL) with RLS policies             |
| **Real-time**     | Supabase Realtime for live messages and typing      |
| **Storage**       | Supabase Storage for audio files and avatars        |
| **Audio**         | Expo AV for playback, Web Audio API for waveforms   |
| **Notifications** | Expo Notifications with push token management       |
| **Build**         | Metro (React Native bundler)                        |

## 📊 Data Model

### Core Tables

```sql
users              (Supabase Auth reference)
↓
profiles           (User music metadata & avatar)
├─ audio_clip_url  (60-second intro clip)
├─ track_previews  (JSONB music samples with waveforms)
└─ linked_accounts (Spotify/Apple Music/SoundCloud URLs)

swipes             (User swipe history with direction)
↓
matches            (Mutual swipes trigger match creation)
↓
messages           (Text, voice notes, and audio files)
├─ message_kind    ('text' | 'voice-note' | 'audio-file')
├─ file_url        (Supabase Storage reference)
└─ waveform_*      (Amplitude samples for visualization)
```

### Unique Constraints & Triggers

- **Swipes**: One swipe per user-pair (no duplicates)
- **Matches**: One match per user-pair with automatic creation on mutual right-swipes
- **Messages**: Enforced relationship to matches

## 🔐 Security

- **Row-Level Security (RLS)**: Supabase policies enforce user data isolation
- **Authentication**: Supabase Auth handles credential storage
- **Storage**: Audio files stored in Supabase Storage with signed URLs
- **Rate Limiting**: Built-in Supabase rate limiting on API calls

## 🎬 User Flows

### Onboarding

1. Splash screen with authentication
2. Email/Google sign-in or account creation
3. Profile creation (role, genres, location, avatar)
4. Audio intro clip recording
5. Redirect to main app

### Discovering Collaborators

1. Browse candidate profiles with music information
2. Listen to intro clips via waveform player
3. Swipe right to express interest, left to pass
4. Receive instant match notification on mutual swipe

### Collaborating

1. View matches in the Matches tab
2. Select a match to start conversation
3. Send text messages, voice notes, or audio files
4. View message history with read receipts

### Profile Management

1. Edit profile information and tags
2. Update avatar and audio clip
3. Manage linked music accounts
4. View verification status

## 📦 Dependencies Highlights

- **expo-av**: Audio playback and recording
- **expo-image-picker**: File and image selection
- **expo-notifications**: Push notification handler
- **expo-file-system**: Local file operations
- **@supabase/supabase-js**: Backend client
- **react-native-reanimated**: Smooth animations
- **react-native-worklets**: Native performance optimization

## 🐛 Error Handling

The app uses a consistent error hierarchy:

- `AppError`: Base error class
- `ServiceError`: Service layer failures with context
- `RepositoryError`: Data access failures

Errors include contextual information for debugging and user-facing messages.

## 🚧 Future Enhancements

- Collaborative playlist creation
- Genre and skill-based matching algorithms
- Producer credit tracking on released tracks
- In-app voice/video calls
- Analytics dashboard for collaboration success
- Mobile app store deployment (TestFlight, Google Play)

## 📚 Learn More

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/)
- [Supabase Docs](https://supabase.com/docs)
- [TailwindCSS](https://tailwindcss.com/)
- [TypeScript](https://www.typescriptlang.org/)

## 📝 License

© 2026 WAV - All rights reserved
