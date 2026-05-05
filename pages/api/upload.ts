import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'
import { IncomingForm } from 'formidable'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' })
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads')
  
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
  }

  const form = new IncomingForm({
    uploadDir: uploadDir,
    keepExtensions: true,
    maxFileSize: 50 * 1024 * 1024,
  })

  form.parse(req, (err, _fields, files) => {
    if (err) {
      console.error('Upload error:', err)
      return res.status(500).json({ status: 'error', message: '文件上传失败' })
    }

    const file = files.file
    if (!file) {
      return res.status(400).json({ status: 'error', message: '未选择文件' })
    }

    const fileObj = Array.isArray(file) ? file[0] : file
    const filename = fileObj.originalFilename || fileObj.newFilename

    res.status(200).json({
      status: 'success',
      message: `文件 "${filename}" 上传成功`
    })
  })
}