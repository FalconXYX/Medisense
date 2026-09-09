/**
 * Root layout.
 *
 * headerShown:false on the Stack is what removes the navigation chrome AND the back button — the
 * design's explicit choice after testing showed a nav bar made things worse. The search field is
 * the way home (see SearchHeader).
 *
 * The catalogue is a bundled JSON index inlined by Metro (see src/lib/dataset.ts), so there is no
 * async boot, no Suspense boundary and no loading state — every screen queries synchronously.
 */
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ThemeProvider, useTheme } from '../src/theme-context'
import { FilterProvider } from '../src/lib/filters-context'
import { WebStyles } from '../src/components/WebStyles'

export default function RootLayout() {
  return (
    <ThemeProvider>
      <FilterProvider>
        <Shell />
      </FilterProvider>
    </ThemeProvider>
  )
}

function Shell() {
  const { color, scheme } = useTheme()
  return (
    <SafeAreaProvider>
      <WebStyles />
      {/* Follows the palette, so the clock and battery stay legible in both themes. */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: color.bg },
          animation: 'fade',
        }}
      >
        <Stack.Screen
          name="scan"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
      </Stack>
    </SafeAreaProvider>
  )
}
