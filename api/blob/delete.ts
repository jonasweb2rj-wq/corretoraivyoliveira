import type { ServerResponse } from 'http';
import { ApiRequest, handleBlobDelete, sendJson } from '../_shared.js';

export default async function handler(req: ApiRequest, res: ServerResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return sendJson(res, 405, { error: 'Método não permitido.' });
  }
  return handleBlobDelete(req, res);
}
