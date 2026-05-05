import { list, put } from '@vercel/blob';
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
 
 if (blob.url) {
 res.redirect(blob.url);
 } else {
 return res.status(403).json({ status: 'error', message: '无法直接下载私有文件，请联系管理员' });
 }
 } catch (error: any) {
 console.error('Download error:', error);
 return res.status(500).json({ status: 'error', message: '下载失败: ' + (error.message || '未知错误') });
 }
}