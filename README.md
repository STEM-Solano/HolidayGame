# Crowd Score

A host-led survey guessing game for six teams, using published YouGov poll results.

## Run on a local network

1. Install Node.js 24 or later.
2. Start the server with `npm run dev`.
3. On the host laptop, open `http://localhost:3000` and create a room.
4. Connect the phones and laptop to the same Wi-Fi. On the phones, open `http://<host-laptop-LAN-IP>:3000` and enter the room code. Allow incoming connections to port 3000 on the laptop if needed. For spectators, choose **Watch live** with the same room code, or use the spectator link from the host's lobby. Copy links from the laptop's LAN-IP page if you plan to share those links with phones.

The local server keeps rooms in memory until it stops. Room codes expire after 12 hours.

## Game format

- Opening round: six teams answer two questions. Four advance.
- Semifinal: four teams answer two questions. Two advance.
- Face-off: two teams answer two questions. The higher score wins.

Active teams start each round at zero. Each team can lock one guess per question. Matching answers earn the corresponding published survey percentage as points. The host reveals each answer board, confirms who advances, and starts the next round. For a tie at the cutoff, the host runs a tiebreaker and selects the winning team or teams on the host screen.

Spectators can watch the scoreboard, reveals, and advancement screens without taking a team slot. The source poll is linked on each reveal.

## Source layout

The game rules and API are in `worker/index.js`, the phone and host screens in `worker/page.js`, and the survey question bank in `worker/polls.js`. The server uses the schema in `drizzle/0000_rooms.sql`. A hosted deployment needs a Worker-compatible runtime and a shared D1 database. GitHub holds the source.
