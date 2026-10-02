import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AutoChipLogo } from '@/components/AutoChipLogo';
import colors from '@/constants/colors';

interface AnimatedSplashScreenProps {
  isReady: boolean;
  onAnimationComplete: () => void;
}

export function AnimatedSplashScreen({
  isReady,
  onAnimationComplete,
}: AnimatedSplashScreenProps) {
  // Animation drivers
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(8)).current;
  const progressOpacity = useRef(new Animated.Value(0)).current;
  const progressWidth = useRef(new Animated.Value(0.05)).current; // 5% to 100%
  const containerOpacity = useRef(new Animated.Value(1)).current;

  const [loadingStepText, setLoadingStepText] = useState('Initializing library...');

  useEffect(() => {
    // 1. Entrance sequence
    Animated.sequence([
      // Step A: Logo scale & fade in
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ]),
      // Step B: Text & Tagline fade in
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // Step C: Progress bar entrance
      Animated.timing(progressOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Step D: Advance realistic progress bar
      Animated.timing(progressWidth, {
        toValue: 0.45,
        duration: 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
      setLoadingStepText('Connecting local reference index...');
    });
  }, [logoOpacity, logoScale, textOpacity, textTranslateY, progressOpacity, progressWidth]);

  // When database and app become ready
  useEffect(() => {
    if (!isReady) return;

    // Advance progress to 100%
    setLoadingStepText('Ready');
    Animated.timing(progressWidth, {
      toValue: 1,
      duration: 300,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start(() => {
      // Hold 150ms then smoothly fade out splash screen to reveal home screen
      setTimeout(() => {
        Animated.timing(containerOpacity, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          onAnimationComplete();
        });
      }, 150);
    });
  }, [isReady, progressWidth, containerOpacity, onAnimationComplete]);

  const progressBarWidthInterpolation = progressWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          backgroundColor: colors.dark.background,
          opacity: containerOpacity,
        },
      ]}
    >
      <View style={styles.centerContent}>
        {/* Animated Logo */}
        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          }}
        >
          <AutoChipLogo size={96} />
        </Animated.View>

        {/* Animated Title & Tagline */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }],
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.dark.foreground }]}>
            AutoChip Finder
          </Text>
          <Text style={[styles.tagline, { color: colors.dark.mutedForeground }]}>
            Automotive Data Search
          </Text>
        </Animated.View>

        {/* Realistic Slim Progress Bar */}
        <Animated.View style={[styles.progressWrapper, { opacity: progressOpacity }]}>
          <View
            style={[
              styles.progressTrack,
              { backgroundColor: colors.dark.secondary, borderColor: colors.dark.border },
            ]}
          >
            <Animated.View
              style={[
                styles.progressBar,
                {
                  backgroundColor: colors.dark.primary,
                  width: progressBarWidthInterpolation,
                },
              ]}
            />
          </View>
          <Text style={[styles.statusText, { color: colors.dark.mutedForeground }]}>
            {loadingStepText}
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    width: '100%',
    paddingHorizontal: 32,
  },
  textContainer: {
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  tagline: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  progressWrapper: {
    width: 180,
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
