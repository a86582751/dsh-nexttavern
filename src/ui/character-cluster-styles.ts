/** Integrator mounts with the existing roleplay theme styles. */
export const characterClusterStyles = `
.rp-character-panel { color:var(--dsw-alias-label-primary, inherit); font-size:inherit; }
.rp-character-panel :is(button,input,select,textarea) { box-sizing:border-box; max-width:100%; min-width:0; font:inherit; color:inherit; border:1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35)); border-radius:8px; background:var(--dsw-alias-bg-layer-2, transparent); }
.rp-character-panel :is(button,select,input:not([type=checkbox]),textarea) { min-height:40px; padding:8px 12px; }
.rp-character-panel button { appearance:none; cursor:pointer; white-space:normal; overflow-wrap:anywhere; line-height:1.5; }
.rp-character-panel button:hover:not(:disabled) { border-color:var(--dsw-alias-brand-primary, #956b36); }
.rp-character-panel :is(button,input,select,textarea):disabled { opacity:.55; cursor:not-allowed; }
.rp-character-panel input[type=checkbox] { accent-color:var(--dsw-alias-brand-primary, #956b36); margin-inline-end:.5rem; }
.rp-character-panel input[type=search] { width:100%; margin-bottom:.6rem; }
.rp-character-panel textarea { resize:vertical; }
.rp-character-panel :is(input,textarea)::placeholder { color:var(--dsw-alias-label-secondary, #999); }
.rp-character-panel [role=tablist] { display:flex; gap:.5rem; flex-wrap:wrap; border-bottom:1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35)); padding-bottom:.6rem; }
.rp-character-panel [role=tablist] [role=tab] { flex:1 1 8rem; margin:0; text-align:center; background:transparent; border-color:transparent; }
.rp-character-panel [role=tablist] [role=tab][aria-selected=true] { font-weight:700; background:var(--dsw-alias-bg-layer-2, transparent); border-color:var(--dsw-alias-brand-primary, #956b36); color:var(--dsw-alias-brand-primary, #956b36); }
.rp-character-panel :is(button,input,select,textarea):focus-visible { outline:2px solid var(--dsw-alias-brand-primary, #956b36); outline-offset:3px; }
.rp-character-columns { display:grid; grid-template-columns:minmax(10rem, 15rem) minmax(0,1fr); gap:1.25rem; padding-top:1rem; }
.rp-character-columns aside { min-width:0; }
.rp-character-columns :is(article,section,p) { min-width:0; overflow-wrap:anywhere; }
.rp-character-columns article { max-width:52rem; line-height:1.7; }
.rp-character-columns article section { border-top:1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35)); padding:1rem 0; }
.rp-character-columns textarea { width:100%; min-height:9rem; box-sizing:border-box; line-height:1.7; }
.rp-character-columns button { margin:.3rem .5rem .3rem 0; }
@media(max-width:640px) {
  .rp-character-columns { grid-template-columns:minmax(0,1fr); }
  .rp-character-columns.has-selection aside { display:none; }
  .rp-character-columns:not(.has-selection) article { display:none; }
}
`
