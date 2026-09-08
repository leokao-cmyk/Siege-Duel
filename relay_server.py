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
                if room.get(role) is not None:
                    await ws.send(json.dumps({'type': 'error', 'message': f'{role} is already taken in room {room_code}.'}))
                    room_code = None
                    role = None
                    continue
                room[role] = ws
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
    async with websockets.serve(handler, '0.0.0.0', port):
        print(f'Siege Duel relay running on ws://0.0.0.0:{port}')
        await asyncio.Future()

if __name__ == '__main__':
    asyncio.run(main())
