# iAmHuman

Identity verification using an NFC/QR card and a public Firestore verification record.

## Verification flow

NTAG215 NFC card or QR code → `/verify/{verificationId}` → Firestore → ACTIVE = VERIFIED.

## Firestore collection

`public_verifications/{verificationId}`

Example document:

- `displayName`: `iAmHuman Demo`
- `status`: `ACTIVE`
- `verificationStatus`: `VERIFIED`
- `cardStatus`: `ACTIVE`

Only minimal public verification data belongs in this collection. Private identity information should not be stored here.
