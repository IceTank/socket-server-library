const { EventEmitter } = require('events')
const { promises: fs } = require('fs')
const { WebSocketServer } = require('ws')
const { v1: uuidV1 } = require('uuid')
const wait = require('util').promisify(setTimeout)

const DefaultPort = 9002

async function onceWithTimeout(emitter, event , timeoutMS = 5000, filter = () => { return true }) {
	return await new Promise((resolve, reject) => {
		const clean = () => {
			emitter.removeListener(event, onEvent)
			clearTimeout(timeoutHandle)
		}
		const onEvent = (...args) => {
			if (!filter(...args)) return
			clean()
			resolve(...args)
		}
		const onTimeout = () => {
			clean()
			reject(new Error('timeout'))
		}
		const timeoutHandle = setTimeout(onTimeout, timeoutMS)
		emitter.on(event, onEvent)
	})
}

class Server extends EventEmitter {
	constructor(port) {
		super()
		port = port || DefaultPort
		this.connectionsList = []
		this.wss = new WebSocketServer({
			port: port
		})
		this.wss.on('listening', () => {
			console.info(`Websocket running on port ${port}`)
		})
		this._handleConnections(this.wss)
	}

	/**
	 * 
	 * @param {import('ws').WebSocketServer} wss 
	 */
	_handleConnections(wss) {
		wss.on('connection', (ws, req) => {
			// Keep alive messages
			ws.isAlive = true
			ws.on('pong', heartbeat)
			ws.uuid = uuidV1()

			this.emit('connection', ws)
			this.connectionsList.push(ws)
			const ip = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : req.socket.remoteAddress
			console.info(`New Socket connection ${ip}`)
			ws.on('message', (message) => {
				this._onWebsocketMessage(message, ws)
			})
			ws.on('close', (code, reason) => {
				console.info('Websocket Connection closed', code, reason)
				this._removeWs(ws)
			})
		})
		
		const that = this
		const interval = setInterval(function ping() {
			wss.clients.forEach((ws) => {
				if (ws.isAlive === false) {
					that._removeWs(ws)
					return
				}
		
				ws.isAlive = false
				ws.ping()
			}) 
		}, 30000)
		
		wss.on('close', function close() {
			clearInterval(interval)
		})
	}

	_onWebsocketMessage(message, ws) {
		const data = message.toString('utf8')
		this.emit('messageRaw', data, ws)
		/** @type {import('./protocol').ServerBoundMsg} */
		let d
		try {
			d = JSON.parse(data)
			this.emit('message', d, ws)
		} catch (err) {
			console.info('Parsing of message failed', err)
			return
		}
		try {
			if (d.action === 'set_nick') {
				ws.nick = String(d.data)
				console.info('Set nick for connection', ws.nick)
				this.emit('nick', ws)
				return
			} 
			if (d.action === 'progress') {
				if (d.data.progress.maps > 1) {
					this.emit('progress', { ws: ws, maps: d.data.progress.maps, distance: d.data.progress.distance, jobId: d.data.jobId, mode: 'spiral' })
				} else {
					this.emit('progress', { ws: ws, maps: d.data.progress.maps, jobId: d.data.jobId, mode: 'cube' })
				}
				return
			}
			if (d.action === 'found') {
				this.emit('found', d.data, d.id, ws)
				return
			}
		} catch (err) {
			console.info('Processing of message failed', err)
		}
	}

	_removeWs(ws) {
		const index = this.connectionsList.indexOf(ws)
		if (index < 0) {
			console.error('To Remove ws not found')
			return
		}
		this.connectionsList.splice(index, 1);
	}

	// sendToAll(message) {
	// 	const data = JSON.stringify(message)
	// 	this.connectionsList.forEach(ws => {
	// 		ws.send(data)
	// 	})
	// }

	send(message, clientNum = 0) {
		const data = JSON.stringify(message)
		if (!this.connectionsList[clientNum]) throw new Error('client does not exist ' + clientNum)
		this.connectionsList[clientNum].send(data)
	}

	async getLastFound(clientNum) {
		const connection = this.connectionsList[clientNum]
		if (!connection) throw new Error('Connection does not exist')
		this.send({
			action: 'get_last_found'
		})
		const data = await onceWithTimeout(this, 'message', 5000, (data) => {
			return data.action === 'last_found'
		})
		return data
	}

	async getCurrentJob(clientNum) {
		const connection = this.connectionsList[clientNum]
		if (!connection) throw new Error('Connection does not exist')
		try {
			setTimeout(() => {
				this.send({
					action: 'get_current_job'
				})
			}, 10)
			const data = await onceWithTimeout(this, 'message', 5000, (data) => {
				return data.action === 'job_status'
			})
			return data
		} catch (err) {
			console.error('Error:', err.message)
			return null
		}
	}

	async upload(clientNum, filePathOrBuffer) {
		const connection = this.connectionsList[clientNum]
		const isBuffer = Buffer.isBuffer(filePathOrBuffer)
		if (!connection) throw new Error('Connection does not exist')
		let relFileData
		if (isBuffer) {
			relFileData = Buffer.from(filePathOrBuffer).toString('utf-8')
		} else {
			relFileData = await fs.readFile(filePathOrBuffer, 'utf8')
		}
		const data = {
			action: 'upload',
			data: relFileData
		}
		// console.info('Uploading', data)
		this.send(data)
		await onceWithTimeout(this, 'message', 5000, (data) => {
			return data.action === 'akn'
		})
	}

	getConnections() {
		const connections = []
		this.connectionsList.forEach((c, i) => {
			connections.push({
				clientNum: i,
				uuid: c.uuid,
				nick: c.nick,
				isAlive: c.isAlive
			})
		})
		return connections
	}

	listConnections() {
		try {
			this.getConnections().forEach(c => {
				console.info(`Nick: ${c.nick} Alive: ${c.isAlive} UUID: ${c.uuid}`)
			})
		} catch (err) {
			console.error('Got error listing connections', err)
			console.info(this.connectionsList)
		}
	}

	/**
	 * @param {import('../../pool-worker/runner').runOptions & { clientNum: number }} options 
	 */
	async startJob(options) {
		if (!options) throw new Error('No Options')
		if (options.mode === 'cube') {
			if (!('maxx' in options) || !('minx' in options) || !('maxz' in options) || !('minz' in options)) throw new Error('Missing min max options')
			if (options.maxx < options.minx || options.maxz < options.minz) throw new Error('Min must be smaller then max')
		} 
		const clientNum = options.clientNum || 0
		delete options.clientNum
		const id = options.id

		this.send({
			action: 'job_start',
			id: id,
			data: options
		}, clientNum)
		try {
			await this.awaitAkn(clientNum, id)
			return id
		} catch (err) {
			console.error(err)
			return null
		}
	}

	async stopJob(clientNum) {
		const id = uuidV1()
		this.send({
			action: 'job_stop',
			id: id
		}, clientNum)
		try {
			await this.awaitAkn(clientNum, id)
			return true
		} catch (_ignoreErr) {
			return false
		}
	}

	async awaitAkn(clientNum, id) {
		const connection = this.connectionsList[clientNum]
		const aknTimeoutMS = 5000
		let timeoutHandle
		let messageHandle
		const timeout = new Promise((_resolve, reject) => {
			timeoutHandle = setTimeout(() => {
				clean()
				reject(new Error('timeout'))
			}, aknTimeoutMS)
		})
		const akn = new Promise((resolve) => {
			messageHandle = (message) => {
				try {
					const d = JSON.parse(message)	
					if (d.action !== 'akn' || d.id !== id) return
					clean()
					resolve()
				} catch (err) {}
			}
			connection.on('message', messageHandle)
		})
		const clean = () => {
			connection.removeListener('message', messageHandle)
			clearTimeout(timeoutHandle)
		}
		
		await Promise.race([timeout, akn])
	}
}

function heartbeat() {
  this.isAlive = true
}

module.exports = {
	Server
}
