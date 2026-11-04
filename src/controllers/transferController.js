import { query } from '../config/db.js';
import { sendStock } from '../services/transferService.js';
import { created, forbidden, badRequest } from '../utils/http.js';
import { targetBranch } from '../middleware/auth.js';

const transferController = {
  /** A branch manager sends from their own branch; the owner chooses the sending branch. */
  create: async (req, res) => {
    const body = req.valid.body;
    const fromBranchId = targetBranch(req, body.from_branch_id);
    if (!fromBranchId) throw badRequest('Choose the branch sending the stock.', { from_branch_id: 'Sending branch is required.' });
    if (body.from_branch_id && Number(body.from_branch_id) !== Number(fromBranchId)) throw forbidden('You can only send stock from your own branch.');
    if (fromBranchId === body.to_branch_id) throw badRequest('Choose a different branch to send to.', { to_branch_id: 'Choose a different branch.' });

    const branches = await query('SELECT branch_id, name FROM tbl_branches WHERE is_active = 1 AND branch_id IN (?)', [[fromBranchId, body.to_branch_id]]);
    if (branches.length !== 2) throw badRequest('Both branches must be active.', { to_branch_id: 'Choose an active branch.' });
    const name = (id) => branches.find((b) => b.branch_id === id).name;
    const meds = await query('SELECT medicine_id FROM tbl_medicines WHERE is_active = 1 AND medicine_id IN (?)', [body.items.map((i) => i.medicine_id)]);
    if (meds.length !== body.items.length) throw badRequest('One or more medicines are archived or unknown.', { items: 'Remove archived medicines.' });

    const moved = await sendStock(req, {
      fromBranchId, toBranchId: body.to_branch_id, notes: body.notes, items: body.items,
      branchNames: { from: name(fromBranchId), to: name(body.to_branch_id) },
    });
    created(res, { from_branch_id: fromBranchId, to_branch_id: body.to_branch_id, lots: moved }, `Stock sent to ${name(body.to_branch_id)}.`);
  },
};

export default transferController;
