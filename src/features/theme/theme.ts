import { useCallback, useSyncExternalStore } from "react"

// Must match the pre-hydration script in app/layout.tsx.
const THEME_STORAGE_KEY = "git-review-dark"

// The .dark class on <html> is the source of truth for the theme. It is
// applied pre-hydration by the inline script in layout.tsx (localStorage,
// falling back to prefers-color-scheme). Reading it via useSyncExternalStore
// keeps state in sync with the DOM without a post-mount setState and without
// hydration mismatches.
function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  return () => observer.disconnect()
}

function isThemeDark() {
  return document.documentElement.classList.contains("dark")
}

function isThemeDarkServer() {
  return false
}

export function useTheme() {
  const isDark = useSyncExternalStore(subscribeToTheme, isThemeDark, isThemeDarkServer)
  const toggleTheme = useCallback(() => {
    const next = !isThemeDark()
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem(THEME_STORAGE_KEY, String(next))
  }, [])
  return { isDark, toggleTheme }
}
