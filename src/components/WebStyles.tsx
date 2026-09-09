/**
 * Web-only affordances that React Native has no concept of.
 *
 * On a phone, "what is tappable" is answered by press feedback. On a desktop it is answered by the
 * cursor, a hover state and — for keyboard users — a visible focus ring. React Native Web renders
 * everything as divs with no focus outline by default, so a keyboard user had no idea where they
 * were. This injects the missing behaviour once, at the root.
 *
 * It also does the typographic work RNW does not: RNW's default font stack ends at Helvetica, so
 * on any machine without a better match the whole interface renders in a face designed in 1957 for
 * signage, at UI sizes, with no optical sizing. The stack below prefers each platform's actual UI
 * face and turns on the OpenType features that make small text legible — which is a large part of
 * why the first build looked unfinished even where the layout was correct.
 *
 * Native renders nothing: the component returns null off web.
 */
import { Platform } from 'react-native'
import { useEffect } from 'react'
import { useTheme } from '../theme-context'

const ID = 'medisense-web-styles'

/**
 * The system UI stack. `-apple-system` gets SF on Apple platforms, `Segoe UI Variable` gets the
 * current Windows face rather than the 2012 one, `Inter` catches Linux installs that have it, and
 * `system-ui` catches everything else before the generic fallback.
 */
const UI_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", ' +
  'Inter, Roboto, system-ui, "Helvetica Neue", Arial, sans-serif'

export function WebStyles() {
  const { color, scheme } = useTheme()

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return
    let el = document.getElementById(ID) as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = ID
      document.head.appendChild(el)
    }
    el.textContent = `
      /* The page ground behind the app, so overscroll does not flash white in dark mode. */
      html, body { background: ${color.bg}; }
      body { color-scheme: ${scheme}; }

      /*
       * Typography. RNW stamps its own font stack onto every Text node, so this has to reach them
       * by selector rather than by cascade — hence the explicit list of the elements it renders.
       */
      html, body, #root, div, span, p, input, textarea, button, a {
        font-family: ${UI_FONT};
      }
      body {
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
        /* Contextual alternates and kerning on; lining figures so prices align in a column. */
        font-feature-settings: "kern" 1, "liga" 1, "calt" 1, "lnum" 1;
      }
      /* The icon font must NOT inherit the stack above or every glyph renders as a tofu box. */
      [class*="material"], [class*="ionicon"],
      span[style*="Ionicons"], span[style*="MaterialCommunityIcons"] { font-family: inherit; }

      /* Anything interactive gets a pointer. RNW leaves the default arrow on div-based buttons. */
      [role="button"], [role="tab"], [role="link"], [role="radio"],
      [role="checkbox"], a, button, input[type="submit"] { cursor: pointer; }
      [role="button"] *, [role="tab"] *, [role="link"] * { cursor: inherit; }

      /* Keyboard focus must be visible — WCAG 2.4.7. Only for keyboard, not mouse clicks. */
      :focus { outline: none; }
      :focus-visible {
        outline: 2px solid ${color.focus};
        outline-offset: 2px;
        border-radius: 8px;
      }

      /*
       * Hover. The old rule was a blanket brightness() filter on every [role=button], which
       * dimmed the *whole subtree* — including any icon or badge inside it — and did nothing at
       * all to an element that was already white. A background wash on the container reads as a
       * hover state without touching what is inside it.
       */
      @media (hover: hover) {
        [role="button"]:hover, [role="tab"]:hover, [role="radio"]:hover,
        [role="checkbox"]:hover, [role="link"]:hover {
          transition: background-color 120ms ease, border-color 120ms ease, transform 120ms ease;
        }
        [role="button"]:active, [role="tab"]:active { transform: translateY(0.5px); }
      }

      /* Text inputs inherit nothing useful from RNW. */
      input, textarea { caret-color: ${color.ink}; }
      input::placeholder, textarea::placeholder { opacity: 1; }
      ::selection { background: ${color.accent}; color: #fff; }

      /* A scrollbar that belongs to the palette rather than to the browser's default chrome. */
      * { scrollbar-color: ${color.lineMid} transparent; }
      ::-webkit-scrollbar { width: 12px; height: 12px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb {
        background: ${color.lineMid}; border-radius: 8px;
        border: 3px solid ${color.bg}; background-clip: padding-box;
      }
      ::-webkit-scrollbar-thumb:hover { background: ${color.inkTertiary}; background-clip: padding-box; }

      /*
       * Leaflet's own chrome ships hard-coded white. Left alone, the zoom buttons and the ODbL
       * attribution stayed two bright rectangles on an inverted dark map — and the attribution is
       * the one element on that screen we are licence-bound to keep readable, so it cannot just be
       * hidden. These follow the palette instead.
       */
      .leaflet-bar { border: none; box-shadow: 0 1px 4px rgba(0,0,0,0.28); }
      .leaflet-bar a,
      .leaflet-bar a:hover {
        background: ${color.surface};
        color: ${color.ink};
        border-bottom-color: ${color.line};
      }
      .leaflet-bar a:hover { background: ${color.surfaceAlt}; }
      .leaflet-control-attribution {
        background: ${color.surface} !important;
        color: ${color.inkTertiary};
        font-family: ${UI_FONT};
        font-size: 10px;
      }
      .leaflet-control-attribution a { color: ${color.inkSecondary}; }

      /* Respect a reduced-motion preference for the accordion and screen transitions. */
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          transition-duration: 0.01ms !important;
          scroll-behavior: auto !important;
        }
      }
    `
  }, [color, scheme])

  return null
}
