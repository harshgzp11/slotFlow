import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { User } from '../models/User';
import { Membership } from '../models/Membership';
import { Business } from '../models/Business';
import { ConflictError, UnauthorizedError, ValidationError, ForbiddenError } from '../middleware/errorHandler';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email is required').toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

const loginSchema = z.object({
  email: z.string().email('Valid email is required').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required')
});

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, password } = registerSchema.parse(req.body);

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new ConflictError('An account with this email address already exists.');
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const user = await User.create({
      name,
      email,
      passwordHash,
      systemRole: 'USER'
    });

    // Automatically establish session
    req.session.userId = user._id.toString();

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          systemRole: user.systemRole
        },
        memberships: []
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await User.findOne({ email });
    if (!user) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    // Set session
    req.session.userId = user._id.toString();

    // Fetch user's workspaces
    const memberships = await Membership.find({ userId: user._id, isActive: true })
      .populate('businessId', 'name slug timezone currency isActive');

    if (memberships.length > 0) {
      req.session.activeBusinessId = memberships[0].businessId._id.toString();
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          systemRole: user.systemRole
        },
        memberships: memberships.map((m) => ({
          id: m._id,
          role: m.role,
          business: m.businessId
        }))
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    req.session.destroy((err) => {
      if (err) {
        return next(err);
      }
      res.clearCookie('connect.sid');
      res.status(200).json({
        success: true,
        message: 'Logged out successfully.'
      });
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required.');
    }

    const memberships = await Membership.find({ userId: req.user._id, isActive: true })
      .populate('businessId');

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          systemRole: req.user.systemRole
        },
        memberships: memberships.map((m) => ({
          id: m._id,
          role: m.role,
          business: m.businessId
        })),
        activeBusinessId: req.session?.activeBusinessId || null
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function switchBusiness(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = req.body;
    if (!businessId) {
      throw new ValidationError('businessId is required.');
    }

    const membership = await Membership.findOne({
      userId: req.user!._id,
      businessId,
      isActive: true
    }).populate('businessId');

    if (!membership) {
      throw new ForbiddenError('You do not have access to this business workspace.');
    }

    req.session.activeBusinessId = businessId;

    res.status(200).json({
      success: true,
      data: {
        activeBusinessId: businessId,
        business: membership.businessId,
        role: membership.role
      }
    });
  } catch (error) {
    next(error);
  }
}
