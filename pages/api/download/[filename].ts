import type { NextApiRequest, NextApiResponse } from 'next'
import { list } from '@vercel/blob'
import fs from 'fs'
import path from 'path'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' })
  }

  const { filename } = req.query
  const decodedFilename = decodeURIComponent(filename as string)

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      const backupDir = path.join('/tmp', 'uploads')
      const filePath = path.join(backupDir, decodedFilename)

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ status: 'error', message: '文件不存在' })
      }

      const fileContent = fs.readFileSync(filePath)
      
      res.setHeader('Content-Type', 'application/octet-stream')
      res.setHeader('Content-Disposition', `attachment; filename="${decodedFilename}"`)
      res.status(200).send(fileContent)
      return
    }

    const { blobs } = await list()
    const blob = blobs.find(b => b.pathname === decodedFilename)

    if (!blob) {
      return res.status(404).json({ status: 'error', message: '文件不存在' })
    }

    res.redirect(blob.url)
  } catch (error: any) {
    console.error('Download error:', error.message)
    res.status(500).json({ status: 'error', message: '下载失败', error: error.message })
  }
}