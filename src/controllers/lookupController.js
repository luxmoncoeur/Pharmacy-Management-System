import { Lookup } from '../models/lookupModel.js';
import { ok } from '../utils/http.js';

const lookupController = {
  categories: async (_req, res) => ok(res, await Lookup.categories()),
  suppliers: async (_req, res) => ok(res, await Lookup.suppliers()),
};

export default lookupController;
