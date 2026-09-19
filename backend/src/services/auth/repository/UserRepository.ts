import User, { UserDocument } from '../../../shared/models/User.js';

export class UserRepository {
  async findByEmail(email: string): Promise<UserDocument | null> {
    return User.findOne({ email: email.toLowerCase().trim() }).select('+password');
  }

  async findById(id: string): Promise<UserDocument | null> {
    return User.findById(id);
  }

  async existsByEmail(email: string): Promise<boolean> {
    return !!(await User.exists({ email: email.toLowerCase().trim() }));
  }

  async create(data: {
    name: string;
    email: string;
    password: string;
    role?: 'admin' | 'department_officer' | 'citizen';
    isVerified?: boolean;
    dateOfBirth?: string;
    phone?: string;
    registrationNumber?: string;
  }): Promise<UserDocument> {
    return User.create(data);
  }
}
