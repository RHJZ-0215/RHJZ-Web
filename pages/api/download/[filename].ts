import { get } from '@vercel/blob';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
 const { filename } = req.query;
 if (typeof filename !== 'string') {
 return res.status(400).json({ status: 'error', message: 'Invalid filename' });
 }

 try {
 const blobResult = await get(filename, {
 access: 'private' as const,
 });
 
 if (!blobResult) {
 return res.status(404).json({ status: 'error', message: '文件不存在' });
 }
 
 if (blobResult.statusCode === 304) {
 return res.status(304).end();
 }
 
 const downloadUrl = blobResult.blob.downloadUrl || blobResult.blob.url;
 if (!downloadUrl) {
 return res.status(404).json({ status: 'error', message: '无法获取下载链接' });
 }
 
 res.redirect(downloadUrl);
 } catch (error: any) {
 console.error('Download error:', error);
 return res.status(500).json({ status: 'error', message: '下载失败: ' + (error.message || '未知错误') });
 }
}