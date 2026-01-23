# Client Data Portal - Theme System Implementation Documentation

> **For reuse in other projects (e.g., Contract Conduit)**
> 
> This document provides the complete, actual code from the Client Data Portal's light/dark mode theme system.

---

## Table of Contents

1. [Theme Context/Provider](#1-theme-context--provider)
2. [App.tsx Integration](#2-apptsx-integration)
3. [Tailwind Configuration](#3-tailwind-configuration)
4. [CSS Variables](#4-css-variables)
5. [Theme Toggle Component](#5-theme-toggle-component)
6. [Index.html](#6-indexhtml)
7. [Known Issues & Limitations](#7-known-issues--limitations)
8. [Enhancement Recommendations](#8-enhancement-recommendations)

---

## 1. THEME CONTEXT / PROVIDER

**File:** `client/src/contexts/ThemeContext.tsx`

```typescript
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // SSR safety check
    if (typeof window === 'undefined') return 'light';
    
    // Check localStorage first
    const saved = localStorage.getItem('cdp-theme') as Theme;
    if (saved === 'light' || saved === 'dark') return saved;
    
    // Fall back to system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    // Save to localStorage
    localStorage.setItem('cdp-theme', theme);
    
    // Apply dark class to document
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
```

### Key Implementation Details:

| Feature | Implementation |
|---------|----------------|
| Storage Key | `cdp-theme` in localStorage |
| Theme Options | `'light'` or `'dark'` only (no system mode) |
| Document Class | Adds/removes `dark` on `<html>` element |
| System Detection | Checks once on init via `prefers-color-scheme` |
| SSR Safety | Returns `'light'` if `window` undefined |

---

## 2. APP.TSX INTEGRATION

**File:** `client/src/App.tsx`

```typescript
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChatProvider } from "@/contexts/ChatContext";
import { LeadGateProvider } from "@/contexts/LeadGateContext";
import { SelectedPropertyProvider } from "@/contexts/SelectedPropertyContext";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { UserMenu } from "@/components/UserMenu";
import { AuthGuard } from "@/components/AuthGuard";
import Router from "./Router";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <ChatProvider>
            <LeadGateProvider>
              <SelectedPropertyProvider>
                <AuthGuard>
                  <SidebarProvider>
                    <div className="flex h-screen w-full">
                      <AppSidebar />
                      <div className="flex flex-col flex-1 overflow-hidden">
                        {/* Header with Theme Toggle */}
                        <header className="flex items-center justify-between p-4 border-b bg-background gap-4">
                          <SidebarTrigger />
                          <div className="flex items-center gap-4">
                            <ThemeToggle />
                            <UserMenu />
                          </div>
                        </header>
                        {/* Main Content */}
                        <main className="flex-1 overflow-auto p-6">
                          <Router />
                        </main>
                      </div>
                    </div>
                  </SidebarProvider>
                </AuthGuard>
              </SelectedPropertyProvider>
            </LeadGateProvider>
          </ChatProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

### Provider Hierarchy (Outer to Inner):

1. `QueryClientProvider` - React Query
2. **`ThemeProvider`** - Theme state (wraps everything inside QueryClient)
3. `TooltipProvider` - UI tooltips
4. `ChatProvider` - Chat functionality
5. `LeadGateProvider` - Lead gating
6. `SelectedPropertyProvider` - Property selection state
7. `AuthGuard` - Authentication
8. `SidebarProvider` - Sidebar state

**File:** `client/src/main.tsx`

```typescript
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
```

---

## 3. TAILWIND CONFIGURATION

**File:** `tailwind.config.ts`

```typescript
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],  // CRITICAL: Uses class-based dark mode
  content: [
    "./client/index.html", 
    "./client/src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // CSS variable-based colors for theme switching
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        
        sidebar: {
          DEFAULT: "hsl(var(--sidebar) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"), 
    require("@tailwindcss/typography")
  ],
} satisfies Config;
```

### Key Settings:

- **`darkMode: ["class"]`** - Required for ThemeContext to work
- **HSL with CSS variables** - Enables runtime theme switching
- **`<alpha-value>` pattern** - Allows opacity modifiers (e.g., `bg-primary/50`)

---

## 4. CSS VARIABLES

**File:** `client/src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ============================================
   LIGHT MODE - Spyglass Realty Brand Colors
   ============================================ */
:root {
  /* Elevation/Shadow helpers */
  --button-outline: rgba(0, 0, 0, 0.10);
  --elevate-1: rgba(0, 0, 0, 0.03);
  --elevate-2: rgba(0, 0, 0, 0.08);
  
  /* Core colors (HSL format for Tailwind) */
  --background: 0 0% 100%;           /* White */
  --foreground: 0 0% 12%;            /* Near black */
  
  --border: 30 10% 90%;              /* Warm gray border */
  --input: 30 10% 88%;               /* Input border */
  --ring: 25 90% 52%;                /* Focus ring - Orange */
  
  /* Card */
  --card: 0 0% 99%;
  --card-foreground: 0 0% 12%;
  
  /* Sidebar */
  --sidebar: 0 0% 100%;
  --sidebar-foreground: 0 0% 12%;
  
  /* Primary - Orange brand color */
  --primary: 25 90% 52%;
  --primary-foreground: 0 0% 100%;
  
  /* Secondary */
  --secondary: 30 15% 94%;
  --secondary-foreground: 0 0% 12%;
  
  /* Muted */
  --muted: 30 15% 95%;
  --muted-foreground: 0 0% 40%;
  
  /* Accent */
  --accent: 30 20% 96%;
  --accent-foreground: 0 0% 12%;
  
  /* Destructive */
  --destructive: 0 84% 42%;
  --destructive-foreground: 0 0% 100%;
}

/* ============================================
   DARK MODE
   ============================================ */
.dark {
  /* Elevation/Shadow helpers */
  --button-outline: rgba(255, 255, 255, 0.10);
  --elevate-1: rgba(255, 255, 255, 0.04);
  --elevate-2: rgba(255, 255, 255, 0.09);
  
  /* Core colors */
  --background: 0 0% 8%;             /* Near black */
  --foreground: 0 0% 95%;            /* Near white */
  
  --border: 0 0% 18%;                /* Dark gray border */
  --input: 0 0% 20%;                 /* Input border */
  --ring: 25 90% 55%;                /* Focus ring - Brighter orange */
  
  /* Card */
  --card: 0 0% 10%;
  --card-foreground: 0 0% 95%;
  
  /* Sidebar */
  --sidebar: 0 0% 6%;
  --sidebar-foreground: 0 0% 92%;
  
  /* Primary - Slightly brighter orange for dark mode */
  --primary: 25 90% 55%;
  --primary-foreground: 0 0% 100%;
  
  /* Secondary */
  --secondary: 0 0% 18%;
  --secondary-foreground: 0 0% 95%;
  
  /* Muted */
  --muted: 0 0% 16%;
  --muted-foreground: 0 0% 60%;
  
  /* Accent */
  --accent: 0 0% 14%;
  --accent-foreground: 0 0% 95%;
  
  /* Destructive */
  --destructive: 0 84% 45%;
  --destructive-foreground: 0 0% 95%;
}

/* ============================================
   BASE STYLES
   ============================================ */
@layer base {
  body {
    @apply font-sans antialiased bg-background text-foreground;
  }
}
```

### Color Variable Reference:

| Variable | Light Mode | Dark Mode | Usage |
|----------|------------|-----------|-------|
| `--background` | White (100%) | Near black (8%) | Page background |
| `--foreground` | Near black (12%) | Near white (95%) | Primary text |
| `--card` | Off-white (99%) | Dark gray (10%) | Card backgrounds |
| `--primary` | Orange (52% L) | Orange (55% L) | Brand color, CTAs |
| `--muted` | Light warm gray | Dark gray (16%) | Disabled states |
| `--border` | Warm gray | Dark gray (18%) | Borders, dividers |

---

## 5. THEME TOGGLE COMPONENT

**File:** `client/src/components/ThemeToggle.tsx`

```typescript
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      data-testid="button-theme-toggle"
    >
      {theme === 'light' ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5" />
      )}
    </Button>
  );
}
```

### Component Features:

- Uses shadcn/ui `Button` component with `ghost` variant
- Lucide icons (`Sun` and `Moon`)
- Accessible `title` attribute
- Test ID for automated testing
- Simple toggle behavior (no dropdown/menu)

---

## 6. INDEX.HTML

**File:** `client/index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
    <title>MLS Grid IDX - Professional Real Estate CMA Platform</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <!-- Font preloads -->
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Note:** No flash prevention script currently exists.

---

## 7. KNOWN ISSUES & LIMITATIONS

| Issue | Description | Impact |
|-------|-------------|--------|
| **No "system" mode** | Only supports `light` or `dark`, not `system` (auto-detect) | Users who prefer system preference must manually toggle |
| **Flash on initial load** | No inline script in `<head>` to prevent flash of wrong theme before React hydrates | Brief white flash visible when dark mode is set |
| **Not persisted to DB** | Theme is localStorage only - doesn't sync across devices/sessions | Users must re-set preference on each device |
| **No listener for system changes** | If user changes OS theme while app is open, it won't auto-update | App ignores real-time OS preference changes |
| **No Settings page option** | Theme toggle only in header, not discoverable in Settings | May confuse users looking for theme in Settings |

---

## 8. ENHANCEMENT RECOMMENDATIONS

### 8.1 Add Flash Prevention Script

Add to `client/index.html` in `<head>`:

```html
<script>
  (function() {
    const saved = localStorage.getItem('cdp-theme');
    if (saved === 'dark' || 
        (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  })();
</script>
```

### 8.2 Add System Mode Support

Update ThemeContext type:

```typescript
type Theme = 'light' | 'dark' | 'system';
```

Add system preference listener:

```typescript
useEffect(() => {
  if (theme !== 'system') return;
  
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => {
    document.documentElement.classList.toggle('dark', e.matches);
  };
  
  mql.addEventListener('change', handler);
  return () => mql.removeEventListener('change', handler);
}, [theme]);
```

### 8.3 Add Theme to Settings Page

Add a "Display" or "Appearance" section in Settings with radio buttons:
- Light
- Dark
- System (auto)

### 8.4 Persist Theme to Database

Add `theme` field to user preferences table:

```typescript
export const userPreferences = pgTable("user_preferences", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  theme: text("theme").default("system"), // 'light' | 'dark' | 'system'
  // ...other preferences
});
```

---

## Summary

The current theme system is functional but basic. It provides:
- Light/dark mode toggle via button in header
- localStorage persistence
- CSS variable-based theming with Tailwind
- Initial system preference detection

For Contract Conduit or other projects, consider implementing the enhancement recommendations for a more polished experience.
