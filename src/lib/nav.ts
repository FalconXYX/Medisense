/**
 * Navigation helpers.
 *
 * The design has no back button: the search control is the only route home. That means it MUST
 * work from a cold start. `router.dismissAll()` throws POP_TO_TOP_UNHANDLED when there is nothing
 * on the stack to dismiss — which is exactly the case after a deep link or a reload — and because
 * the call sites were bare, every navigation control in the app was dead on a cold load, including
 * the "Search for something else" escape on the red-flag hard-stop screen.
 */
import type { Router } from 'expo-router'

export function goHome(router: Router): void {
  try {
    router.dismissAll()
  } catch {
    // Nothing to dismiss — this is a cold load, so go home directly.
    router.replace('/')
  }
  // dismissAll() can also succeed while leaving us somewhere other than the root.
  try {
    if (router.canGoBack?.()) router.replace('/')
  } catch {
    /* best effort */
  }
}
