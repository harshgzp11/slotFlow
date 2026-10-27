import { Request, Response, NextFunction } from 'express';
import { User, IUser } from '../models/User';
import { Business, IBusiness } from '../models/Business';
import { Membership, IMembership, MembershipRole } from '../models/Membership';
import { UnauthorizedError, ForbiddenError } from './errorHandler';
import mongoose from 'mongoose';

// Extend Express Request interface to include session user, business, and membership
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      business?: IBusiness;
      membership?: IMembership;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      throw new UnauthorizedError('Authentication required. Please log in.');
    }

    const user = await User.findById(userId);
    if (!user) {
      req.session.destroy(() => {});
      throw new UnauthorizedError('User account not found. Please log in again.');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export async function tenantGuard(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required before accessing tenant resources.');
    }

    // Extract businessId from header, route param, query param, or active session
    const rawBusinessId =
      (req.headers['x-business-id'] as string) ||
      req.params.businessId ||
      (req.query.businessId as string) ||
      req.session?.activeBusinessId;

    if (!rawBusinessId || !mongoose.Types.ObjectId.isValid(rawBusinessId)) {
      throw new ForbiddenError('Business workspace ID is required or invalid.');
    }

    const businessId = new mongoose.Types.ObjectId(rawBusinessId);

    // Verify business exists and is active
    const business = await Business.findOne({ _id: businessId, isActive: true });
    if (!business) {
      throw new ForbiddenError('Business workspace not found or inactive.');
    }

    // Verify user's membership and permissions in this business
    const membership = await Membership.findOne({
      userId: req.user._id,
      businessId: business._id,
      isActive: true
    });

    if (!membership) {
      throw new ForbiddenError('You do not have access to this business workspace.');
    }

    req.business = business;
    req.membership = membership;

    // Cache as active business in session
    if (req.session) {
      req.session.activeBusinessId = business._id.toString();
    }

    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(allowedRoles: MembershipRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.membership) {
        throw new ForbiddenError('Workspace membership context required.');
      }

      if (!allowedRoles.includes(req.membership.role)) {
        throw new ForbiddenError(
          `Insufficient permissions. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.membership.role}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
