import Branch from '../models/branchModel.js';
import { ok, created, notFound, conflict } from '../utils/http.js';
import { audit } from '../utils/audit.js';

const branchController = {
  list: async (req, res) => ok(res, await Branch.list(req.user.role === 'admin' && req.query.status === 'all')),

  get: async (req, res) => {
    const branch = await Branch.getById(req.valid.params.id);
    if (!branch) throw notFound('Branch');
    ok(res, branch);
  },

  create: async (req, res) => {
    const id = await Branch.create(req.valid.body);
    await audit(req, 'create', 'branch', id, { name: req.valid.body.name });
    created(res, await Branch.getById(id), 'Branch added.');
  },

  update: async (req, res) => {
    const { id } = req.valid.params;
    if (!(await Branch.getById(id))) throw notFound('Branch');
    await Branch.update(id, req.valid.body);
    await audit(req, 'update', 'branch', id);
    ok(res, await Branch.getById(id), 'Branch updated.');
  },

  deactivate: async (req, res) => {
    const { id } = req.valid.params;
    if (!(await Branch.getById(id))) throw notFound('Branch');
    if (await Branch.activeStaff(id)) throw conflict('Move or deactivate this branch\'s staff accounts first.');
    await Branch.setActive(id, false);
    await audit(req, 'deactivate', 'branch', id);
    ok(res, { branch_id: id }, 'Branch deactivated.');
  },
};

export default branchController;
