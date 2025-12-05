import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      username: string;
      role: string;
      branchId: string;
    };
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.user || !roles.includes(req.session.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
};

// Middleware to get the current user
// This is a simplified version - in a real app, you'd verify the JWT token here
export const getCurrentUser = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.user) {
    return next();
  }

  try {
    const user = await storage.getUser(req.session.user.id);
    if (user) {
      req.user = user;
    }
  } catch (error) {
    console.error('Error fetching user:', error);
  }
  
  next();
};
