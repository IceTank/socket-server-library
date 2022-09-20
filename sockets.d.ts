import { EventEmitter } from "events"
import { WebSocket } from "ws";
import { runOptions } from "../pool-worker/runner";
import { ClientBoundMsg, MsgJobStatus, ServerBoundMsg } from "./socket/protocol";

interface SocketServerEmitter extends EventEmitter {
  on(event: 'message', listener: (message: unknown, ws: WebSocket) => void): this
}

interface CustomWebsocket extends WebSocket {
  uuid: string
  nick?: string
  isAlive: boolean
}

interface ClientOptions {
  url?: string
  port?: number
}

export class Client extends EventEmitter {
  constructor(options: ClientOptions = {})

  on(event: 'message', listener: (...args: unknown) => void): this
  on(event: 'error', listener: (err: Error) => void): this
  /** Emitted when a connection has been established */
  on(event: 'open', listener: () => void): this

  send: (data: ClientBoundMsg) => Promise<void>
  sendProgress: (progress: { maps: number, distance?: number }, jobId: string) => void
  sendNick: (nick: string) => void
  sendFound: (found: string, jobId: string) => Promise<void>
  sendAkn: (id: string) => Promise<void>
  sendLastFound: (data: string) => void
  sendCurrentJob: (data: string) => void
  sendJobFinished: (id: string) => void
}

export class Server extends EventEmitter {
  constructor(port?: number)

  on(event: 'connection', listener: (ws: CustomWebsocket) => void): this
  on(event: 'messageRaw', listener: (message: string, ws: CustomWebsocket) => void): this
  on(event: 'message', listener: (message: ServerBoundMsg, ws: CustomWebsocket) => void): this
  on(event: 'nick', listener: (ws: CustomWebsocket) => void): this
  on(event: 'progress', listener: (data: {ws: CustomWebsocket, maps: number, distance: number, jobId: string, mode: 'spiral'}) => void): this
  on(event: 'progress', listener: (data: {ws: CustomWebsocket, maps: number, jobId: string, mode: 'cube'}) => void): this
  on(event: 'found', listener: (found: string, jobId: string, ws: CustomWebsocket) => void): this

  connectionsList: typeof WebSocket.WebSocket[]
	wss: typeof WebSocket.Server

  sendToAll: (message: ClientBoundMsg) => void
  send: (message: ClientBoundMsg, clientNum?: number) => void
  upload: (clientNum: number, filePath: string) => Promise<void>
  getConnections: () => Array<{uuid: string, nick: string, isAlive: boolean, clientNum: number}>
  listConnections: () => void
  startJob: (options: runOptions) => Promise<string|null>
  stopJob: (clientNum: number) => Promise<boolean>
  getLastFound: (clientNum: number) => Promise<string>
  getCurrentJob: (clientNum: number) => Promise<MsgJobStatus>
  awaitAkn: (clientNum: number, id: string) => Promise<void>
}
