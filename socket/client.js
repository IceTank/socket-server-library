const { EventEmitter } = require('events')
const { WebSocket: WebSocketConstructor } = require('ws')

const ReconnectTimeoutMS = 5000

class Client extends EventEmitter {
  constructor(options = {}) {
    super()
    this.ws = null
    this._url = options.url || 'ws://localhost'
    this._port = options.port || '9002'
    this.isConnecting = false
    this.aliveInterval = null
    this._init()
  }

  _init() {
    this.isConnecting = true
    this.ws = new WebSocketConstructor(`${this._url}:${this._port}`)
    this._handleEvents(this.ws)
  }

  _onDisconnect() {
    this.isConnecting = false
    this._clean()
    console.info('Error in connection reconnecting in', ReconnectTimeoutMS / 1000, 'seconds')
    setTimeout(() => {
      this._init()
    }, ReconnectTimeoutMS)
  }

  _handleEvents(ws) {
    if (!ws) return
    ws.on('message', (...args) => this.emit('message', ...args))
    ws.on('error', (err) => {
      if (this.listenerCount('error') !== 0) this.emit('error', err)
    })
    ws.on('open', () => this.emit('open'))
    ws.on('close', (code) => {
      this._onDisconnect()
      this.emit('close', code)
    })
  }

  _clean() {
    this.ws.removeAllListeners()
    this.ws = null
  }

  /**
   * @param {import('./protocol').ServerBoundMsg} data 
   * @returns {Promise<void>}
   */
  send(data) {
    if (!this.ws) {
      console.warn('Tried to send message with closed websocket', data)
      return Promise.resolve()
    }
    return new Promise((resolve, reject) => {
      this.ws.send(JSON.stringify(data), (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  sendProgress(progress, jobId) {
    this.send({
      action: 'progress',
      data: {
        progress: {
          maps: progress.maps,
          distance: progress.distance
        },
        jobId: jobId
      }
    })
  }

  sendNick(nick) {
    this.send({
      action: 'set_nick',
      data: nick
    })
  }

  sendFound(found, jobId) {
    this.send({
      action: 'found',
      data: found,
      id: jobId
    })
  }

  async sendAkn(id) {
    await this.send({
      action: 'akn',
      id: id
    })
  }

  sendJobFinished(id) {
    this.send({
      action: 'job_finished',
      id: id
    })
  }

  sendLastFound(data) {
    this.send({
      action: 'last_found',
      data
    })
  }

  sendCurrentJob(data) {
    this.send({
      action: 'job_status',
      data: data
    })
  }
}

module.exports = {
  Client
}
