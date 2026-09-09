/**
 * Theme context: system preference by default, with a persisted manual override.
 *
 * Screens read the palette with `useTheme()` and build their StyleSheet through a `makeStyles`
 * factory, so a theme change re-renders with new colours rather than requiring a reload.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { lightColors, darkColors, type Palette } from './theme'

export type ThemeChoice = 'system' | 'light' | 'dark'

interface ThemeValue {
  color: Palette
  scheme: 'light' | 'dark'
  choice: ThemeChoice
  setChoice: (c: ThemeChoice) => void
}

const KEY = 'medisense.theme.v1'

const Ctx = createContext<ThemeValue>({
  color: lightColors,
  scheme: 'light',
  choice: 'system',
  setChoice: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme()
  const [choice, setChoiceState] = useState<ThemeChoice>('system')

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setChoiceState(v)
      })
      .catch(() => {
        /* a missing preference just means "system" */
      })
  }, [])

  const setChoice = (c: ThemeChoice) => {
    setChoiceState(c)
    // Fire and forget, like the rest of our storage — never block the UI on a write.
    void AsyncStorage.setItem(KEY, c).catch(() => {})
  }

  const scheme: 'light' | 'dark' = choice === 'system' ? (system === 'dark' ? 'dark' : 'light') : choice

  const value = useMemo<ThemeValue>(
    () => ({ color: scheme === 'dark' ? darkColors : lightColors, scheme, choice, setChoice }),
    [scheme, choice],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme() {
  return useContext(Ctx)
}
