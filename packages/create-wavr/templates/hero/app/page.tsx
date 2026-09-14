import { WavrBackground } from "../components/WavrBackground";

export default function Page() {
  return (
    <main className="page">
      <WavrBackground />
      <section className="content">
        <p className="kicker">Wavr</p>
        <h1>Motion the page is made of.</h1>
        <p className="lede">
          A generated shader landing page. Tweak the gradient in the preview editor,
          then Apply to write <code>wavr.config.ts</code>.
        </p>
        <div className="row">
          <a className="btn" href="#start">Start building</a>
          <a className="ghost" href="https://github.com/litterthanlit/wavr">GitHub</a>
        </div>
      </section>
    </main>
  );
}
