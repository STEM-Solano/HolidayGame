# Holiday Team Fused

A host-led survey guessing game for six teams, using published YouGov poll results.

## Run on a local network

1. Install Node.js 24 or later.
2. Start the server with `npm run dev`.
3. On the host laptop, open `http://localhost:3000` and create a room.
4. Connect the phones and laptop to the same Wi-Fi. On the phones, open `http://<host-laptop-LAN-IP>:3000` and enter the room code. Allow incoming connections to port 3000 on the laptop if needed. For spectators, choose **Watch live** with the same room code, or use the spectator link from the host's lobby. Copy links from the laptop's LAN-IP page if you plan to share those links with phones.

The local server keeps rooms in memory until it stops. Rooms close automatically one hour after creation. Start a new room and share its new code or QR link to play again.

## Test with AI teams

Create a room on the host screen and join as a human team from a phone or a private browser window. In the host lobby, choose **Start with 5 AI teams**. With two to five human teams, the button fills only the remaining slots.

AI teams automatically lock one randomly selected dropdown choice per question. They earn points and advance under the same rules as human teams. The host still controls reveals, advancement, and tiebreakers.

## Choose or write questions

In the host lobby, set **Questions per round** to 1–10 (default 5), then choose **Edit questions** to review or replace the preselected questions. For each slot, choose any of the 64 fixed YouGov questions or select **Write a custom question** and enter 2–10 answers with points. Each YouGov question can appear once per game. The 14 original questions at the bottom of the picker are available by manual selection. Use one answer per line in the format `Answer | Points | Alternate spelling`. Points are whole numbers from 1 to 100. Add 2–6 plausible non-scoring choices in the separate field, one per line.

Save before starting. Teams lock in one answer from an alphabetical dropdown containing survey answers and non-scoring choices. Only the host screen displays scores, revealed answers, and the source poll.

## Game format

- Opening round: six teams answer the configured number of questions. Four advance.
- Semifinal: four teams answer the configured number of questions. Two advance.
- Face-off: two teams answer the configured number of questions. The higher score wins.

Team scores carry across all three rounds. The host opens and scores one question at a time with **Reveal results**, then advances to the next question or round. Survey answers earn the published percentage or host-assigned points. Other choices earn zero.

When teams tie for an advancement slot or the championship, the host starts a tiebreaker using a question from the bank. The tied teams start with a separate score of zero. The host can run another tiebreak question if the cutoff is still tied. Regular game scores carry forward without adding the tiebreak points.

Spectators can follow the questions and advancement without taking a team slot.

## Quit or restart

Use **Quit** to return to the home screen on your device. Once a game starts, the host can choose **Start over** to return everyone to the lobby and reset scores, guesses, and advancement. The room code, teams, and saved questions carry over.

## GitHub Pages

In **Settings → Pages**, choose **Deploy from a branch**, then select `main` and `/ (root)` to show these instructions at the GitHub Pages URL. Select `main` and `/docs` to show the hosted-game launcher at that same URL. The hosted game uses its own access settings. To play without accounts on the same Wi-Fi, follow the local network instructions above.

## Source layout

The game rules and API are in `worker/index.js`, the phone and host screens in `worker/page.js`, and the survey question bank in `worker/polls.js`. The server uses the schema in `drizzle/0000_rooms.sql`. A hosted deployment needs a Worker-compatible runtime and a shared D1 database. GitHub holds the source.
