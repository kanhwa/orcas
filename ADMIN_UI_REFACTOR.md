# Admin UI Refactor - User Management

## Summary

Refactored the Admin > User Management page to improve UX and reduce visual clutter by consolidating multiple action buttons into a single comprehensive Edit modal with tab navigation.

## Changes Made

### 1. User Sorting

- **Admins First**: Admin users are now displayed at the top of the user list
- **Alphabetical Order**: Within each role (admin/employee), users are sorted by username (case-insensitive)
- **Fallback Sorting**: If usernames match, sort by ID ascending

**Implementation**: `sortUsers()` function

```typescript
function sortUsers(users: AdminUser[]): AdminUser[] {
  return [...users].sort((a, b) => {
    // 1) Role priority: admin = 0, employee = 1
    const rolePriorityA = a.role === "admin" ? 0 : 1;
    const rolePriorityB = b.role === "admin" ? 0 : 1;
    if (rolePriorityA !== rolePriorityB) {
      return rolePriorityA - rolePriorityB;
    }
    // 2) Within same role, sort by username (case-insensitive)
    const usernameCompare = a.username
      .toLowerCase()
      .localeCompare(b.username.toLowerCase());
    if (usernameCompare !== 0) {
      return usernameCompare;
    }
    // 3) Fallback: id ascending
    return a.id - b.id;
  });
}
```

### 2. Simplified Actions Column

**Before**: 4 separate action buttons per row

- Edit (profile/role/status)
- Username (change username)
- Reset Pwd (reset password)
- Delete (delete user)

**After**: Single "Edit" button per row

- Opens comprehensive modal with all actions organized in tabs

### 3. Comprehensive Edit User Modal

The new modal includes 4 tabs for different categories of user management:

#### **Account Tab**

- Edit username
- Change user role (admin/employee)
- Change user status (active/inactive)
- Warnings for admin promotion when at max capacity
- Save button for account settings

#### **Profile Tab**

- Edit first name
- Edit middle name (optional)
- Edit last name
- Edit email address
- Save button for profile information

#### **Security Tab**

- Reset user password
- Confirm password field
- Password validation (min 6 characters, matching confirmation)
- Info message: "Set a new password for this user. Old passwords are never shown."
- Reset button for password

#### **Danger Zone Tab**

- Delete user account
- Delete confirmation: type username or "DELETE" to confirm
- Warnings:
  - Cannot delete yourself
  - Cannot delete the last active admin
- Red styling to indicate dangerous operation

### 4. Removed Components

- ❌ `ResetPasswordModal` (merged into Security tab)
- ❌ `EditUsernameModal` (merged into Account tab)
- ❌ Old separate Edit modal (merged into comprehensive modal)

### 5. Success/Error Messaging

- **Main page**: Success banner for create/delete operations (auto-dismiss after 3s)
- **Within modal**: Success/error messages for individual tab operations
  - Account settings saved
  - Profile updated
  - Password reset
  - Delete errors (validation)

### 6. Validation Logic

- ✅ Prevent deleting yourself (`editingUser.id === user.id`)
- ✅ Prevent deleting last active admin (`adminCount <= 1`)
- ✅ Warn about admin promotion when at max capacity (2/2 admins)
- ✅ Delete confirmation requires typing exact username or "DELETE"
- ✅ Password must match confirmation and be at least 6 characters

## Benefits

### User Experience

1. **Cleaner UI**: Single action button instead of 4 reduces visual noise
2. **Better Organization**: Related settings grouped into logical tabs
3. **Context Retention**: All user management actions in one modal - no context switching
4. **Mobile-Friendly**: Single button works better on smaller screens
5. **Clear Visual Hierarchy**: Danger Zone tab uses red styling to warn users

### Developer Experience

1. **Less Code Duplication**: Reused modal structure for all operations
2. **Easier Maintenance**: Single comprehensive component instead of multiple modals
3. **Better State Management**: All edit state in one place with clear tab navigation
4. **Consistent Validation**: All validation logic in one component

### Admin Visibility

1. **Admins Always Visible**: Sorting ensures admin accounts are at the top
2. **Easy Role Management**: Clear visual distinction with purple badges for admins
3. **Quick Access**: Important privileged accounts are immediately visible

## API Endpoints Used

All existing backend endpoints are reused (no backend changes required):

- `GET /api/admin/users` - Fetch user list
- `GET /api/admin/admin-count` - Check admin capacity
- `PUT /api/admin/users/{id}` - Update user (profile/role/status)
- `PATCH /api/admin/users/{id}/username` - Update username
- `PATCH /api/admin/users/{id}/password` - Reset password
- `DELETE /api/admin/users/{id}` - Delete user

## Commit

```
fd95661 refactor(admin): simplify user management actions and sort admins first
```

## Testing Checklist

- [ ] Admins appear first in the user table
- [ ] Employees are sorted alphabetically within their group
- [ ] Click "Edit" button opens modal with Account tab active
- [ ] Account tab: username, role, status can be changed
- [ ] Profile tab: name and email can be updated
- [ ] Security tab: password can be reset with confirmation
- [ ] Danger Zone tab: delete requires typing username or "DELETE"
- [ ] Cannot delete yourself
- [ ] Cannot delete last active admin
- [ ] Success messages appear and auto-dismiss
- [ ] Validation errors show correctly
- [ ] All tabs maintain state correctly when switching

## Future Enhancements

Potential improvements for future iterations:

1. **Bulk Operations**: Select multiple users for bulk status changes
2. **Search/Filter**: Filter users by role, status, or search by name/username
3. **Pagination**: Handle large user lists with pagination controls
4. **Audit Log**: Show recent actions in a tab (who modified what and when)
5. **Role Permissions**: More granular role-based permissions beyond admin/employee
