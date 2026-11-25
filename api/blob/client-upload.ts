import type { ServerResponse } from 'http';
import { ApiRequest, handleBlobClientUpload, sendJson } from '../_shared.js';

export default async function handler(req: ApiRequest, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Método não permitido.' });
  }
  return handleBlobClientUpload(req, res);
}
