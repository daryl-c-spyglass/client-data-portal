import jwt, { JwtPayload } from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import type { User } from "@shared/schema";
<<<<<<< HEAD
=======
import { getUserRole } from "@shared/permissions";
>>>>>>> 5bb0ffc83975cd73d0751d6958c38a1c824f3e93
import { storage } from "./storage";

interface JWTUserPayload {
  id: string;
  email: string;
<<<<<<< HEAD
  role: string;
=======
  isAdmin: string | null;  // varchar in database, not boolean
  isSuperAdmin: boolean | null;
>>>>>>> 5bb0ffc83975cd73d0751d6958c38a1c824f3e93
  iat: number;
  exp: number;
}

<<<<<<< HEAD
=======
// Get JWT secret, with fallback for development
>>>>>>> 5bb0ffc83975cd73d0751d6958c38a1c824f3e93
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
<<<<<<< HEAD
    console.warn('Warning: Using fallback JWT secret for development. Set JWT_SECRET environment variable.');
=======
    console.warn('⚠️ Using fallback JWT secret for development. Set JWT_SECRET environment variable.');
>>>>>>> 5bb0ffc83975cd73d0751d6958c38a1c824f3e93
    return 'dev-jwt-secret-change-in-production';
  }
  return secret;
}

<<<<<<< HEAD
=======
/**
 * Generate a JWT token for a user
 */
>>>>>>> 5bb0ffc83975cd73d0751d6958c38a1c824f3e93
export function generateJWT(user: User): string {
  const payload: Omit<JWTUserPayload, 'iat' | 'exp'> = {
    id: user.id,
    email: user.email,
<<<<<<< HEAD
    role: user.role,
  };

  return jwt.sign(payload, getJWTSecret(), {
    expiresIn: '7d',
=======
    isAdmin: user.isAdmin,
    isSuperAdmin: user.isSuperAdmin,
  };

  return jwt.sign(payload, getJWTSecret(), {
    expiresIn: '7d', // 7 days to match current session expiry
>>>>>>> 5bb0ffc83975cd73d0751d6958c38a1c824f3e93
    algorithm: 'HS256',
  });
}

<<<<<<< HEAD
export function verifyJWT(token: string): JWTUserPayload | null {
  try {
    const decoded = jwt.verify(token, getJWTSecret(), { algorithms: ['HS256'] }) as JwtPayload;

    if (typeof decoded === 'object' && decoded.id && decoded.email) {
      return decoded as JWTUserPayload;
    }

=======
/**
 * Verify and decode a JWT token
 */
export function verifyJWT(token: string): JWTUserPayload | null {
  try {
    const decoded = jwt.verify(token, getJWTSecret(), { algorithms: ['HS256'] }) as JwtPayload;
    
    // Ensure the token has the expected structure
    if (typeof decoded === 'object' && decoded.id && decoded.email) {
      return decoded as JWTUserPayload;
    }
    
>>>>>>> 5bb0ffc83975cd73d0751d6958c38a1c824f3e93
    console.warn('[JWT] Token has invalid structure');
    return null;
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error) {
      if (error.name === 'TokenExpiredError') {
        console.log('[JWT] Token expired');
      } else if (error.name === 'JsonWebTokenError') {
        console.log('[JWT] Token invalid:', (error as any).message);
<<<<<<< HEAD
      }
=======
      } else {
        console.error('[JWT] Token verification error:', error);
      }
    } else {
      console.error('[JWT] Token verification error:', error);
>>>>>>> 5bb0ffc83975cd73d0751d6958c38a1c824f3e93
    }
    return null;
  }
}

<<<<<<< HEAD
function extractTokenFromRequest(req: Request): string | null {
=======
/**
 * Extract JWT token from request (cookie or Authorization header)
 */
function extractTokenFromRequest(req: Request): string | null {
  // Try cookie first (primary method)
>>>>>>> 5bb0ffc83975cd73d0751d6958c38a1c824f3e93
  const cookieToken = req.cookies?.['auth-token'];
  if (cookieToken) {
    return cookieToken;
  }

<<<<<<< HEAD
=======
  // Fallback to Authorization header
>>>>>>> 5bb0ffc83975cd73d0751d6958c38a1c824f3e93
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

<<<<<<< HEAD
export function setJWTCookie(res: Response, token: string): void {
  const isProduction = process.env.NODE_ENV === 'production';

=======
/**
 * Set secure JWT cookie
 */
export function setJWTCookie(res: Response, token: string): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
>>>>>>> 5bb0ffc83975cd73d0751d6958c38a1c824f3e93
  res.cookie('auth-token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
<<<<<<< HEAD
    maxAge: 1000 * 60 * 60 * 24 * 7,
=======
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
>>>>>>> 5bb0ffc83975cd73d0751d6958c38a1c824f3e93
    path: '/',
  });
}

<<<<<<< HEAD
=======
/**
 * Clear JWT cookie
 */
>>>>>>> 5bb0ffc83975cd73d0751d6958c38a1c824f3e93
export function clearJWTCookie(res: Response): void {
  res.clearCookie('auth-token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });
}

<<<<<<< HEAD
export async function jwtAuthMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractTokenFromRequest(req);

  if (token) {
    const payload = verifyJWT(token);
    if (payload) {
      try {
        const user = await storage.getUser(payload.id);
        if (user) {
          const { passwordHash, ...safeUser } = user;
          (req as any).user = safeUser;
          (req as any).isAuthenticated = () => true;
        }
      } catch (error) {
        console.warn('[JWT] Error fetching user from token:', error);
      }
    }
  }

  if (!(req as any).isAuthenticated) {
    (req as any).isAuthenticated = () => false;
  }

  next();
}

export function requireJWTAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractTokenFromRequest(req);

=======
/**
 * JWT Authentication middleware - replaces session-based requireAuth
 */
export function requireJWTAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractTokenFromRequest(req);
  
>>>>>>> 5bb0ffc83975cd73d0751d6958c38a1c824f3e93
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const payload = verifyJWT(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

<<<<<<< HEAD
  if ((req as any).user) {
    next();
    return;
  }

  storage.getUser(payload.id).then(user => {
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    const { passwordHash, ...safeUser } = user;
    (req as any).user = safeUser;
    (req as any).isAuthenticated = () => true;
    next();
  }).catch(err => {
    console.error('[JWT] Error in requireJWTAuth:', err);
    res.status(500).json({ error: "Authentication error" });
  });
}
=======
  // Attach user info to request - similar to how passport does it
  (req as any).user = {
    id: payload.id,
    email: payload.email,
    isAdmin: payload.isAdmin,
    isSuperAdmin: payload.isSuperAdmin,
  };

  // Mark as authenticated for compatibility with existing code
  (req as any).isAuthenticated = () => true;

  next();
}

/**
 * Enhanced JWT auth middleware that validates user is still active in database
 * Use this for sensitive operations
 */
export function requireJWTAuthWithDBCheck(req: Request, res: Response, next: NextFunction): void {
  const token = extractTokenFromRequest(req);
  
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const payload = verifyJWT(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  // Validate user still exists and is active in database
  storage.getUser(payload.id)
    .then(user => {
      if (!user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      if (user.isActive === false) {
        res.status(403).json({ error: "Account is disabled. Please contact an administrator." });
        return;
      }

      // Attach full user object to request
      (req as any).user = user;
      (req as any).isAuthenticated = () => true;

      next();
    })
    .catch(error => {
      console.error('[JWT] Database check failed:', error);
      res.status(500).json({ error: "Authentication validation failed" });
    });
}

/**
 * Optional JWT auth middleware - doesn't require authentication but adds user if available
 * Useful for endpoints that have different behavior for authenticated vs anonymous users
 */
export function optionalJWTAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractTokenFromRequest(req);
  
  if (!token) {
    (req as any).user = null;
    (req as any).isAuthenticated = () => false;
    return next();
  }

  const payload = verifyJWT(token);
  if (!payload) {
    (req as any).user = null;
    (req as any).isAuthenticated = () => false;
    return next();
  }

  (req as any).user = {
    id: payload.id,
    email: payload.email,
    isAdmin: payload.isAdmin,
    isSuperAdmin: payload.isSuperAdmin,
  };
  (req as any).isAuthenticated = () => true;

  next();
}
>>>>>>> 5bb0ffc83975cd73d0751d6958c38a1c824f3e93
