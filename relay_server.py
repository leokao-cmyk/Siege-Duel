import asyncio
import json
import os
import websockets

ROOMS = {}  # room_code -> {'defense': ws|None, 'offense': ws|None}

def other_role(role):
    return 'offense' if role == 'defense' else 'defense'

async def handler(ws):
    room_code = None
    role = None
    try:
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except ValueError:
                continue

            if msg.get('type') == 'join':
                room_code = str(msg.get('room', '')).strip().upper()
                role = msg.get('role')
                if role not in ('defense', 'offense') or not room_code:
                    await ws.send(json.dumps({'type': 'error', 'message': 'Bad join request.'}))
                    room_code = None
                    continue
                room = ROOMS.setdefault(room_code, {'defense': None, 'offense': None})
                # A phone locking, backgrounding, or losing signal can kill a connection without a
                # clean close handshake, and pinging the old socket to check isn't reliable through
                # a proxy (it can only prove the proxy hop is alive, not the real client past it).
                # Simplest robust fix: a fresh join for a role always takes the slot outright and
                # evicts whoever was there — for two friends deliberately joining a shared room
                # code, "never gets permanently stuck" matters far more than guarding against a
                # rare accidental takeover.
                old_sock = room.get(role)
                room[role] = ws
                if old_sock is not None and old_sock is not ws:
                    try:
                        await old_sock.close(code=4000, reason='replaced by a new connection')
                    except Exception:
                        pass
                await ws.send(json.dumps({'type': 'joined', 'role': role, 'room': room_code}))
                peer = room.get(other_role(role))
                if peer is not None:
                    await ws.send(json.dumps({'type': 'peer_joined'}))
                    await peer.send(json.dumps({'type': 'peer_joined'}))
            else:
                if room_code and role:
                    room = ROOMS.get(room_code)
                    if room:
                        peer = room.get(other_role(role))
                        if peer is not None:
                            await peer.send(raw)
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        if room_code and role and room_code in ROOMS:
            room = ROOMS[room_code]
            if room.get(role) is ws:
                room[role] = None
                peer = room.get(other_role(role))
                if peer is not None:
                    try:
                        await peer.send(json.dumps({'type': 'peer_left'}))
                    except Exception:
                        pass
            if not room.get('defense') and not room.get('offense'):
                del ROOMS[room_code]

async def main():
    # Render (and most cloud hosts) assign a port via $PORT; fall back to 8940 for local runs.
    port = int(os.environ.get('PORT', 8940))
    # A stale room slot is now cleaned up by the unconditional-eviction logic above, not by
    # ping timeout, so there's no reason to keep this aggressive. A short ping_timeout was
    # actively harmful on real devices: a phone/tablet briefly throttling JS in the background
    # (or the OS deprioritizing a backgrounded tab for a couple seconds) could miss a single
    # pong and get its otherwise-healthy connection killed by the server. Longer keepalive
    # tolerates that without giving up anything, since eviction already handles reconnects.
    async with websockets.serve(handler, '0.0.0.0', port, ping_interval=20, ping_timeout=20):
        print(f'Siege Duel relay running on ws://0.0.0.0:{port}')
        await asyncio.Future()

if __name__ == '__main__':
    asyncio.run(main())
