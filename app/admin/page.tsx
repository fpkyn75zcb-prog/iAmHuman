"use client";

import { FormEvent, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { QRCodeSVG } from "qrcode.react";
import { auth, db } from "../../lib/firebase";

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
  const [loading, setLoading] = useState(true);
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
    } catch {
      setMessage("The record could not be created. Confirm this account is listed in the admins collection.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="verify-shell"><section className="verify-card"><div className="brand">iAmHuman</div><p className="subtitle">Loading admin console…</p></section></main>;

  if (!user) {
    return (
      <main className="verify-shell">
        <section className="verify-card">
          <div className="brand">iAmHuman Admin</div>
          <h1 className="title">Sign in</h1>
          <p className="subtitle">Authorized administrators can issue verification records.</p>
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
        <h1 className="title">Issue a card</h1>
        <p className="subtitle">Signed in as {user.email}</p>
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
        {message && <p className="admin-message">{message}</p>}
        <button className="secondary-button" onClick={() => signOut(auth)}>Sign out</button>
      </section>
    </main>
  );
}
