import {User} from '../types';
import storage from './storage';

export interface AuthCredentials {
  email: string;
  password: string;
  displayName?: string;
}

// Simple password hashing (for local storage only - not secure!)
function hashPassword(password: string): string {
  // This is a simple hash for demo purposes only
  // In production, you'd use proper hashing like bcrypt
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
}

export async function signUp(
  email: string,
  password: string,
  displayName?: string,
): Promise<User> {
  // Check if user already exists
  const existingUser = await storage.getUserByEmail(email);
  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // Create new user
  const user: User = {
    uid: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    email,
    displayName,
  };

  // Store user with hashed password
  const userWithPassword = {
    ...user,
    passwordHash: hashPassword(password),
  };

  await storage.saveUser(userWithPassword as any);
  await storage.setCurrentUser(user);

  return user;
}

export async function signIn(email: string, password: string): Promise<User> {
  const user = await storage.getUserByEmail(email);
  if (!user) {
    throw new Error('User not found');
  }

  const userWithPassword = user as any;
  const passwordHash = hashPassword(password);

  if (userWithPassword.passwordHash !== passwordHash) {
    throw new Error('Invalid password');
  }

  // Remove password hash before setting current user
  const {passwordHash: _, ...userWithoutPassword} = userWithPassword;
  await storage.setCurrentUser(userWithoutPassword);

  return userWithoutPassword;
}

export async function signOut(): Promise<void> {
  await storage.setCurrentUser(null);
}

export async function getCurrentUser(): Promise<User | null> {
  return await storage.getCurrentUser();
}

