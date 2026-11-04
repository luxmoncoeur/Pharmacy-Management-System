import { z } from 'zod';
import Pharmacist from '../models/pharmacistModel.js';
import { ok, created, notFound, badRequest } from '../utils/http.js';
import { audit } from '../utils/audit.js';

const statusQuery = z.object({ q: z.string().trim().max(100).optional(), status: z.enum(['active', 'inactive', 'all']).default('active') });

async function assertLinkable(userId) {
  if (!userId) return;
  const role = await Pharmacist.userRole(userId);
  if (!role) throw badRequest('Linked user does not exist.', { user_id: 'Choose an existing user.' });
  if (role !== 'pharmacist') throw badRequest('Only pharmacist accounts can be linked.', { user_id: 'This user is not a pharmacist account.' });
}

const pharmacistController = {
  list: async (req, res) => ok(res, await Pharmacist.list(statusQuery.parse(req.query))),

  get: async (req, res) => {
    const p = await Pharmacist.getById(req.valid.params.id);
    if (!p) throw notFound('Pharmacist');
    ok(res, p);
  },

  create: async (req, res) => {
    await assertLinkable(req.valid.body.user_id);
    const id = await Pharmacist.create(req.valid.body);
    await audit(req, 'create', 'pharmacist', id, { license_no: req.valid.body.license_no });
    created(res, await Pharmacist.getById(id), 'Pharmacist added.');
  },

  update: async (req, res) => {
    const { id } = req.valid.params;
    if (!(await Pharmacist.getById(id))) throw notFound('Pharmacist');
    await assertLinkable(req.valid.body.user_id);
    await Pharmacist.update(id, req.valid.body);
    await audit(req, 'update', 'pharmacist', id);
    ok(res, await Pharmacist.getById(id), 'Pharmacist updated.');
  },

  deactivate: async (req, res) => {
    const { id } = req.valid.params;
    if (!(await Pharmacist.getById(id))) throw notFound('Pharmacist');
    await Pharmacist.setActive(id, false);
    await audit(req, 'deactivate', 'pharmacist', id);
    ok(res, { pharmacist_id: id }, 'Pharmacist deactivated.');
  },
};

export default pharmacistController;
