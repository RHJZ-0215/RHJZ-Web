import { list } from '@vercel/blob';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
 const { filename } = req.query;
 if (typeof filename !== 'string') {
 return res.status(400).json({ status: 'error', message: 'Invalid filename' });
 }

 try {
 const { blobs } = await list();
 const blob = blobs.find(b => b.pathname === filename);
 if (!blob) {
 return res.status(404).json({ status: 'error', message: '文件不存在' });
 }
 res.redirect(blob.url);
 } catch (error) {
 console.error('Download error:', error);
 return res.status(500).json({ status: 'error', message: '下载失败' });
 }
}