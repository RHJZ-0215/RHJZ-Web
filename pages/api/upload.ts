import { put } from '@vercel/blob';
import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm } from 'formidable';
import type { Fields, Files } from 'formidable';
export const config = {
 api: {
 bodyParser: false,
 },
};
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
 if (req.method !== 'POST') {
 return res.status(405).json({ status: 'error', message: 'Method not allowed' });
 }
 const form = new IncomingForm({ keepExtensions: true });
 form.parse(req, async (err, _fields, files) => {
 if (err) {
 console.error('Parse error:', err);
 return res.status(500).json({ status: 'error', message: '解析文件失败' });
 }
 const file = files.file;
 if (!file) {
 return res.status(400).json({ status: 'error', message: '没有选择文件' });
 }
 const fileObj = Array.isArray(file) ? file[0] : file;
 try {
 const buffer = await fileObj.toArrayBuffer();
 const result = await put(fileObj.originalFilename || fileObj.newFilename, buffer, {
 access: 'public',
 });
 return res.status(200).json({ status: 'success', message: '上传成功', url: result.url });
 }
 catch (error) {
 console.error('Upload error:', error);
 return res.status(500).json({ status: 'error', message: '上传失败' });
 }
 });
}