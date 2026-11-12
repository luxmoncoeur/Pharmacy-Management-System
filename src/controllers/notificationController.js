import { getNotifications } from '../services/notificationService.js';
import { ok } from '../utils/http.js';
import { branchScope } from '../middleware/auth.js';

const notificationController = {
  list: async (req, res) => {
    const { items, counts } = await getNotifications(req, branchScope(req, req.valid.query?.branch));
    ok(res, items, 'Notifications fetched.', { counts });
  },
};

export default notificationController;
