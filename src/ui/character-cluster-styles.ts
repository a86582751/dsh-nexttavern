/** Integrator mounts with the existing roleplay theme styles. */
export const characterClusterStyles = `
.rp-character-panel { color:var(--dsw-alias-label-primary, inherit); font-size:inherit; }
.rp-character-panel :is(button,input,select,textarea) { max-width:100%; min-width:0; }
.rp-character-panel button { white-space:normal; overflow-wrap:anywhere; }
.rp-character-panel input[type=checkbox] { accent-color:var(--dsh-rp-dialog-accent); margin-inline-end:.5rem; }
.rp-character-panel input[type=search] { width:100%; margin-bottom:.6rem; }
.rp-character-panel textarea { resize:vertical; }
.rp-character-panel :is(input,textarea)::placeholder { color:var(--dsw-alias-label-secondary, #999); }
.rp-character-run { padding:14px; }
.rp-character-run-row { display:flex; justify-content:space-between; align-items:center; gap:10px 20px; flex-wrap:wrap; }
.rp-character-run p, .rp-character-run h4 { margin:0; }
.rp-character-toggle { display:flex; align-items:center; gap:6px; font-weight:600; }
.rp-character-toggle input[type=checkbox] { margin-inline-end:0; }
.rp-character-run-help { margin-top:9px; }
.rp-character-run-help summary { cursor:pointer; }
.rp-character-run-help p { margin-top:6px; max-width:68ch; }
.rp-character-tab { display:grid; gap:14px; min-width:0; }
.rp-cluster-settings { overflow-wrap:anywhere; }
.rp-cluster-settings-field { border-top:1px solid var(--dsw-alias-border-l2, #d8dee8); padding:10px 0; }
.rp-cluster-settings label { display:block; margin:6px 0; }
.rp-cluster-settings :is(select,input[type=number]) { display:block; width:100%; }
.rp-cluster-settings .dsh-rp-btn { margin-block:4px; margin-inline-end:8px; }
.rp-cluster-settings-roster { display:flex; flex-wrap:wrap; gap:4px; }
.dsh-rp-dialog .rp-cluster-settings-roster .dsh-rp-btn[aria-pressed=true],
.dsh-rp-dialog .rp-character-picker.dsh-rp-btn[aria-pressed=true] { border-color:var(--dsh-rp-dialog-accent); }
.rp-character-columns { display:grid; grid-template-columns:minmax(10rem, 15rem) minmax(0,1fr); gap:1.25rem; }
.rp-character-columns aside { display:grid; align-content:start; gap:6px; min-width:0; }
.rp-character-columns aside h4, .rp-character-columns aside p { margin:0; }
.rp-character-columns aside .rp-character-picker { display:flex; align-items:center; justify-content:space-between; gap:8px; margin:0; text-align:start; }
.rp-character-picker span { min-width:0; overflow-wrap:anywhere; }
.rp-character-picker small { flex:none; }
.rp-character-placeholder { margin:0; padding:14px 16px; border-inline-start:3px solid var(--dsh-rp-dialog-accent); background:var(--dsw-alias-bg-layer-2,#f8f9fb); }
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
