import { get } from '@vercel/blob';
import type { NextApiRequest, NextApiResponse } from 'next';
import { addLog } from '../../../utils/logger';
import { pathnameFromSegments } from '../../../lib/blobPath';

function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

/**
 * 文件下载：支持多级路径（API 上传允许 a/b/c.txt）
 * 路由 pages/api/download/[...path].ts，请求 /api/download/a/b.txt
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const pathname = pathnameFromSegments(req.query.path);

  if (!pathname) {
    return res.status(400).json({ status: 'error', message: '缺少文件名' });
  }

  try {
    // 先按私有读取（默认上传方式），再尝试公开，兼容 ?public=1 上传的文件
    let blobResult = null;
    for (const access of ['private', 'public'] as const) {
      try {
        const attempt = await get(pathname, { access });
        if (attempt && attempt.statusCode !== 304) {
          blobResult = attempt;
          break;
        }
      } catch {
        // 该 access 下不存在或无权访问，换下一个
      }
    }

    if (!blobResult) {
      return res.status(404).json({ status: 'error', message: '文件不存在' });
    }

    const { stream, blob } = blobResult;

    const baseName = blob.pathname.split('/').pop() || blob.pathname;
    const safeName = encodeURIComponent(baseName);
    res.setHeader('Content-Type', blob.contentType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeName}"; filename*=UTF-8''${safeName}`,
    );
    res.setHeader('Content-Length', blob.size.toString());
    res.setHeader('Cache-Control', blob.cacheControl);
    res.setHeader('ETag', blob.etag);

    const reader = stream.getReader();
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
