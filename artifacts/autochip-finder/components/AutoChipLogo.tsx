import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect, Circle, Line, Path, G } from 'react-native-svg';

interface AutoChipLogoProps {
  size?: number;
}

export function AutoChipLogo({ size = 88 }: AutoChipLogoProps) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
        {/* Top Pins (5 pins) */}
        <G stroke="#91b9ae" strokeWidth="2.5" strokeLinecap="round">
          <Line x1="42" y1="21" x2="42" y2="28" />
          <Line x1="51" y1="21" x2="51" y2="28" />
          <Line x1="60" y1="21" x2="60" y2="28" />
          <Line x1="69" y1="21" x2="69" y2="28" />
          <Line x1="78" y1="21" x2="78" y2="28" />
        </G>

        {/* Bottom Pins (5 pins) */}
        <G stroke="#91b9ae" strokeWidth="2.5" strokeLinecap="round">
          <Line x1="42" y1="92" x2="42" y2="99" />
          <Line x1="51" y1="92" x2="51" y2="99" />
          <Line x1="60" y1="92" x2="60" y2="99" />
          <Line x1="69" y1="92" x2="69" y2="99" />
          <Line x1="78" y1="92" x2="78" y2="99" />
        </G>

        {/* Left Pins (5 pins) */}
        <G stroke="#91b9ae" strokeWidth="2.5" strokeLinecap="round">
          <Line x1="21" y1="42" x2="28" y2="42" />
          <Line x1="21" y1="51" x2="28" y2="51" />
          <Line x1="21" y1="60" x2="28" y2="60" />
          <Line x1="21" y1="69" x2="28" y2="69" />
          <Line x1="21" y1="78" x2="28" y2="78" />
        </G>

        {/* Right Pins (5 pins) */}
        <G stroke="#91b9ae" strokeWidth="2.5" strokeLinecap="round">
          <Line x1="92" y1="42" x2="99" y2="42" />
          <Line x1="92" y1="51" x2="99" y2="51" />
          <Line x1="92" y1="60" x2="99" y2="60" />
          <Line x1="92" y1="69" x2="99" y2="69" />
          <Line x1="92" y1="78" x2="99" y2="78" />
        </G>

        {/* Main Microchip Body */}
        <Rect
          x="28"
          y="28"
          width="64"
          height="64"
          rx="12"
          ry="12"
          fill="#242a28"
          stroke="#39413d"
          strokeWidth="2"
        />

        {/* Pin 1 Index Dot */}
        <Circle cx="37" cy="37" r="2.5" fill="#91b9ae" />

        {/* Magnifying Glass Handle */}
        <Line
          x1="69"
          y1="67"
          x2="82"
          y2="80"
          stroke="#91b9ae"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* Magnifying Glass Outer Lens */}
        <Circle
          cx="57"
          cy="55"
          r="16"
          fill="#1b201f"
          stroke="#ffffff"
          strokeWidth="3.2"
        />

        {/* Central Automotive Chip Die inside Lens */}
        <Rect
          x="50"
          y="49"
          width="14"
          height="12"
          rx="2"
          fill="#376a66"
        />

        {/* Precision ECG / Automotive Pulse Wave */}
        <Path
          d="M51 55 L53.5 55 L55 51.5 L57.5 58.5 L59 55 L63 55"
          stroke="#91b9ae"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
