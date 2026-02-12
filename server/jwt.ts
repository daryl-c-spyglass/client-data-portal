import jwt, { JwtPayload } from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import type { User } from "@shared/schema";
import { getUserRole } from "@shared/permissions";
import { storage } from "./storage";

interface JWTUserPayload {
  id: string;
  email: string;
  isAdmin: string | null;  // varchar in database, not boolean
  isSuperAdmin: boolean | null;
  iat: number;
  exp: number;
}

// Get JWT secret, with fallback for development
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    console.warn('⚠️ Using fallback JWT secret for development. Set JWT_SECRET environment variable.');
    return 'dev-jwt-secret-change-in-production';
  }
  return secret;
}

/**
 * Generate a JWT token for a user
 */
export function generateJWT(user: User): string {
  const payload: Omit<JWTUserPayload, 'iat' | 'exp'> = {
    id: user.id,
    email: user.email,
    isAdmin: user.isAdmin,
    isSuperAdmin: user.isSuperAdmin,
  };

  return jwt.sign(payload, getJWTSecret(), {
    expiresIn: '7d', // 7 days to match current session expiry
    algorithm: 'HS256',
  });
}

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
    
    console.warn('[JWT] Token has invalid structure');
    return null;
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error) {
      if (error.name === 'TokenExpiredError') {
        console.log('[JWT] Token expired');
      } else if (error.name === 'JsonWebTokenError') {
        console.log('[JWT] Token invalid:', (error as any).message);
      } else {
        console.error('[JWT] Token verification error:', error);
      }
    } else {
      console.error('[JWT] Token verification error:', error);
    }
    return null;
  }
}

/**
 * Extract JWT token from request (cookie or Authorization header)
 */
function extractTokenFromRequest(req: Request): string | null {
  // Try cookie first (primary method)
  const cookieToken = req.cookies?.['auth-token'];
  if (cookieToken) {
    return cookieToken;
  }

  // Fallback to Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Set secure JWT cookie
 */
export function setJWTCookie(res: Response, token: string): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.cookie('auth-token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

/**
 * Clear JWT cookie
 */
export function clearJWTCookie(res: Response): void {
  res.clearCookie('auth-token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });
}

/**
 * JWT Authentication middleware - replaces session-based requireAuth
 */
export function requireJWTAuth(req: Request, res: Response, next: NextFunction): void {
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