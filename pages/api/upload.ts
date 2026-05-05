import type { NextApiRequest, NextApiResponse } from 'next'
import { put } from '@vercel/blob'

export const config = {
  api: {
    bodyParser: false,
  },
}

function parseMultipart(req: NextApiRequest): Promise<{ filename: string; data: Buffer }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let filename = ''

    req.on('data', (chunk) => {
      chunks.push(chunk)
    })

    req.on('end', () => {
      const buffer = Buffer.concat(chunks)
      const boundary = req.headers['content-type']?.split('boundary=')[1]
      
      if (!boundary) {
        reject(new Error('Missing content-type boundary'))
        return
      }

      const parts = buffer.toString().split(`--${boundary}`)
      
      for (const part of parts) {
        if (part.includes('Content-Disposition')) {
          const filenameMatch = part.match(/filename="([^"]+)"/)
          if (filenameMatch) {
            filename = filenameMatch[1]
          }
          
          const contentStart = part.indexOf('\r\n\r\n') + 4
          const contentEnd = part.lastIndexOf('\r\n--')
          const fileContent = buffer.slice(
            buffer.indexOf(part) + contentStart,
            buffer.indexOf(part) + (contentEnd > 0 ? contentEnd : part.length)
          )
          
          if (filename && fileContent.length > 0) {
            resolve({ filename, data: fileContent })
            return
          }
        }
      }
      
      reject(new Error('File not found in request'))
    })

    req.on('error', (err) => {
      reject(err)
    })
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' })
  }

  try {
    const { filename, data } = await parseMultipart(req)
    
    if (!filename || !data || data.length === 0) {
      return res.status(400).json({ status: 'error', message: '无效的文件数据' })
    }

    console.log(`Uploading file: ${filename}, size: ${data.length} bytes`)

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.log('BLOB_READ_WRITE_TOKEN not set, using memory storage')
      
      return res.status(200).json({
        status: 'success',
        message: `文件 "${filename}" 上传成功（演示模式）`,
        note: 'Vercel Blob 未配置，文件未实际保存'
      })
    }

    const { url } = await put(filename, data, {
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
    console.error('Error stack:', err.stack)
    
    return res.status(500).json({ 
      status: 'error', 
      message: '文件上传失败',
      error: err.message || 'Unknown error'
    })
  }
}