# Roundtable

A video meeting room, built for the CodeAlpha Full Stack Development
internship (Task 4).

## Features

- Registration and sign-in with a bcrypt-hashed password and an httpOnly session cookie
- Multi-party video and audio over WebRTC, up to six people in a room
- Screen sharing, swapped in without renegotiating the call
- File sharing straight between browsers, in chunks, with a progress bar
- A shared whiteboard; strokes are sent over the same peer connections
- Rooms with a shareable link, and a record of who joined and when

## How the call is put together

The server only does signalling. It relays the offers, answers, and ICE
candidates that let two browsers find each other, and after that the media,
the files, and the whiteboard strokes travel directly between them. Nothing
that happens inside a call passes through the server or is written to disk.

Connections form a full mesh: each browser holds one `RTCPeerConnection` per
other person. That is simple and needs no media server, but the number of
connections grows with the square of the room size, which is why rooms are
capped at six. A larger call would need a selective forwarding unit.

The newcomer to a room is the one who sends offers to everyone already there,
so two peers never send each other an offer at the same time.

## Encryption

WebRTC encrypts by default and cannot be turned off: audio and video are
carried over SRTP with keys agreed by DTLS, and the data channel used for
files and the whiteboard is DTLS too. Because the server never handles that
traffic, calls are end to end encrypted between participants.

Around the call: passwords are stored as bcrypt hashes, the session is a
signed JWT in an httpOnly, sameSite cookie, and the signalling socket is
closed on upgrade unless it presents that cookie and names a room that exists.
A relayed message can only reach a peer in the sender's own room.

This is the encryption WebRTC gives you. It is not a custom end-to-end scheme
layered on top, and it does not hide who is talking to whom from the server.

## Tech stack

- Frontend: HTML, CSS, vanilla JavaScript, WebRTC (no build step)
- Backend: Node.js, Express, ws
- Database: PostgreSQL
- Docker Compose for local setup

## Running it

Requires Docker Desktop.

```bash
cp .env.example .env      # set POSTGRES_PASSWORD, DATABASE_URL, and JWT_SECRET
docker compose up --build
```

Open http://localhost:4003, create a room, and open the same link in a second
browser window signed in as a different account.

Browsers only allow camera and microphone access on `localhost` or over HTTPS,
so a deployment needs a TLS certificate. Two peers on different networks may
also need a TURN server; set `STUN_URLS` in `.env` to a comma separated list to
change the ICE servers without rebuilding.

## Layout

```
server/index.js       express app, http server, ICE config endpoint
server/db.js          connection pool, applies db/schema.sql on boot
server/auth.js        register, sign in, sign out, shared token check
server/signalling.js  WebSocket rooms and message relay
server/routes/rooms.js
public/js/peers.js    the mesh of peer connections
public/js/media.js    camera, microphone, screen share
public/js/transfer.js chunked file sending over the data channel
public/js/whiteboard.js
db/schema.sql
```
