import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'
import { IncomingForm, File, Fields, Files } from 'formidable'

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

  form.on('fileBegin', (_name: string, file: File) => {
    file.filepath = path.join(uploadDir, file.originalFilename || file.newFilename)
  })

  form.parse(req, (err: unknown, _fields: Fields<string>, files: Files<string>) => {
    if (err) {
      return res.status(500).json({ status: 'error', message: 'File upload failed' })
    }

    const file = files.file as File | undefined
    if (!file) {
      return res.status(400).json({ status: 'error', message: 'No file uploaded' })
    }

    res.status(200).json({
      status: 'success',
      message: `文件 "${file.originalFilename}" 上传成功`
    })
  })
}