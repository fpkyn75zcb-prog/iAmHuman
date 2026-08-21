import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export type VerificationRecord = {
  displayName?: string;
  status?: "ACTIVE" | "DISABLED" | "REVOKED";
  cardId?: string;
  createdAt?: unknown;
};

export async function getVerification(id: string): Promise<VerificationRecord | null> {
  const normalizedId = id.trim();
  if (!normalizedId) return null;

  const snapshot = await getDoc(doc(db, "public_verifications", normalizedId));
  if (!snapshot.exists()) return null;

  return snapshot.data() as VerificationRecord;
}
