import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserDocument } from '../../../shared/models/User.js';
import { UserRepository } from '../repository/UserRepository.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9][0-9\s-]{6,19}$/;

export function safeUser(user: UserDocument) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
    ...(user.dateOfBirth && { dateOfBirth: user.dateOfBirth }),
    ...(user.phone && { phone: user.phone }),
    ...(user.registrationNumber && { registrationNumber: user.registrationNumber }),
  };
}

export function issueToken(user: UserDocument): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT secret is not configured');
  return jwt.sign(
    { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
    secret,
    { expiresIn: '1h' }
  );
}

export function isDuplicate(error: unknown): error is { code: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 11000
  );
}

export interface RegisterInput {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  dateOfBirth?: unknown;
  phone?: unknown;
  registrationNumber?: unknown;
}

export interface LoginInput {
  email?: unknown;
  password?: unknown;
}

export class AuthService {
  constructor(private readonly userRepository: UserRepository) {}

  validateRegisterInput(input: RegisterInput): {
    valid: boolean;
    error?: string;
    data?: {
      name: string;
      email: string;
      password: string;
      dateOfBirth?: string;
      phone?: string;
      registrationNumber?: string;
    };
  } {
    const { name, email, password, dateOfBirth, phone, registrationNumber } = input;

    if (
      typeof name !== 'string' || !name.trim() ||
      typeof email !== 'string' || !emailPattern.test(email) ||
      typeof password !== 'string' || password.length < 8
    ) {
      return { valid: false, error: 'Name, valid email, and password of at least 8 characters are required' };
    }

    if (dateOfBirth !== undefined && (typeof dateOfBirth !== 'string' || Number.isNaN(new Date(dateOfBirth).getTime()))) {
      return { valid: false, error: 'dateOfBirth must be a valid date string' };
    }

    if (phone !== undefined && (typeof phone !== 'string' || !phonePattern.test((phone as string).trim()))) {
      return { valid: false, error: 'phone must be a valid phone number' };
    }

    if (registrationNumber !== undefined && (typeof registrationNumber !== 'string' || !(registrationNumber as string).trim())) {
      return { valid: false, error: 'registrationNumber must be a non-empty string' };
    }

    return {
      valid: true,
      data: {
        name: (name as string).trim(),
        email: (email as string).toLowerCase().trim(),
        password: password as string,
        ...(dateOfBirth && { dateOfBirth: (dateOfBirth as string).trim() }),
        ...(phone && { phone: (phone as string).trim() }),
        ...(registrationNumber && { registrationNumber: (registrationNumber as string).trim() }),
      },
    };
  }

  async register(data: {
    name: string;
    email: string;
    password: string;
    dateOfBirth?: string;
    phone?: string;
    registrationNumber?: string;
  }): Promise<{ user: UserDocument; token: string }> {
    const exists = await this.userRepository.existsByEmail(data.email);
    if (exists) {
      throw Object.assign(new Error('Email is already registered'), { statusCode: 409, code: 11000 });
    }

    const user = await this.userRepository.create({
      ...data,
      password: await bcrypt.hash(data.password, 10),
      role: 'citizen',
      isVerified: true,
    });

    const token = issueToken(user);
    return { user, token };
  }

  async login(email: unknown, password: unknown): Promise<{ user: UserDocument; token: string }> {
    if (typeof email !== 'string' || typeof password !== 'string') {
      throw Object.assign(new Error('Email and password are required'), { statusCode: 400 });
    }

    const user = await this.userRepository.findByEmail(email);
    const valid = user && (await bcrypt.compare(password, user.password));

    if (!valid) {
      throw Object.assign(
        Object.assign(new Error('Invalid email or password'), { statusCode: 401 }),
        { userId: user?._id.toString() ?? null, actorRole: user?.role }
      );
    }

    if (!user.isVerified) {
      throw Object.assign(new Error('Account is disabled'), { statusCode: 403 });
    }

    const token = issueToken(user);
    return { user, token };
  }
}
