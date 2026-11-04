import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';
import { HttpError, ok, badRequest } from '../utils/http.js';

// Compared against when the username does not exist, so response time does not reveal valid usernames.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 10);

const authController = {
  login: async (req, res) => {
    const { username, password } = req.valid.body;
    const user = await User.findForLogin(username);
    const valid = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);

    if (!user || !valid || !user.is_active) {
      throw new HttpError(401, user && valid ? 'This account has been deactivated. Ask the owner to reactivate it.' : 'Incorrect username or password.');
    }

    await new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
    req.session.user = { user_id: user.user_id };
    await User.touchLogin(user.user_id);
    ok(res, await User.getById(user.user_id), 'Signed in.');
  },

  logout: (req, res) => {
    req.session.destroy(() => {
      res.clearCookie('pms.sid');
      ok(res, null, 'Signed out.');
    });
  },

  me: (req, res) => ok(res, req.user),

  changePassword: async (req, res) => {
    const { current_password, new_password } = req.valid.body;
    const hash = await User.findPasswordHash(req.user.user_id);
    if (!(await bcrypt.compare(current_password, hash))) {
      throw badRequest('Current password is incorrect.', { current_password: 'Current password is incorrect.' });
    }
    if (current_password === new_password) {
      throw badRequest('Choose a password you have not used here.', { new_password: 'New password must be different from the current one.' });
    }
    await User.setPassword(req.user.user_id, await bcrypt.hash(new_password, 10));
    ok(res, null, 'Password updated.');
  },
};

export default authController;
