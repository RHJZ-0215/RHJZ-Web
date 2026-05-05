import { del } from '@vercel/blob';
import type { NextApiRequest, NextApiResponse } from 'next';
function isAdmin(req: NextApiRequest): boolean {
 const cookies = req.headers.cookie || '';
 return cookies.includes('admin=authenticated');
}
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
 if (req.method !== 'POST') {
 return res.status(405).json({ status: 'error', message: 'Method not allowed' });
 }
 if (!isAdmin(req)) {
 return res.status(401).json({ status: 'error', message: '未登录或权限不足' });
 }
 const { filename } = req.body;
 if (!filename) {
 return res.status(400).json({ status: 'error', message: '文件名不能为空' });
 }
 try {
 await del(filename);
 return res.status(200).json({ status: 'success', message: `文件 "${filename}" 删除成功` });
 }
 catch (error) {
 console.error('Delete error:', error);
 return res.status(500).json({ status: 'error', message: '删除失败' });
 }
}