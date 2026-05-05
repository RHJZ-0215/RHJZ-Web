import type { NextApiRequest, NextApiResponse } from 'next'
import { put } from '@vercel/blob'
import { IncomingForm, Fields, Files } from 'formidable'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' })
  }

  const form = new IncomingForm({
    keepExtensions: true,
    maxFileSize: 50 * 1024 * 1024,
  })

  try {
    const [fields, files] = await new Promise<[Fields<string>, Files<string>]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          reject(err)
        } else {
          resolve([fields, files])
        }
      })
    })

    const file = files.file
    if (!file) {
      return res.status(400).json({ status: 'error', message: '未选择文件' })
    }

    const fileObj = Array.isArray(file) ? file[0] : file
    const filename = fileObj.originalFilename || fileObj.newFilename
    const filePath = fileObj.filepath

    if (!filePath) {
      return res.status(400).json({ status: 'error', message: '文件路径无效' })
    }

    const { url } = await put(filename, filePath, {
      access: 'public',
    })

    console.log('File uploaded to Vercel Blob:', url)
    return res.status(200).json({
      status: 'success',
      message: `文件 "${filename}" 上传成功`,
      url: url
    })
  } catch (err: any) {
    console.error('Upload error:', err.message)
    return res.status(500).json({ 
      status: 'error', 
      message: '文件上传失败',
      error: err.message || 'Unknown error'
    })
  }
}