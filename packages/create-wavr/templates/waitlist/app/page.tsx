"use client";

import { FormEvent } from "react";
import { WavrBackground } from "../components/WavrBackground";

export default function Page() {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <main className="page">
      <WavrBackground />
      <section className="content">
        <p className="kicker">Early access</p>
        <h1>Join the waitlist.</h1>
        <p className="lede">
          Leave an email and keep the shader. The preview editor lets you restyle
          the hero without leaving Cursor, Claude Code, or Codex.
        </p>
        <form className="row" onSubmit={onSubmit}>
          <input type="email" name="email" placeholder="you@studio.com" required />
          <button className="btn" type="submit">Notify me</button>
        </form>
      </section>
    </main>
  );
}
