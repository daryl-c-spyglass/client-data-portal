import jwt, { JwtPayload } from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import type { User } from "@shared/schema";
import { storage } from "./storage";

interface JWTUserPayload {
  id: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    console.warn('Warning: Using fallback JWT secret for development. Set JWT_SECRET environment variable.');
    return 'dev-jwt-secret-change-in-production';
  }
  return secret;
}

export function generateJWT(user: User): string {
  const payload: Omit<JWTUserPayload, 'iat' | 'exp'> = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, getJWTSecret(), {
    expiresIn: '7d',
    algorithm: 'HS256',
  });
}

export function verifyJWT(token: string): JWTUserPayload | null {
  try {
    const decoded = jwt.verify(token, getJWTSecret(), { algorithms: ['HS256'] }) as JwtPayload;

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
      }
    }
    return null;
  }
}

function extractTokenFromRequest(req: Request): string | null {
  const cookieToken = req.cookies?.['auth-token'];
  if (cookieToken) {
    return cookieToken;
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

export function setJWTCookie(res: Response, token: string): void {
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie('auth-token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7,
    path: '/',
  });
}

export function clearJWTCookie(res: Response): void {
  res.clearCookie('auth-token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });
}

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

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const payload = verifyJWT(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

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
