# Core Rules for LifeQuest Development

## 1. Data Persistence is Sacred
- **Rule**: Any update or UI change MUST NOT wipe or corrupt user data (memory).
- **Implementation**: 
  - Never simply catch a JSON parse error and return default state without backing up the original data.
  - When modifying data structures, implement a migration strategy from the old structure to the new one.
  - Ensure `localStorage` keys are stable.
- **Verification**: Check data integrity on app startup. If data appears corrupted, attempt to recover from backup.

## 2. Mobile Experience First
- **Rule**: Updates must verify that the mobile experience remains smooth and usable.
- **Context**: The app is primarily used as a PWA on iPhone.
- **Verification**: Ensure UI elements are touch-friendly and layouts work on small screens.

## 3. Persistent Across Updates
- **Rule**: Updating the application code (e.g., `npm run dev` or deploying new version) must preserve existing `localStorage` data.
