import { loginAdmin } from '../services/auth.service';
import { assertNotLocked, clearLoginAttempts, recordLoginFailure } from '../services/login-rate-limit.service';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/api-response';

export const login = asyncHandler(async (req, res) => {
  const identifier = String(req.body?.email ?? '').trim().toLowerCase();
  await assertNotLocked(identifier); // 429 if too many recent failures
  try {
    const result = await loginAdmin(req.body.email, req.body.password);
    await clearLoginAttempts(identifier);
    return sendSuccess(res, 'Login successful.', result);
  } catch (err) {
    await recordLoginFailure(identifier);
    throw err;
  }
});

export const logout = asyncHandler(async (_req, res) => {
  return sendSuccess(res, 'Logout successful.');
});

export const me = asyncHandler(async (req, res) => {
  return sendSuccess(res, 'Authenticated user fetched successfully.', req.user);
});
