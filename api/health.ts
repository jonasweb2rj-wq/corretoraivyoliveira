import type { ServerResponse } from 'http';
import { ApiRequest, handleHealth, sendJson } from './_shared.js';

export default async function handler(req: ApiRequest, res: ServerResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Método não permitido.' });
  }
  return handleHealth(res);
}
