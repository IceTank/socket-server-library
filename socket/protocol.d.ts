import { runOptions } from '../../pool-worker/runner'

export type ClientBoundMsg = MsgUpload | MsgJobStart | MsgGetLastFound | MsgCurrentJob | MsgStopJob

export type ServerBoundMsg = MsgAkn | MsgFound | MsgProgress | MsgSetNick | MsgJobFinish | MsgLastFound | MsgJobStatus

// Client Bound
interface MsgStopJob {
  action: 'job_stop'
  id: string
}

interface MsgCurrentJob {
  action: 'get_current_job'
}

interface MsgGetLastFound {
  action: 'get_last_found'
}

interface MsgJobStart {
  action: 'job_start'
  id: string
  data: runOptions
}

interface MsgUpload {
  action: 'upload'
  data: string
}

// Server Bound
export interface MsgJobStatus {
  action: 'job_status'
  data: string
}

interface MsgLastFound {
  action: 'last_found'
  data: string
}

interface MsgJobFinish {
  action: 'job_finished'
  id: string
}

interface MsgProgress {
  action: 'progress'
  data: {
    progress: {
      maps: number
      distance?: number
    }
    jobId: string
  }
}

interface MsgSetNick {
  action: 'set_nick',
  data: string
}

interface MsgAkn {
  action: 'akn'
  id: string
}

interface MsgFound {
  action: 'found'
  data: string,
  id: string
}

