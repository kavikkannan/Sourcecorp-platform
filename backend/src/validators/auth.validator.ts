import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(),
  }).default({}),
  cookies: z.object({
    refreshToken: z.string().optional(),
  }).default({}),
}).refine((data) => data.body.refreshToken || data.cookies.refreshToken, {
  message: 'Refresh token is required',
});

