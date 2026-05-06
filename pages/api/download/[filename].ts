import { get } from '@vercel/blob';
import type { NextApiRequest, NextApiResponse } from 'next';
import { addLog } from '../../../utils/logger';

function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
 const { filename } = req.query;
 if (typeof filename !== 'string') {
 return res.status(400).json({ status: 'error', message: 'Invalid filename' });
 }

 try {
 const blobResult = await get(filename, {
 access: 'private' as const,
 });
 
 if (!blobResult || blobResult.statusCode === 304) {
 return res.status(404).json({ status: 'error', message: '文件不存在' });
 }
 
 const { stream, blob } = blobResult;
 
 res.setHeader('Content-Type', blob.contentType || 'application/octet-stream');
 res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(blob.pathname)}"`);
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
 details: `文件: ${filename}, 大小: ${blob.size} bytes`
 });
 
 } catch (error: any) {
 console.error('Download error:', error);
 return res.status(500).json({ status: 'error', message: '下载失败: ' + (error.message || '未知错误') });
 }
}