import type { ServerResponse } from 'http';
import { ApiRequest, handleBlobUpload, sendJson } from '../_shared.js';

export default async function handler(req: ApiRequest, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Método não permitido.' });
  }
  return handleBlobUpload(req, res);
}
