const router = require('express').Router();
const { login, resetPassword, sendResetOtp, verifyResetOtp } = require('../controllers/authController');

router.post('/login', login);
router.post('/logout', (req, res) => {
  res.clearCookie('sentinel_session', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  res.json({ ok: true });
});
router.post('/send-reset-otp', sendResetOtp);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);

module.exports = router;
