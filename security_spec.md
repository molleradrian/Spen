# Security Specification - S Pen Draw Pro

## Data Invariants
- A drawing must be owned by a user.
- Users can only read/write their own drawings.
- Timestamps must be server-generated.

## The Dirty Dozen Payloads
1. Create drawing for another user ID.
2. Update someone else's drawing.
3. Delete someone else's drawing.
4. List all drawings without filtering by userId.
5. Inject massive strings into the title.
6. Bypass server timestamps on creation.
7. Bypass server timestamps on update.
8. Create drawing without a userId.
9. Create drawing with invalid ID format.
10. Update drawing to change ownerId.
11. Read a drawing knowing only its ID (if not owner).
12. Bulk download drawings of other users.

## Rule Generation logic...
