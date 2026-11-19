# Crowd Score

A host-led survey guessing game for six teams, using published YouGov poll results.

## Run on a local network

1. Install Node.js 24 or later.
2. Start the server with `npm run dev`.
3. On the host laptop, open `http://localhost:3000` and create a room.
4. Connect the phones and laptop to the same Wi-Fi. On the phones, open `http://<host-laptop-LAN-IP>:3000` and enter the room code. Allow incoming connections to port 3000 on the laptop if needed. For spectators, choose **Watch live** with the same room code, or use the spectator link from the host's lobby. Copy links from the laptop's LAN-IP page if you plan to share those links with phones.

The local server keeps rooms in memory until it stops. Room codes expire after 12 hours.

## Test with AI teams

Create a room on the host screen and join as a human team from a phone or a private browser window. In the host lobby, choose **Start with 5 AI teams**. With two to five human teams, the button fills only the remaining slots.

AI teams automatically lock one randomly selected survey answer per question. They earn points and advance under the same rules as human teams. The host still controls reveals, advancement, and tiebreakers.

## Choose or write questions

In the host lobby, choose **Edit questions**. Each round starts with five preselected questions. For each slot, choose any of the 50 fixed YouGov questions or select **Write a custom question** and enter 2–10 answers with points. Each YouGov question can appear once per game. Use one answer per line in the format `Answer | Points | Alternate spelling`. Points are whole numbers from 1 to 100. Add optional alternate spellings with extra pipe separators.

Save before starting. The questions apply to that room, and players see the answers when the host reveals them.

## Game format

- Opening round: six teams answer five questions. Four advance.
- Semifinal: four teams answer five questions. Two advance.
- Face-off: two teams answer five questions. The higher score wins.

Active teams start each round at zero. Each team can lock one guess per question. Matching answers earn the published survey percentage or host-assigned points. The host reveals each answer board, confirms who advances, and starts the next round. For a tie at the cutoff, the host runs a tiebreaker and selects the winning team or teams on the host screen.

Spectators can watch the scoreboard, reveals, and advancement screens without taking a team slot. The source poll is linked on each reveal.

## Quit or restart

Use **Quit** to return to the home screen on your device. Once a game starts, the host can choose **Start over** to return everyone to the lobby and reset scores, guesses, and advancement. The room code, teams, and saved questions carry over.

## Source layout

The game rules and API are in `worker/index.js`, the phone and host screens in `worker/page.js`, and the survey question bank in `worker/polls.js`. The server uses the schema in `drizzle/0000_rooms.sql`. A hosted deployment needs a Worker-compatible runtime and a shared D1 database. GitHub holds the source.
