import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Mic, MicOff, Video, VideoOff } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Button } from '@/components/ui/button'
import { meetingApi } from '@/services/meetingApi'
import { getSocket } from '@/services/socket'
import { useAppSelector } from '@/store'
import { cn } from '@/utils/cn'

type PeerState = {
  socketId: string
  userId: string
  pc: RTCPeerConnection
  stream?: MediaStream
}

const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }]

export function MeetingRoomPage() {
  const { meetingId } = useParams<{ meetingId: string }>()
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)
  const currentUserId = useAppSelector((s) => s.auth.user?.id)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const peersRef = useRef<Map<string, PeerState>>(new Map())
  const localStreamRef = useRef<MediaStream | null>(null)
  const roomIdRef = useRef<string | null>(null)

  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Array<{ id: string; stream: MediaStream }>>([])
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [status, setStatus] = useState('Connecting…')

  const meetingQuery = useQuery({
    queryKey: ['meeting', meetingId],
    queryFn: () => meetingApi.get(meetingId!),
    enabled: Boolean(meetingId),
  })

  const meeting = meetingQuery.data
  const roomId = meeting?.roomId || meeting?.id || meetingId

  const refreshRemoteStreams = useCallback(() => {
    const next: Array<{ id: string; stream: MediaStream }> = []
    for (const [id, peer] of peersRef.current) {
      if (peer.stream) next.push({ id, stream: peer.stream })
    }
    setRemoteStreams(next)
  }, [])

  const createPeer = useCallback(
    (socketId: string, userId: string, initiator: boolean) => {
      if (peersRef.current.has(socketId)) return peersRef.current.get(socketId)!

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      const local = localStreamRef.current
      if (local) {
        for (const track of local.getTracks()) {
          pc.addTrack(track, local)
        }
      }

      pc.ontrack = (event) => {
        const stream = event.streams[0]
        const existing = peersRef.current.get(socketId)
        if (existing) {
          existing.stream = stream
          peersRef.current.set(socketId, existing)
          refreshRemoteStreams()
        }
      }

      pc.onicecandidate = (event) => {
        if (!event.candidate || !roomIdRef.current) return
        getSocket()?.emit('meeting:signal', {
          roomId: roomIdRef.current,
          toSocketId: socketId,
          data: { type: 'ice', candidate: event.candidate },
        })
      }

      const peer: PeerState = { socketId, userId, pc }
      peersRef.current.set(socketId, peer)

      if (initiator) {
        void pc.createOffer().then((offer) => {
          void pc.setLocalDescription(offer)
          getSocket()?.emit('meeting:signal', {
            roomId: roomIdRef.current,
            toSocketId: socketId,
            data: { type: 'offer', sdp: offer },
          })
        })
      }

      return peer
    },
    [refreshRemoteStreams],
  )

  useEffect(() => {
    if (!roomId || !currentUserId) return

    roomIdRef.current = roomId
    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        localStreamRef.current = stream
        setLocalStream(stream)
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }
        setStatus('Waiting for peers…')
      } catch {
        setStatus('Camera/microphone access denied')
        return
      }

      const socket = getSocket()
      if (!socket) {
        setStatus('Socket not connected')
        return
      }

      socket.emit('meeting:join', { roomId }, (res: { success?: boolean }) => {
        if (res?.success) setStatus('In room')
      })

      const onPeerJoined = (payload: { roomId: string; userId: string; socketId: string }) => {
        if (payload.roomId !== roomId || payload.userId === currentUserId) return
        createPeer(payload.socketId, payload.userId, true)
      }

      const onPeerLeft = (payload: { socketId: string }) => {
        const peer = peersRef.current.get(payload.socketId)
        if (peer) {
          peer.pc.close()
          peersRef.current.delete(payload.socketId)
          refreshRemoteStreams()
        }
      }

      const onSignal = async (payload: {
        fromSocketId: string
        fromUserId: string
        roomId: string
        data: { type: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }
      }) => {
        if (payload.roomId !== roomId) return
        let peer = peersRef.current.get(payload.fromSocketId)
        if (!peer) {
          peer = createPeer(payload.fromSocketId, payload.fromUserId, false)
        }

        const { data } = payload
        if (data.type === 'offer' && data.sdp) {
          await peer.pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
          const answer = await peer.pc.createAnswer()
          await peer.pc.setLocalDescription(answer)
          socket.emit('meeting:signal', {
            roomId,
            toSocketId: payload.fromSocketId,
            data: { type: 'answer', sdp: answer },
          })
        } else if (data.type === 'answer' && data.sdp) {
          await peer.pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
        } else if (data.type === 'ice' && data.candidate) {
          try {
            await peer.pc.addIceCandidate(new RTCIceCandidate(data.candidate))
          } catch {
            // ignore stale ICE
          }
        }
      }

      socket.on('meeting:peer-joined', onPeerJoined)
      socket.on('meeting:peer-left', onPeerLeft)
      socket.on('meeting:signal', onSignal)

      return () => {
        socket.off('meeting:peer-joined', onPeerJoined)
        socket.off('meeting:peer-left', onPeerLeft)
        socket.off('meeting:signal', onSignal)
        socket.emit('meeting:leave', { roomId })
        for (const peer of peersRef.current.values()) {
          peer.pc.close()
        }
        peersRef.current.clear()
        localStreamRef.current?.getTracks().forEach((t) => t.stop())
        localStreamRef.current = null
      }
    }

    const cleanupPromise = start()

    return () => {
      cancelled = true
      void cleanupPromise.then((cleanup) => cleanup?.())
    }
  }, [roomId, currentUserId, createPeer, refreshRemoteStreams])

  const toggleVideo = () => {
    const next = !videoEnabled
    localStream?.getVideoTracks().forEach((t) => {
      t.enabled = next
    })
    setVideoEnabled(next)
  }

  const toggleAudio = () => {
    const next = !audioEnabled
    localStream?.getAudioTracks().forEach((t) => {
      t.enabled = next
    })
    setAudioEnabled(next)
  }

  if (meetingQuery.isLoading) return <LoadingState />
  if (meetingQuery.isError) {
    return <ErrorState onRetry={() => void meetingQuery.refetch()} />
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Video"
        title={meeting?.title || 'Meeting room'}
        description={status}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/app/meetings">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to meetings
            </Link>
          </Button>
        }
      />

      <div
        className={cn(
          'grid gap-3',
          remoteStreams.length > 0 ? 'sm:grid-cols-2' : 'grid-cols-1',
        )}
      >
        <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-muted">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="h-full w-full object-cover"
          />
          <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">
            You {orgId ? '' : ''}
          </span>
        </div>
        {remoteStreams.map(({ id, stream }) => (
          <RemoteVideo key={id} stream={stream} label="Participant" />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant={videoEnabled ? 'secondary' : 'outline'} size="sm" onClick={toggleVideo}>
          {videoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          Camera
        </Button>
        <Button variant={audioEnabled ? 'secondary' : 'outline'} size="sm" onClick={toggleAudio}>
          {audioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          Mic
        </Button>
        <p className="text-xs text-muted-foreground">
          Mesh WebRTC — works best with 1–2 peers on the same network.
        </p>
      </div>
    </div>
  )
}

function RemoteVideo({ stream, label }: { stream: MediaStream; label: string }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])

  return (
    <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-muted">
      <video ref={ref} autoPlay playsInline className="h-full w-full object-cover" />
      <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">
        {label}
      </span>
    </div>
  )
}
