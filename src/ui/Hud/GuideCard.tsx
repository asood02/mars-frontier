import { useGame } from '../../store';
import { RESOURCES } from '../../game/types';
import {
  RESOURCE_META,
  BUILDING_META,
  BUILDABLES,
  producedByTerrains,
  usedForBuildings,
  costPairs,
} from '../format';

// On-demand reference card (like Catan's): what each resource does and what each
// building costs/gives. Pure — derived entirely from game constants.
export default function GuideCard() {
  const close = useGame((s) => s.closeGuide);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
      onClick={close}
    >
      <div
        role="dialog"
        aria-label="Game guide"
        className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-3xl bg-space border border-cyan/40 p-8 shadow-[0_0_60px_rgba(0,217,255,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <p className="font-sans tracking-[0.35em] text-cyan/70 text-xs">GUIDE</p>
          <button
            onClick={close}
            aria-label="Close guide"
            className="w-7 h-7 rounded-full border border-white/20 text-white/60 text-sm hover:bg-white/10 transition"
          >
            ✕
          </button>
        </div>

        {/* Resources */}
        <h2 className="font-display text-2xl text-mars mb-3">Resources</h2>
        <div className="space-y-2 mb-8">
          {RESOURCES.map((r) => (
            <div
              key={r}
              className="flex items-start gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3"
            >
              <span
                style={{ color: RESOURCE_META[r].color }}
                className="font-display text-lg font-bold w-12 shrink-0"
              >
                {RESOURCE_META[r].glyph}
              </span>
              <div className="min-w-0">
                <div className="font-display font-semibold">{RESOURCE_META[r].label}</div>
                <div className="text-xs text-white/55 leading-relaxed">
                  <span className="text-white/40">Produced by</span>{' '}
                  {producedByTerrains(r).join(', ') || '—'}
                  <span className="mx-2 text-white/20">•</span>
                  <span className="text-white/40">Used for</span>{' '}
                  {usedForBuildings(r).join(', ') || '—'}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Buildings */}
        <h2 className="font-display text-2xl text-mars mb-3">Buildings</h2>
        <div className="space-y-2">
          {BUILDABLES.map((b) => (
            <div
              key={b}
              className="flex items-start gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3"
            >
              <span className="text-xl w-12 shrink-0 text-center text-white/80">
                {BUILDING_META[b].icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display font-semibold">{BUILDING_META[b].label}</span>
                  <span className="text-xs text-cyan/80 shrink-0">{BUILDING_META[b].vp}</span>
                </div>
                <div className="text-xs text-white/55 leading-relaxed">{BUILDING_META[b].gives}</div>
                <div className="mt-1 flex items-center gap-2 text-sm">
                  <span className="text-white/40 text-xs uppercase tracking-wide">Cost</span>
                  {costPairs(b).map(([res, amt]) => (
                    <span key={res} style={{ color: RESOURCE_META[res].color }}>
                      {amt}
                      {RESOURCE_META[res].glyph}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
