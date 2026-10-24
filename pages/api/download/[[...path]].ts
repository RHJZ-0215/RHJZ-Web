import type { NextApiRequest, NextApiResponse } from 'next';
import { addLog } from '../../../utils/logger';
import { pathnameFromSegments } from '../../../lib/blobPath';
import { readBlob } from '../../../lib/blobFetch';
import { firstString, methodNotAllowed, setCors } from '../../../lib/http';

function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

/**
 * 文件下载：无需鉴权，按已上传的文件名直接下载。
 *
 *   GET /api/download/notes/a.txt          ← 多级路径
 *   GET /api/download/a.txt                ← 单级
 *   GET /api/download?name=notes/a.txt     ← 查询参数（适合文件名带特殊字符）
 *   GET /api/download/notes/a.txt?inline=1 ← 浏览器内联预览而非下载
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setCors(res, 'GET, HEAD, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return methodNotAllowed(res, ['GET', 'HEAD', 'OPTIONS']);
  }

  const fromQuery = firstString(req.query.name, req.query.filename, req.query.file);
  // 查询参数里的反斜杠同样归一化为斜杠，兼容 Windows 风格路径
  const pathname = fromQuery
    ? pathnameFromSegments(fromQuery)
    : pathnameFromSegments(req.query.path);

  if (!pathname) {
    return res.status(400).json({ status: 'error', message: '缺少文件名' });
  }

  try {
    const blob = await readBlob(pathname);
    if (!blob) {
      return res.status(404).json({ status: 'error', message: '文件不存在' });
    }

    const inline = firstString(req.query.inline) === '1';
    const baseName = blob.pathname.split('/').pop() || blob.pathname;
    const safeName = encodeURIComponent(baseName);

    res.setHeader('Content-Type', blob.contentType);
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${safeName}"; filename*=UTF-8''${safeName}`,
    );
    res.setHeader('Content-Length', String(blob.size));
    res.setHeader('Cache-Control', blob.cacheControl);
    if (blob.etag) res.setHeader('ETag', blob.etag);

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const reader = blob.stream.getReader();
    const pump = async () => {
      const { done, value } = await reader.read();
      if (done) {
        res.end();
        return;
      }
      res.write(value);
      await pump();
    };

    await pump();

    await addLog({
      ip: getClientIp(req),
      type: 'download',
      action: '文件下载',
      details: `文件: ${pathname}, 大小: ${blob.size} bytes`,
    });
  } catch (error: any) {
    console.error('Download error:', error);
    return res
      .status(500)
      .json({ status: 'error', message: '下载失败: ' + (error.message || '未知错误') });
  }
}
