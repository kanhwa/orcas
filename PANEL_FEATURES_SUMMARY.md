# ORCAS Panel Features Implementation Summary

## Overview
Implemented three features for ORCAS (Vite React + TypeScript frontend, FastAPI backend):
- **Feature A**: Default letter avatar display
- **Feature B**: Remove avatar functionality
- **Feature C**: Admin password reset + username edit

## Implementation Details

### FEATURE A — Default Avatar (Letter)
**Component**: `frontend/src/components/AvatarBadge.tsx` (new)

Reusable component that displays:
- User avatar image if `avatar_url` exists
- Fallback: circular badge with first letter of username (uppercase) on white background
- Supports 3 sizes: `sm` (8x8), `md` (10x10), `lg` (16x16)

**Usage Locations**:
1. **Header** (`frontend/src/components/layout/AppShell.tsx`) - Top-right user menu
2. **Profile page** (`frontend/src/pages/Profile.tsx`) - Avatar section

**Backend**:
- Migration added: `backend/alembic/versions/20260109_add_avatar_url.py`
- Added `avatar_url` column to `users` table (nullable string)
- Updated `UserMeResponse` schema to include `avatar_url`

### FEATURE B — Remove Avatar
**Backend Endpoint**: `DELETE /api/auth/avatar`
- Auth required (uses session cookie)
- Deletes avatar file from disk (best-effort; ignores missing files)
- Sets `avatar_url` to NULL in database
- Returns updated user payload (same shape as `/api/auth/me`)

**Frontend**:
- Added `deleteAvatar()` function to `api.ts`
- Added "Remove" button next to "Upload Avatar" in Profile page
- Button only visible if user has an avatar
- On success: user state updates immediately, session remains valid
- Error handling with user-friendly messages

**Files Changed**:
- `backend/app/api/routes/auth.py` - Added DELETE endpoint
- `frontend/src/services/api.ts` - Added deleteAvatar() function
- `frontend/src/pages/Profile.tsx` - Added Remove button and handler

### FEATURE C — Admin User Management
**Backend Endpoints** (admin-only, require admin role):

1. **PATCH `/api/admin/users/{user_id}/password`**
   - Body: `{ "password": "NewPassword123!" }`
   - Manual password reset (no verification of old password required)
   - Hashes password using existing `hash_password()` function
   - Returns updated user
   - Audit logged

2. **PATCH `/api/admin/users/{user_id}/username`**
   - Body: `{ "username": "newusername" }`
   - Validates: non-empty, unique across users
   - Returns updated user
   - Audit logged

**Frontend**:
- Added modal dialogs for both operations
- User Management table now has two new action buttons:
  - **"Username"** button - Opens modal to edit username
  - **"Reset Pwd"** button - Opens modal to set new password
- Both actions trigger table refresh on success
- Error handling with validation messages
- Does not reveal old passwords (manual set only)

**Files Changed**:
- `backend/app/api/routes/admin.py` - Added 2 new endpoints + 2 modal request classes
- `frontend/src/pages/Admin.tsx` - Added modals + action buttons + handlers
- `frontend/src/services/api.ts` - Added `adminResetPassword()` and `adminEditUsername()` functions

## Commits
```
08f9aef - feat: default letter avatar (AvatarBadge component)
a044013 - feat: delete/remove avatar (backend DELETE endpoint + frontend UI)
2b52b93 - feat: admin reset password + username edit (backend+frontend)
```

## Testing Verification Commands

### Test DELETE Avatar
```bash
# Login as user
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' \
  -c cookies.txt

# Upload avatar (optional)
curl -X POST http://localhost:8000/api/auth/avatar \
  -F "file=@/path/to/image.png" \
  -b cookies.txt -c cookies.txt

# Delete avatar - should return 200 with avatar_url=null
curl -X DELETE http://localhost:8000/api/auth/avatar \
  -b cookies.txt -c cookies.txt | jq .

# Verify avatar_url is null
curl -X GET http://localhost:8000/api/auth/me \
  -b cookies.txt | jq '.avatar_url'
```

### Test Admin Reset Password
```bash
# Login as admin
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' \
  -c admin_cookies.txt

# Reset employee password (user_id=2 as example)
curl -X PATCH http://localhost:8000/api/admin/users/2/password \
  -H "Content-Type: application/json" \
  -d '{"password": "NewPassword456!"}' \
  -b admin_cookies.txt | jq '.username'

# Verify employee can login with new password
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "employee_username", "password": "NewPassword456!"}' \
  -c employee_cookies.txt | jq '.username'
```

### Test Admin Edit Username
```bash
# Login as admin
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' \
  -c admin_cookies.txt

# Edit employee username (user_id=2 as example)
curl -X PATCH http://localhost:8000/api/admin/users/2/username \
  -H "Content-Type: application/json" \
  -d '{"username": "newusername"}' \
  -b admin_cookies.txt | jq '.username'

# Expected: returns "newusername"

# Verify username is now unique - try to create another user with old username (should succeed)
# And employee can login with new username
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "newusername", "password": "password_unchanged"}' \
  -c employee_cookies.txt | jq '.username'
```

## Frontend Testing
1. **Avatar Display**:
   - Navigate to Profile page
   - See first letter of username in circular badge
   - Upload avatar (PNG/JPG, ≤1MB) → image displays immediately
   - Click "Remove" button → back to letter avatar

2. **Admin Features** (if logged in as admin):
   - Go to Admin > User Management
   - Find any user row
   - Click "Username" button → dialog appears to edit username
   - Click "Reset Pwd" button → dialog appears to set new password
   - After operation, user list refreshes automatically

## Key Design Decisions
- **Session Integrity**: All endpoints maintain session cookie (user_id based)
- **No Password Retrieval**: Admin can only SET passwords, never view/retrieve old ones
- **Consistent Hashing**: Uses same `hash_password()` utility as login authentication
- **Audit Logging**: All admin operations logged to audit_logs table
- **Graceful File Handling**: Avatar file deletion is best-effort (doesn't fail if file missing)
- **Client-side Validation**: File type/size checked before upload to reduce server load

## Session Notes
- Session remains valid after profile/avatar changes (based on user_id)
- After username change, user must re-login with new username (message shown in UI)
- Admin can change their own password/username without forced logout
