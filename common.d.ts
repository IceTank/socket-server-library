import EventEmitter from "events";
import { WebSocket } from "ws";
import { Lock } from "./socket/lock";
import { ServerBoundMsg } from "./socket/protocol";
import { CustomWebsocket, Server } from "./sockets";

export type SearchModes = 'spiral' | 'cube'

export class Job {
  /** Current client id or null if no client */
  client: CustomWebsocket | null
  /** User given job name */
  name: string
  jobOptions: JobOptions
  /** Auto generated uuid v1 (Random number and date) */
  id: string = ''
  found: FoundInfo[] = []
  /** Progress number ether 0 to 1 for mode cube or number of visited maps for mode spiral */
  progress: number = 0
  _progressRate: Array<{time: number, progress: number}> = []
  progressRate: number
  relFileName: string = ''
  distance: number | null = null
  getRelFile: () => Promise<Buffer>
  toString: () => void
  fromJSON: () => void

  constructor(client: CustomWebSocket | null, relFileName: string, name: string, jobOptions: JobOptions)
}

export interface FoundInfo {
  x: number
  z: number
  date?: number
}

export type JobOptions = {
  fpos: number | null
  threads: number | null
  biomes: number[] | null
} & ({
  mode: 'modeSpiral'
  spiralStart: number
  maxa?: number
  minx: never
  maxx: never
  minz: never
  maxz: never
} | {
  mode: 'modeCube'
  spiralStart: never
  minx: number
  maxx: number
  minz: number
  maxz: number
})

export class JobManager {
  jobsSavePath: string = ''
  relFiles: string
  _writeLock = new Lock()
  currentJobs: Job[] = []
  socketServer: Server
  workerStatus: Map<string, {isWorking: boolean, clientNum: number}>
  constructor(jobsSavePath: string, socketServer: Server)

  readConfig: () => Promise<void>
  newJob: (workerUUID: string, relfile: string, name: string, jobOptions: JobOptions, relFilePath: string) => Promise<Job>
  getWorkers: () => Array<{uuid: string, nick: string, isAlive: boolean}>
  addJob: (job: Job) => boolean
  updateJobProgress: (id: string, progress: number, distance?: number) => boolean
  getLastProgress: (id: string) => number | null
  getJobsList: () => Job[]
  getJobById: () => Job | null
  refreshWorkerStatus: () => Promise<void>
  assignJob: () => Promise<boolean>
  startJob: (clientId: number, job: Job) => Promise<void>
}

export interface FoundInfo {
  x: number
  z: number
  date?: number
}
