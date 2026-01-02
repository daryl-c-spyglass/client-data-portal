import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import type { User } from "@shared/schema";
import type { Request, Response, NextFunction } from "express";

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
    const callbackURL = process.env.GOOGLE_REDIRECT_URI || 
      (process.env.REPLIT_DOMAINS 
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}/auth/google/callback`
        : process.env.REPLIT_DEV_DOMAIN
          ? `https://${process.env.REPLIT_DEV_DOMAIN}/auth/google/callback`
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
              user = await storage.createUser({
                email,
                firstName: profile.name?.givenName || null,
                lastName: profile.name?.familyName || null,
                googleId: profile.id,
                picture: profile.photos?.[0]?.value || null,
                role: "agent",
                passwordHash: null,
              });
              console.log(`👤 Created new user: ${email}`);
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

            return done(null, user);
          } catch (error) {
            console.error("Google OAuth error:", error);
            return done(error as Error);
          }
        }
      )
    );
  } else {
    console.log("⚠️ Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
  }

  passport.serializeUser((user: Express.User, done) => {
    done(null, (user as User).id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (user) {
        const { passwordHash, ...safeUser } = user;
        done(null, safeUser);
      } else {
        done(null, false);
      }
    } catch (error) {
      done(error);
    }
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const user = req.user as User;
    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
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
  app.get("/auth/google", (req: Request, res: Response, next: NextFunction) => {
    const nextUrl = sanitizeRedirectUrl(req.query.next as string);
    (req.session as any).returnTo = nextUrl;
    next();
  }, passport.authenticate("google", { 
    scope: ["email", "profile"],
    prompt: "select_account"
  }));

  app.get("/auth/google/callback", 
    passport.authenticate("google", { 
      failureRedirect: "/login?error=access_denied"
    }),
    (req: Request, res: Response) => {
      const redirectTo = (req.session as any)?.returnTo || "/";
      delete (req.session as any)?.returnTo;
      res.redirect(redirectTo);
    }
  );

  app.post("/auth/logout", (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ error: "Session destruction failed" });
        }
        res.clearCookie("connect.sid");
        res.json({ success: true });
      });
    });
  });

  app.get("/api/auth/me", (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const user = req.user as User;
    const { passwordHash, ...safeUser } = user;
    res.json(safeUser);
  });
}
