# Player and User Account Reconciliation Plan

## Goal
Establish a seamless login flow for players while keeping `users` (auth) and `players` (sports stats & roster) database tables separate, backfilling login accounts for existing players with default password `NoPassword@123`, and enforcing a mandatory password reset guard upon login attempt.

---

## Architectural Strategy

1. **Auto-Provisioning for New Players**:
   - When a Team Manager creates a player with `john@team.com`, backend checks if a `users` record exists for `john@team.com`.
   - If **NO user exists**: Auto-provision a `users` record (`role = 'player'`, `email = john@team.com`, `full_name = player.name`, password hash set to pre-computed bcrypt hash of `NoPassword@123`).
   - Link `players.user_id = new_user.id`.

2. **Backfilling Existing Players**:
   - SQL migration `064_backfill_player_user_accounts.sql`:
     Find all existing rows in `players` where `email IS NOT NULL AND email != '' AND user_id IS NULL`:
     - If a matching `users` row exists: Link `players.user_id = users.id` and update `users.role = 'player'`.
     - If no matching `users` row exists: Auto-create `users` account (`role = 'player'`, pre-computed bcrypt hash of `NoPassword@123`) and link `players.user_id`.

3. **Mandatory Forced Password Reset Guard (Bcrypt Compare)**:
   - In `AuthService.Login`: After verifying password hash matches, check if `user.Password.Matches("NoPassword@123") == (true, nil)`.
   - If it matches `NoPassword@123`, **BLOCK** the login and return an error response:
     `{"error": "MUST_RESET_PASSWORD", "code": "MUST_RESET_PASSWORD", "message": "Default temporary password cannot be used to log in. Please use Forgot Password / Reset Password to set your password."}`
   - Frontend catches `code === 'MUST_RESET_PASSWORD'` and prompts user to reset password.

4. **Auto-Link on Self-Registration**:
   - If a player self-registers at `/register` using their email, backend automatically attaches `role = 'player'` and links `players.user_id`.

---

## Implementation Breakdown

### Task 1: Create SQL Migration `064_backfill_player_user_accounts.sql`
- Write SQL migration in `backend/internal/sql/migrations/064_backfill_player_user_accounts.sql`.
- Pre-compute bcrypt hash of `NoPassword@123` with cost 12.
- Insert missing `users` with `role = 'player'` and set `players.user_id = users.id`.
- Update existing users matching `players.email` to `role = 'player'` and set `players.user_id`.
- **Verification**: Run `go build ./cmd/main/...` and check DB schema migration.

### Task 2: Implement Forced Password Reset Guard in `AuthService.Login`
- In `backend/internal/services/auth_service.go` `Login()`:
  - Add check for `NoPassword@123` match using `user.Password.Matches("NoPassword@123")`.
  - Return custom error `appErrors.ErrMustResetPassword` or `errors.New("MUST_RESET_PASSWORD")`.
- In `backend/internal/transport/auth_handler.go`:
  - Handle `MUST_RESET_PASSWORD` and return HTTP 403 status with `code: "MUST_RESET_PASSWORD"`.
- **Verification**: Unit test or login request with `NoPassword@123` returns HTTP 403 `MUST_RESET_PASSWORD`.

### Task 3: Update `PlayerHandler.CreatePlayer` for Auto-Provisioning
- In `backend/internal/transport/player_handler.go`:
  - Check if `users` account exists for `req.Email`.
  - If missing, call `authRepository.Register` with `NoPassword@123` hashed password and `role = 'player'`.
  - Link `player.UserID = &newUserID`.
- Inject `authRepo ports.IAuthRepository` into `PlayerHandler`.
- **Verification**: Creating a new player automatically creates a `users` record and links `user_id`.

### Task 4: Update `AuthService.Register` for Auto-Linking
- In `backend/internal/services/auth_service.go` `Register()`:
  - When registering a user, check if `players` table has an unlinked record with `LOWER(email) = LOWER(req.Email)`.
  - If found, set `user.Role = 'player'` and auto-link `players.user_id = registered_user_id`.
- **Verification**: Registering a user with a matching player email assigns `player` role and links `user_id`.

### Task 5: Frontend Error Handling in `AuthContext.tsx`
- Catch `code === 'MUST_RESET_PASSWORD'` in `AuthContext.tsx` `login()` and return `{ success: false, mustReset: true, error: message }`.
- In `LoginModal.tsx`, if `mustReset` is true, automatically open Forgot Password / Reset Password modal.
- **Verification**: `npm run build` succeeds with 0 errors.

---

## Done When
- [x] All existing players in the database have a corresponding `users` account with `role = 'player'`.
- [x] Newly created players automatically receive a `users` login account with default password `NoPassword@123`.
- [x] Attempting to log in with `NoPassword@123` is strictly blocked with `MUST_RESET_PASSWORD`.
- [x] `users` and `players` tables remain cleanly separated in the database.

---

## The Build

### Summary of System Enhancements & Accomplishments

All requirements from the specification and architectural design have been fully implemented, tested, built, and committed:

#### 1. Player Authentication Reconciliation & Forced Reset Guard
- **Auto-Provisioned Accounts**: When a Team Manager adds a player, a corresponding `users` account (`role = 'player'`) is auto-provisioned with default password `NoPassword@123`.
- **Database Backfill Migration (`064_backfill_player_user_accounts.sql`)**: Backfilled all unlinked players in the database with matching `users` records and linked `players.user_id`.
- **Forced Password Reset Guard**: In `AuthService.Login`, any login attempt with `NoPassword@123` is blocked with HTTP 403 `MUST_RESET_PASSWORD`. The frontend redirects the user to `/forgot-password` to establish a private password.
- **Auto-Linking**: Self-registering at `/register` with a player's email automatically attaches `role = 'player'` and links `players.user_id`.

#### 2. Match-Triggered Contract Countdown & Notification Cascade
- **Match Finish Trigger**: Marking a match `FINISHED` automatically triggers contract match countdowns scoped strictly to the competing `HomeTeamID` and `AwayTeamID`.
- **Remaining Match Calculation**:
  $$\text{Remaining} = \text{Contract Length} - (\text{Team Finished Matches} - \text{Matches At Start})$$
- **4-Stage Notification Cascade**: Dispatches automated in-app notifications to players and managers at 3 matches left, 2 matches left, 1 match left, and 0 matches left (Free Agency transition).
- **Deduplication**: Added `last_notified_remaining` column to `contracts` to ensure notifications trigger exactly once per threshold.

#### 3. Unified Transfer History Across All Dashboards
- **Player Portal (`/player-portal/transfers`)**: Created dedicated *Transfer History* tab rendering player movement timeline, fee/value, and status.
- **Team Head Dashboard (`/team-head/transfers`)**: Full breakdown of team transfers, active bids, and budget tracking.
- **Admin Dashboard (`/admin/transfers`)**: Added real-time search & filter bar to search transfer activity by Player Name, Team Name, or Transfer Type.

#### 4. Active Roster Locks & Contract Expiry Enforcement
- **Team Sheet Guard**: `SaveTeamSheet` validates at the database level that inserted players hold an active contract with that team (`p.team_id = team_id`).
- **Scheduled Team Sheet Clean-Up (`RemovePlayerFromScheduledTeamSheets`)**: When a contract expires or is terminated, the player is automatically purged from all upcoming `SCHEDULED` match team sheets.
- **Dropdown Scoping**: All player selection dropdowns filter by `p.team_id = team_id`, ensuring free agents or players without active contracts never appear in match team sheet menus.

