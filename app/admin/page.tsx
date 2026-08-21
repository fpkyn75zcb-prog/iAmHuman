"use client";

import { FormEvent, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { QRCodeSVG } from "qrcode.react";
import { auth, db } from "../../lib/firebase";

type Verification = {
  id: string;
  displayName?: string;
  status?: string;
  verificationStatus?: string;
  cardStatus?: string;
  createdAt?: { seconds: number } | null;
};

function createVerificationId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `IAH-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [createdId, setCreatedId] = useState("");
  const [records, setRecords] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => onAuthStateChanged(auth, (nextUser) => {
    setUser(nextUser);
    setLoading(false);
  }), []);

  async function login(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch {
      setMessage("Login failed. Check the email and password.");
    } finally {
      setBusy(false);
    }
  }

  async function loadRecords() {
    if (!user) return;
    setLoadingRecords(true);
    try {
      const snapshot = await getDocs(collection(db, "public_verifications"));
      const nextRecords = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as Verification[];
      nextRecords.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      setRecords(nextRecords);
    } catch {
      setMessage("Cards could not be loaded. Confirm this account is an administrator.");
    } finally {
      setLoadingRecords(false);
    }
  }

  useEffect(() => {
    if (user) void loadRecords();
  }, [user]);

  async function issueCard(event: FormEvent) {
    event.preventDefault();
    if (!user || !displayName.trim()) return;
    setBusy(true);
    setMessage("");
    const id = createVerificationId();
    try {
      await setDoc(doc(db, "public_verifications", id), {
        displayName: displayName.trim(),
        status: "ACTIVE",
        verificationStatus: "VERIFIED",
        cardStatus: "ACTIVE",
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });
      setCreatedId(id);
      setDisplayName("");
      setMessage("Verification record created.");
      await loadRecords();
    } catch {
      setMessage("The record could not be created. Confirm this account is listed in the admins collection.");
    } finally {
      setBusy(false);
    }
  }

  async function updateRecord(id: string, field: "displayName" | "cardStatus" | "verificationStatus" | "status", value: string) {
    setMessage("");
    try {
      await updateDoc(doc(db, "public_verifications", id), { [field]: value });
      setRecords((current) => current.map((record) => record.id === id ? { ...record, [field]: value } : record));
      setMessage("Card updated.");
    } catch {
      setMessage("The card could not be updated.");
    }
  }

  async function copyUrl(id: string) {
    const url = `${window.location.origin}/verify/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Verification URL copied.");
    } catch {
      setMessage("The URL could not be copied. Copy it from the verification page instead.");
    }
  }

  if (loading) return <main className="verify-shell"><section className="verify-card"><div className="brand">iAmHuman</div><p className="subtitle">Loading admin console…</p></section></main>;

  if (!user) {
    return (
      <main className="verify-shell">
        <section className="verify-card">
          <div className="brand">iAmHuman Admin</div>
          <h1 className="title">Sign in</h1>
          <p className="subtitle">Authorized administrators can issue and manage verification records.</p>
          <form onSubmit={login} className="admin-form">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Admin email" required />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" required />
            <button disabled={busy} type="submit">{busy ? "Signing in…" : "Sign in"}</button>
          </form>
          {message && <p className="admin-message">{message}</p>}
        </section>
      </main>
    );
  }

  const verificationUrl = createdId && typeof window !== "undefined"
    ? `${window.location.origin}/verify/${createdId}`
    : "";

  return (
    <main className="verify-shell">
      <section className="verify-card">
        <div className="brand">iAmHuman Admin</div>
        <h1 className="title">Card management</h1>
        <p className="subtitle">Signed in as {user.email}</p>

        <h2 className="admin-section-title">Issue a card</h2>
        <form onSubmit={issueCard} className="admin-form">
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Person or card display name" required />
          <button disabled={busy} type="submit">{busy ? "Creating…" : "Create verification"}</button>
        </form>

        {createdId && (
          <div className="profile">
            <div className="profile-label">Verification ID</div>
            <div className="profile-value">{createdId}</div>
            <div className="qr-wrap"><QRCodeSVG value={verificationUrl} size={180} includeMargin /></div>
            <div className="url">{verificationUrl}</div>
            <div className="footer">Write this URL to the NTAG215 NFC card.</div>
          </div>
        )}

        <h2 className="admin-section-title">Issued cards</h2>
        {loadingRecords ? (
          <p className="subtitle">Loading cards…</p>
        ) : records.length === 0 ? (
          <p className="subtitle">No verification records found.</p>
        ) : (
          <div className="admin-records">
            {records.map((record) => (
              <article className="admin-record" key={record.id}>
                <div className="profile-label">Verification ID</div>
                <div className="profile-value">{record.id}</div>

                <label>Display name
                  <input
                    value={record.displayName ?? ""}
                    onChange={(e) => setRecords((current) => current.map((item) => item.id === record.id ? { ...item, displayName: e.target.value } : item))}
                    onBlur={(e) => void updateRecord(record.id, "displayName", e.target.value.trim())}
                  />
                </label>

                <label>Card status
                  <select value={record.cardStatus ?? "ACTIVE"} onChange={(e) => void updateRecord(record.id, "cardStatus", e.target.value)}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="REVOKED">REVOKED</option>
                  </select>
                </label>

                <label>Verification status
                  <select value={record.verificationStatus ?? "VERIFIED"} onChange={(e) => void updateRecord(record.id, "verificationStatus", e.target.value)}>
                    <option value="VERIFIED">VERIFIED</option>
                    <option value="UNVERIFIED">UNVERIFIED</option>
                  </select>
                </label>

                <label>Public record status
                  <select value={record.status ?? "ACTIVE"} onChange={(e) => void updateRecord(record.id, "status", e.target.value)}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="REVOKED">REVOKED</option>
                  </select>
                </label>

                <button className="secondary-button" onClick={() => void copyUrl(record.id)}>Copy verification URL</button>
                <a className="footer" href={`/verify/${record.id}`} target="_blank" rel="noreferrer">Open public verification</a>
              </article>
            ))}
          </div>
        )}

        {message && <p className="admin-message">{message}</p>}
        <button className="secondary-button" onClick={() => signOut(auth)}>Sign out</button>
      </section>
    </main>
  );
}
