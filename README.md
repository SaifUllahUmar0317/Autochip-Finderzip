# 🔍 AutoChip Finder

<p align="center">
  <img src="artifacts/autochip-finder/assets/images/icon.png" width="120" alt="AutoChip Finder Logo" />
</p>

<p align="center">
  <strong>Professional automotive chip & ECU lookup tool — 100% offline, instant search</strong>
</p>

<p align="center">
  <a href="https://github.com/SaifUllahUmar0317/Autochip-Finderzip/releases/tag/v1.0.0">
    <img src="https://img.shields.io/github/v/release/SaifUllahUmar0317/Autochip-Finderzip?label=APK&color=2ea043&logo=android" alt="Download APK" />
  </a>
  <img src="https://img.shields.io/badge/Platform-Android-brightgreen?logo=android" alt="Platform" />
  <img src="https://img.shields.io/badge/Framework-Expo%20%2F%20React%20Native-blue?logo=expo" alt="Framework" />
  <img src="https://img.shields.io/badge/Offline-100%25-success" alt="Offline" />
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License" />
</p>

---

## 📱 Download

| Platform | Link |
|----------|------|
| 🤖 Android APK | [**Download v1.0.0**](https://github.com/SaifUllahUmar0317/Autochip-Finderzip/releases/tag/v1.0.0) |

> **Install instructions:** Download the APK → go to **Settings → Security → Unknown Sources** → enable → tap the APK file → Install.

---

## 📸 About

**AutoChip Finder** is a professional automotive diagnostic tool designed for technicians and engineers who work with vehicle ECUs, BCMs, airbag modules, and dashboard control units.

It provides an **instant, fully offline** searchable database of automotive chip part numbers and chip numbers, allowing technicians to identify the correct replacement chip for any vehicle module — without needing an internet connection.

---

## ✨ Features

- **🔎 Instant Indexed Search** — Search by Part Number or Chip Number with results appearing in milliseconds
- **📦 4 Complete Module Libraries:**
  - Airbag / SRS Modules
  - BCM (Body Control Module)
  - Dashboard / Instrument Clusters
  - ECU (Engine Control Unit)
- **📴 100% Offline** — No internet required after installation
- **🗂️ PDF Import & Viewer** — Import custom PDF chip reference sheets
- **📚 Library Management** — Organize, update, and delete imported documents
- **🌓 Light & Dark Theme** — Automatic system theme support
- **🎨 Animated Splash Screen** — Custom chip + lens logo animation on startup
- **📋 Search History** — View recently searched items
- **📤 Share Results** — Share chip information directly from search results
- **🔖 Saved / Bookmarks** — Save frequently referenced entries

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [Expo](https://expo.dev) (React Native) |
| Navigation | [Expo Router](https://expo.github.io/router) (file-based routing) |
| Database | [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) (on-device SQLite) |
| UI | React Native + custom components |
| Fonts | Inter (via `@expo-google-fonts/inter`) |
| PDF Parsing | `pdfjs-dist` |
| Animations | `react-native-reanimated` |
| State | `@tanstack/react-query` |
| Build | GitHub Actions → Gradle → APK |

---

## 📁 Project Structure

```
artifacts/autochip-finder/
├── app/                    # Expo Router screens
│   ├── (tabs)/             # Tab navigation screens
│   │   ├── index.tsx       # Home dashboard
│   │   ├── library.tsx     # Document library
│   │   └── saved.tsx       # Saved / bookmarks
│   ├── search.tsx          # Global search screen
│   ├── import.tsx          # PDF import screen
│   ├── viewer.tsx          # PDF viewer
│   ├── settings.tsx        # App settings
│   ├── history.tsx         # Search history
│   ├── module/[id].tsx     # Module detail screen
│   └── tool/[tool].tsx     # Tool screens (CG100X, iProg Pro)
├── components/             # Reusable UI components
│   ├── AnimatedSplashScreen.tsx
│   ├── AutoChipLogo.tsx
│   ├── HomeDashboard.tsx
│   └── ...
├── context/                # Global app state (AppContext)
├── constants/              # Colors, themes
├── hooks/                  # Custom React hooks
├── lib/                    # Database utilities
│   └── database.ts         # SQLite schema, queries, seed logic
├── data/                   # Bundled seed data (JSON index)
├── assets/                 # Images, fonts, icons
├── app.json                # Expo configuration
└── package.json            # Dependencies
```

---

## 🚀 Getting Started (Development)

### Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [Expo Go](https://expo.dev/go) app on your Android phone

### Run in Expo Go

```bash
# Clone the repository
git clone https://github.com/SaifUllahUmar0317/Autochip-Finderzip.git
cd Autochip-Finderzip/artifacts/autochip-finder

# Install dependencies
npm install

# Start the development server
npx expo start
```

Scan the QR code with **Expo Go** on your Android phone.

---

## 🔨 Build APK (GitHub Actions)

The project uses **GitHub Actions** to build a standalone Android APK automatically on every push to `main`.

**Workflow:** [`.github/workflows/build-apk.yml`](.github/workflows/build-apk.yml)

```
Push to main
    ↓
npm install (app dependencies)
    ↓
expo prebuild --platform android (generates native Android project)
    ↓
./gradlew assembleRelease (compiles APK)
    ↓
GitHub Release published with APK download
```

To trigger a manual build:
1. Go to [Actions](https://github.com/SaifUllahUmar0317/Autochip-Finderzip/actions)
2. Select **"Build Android APK"**
3. Click **"Run workflow"**

---

## 📊 Database Schema

The app uses an **on-device SQLite** database seeded with structured chip data at first launch.

```sql
-- Chip records table (indexed for fast search)
CREATE TABLE chip_records (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  brand       TEXT,
  model       TEXT,
  part_number TEXT,
  chip_number TEXT,
  source_doc  TEXT
);

CREATE INDEX idx_part_number ON chip_records (part_number);
CREATE INDEX idx_chip_number ON chip_records (chip_number);
```

**Seed data:** ~9,600 structured records across 4 categories (Airbag, BCM, Dashboard, ECU) bundled as a JSON index at `data/seed-index.json`.

---

## 🗒️ Changelog

### v1.0.0 — Initial Release
- Complete offline chip lookup database (~9,600 records)
- Instant indexed search by Part Number and Chip Number
- PDF import and viewer
- CG100X and iProg Pro tool sections
- Animated splash screen with custom chip+lens logo
- Light and dark theme support
- GitHub Actions automated APK build

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 👨‍💻 Author

**Saif Ullah Umar**
- GitHub: [@SaifUllahUmar0317](https://github.com/SaifUllahUmar0317)

---

<p align="center">
  Made with ❤️ for automotive technicians
</p>
