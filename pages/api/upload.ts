import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'
import { IncomingForm, Fields, Files } from 'formidable'
import { promises as fsPromises } from 'fs'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' })
  }

  const uploadDir = path.join('/tmp', 'uploads')
  
  try {
    await fsPromises.mkdir(uploadDir, { recursive: true })
    console.log('Upload directory created:', uploadDir)
  } catch (err: any) {
    console.error('Failed to create upload directory:', err.message)
    return res.status(500).json({ status: 'error', message: '创建上传目录失败' })
  }

  const form = new IncomingForm({
    uploadDir: uploadDir,
    keepExtensions: true,
    maxFileSize: 50 * 1024 * 1024,
  })

  form.on('fileBegin', (_name, file) => {
    const filename = file.originalFilename || file.newFilename
    file.filepath = path.join(uploadDir, filename)
    console.log('File will be saved to:', file.filepath)
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

    console.log('File uploaded:', filename)
    return res.status(200).json({
      status: 'success',
      message: `文件 "${filename}" 上传成功`
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