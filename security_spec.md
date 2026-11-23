# PrintDesk Firestore Security Specification

## 1. Data Invariants
1. Every order, client, and setting document resides strictly under `/users/{userId}/...` where `userId == request.auth.uid` and `request.auth.token.email_verified == true`.
2. Every document in `orders`, `clients`, and `settings` stores `ownerId == request.auth.uid`, which is immutable after creation.
3. `createdAt` is strictly validated against `request.time` on creation and immutable on updates; `updatedAt` is strictly validated against `request.time` on both creation and updates.
4. Array fields (`files` <= 20 items, `emailHistory` <= 50 items) are bounded and type-guarded.
5. `workStatus` is strictly constrained to `['belum_dp', 'dalam_proses', 'selesai']` and `paymentStatus` to `['belum_dp', 'sudah_dp', 'lunas']`.
6. Financial amounts (`totalPrice`, `dpAmount`, `remainingAmount`) must be numeric and non-negative (`>= 0`).
7. Optional `salesName` on orders is a string up to 60 characters; optional `salesNames` on settings is a list of up to 20 strings (max 60 characters each).

## 2. Dirty Dozen Attack Vectors (Verified Denied)
1. Unauthenticated read/write to `/users/uid/orders/o1`.
2. Unverified email user (`email_verified: false`) attempting write.
3. Cross-tenant access: user A reading/writing `/users/userB/orders/o1`.
4. Identity spoofing: user A creating order under `/users/userA/orders/o1` with `ownerId: "userB"`.
5. Ghost/shadow field injection: adding `isAdmin: true` on create or update.
6. ID poisoning: creating a document with an ID > 128 chars or special characters like `../admin`.
7. Timestamp spoofing: passing arbitrary client `createdAt` or mutating `createdAt` on update.
8. Negative financial values: setting `totalPrice: -50000` or `dpAmount: -100`.
9. Invalid status enum: setting `workStatus: "hacked"`.
10. Unbounded array DoS: injecting > 20 files or > 50 emailHistory entries.
11. Resource exhaustion string: injecting > 1000 chars into `notes` or > 120 chars into `clientName`.
12. Blanket user listing: running `list` on `/users` collection.
