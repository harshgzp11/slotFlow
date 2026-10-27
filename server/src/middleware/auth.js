import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Business } from '../models/Business.js';
import { Membership } from '../models/Membership.js';
import { UnauthorizedError, ForbiddenError } from './errorHandler.js';

export async function requireAuth(req, _res, next) {
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

export async function tenantGuard(req, _res, next) {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required before accessing tenant resources.');
    }

    // Extract businessId from header, route param, query param, or active session
    const rawBusinessId =
      req.headers['x-business-id'] ||
      req.params.businessId ||
      req.query.businessId ||
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

/**
 * Checks that the authenticated user possesses one of the allowed membership roles
 * @param {string[]} allowedRoles
 */
export function requireRole(allowedRoles) {
  return (req, _res, next) => {
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
