import { ScrollView, ScrollViewProps } from 'react-native';

export type KeyboardAwareScrollViewCompatProps = ScrollViewProps;

export function KeyboardAwareScrollViewCompat({
  children,
  keyboardShouldPersistTaps = 'handled',
  ...props
}: KeyboardAwareScrollViewCompatProps) {
  return (
    <ScrollView
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

