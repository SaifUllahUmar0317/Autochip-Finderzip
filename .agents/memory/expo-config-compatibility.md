---
name: Expo configuration compatibility
description: Expo SDK 57 no longer accepts the legacy top-level splash configuration.
---

For Expo SDK 57, configure splash assets through the expo-splash-screen plugin rather than the legacy top-level splash property.

**Why:** The imported configuration could start Metro, but Expo Doctor rejected the legacy field. A running server alone does not prove the configuration is valid for native builds.

**How to apply:** When importing or changing Expo configuration, run both Expo's dependency check and Expo Doctor before declaring setup complete.