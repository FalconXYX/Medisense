/**
 * Tab 3 route. The implementation is platform-split in src/components:
 *   MapScreen.native.tsx  react-native-maps with tappable price markers
 *   MapScreen.tsx         the web fallback — react-native-maps compiles to UnimplementedView there
 *
 * The split lives outside app/ deliberately: expo-router builds its routes with require.context,
 * which pulls in every matching file, so a `map.web.tsx` sibling still gets bundled on native and
 * a `map.tsx` importing react-native-maps still gets bundled on web.
 */
import { useLocalSearchParams } from 'expo-router'
import { MapScreen } from '../../../src/components/MapScreen'

export default function MapTab() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <MapScreen id={id} />
}
