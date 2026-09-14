import { WavrBackground } from "../components/WavrBackground";

export default function Page() {
  return (
    <main className="page">
      <WavrBackground />
      <section className="content">
        <p className="kicker">Product</p>
        <h1>Shader backgrounds, shipped.</h1>
        <p className="lede">
          Drop Wavr behind a product story. Edit the gradient live in the IDE preview,
          then keep the config in source.
        </p>
        <div className="row">
          <a className="btn" href="#features">See features</a>
          <a className="ghost" href="#docs">Read the skill</a>
        </div>
      </section>
      <section className="features" id="features">
        <article className="card">
          <h2>Runtime</h2>
          <p><code>@wavr/gradient</code> renders the same WebGL engine as the Wavr editor.</p>
        </article>
        <article className="card">
          <h2>Preview editor</h2>
          <p>Presets, colors, speed, and effects overlay the page during <code>next dev</code>.</p>
        </article>
        <article className="card">
          <h2>Apply</h2>
          <p>Writes <code>wavr.config.ts</code> so agents can read the result after you tweak.</p>
        </article>
      </section>
    </main>
  );
}
