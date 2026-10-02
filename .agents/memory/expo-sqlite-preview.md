---
name: Expo SQLite browser preview
description: Replit's proxied Expo browser preview does not initialize this app's Expo SQLite web worker.
---

In the Replit-proxied Expo browser preview, the Expo SQLite worker request falls through to the app HTML, so `openDatabaseAsync` never completes. This is not evidence that native Android SQLite is failing.

**Why:** The browser preview runs Expo's web implementation and worker, while Expo Go on Android uses the native SQLite module.

**How to apply:** Verify SQLite-backed flows in Expo Go or the Android emulator. If the web preview cannot start the worker, show a clear mobile-preview message rather than leaving an indefinite loading screen.