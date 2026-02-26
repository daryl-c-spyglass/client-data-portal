import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import type { User } from "@shared/schema";
import type { Request, Response, NextFunction } from "express";
import { 
  UserRole, 
  Permission, 
  hasPermission, 
  isAtLeast, 
  normalizeRole,
  getUserRole,
  isSuperAdminEmail,
  determineUserRole 
} from "@shared/permissions";
import { generateJWT, setJWTCookie, clearJWTCookie, requireJWTAuth } from "./jwt";

const ALLOWED_EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || "spyglassrealty.com";
const ALLOWED_EMAILS = process.env.ALLOWED_EMAILS?.split(",").map(e => e.trim().toLowerCase()) || [];

export function isSpyglassAuthorized(email: string, hostedDomain?: string): boolean {
  const emailLower = email.toLowerCase();
  
  if (ALLOWED_EMAILS.length > 0 && ALLOWED_EMAILS.includes(emailLower)) {
    return true;
  }
  
  if (emailLower.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
    return true;
  }
  
  if (hostedDomain && hostedDomain === ALLOWED_EMAIL_DOMAIN) {
    return true;
  }
  
  return false;
}

export function setupAuth() {
  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) {
            return done(null, false, { message: "Incorrect email or password" });
          }

          if (!user.passwordHash) {
            return done(null, false, { message: "Please use Google Sign-In" });
          }

          const isValid = await bcrypt.compare(password, user.passwordHash);
          if (!isValid) {
            return done(null, false, { message: "Incorrect email or password" });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (googleClientId && googleClientSecret) {
    const callbackURL = process.env.GOOGLE_CALLBACK_URL || 
      process.env.GOOGLE_REDIRECT_URI || 
      (process.env.APP_URL
        ? `${process.env.APP_URL}/auth/google/callback`
        : "http://localhost:5000/auth/google/callback");
    
    console.log(`🔐 Google OAuth configured with callback: ${callbackURL}`);
    
    passport.use(
      new GoogleStrategy(
        {
          clientID: googleClientId,
          clientSecret: googleClientSecret,
          callbackURL,
          scope: ["email", "profile"],
        },
        async (accessToken, refreshToken, profile: Profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(null, false, { message: "No email found in Google profile" });
            }

            const hostedDomain = (profile as any)._json?.hd;
            
            if (!isSpyglassAuthorized(email, hostedDomain)) {
              console.log(`🚫 Access denied for: ${email} (domain: ${hostedDomain || 'none'})`);
              return done(null, false, { message: "Access not allowed. Spyglass team only." });
            }

            console.log(`✅ Access granted for: ${email}`);

            let user = await storage.getUserByEmail(email);
            
            if (!user) {
              const isSuperAdmin = isSuperAdminEmail(email);
              user = await storage.createUser({
                email,
                firstName: profile.name?.givenName || null,
                lastName: profile.name?.familyName || null,
                googleId: profile.id,
                picture: profile.photos?.[0]?.value || null,
                isAdmin: null,
                isSuperAdmin: isSuperAdmin,
                passwordHash: null,
              });
              const assignedRole = isSuperAdmin ? "super_admin" : "agent";
              console.log(`👤 Created new user: ${email} with role: ${assignedRole}`);
            } else {
              user = await storage.updateUser(user.id, {
                googleId: profile.id,
                picture: profile.photos?.[0]?.value || user.picture,
                firstName: user.firstName || profile.name?.givenName || null,
                lastName: user.lastName || profile.name?.familyName || null,
                lastLoginAt: new Date(),
              });
              console.log(`👤 Updated existing user: ${email}`);
            }

            const token = generateJWT(user);
            return done(null, { user, token });
          } catch (error) {
            console.error("Google OAuth error:", error);
            return done(error as Error);
          }
        }
      )
    );
  } else {
    console.log("Warning: Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
  }

  // JWT-based auth - serialize/deserialize still needed for passport OAuth flow
  passport.serializeUser((authResult: Express.User, done) => {
    const result = authResult as any;
    done(null, JSON.stringify({ id: result.user?.id || result.id, token: result.token }));
  });

  passport.deserializeUser(async (serialized: string, done) => {
    try {
      let userId: number;
      let token: string | undefined;

      if (typeof serialized === 'number') {
        userId = serialized;
      } else if (typeof serialized === 'string') {
        try {
          const data = JSON.parse(serialized);
          userId = data.id;
          token = data.token;
        } catch {
          userId = parseInt(serialized, 10);
          if (isNaN(userId)) {
            return done(null, false);
          }
        }
      } else {
        return done(null, false);
      }

      const user = await storage.getUser(userId);
      if (user) {
        const { passwordHash, ...safeUser } = user;
        done(null, token ? { ...safeUser, _token: token } : safeUser);
      } else {
        done(null, false);
      }
    } catch (error) {
      done(error);
    }
  });
}

// Legacy function - redirects to JWT-based auth
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  console.warn('[Auth] DEPRECATED: requireAuth() is deprecated. Use requireJWTAuth() instead.');
  return requireJWTAuth(req, res, next);
}

/**
 * @deprecated Use requireMinimumRole() or requirePermission() instead.
 * This function is kept for backwards compatibility but should not be used.
 */
export function requireRole(roles: string[]) {
  console.warn('[Auth] DEPRECATED: requireRole() is deprecated. Use requireMinimumRole() or requirePermission() instead.');
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const user = req.user as User;
    const userRole = normalizeRole({ 
      isAdmin: user.isAdmin || undefined, 
      isSuperAdmin: user.isSuperAdmin || undefined 
    });
    if (!roles.includes(userRole)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
}

export function requireMinimumRole(minimumRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const user = req.user as User;
    const userRole = normalizeRole({ 
      isAdmin: user.isAdmin || undefined, 
      isSuperAdmin: user.isSuperAdmin || undefined 
    });

    if (!isAtLeast(userRole, minimumRole)) {
      console.log('[Auth] Access denied:', { 
        userId: user.id, 
        userRole, 
        requiredRole: minimumRole 
      });
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const user = req.user as User;
    const userRole = normalizeRole({ 
      isAdmin: user.isAdmin || undefined, 
      isSuperAdmin: user.isSuperAdmin || undefined 
    });

    if (!hasPermission(userRole, permission)) {
      console.log('[Auth] Permission denied:', { 
        userId: user.id, 
        userRole, 
        requiredPermission: permission 
      });
      return res.status(403).json({ error: "Permission denied" });
    }

    next();
  };
}

function sanitizeRedirectUrl(url: string | undefined): string {
  if (!url) return "/";
  
  // Only allow relative paths starting with /
  if (!url.startsWith("/")) return "/";
  
  // Prevent protocol-relative URLs (//evil.com)
  if (url.startsWith("//")) return "/";
  
  // Block any URL with : before the first / (prevents javascript:, data:, etc.)
  const colonIndex = url.indexOf(":");
  const slashIndex = url.indexOf("/", 1);
  if (colonIndex !== -1 && (slashIndex === -1 || colonIndex < slashIndex)) {
    return "/";
  }
  
  return url;
}

export function setupAuthRoutes(app: any) {
  // Standard OAuth flow (redirect-based) for direct access
  app.get("/auth/google", (req: Request, res: Response, next: NextFunction) => {
    const nextUrl = sanitizeRedirectUrl(req.query.next as string);
    // Store return URL in a temporary cookie instead of session
    res.cookie('auth-return-to', nextUrl, { 
      httpOnly: true, 
      maxAge: 10 * 60 * 1000, // 10 minutes
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });
    res.cookie('auth-is-popup', 'false', { 
      httpOnly: true, 
      maxAge: 10 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });
    next();
  }, passport.authenticate("google", { 
    scope: ["email", "profile"],
    prompt: "select_account"
  }));

  // Popup OAuth flow for iframe embedding
  // When app is embedded in iframe (e.g., Mission Control), Google blocks redirects
  // This route opens in a popup window instead
  app.get("/auth/google/popup", (req: Request, res: Response, next: NextFunction) => {
    res.cookie('auth-is-popup', 'true', { 
      httpOnly: true, 
      maxAge: 10 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });
    res.clearCookie('auth-return-to');
    next();
  }, passport.authenticate("google", { 
    scope: ["email", "profile"],
    prompt: "select_account",
    failureRedirect: "/auth/google/popup/error?error=access_denied"
  }));

  // Custom callback handler that supports both popup and redirect auth flows
  app.get("/auth/google/callback", (req: Request, res: Response, next: NextFunction) => {
    const isPopupAuth = req.cookies?.['auth-is-popup'] === 'true';
    
    passport.authenticate("google", (err: Error | null, authResult: any, info: any) => {
      // Clean up session flags
      delete (req.session as any)?.isPopupAuth;
      
      const user = authResult?.user || authResult;
      const token = authResult?.token;

      // Handle authentication failure
      if (err || !user) {
        const errorMessage = info?.message || "access_denied";
        
        if (isPopupAuth) {
          // For popup: send error message to parent window and close
          return res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Authentication Failed</title></head>
            <body>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'AUTH_FAILURE', error: '${errorMessage.replace(/'/g, "\\'")}' }, window.location.origin);
                  setTimeout(function() { window.close(); }, 300);
                } else {
                  window.location.href = '/login?error=access_denied';
                }
              </script>
              <p>Authentication failed. This window should close automatically.</p>
            </body>
            </html>
          `);
        } else {
          // Standard redirect flow
          res.clearCookie('auth-return-to');
          return res.redirect("/login?error=access_denied");
        }
      }
      
      // Log in the user and set JWT cookie
      req.logIn(authResult, (loginErr) => {
        if (loginErr) {
          if (isPopupAuth) {
            return res.send(`
              <!DOCTYPE html>
              <html>
              <head><title>Login Failed</title></head>
              <body>
                <script>
                  if (window.opener) {
                    window.opener.postMessage({ type: 'AUTH_FAILURE', error: 'Login failed' }, window.location.origin);
                    setTimeout(function() { window.close(); }, 300);
                  } else {
                    window.location.href = '/login?error=login_failed';
                  }
                </script>
                <p>Login failed. This window should close automatically.</p>
              </body>
              </html>
            `);
          }
          return res.redirect("/login?error=login_failed");
        }

        try {
          if (token) {
            setJWTCookie(res, token);
          }
          
          if (isPopupAuth) {
            // For popup auth: send postMessage to parent window and close
            return res.send(`
              <!DOCTYPE html>
              <html>
              <head><title>Authentication Successful</title></head>
              <body>
                <script>
                  if (window.opener) {
                    window.opener.postMessage({ type: 'AUTH_SUCCESS' }, window.location.origin);
                    setTimeout(function() { window.close(); }, 300);
                  } else {
                    window.location.href = '/';
                  }
                </script>
                <p>Authentication successful! This window should close automatically.</p>
                <p>If it doesn't, <a href="/" onclick="window.close(); return false;">click here</a>.</p>
              </body>
              </html>
            `);
          } else {
            // Standard redirect flow
            const redirectTo = req.cookies?.['auth-return-to'] || "/";
            res.clearCookie('auth-return-to');
            return res.redirect(redirectTo);
          }
        } catch (jwtError) {
        console.error('[Auth] JWT generation failed:', jwtError);
        const errorMsg = 'Login failed';
        
        if (isPopupAuth) {
          return res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Login Failed</title></head>
            <body>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'AUTH_FAILURE', error: '${errorMsg}' }, '*');
                  window.close();
                } else {
                  window.location.href = '/login?error=login_failed';
                }
              </script>
              <p>Login failed. This window should close automatically.</p>
            </body>
            </html>
          `);
        }
        res.clearCookie('auth-return-to');
        return res.redirect("/login?error=login_failed");
        }
      });
    })(req, res, next);
  });

  // Popup auth error handler
  app.get("/auth/google/popup/error", (req: Request, res: Response) => {
    const error = req.query.error || "access_denied";
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Authentication Failed</title></head>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'AUTH_FAILURE', error: '${error}' }, window.location.origin);
            setTimeout(function() { window.close(); }, 300);
          } else {
            window.location.href = '/login?error=${error}';
          }
        </script>
        <p>Authentication failed. This window should close automatically.</p>
      </body>
      </html>
    `);
  });

  app.post("/auth/logout", (req: Request, res: Response) => {
    clearJWTCookie(res);
    req.logout((err) => {
      if (err) {
        console.warn('[Auth] Logout error:', err);
      }
      if (req.session) {
        req.session.destroy((err) => {
          if (err) {
            console.warn('[Auth] Session destroy error:', err);
          }
        });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", requireJWTAuth, (req: Request, res: Response) => {
    const user = req.user as User;
    const { passwordHash, ...safeUser } = user;
    const role = determineUserRole(safeUser);
    res.json({ ...safeUser, role });
  });
}
