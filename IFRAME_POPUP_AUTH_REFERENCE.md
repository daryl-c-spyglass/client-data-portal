# Iframe Embedding & Popup OAuth Reference

This document contains the complete implementation for embedding an application in an iframe (like Mission Control) with popup-based Google OAuth authentication.

---

## Overview

When your app is embedded in an iframe, traditional OAuth redirects don't work because:
1. Google blocks OAuth redirects inside iframes for security
2. Cross-origin cookies require special configuration
3. CSP headers must allow iframe embedding

**Solution:** Use popup-based authentication when in iframe, standard redirect when standalone.

---

## 1. Iframe Detection (Client-Side)

Simple check that works reliably:

```typescript
// In your Login component or auth handler
const isInIframe = window.self !== window.top;
```

---

## 2. Login Component - Popup Auth Handler

Replace standard redirect auth with popup auth when in iframe:

```typescript
// Login.tsx or your auth component

import { useState } from "react";

export function Login() {
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleGoogleSignIn = () => {
    const isInIframe = window.self !== window.top;
    
    if (isInIframe) {
      // Use popup auth when embedded in iframe
      setIsSigningIn(true);
      
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        '/api/auth/google/popup',  // Special popup endpoint
        'googleAuth',
        `width=${width},height=${height},left=${left},top=${top},popup=true`
      );
      
      // Listen for auth success message from popup
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === 'AUTH_SUCCESS') {
          window.removeEventListener('message', handleMessage);
          setIsSigningIn(false);
          window.location.reload();
        }
      };
      window.addEventListener('message', handleMessage);
      
      // Check if popup was closed without auth
      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup);
          window.removeEventListener('message', handleMessage);
          setIsSigningIn(false);
        }
      }, 500);
    } else {
      // Direct redirect when not in iframe
      window.location.href = "/api/auth/google";
    }
  };

  return (
    <div>
      <button 
        onClick={handleGoogleSignIn}
        disabled={isSigningIn}
      >
        {isSigningIn ? "Signing in..." : "Sign in with Google"}
      </button>
    </div>
  );
}
```

---

## 3. Server - Popup Auth Endpoint

Add a dedicated route for popup-based OAuth:

```typescript
// server/routes.ts or auth.ts

import passport from "passport";

// Popup-specific Google auth route
app.get("/api/auth/google/popup", (req, res, next) => {
  // Mark this session as popup auth flow
  if (req.session) {
    (req.session as any).authPopup = true;
  }
  
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
    state: "popup=true",  // Pass popup flag in state
  })(req, res, next);
});

// Standard Google auth route (unchanged)
app.get("/api/auth/google", passport.authenticate("google", {
  scope: ["profile", "email"],
}));
```

---

## 4. Server - OAuth Callback with Popup Handling

Update your Google OAuth callback to detect popup flow and return postMessage HTML:

```typescript
// server/auth.ts or routes.ts

app.get("/api/auth/google/callback", 
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    // Detect if this was a popup auth flow
    const isPopup = 
      (typeof req.query.state === 'string' && req.query.state.includes('popup=true')) || 
      (req.session as any)?.authPopup;

    if (isPopup) {
      // Clear the popup flag
      if (req.session) {
        delete (req.session as any).authPopup;
      }
      
      // Return HTML that posts message to opener window and closes popup
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Authentication Complete</title></head>
          <body>
            <script>
              (function() {
                if (window.opener) {
                  window.opener.postMessage({ type: 'AUTH_SUCCESS' }, '*');
                  setTimeout(function() { window.close(); }, 100);
                } else {
                  window.location.href = '/';
                }
              })();
            </script>
            <p>Authentication successful. This window will close automatically.</p>
          </body>
        </html>
      `);
    } else {
      // Normal redirect for standard auth flow
      res.redirect('/');
    }
  }
);
```

---

## 5. Server - CSP Headers for Iframe Embedding

Add this middleware EARLY in your Express app (before other middleware):

```typescript
// server/index.ts - Add near the top, after creating app

// Allow iframe embedding from trusted domains
app.use((req, res, next) => {
  const frameAncestors = "'self' https://*.replit.dev https://*.replit.app https://*.onrender.com https://*.spyglassrealty.com";
  
  // Override res.setHeader to merge CSP if another middleware sets it
  const originalSetHeader = res.setHeader.bind(res);
  res.setHeader = function(name: string, value: any) {
    if (name.toLowerCase() === 'content-security-policy') {
      const valueStr = String(value);
      if (!valueStr.includes('frame-ancestors')) {
        value = `${valueStr}; frame-ancestors ${frameAncestors}`;
      }
    }
    return originalSetHeader(name, value);
  };
  
  // Remove X-Frame-Options if set elsewhere (conflicts with CSP frame-ancestors)
  res.removeHeader('X-Frame-Options');
  
  // Set initial frame-ancestors CSP
  originalSetHeader('Content-Security-Policy', `frame-ancestors ${frameAncestors}`);
  
  next();
});
```

---

## 6. Server - Cookie Configuration for Cross-Origin

Update session/cookie configuration to work across origins:

```typescript
// server/index.ts

import session from "express-session";
import connectPgSimple from "connect-pg-simple";

const PgSession = connectPgSimple(session);
const isProduction = process.env.NODE_ENV === "production";
const isSecure = isProduction || !!process.env.REPL_ID;

app.use(session({
  store: new PgSession({
    pool: pool,
    tableName: "sessions",
  }),
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? "none" : "lax",  // 'none' required for cross-origin iframe
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
  },
}));
```

**CRITICAL:** `sameSite: "none"` REQUIRES `secure: true`. They must be used together.

---

## 7. Auto Dark Theme When Embedded (Optional)

Apply dark theme automatically when in iframe:

```typescript
// App.tsx or main component

import { useEffect } from "react";

function App() {
  useEffect(() => {
    if (window.self !== window.top) {
      // Auto-enable dark mode when embedded
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  return (
    // ... your app
  );
}
```

---

## 8. Complete Login Component Example

```tsx
// client/src/pages/Login.tsx

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { SiGoogle } from "react-icons/si";

export default function Login() {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    // Detect if running inside an iframe
    setIsInIframe(window.self !== window.top);
  }, []);

  const handleGoogleSignIn = () => {
    if (isInIframe) {
      // Popup auth for iframe embedding
      setIsSigningIn(true);
      
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        '/api/auth/google/popup',
        'googleAuth',
        `width=${width},height=${height},left=${left},top=${top},popup=true`
      );
      
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === 'AUTH_SUCCESS') {
          window.removeEventListener('message', handleMessage);
          setIsSigningIn(false);
          window.location.reload();
        }
      };
      window.addEventListener('message', handleMessage);
      
      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup);
          window.removeEventListener('message', handleMessage);
          setIsSigningIn(false);
        }
      }, 500);
    } else {
      // Standard redirect auth
      window.location.href = "/api/auth/google";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Welcome</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleGoogleSignIn}
            disabled={isSigningIn}
            className="w-full"
            size="lg"
          >
            {isSigningIn ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <SiGoogle className="mr-2 h-4 w-4" />
                Sign in with Google
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 9. Passport.js Google Strategy Setup

```typescript
// server/auth.ts

import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

// Configure Google OAuth strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: "/api/auth/google/callback",
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) {
        return done(new Error("No email found in Google profile"));
      }
      
      // Find or create user in your database
      let user = await storage.getUserByEmail(email);
      
      if (!user) {
        // Create new user
        user = await storage.createUser({
          email,
          firstName: profile.name?.givenName,
          lastName: profile.name?.familyName,
          picture: profile.photos?.[0]?.value,
        });
      }
      
      return done(null, user);
    } catch (error) {
      return done(error as Error);
    }
  }
));

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await storage.getUser(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;
```

---

## 10. Environment Variables Required

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Session
SESSION_SECRET=your-random-session-secret

# Database
DATABASE_URL=postgresql://...
```

---

## Implementation Checklist

| Item | Description |
|------|-------------|
| Iframe detection | `window.self !== window.top` |
| Auth in iframe | Use `window.open()` popup to `/api/auth/google/popup` |
| Auth not in iframe | Normal redirect to `/api/auth/google` |
| Server popup route | Create `/api/auth/google/popup` endpoint with session flag |
| Callback handling | Return HTML with postMessage for popup flow |
| CSP headers | `frame-ancestors 'self' https://*.replit.dev https://*.replit.app https://*.onrender.com` |
| X-Frame-Options | Remove it (conflicts with CSP frame-ancestors) |
| Cookie sameSite | `"none"` when secure |
| Cookie secure | `true` in production/Replit |
| PostMessage | `{ type: 'AUTH_SUCCESS' }` from popup to opener |

---

## Testing

1. **Direct access** - Open app directly → should use redirect auth
2. **Iframe embedding** - Open in Mission Control iframe → should use popup auth
3. **Popup flow** - Popup opens, completes auth, closes, iframe reloads with session
4. **Session persistence** - Authenticated state persists across page refreshes in iframe

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Popup blocked | Ensure popup is triggered by user click, not programmatically |
| Session not persisting | Check `sameSite: "none"` and `secure: true` are both set |
| CSP error in console | Verify frame-ancestors includes the embedding domain |
| Google OAuth error in iframe | Confirm you're using popup flow, not redirect |
| Cookies not sent | Check third-party cookies are enabled in browser |
