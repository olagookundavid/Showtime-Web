# Showtime Web — vMix Broadcast Setup & Operation Guide

This guide describes how to connect the **Showtime Broadcast Studio** graphics engine to **vMix** for live flag football productions.

---

## 1. Architecture Summary

The Showtime broadcast system consists of two connected components:
1. **Producer Control Studio (`/admin/broadcast/:matchId`):**
   - Web application loaded on the graphics operator's laptop or tablet.
   - Provides live controls for the score, countdown game clock, period, down/distance, timeout indicator dots, and lower-third graphics (touchdowns, interceptions, penalties, etc.).
   - Authenticated: accessible to users with roles `broadcast`, `admin`, or `app_admin`.
2. **Transparent vMix Overlay (`/broadcast/:matchId/overlay`):**
   - Public, standalone 1920×1080 transparent canvas designed to be added directly into vMix as a **Web Browser Input**.
   - Streams live updates instantly (< 10ms) from the Go backend via WebSocket.

---

## 2. Setting Up the Overlay in vMix

Follow these steps on the Windows machine running vMix:

1. **Add Web Browser Input:**
   - In vMix, click the **"Add Input"** button in the bottom-left corner.
   - In the left menu of the *Input Select* window, click **"Web Browser"**.

2. **Configure Browser Input Settings:**
   - **URL:** Enter your match's public overlay URL:
     - **Production:** `https://showtimeflag.com/broadcast/<MATCH_ID>/overlay`
     - **Local / LAN Testing:** `http://<IP_OF_SERVER>:5173/broadcast/<MATCH_ID>/overlay`
   - **Width:** `1920`
   - **Height:** `1080`
   - **Allow Transparency:** **CHECKED** (Critical: This allows the video cameras to show through behind the scorebug and graphic banners).
   - Click **OK**.

3. **Assign to vMix Overlay Layer:**
   - On the newly added Web Browser input in vMix, click the **"1"** button (or **"2"**) on the input tile to assign it to **Overlay 1**.
   - The Showtime scorebug will now appear in the top-left corner over your program video feed.

---

## 3. Producer Studio Operation

The broadcast operator/producer controls what appears on air:

1. **Log In to Showtime:**
   - Open a browser on a laptop or tablet and go to `https://showtimeflag.com/login`.
   - Log in with credentials having the `broadcast` (or `admin`/`app_admin`) role.
   - You will automatically land on the **Broadcast Studio** (`/admin/broadcast`).

2. **Select Match:**
   - Click **"Launch Studio"** for the active or upcoming match.

3. **Operating the Controls:**
   - **Scoreboard:** Click up/down or type in numbers for Home and Away scores. Changes reflect on vMix within 10ms.
   - **Timeouts:** Toggle the 3 timeout circles for each team as timeouts are charged.
   - **Clock:**
     - Enter time in `MM:SS` format (e.g. `12:00` or `06:25`) and click **"Set"**.
     - Click **"Start Clock"** to begin the countdown. Click **"Pause Clock"** on whistles or timeouts.
   - **Down & Ball Possession:** Use the dropdown selectors to set down/distance (`1st Down`, `2nd Down`, `3rd Down`, `4th Down`, `1st & Goal`, etc.) and possession.
   - **Scorebug Toggle:** Uncheck **"Show Scorebug on Air"** during pre-game ceremonies, halftime, or commercial breaks.

4. **Triggering Lower-Third Graphics:**
   - Select a player from the roster dropdown (or leave empty for generic calls).
   - Enter or edit the stat line / description.
   - Click any fast-trigger event button (`TOUCHDOWN`, `FIRST DOWN`, `SACK`, `PENALTY`, `INTERCEPTION`, etc.).
   - The animated graphic will slide in on vMix, remain on-air for 5.5 seconds, and cleanly slide out automatically.
   - To dismiss an active graphic early, click **"Hide Graphic Now"**.

5. **Play-by-Play Queue (Manual Trigger Workflow):**
   - Recent plays entered by the stat team appear in the **Play-by-Play Queue** at the bottom of the studio.
   - Click **"PREPARE"** on any play to pre-load the player, team, and play description into the graphic form.
   - Review and adjust the text, then click the trigger button when the television broadcast is ready.

---

## 4. Troubleshooting & Tips

- **Overlay background is black in vMix:**
  - In vMix, right-click the Web Browser input -> click the gear icon (Settings) -> ensure **"Alpha: Transparent"** is selected.
- **vMix does not update when scores change:**
  - Verify that the producer studio shows **"LIVE SYNC ACTIVE"** (emerald pill in the top-right banner).
  - If reconnecting, verify network access and ensure WebSocket port is reachable.
- **Multiple Operators:**
  - Any number of devices can view the overlay simultaneously (e.g. director monitor, stadium jumbo screen, broadcast truck).
