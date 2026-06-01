import { useGame, viewerId } from '../../store';
import { MAX_TERRAFORM, TERRAFORM_MILESTONES, LAKE_THAW_TI } from '../../game/types';

// Shared Terraforming track: a global meter players raise together, racing for
// milestone VP. Past LAKE_THAW_TI the Crater Lakes start producing water.
export default function TerraformMeter() {
  const game = useGame((s) => s.game)!;
  const vid = useGame(viewerId);
  const ti = game.terraformIndex;
  const mine = game.terraformBy?.[vid] ?? 0;
  const pct = (ti / MAX_TERRAFORM) * 100;

  return (
    <div className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-4">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs uppercase tracking-widest text-white/40">Terraforming</span>
        <span className="font-display text-sm text-cyan/80">
          {ti}/{MAX_TERRAFORM}
        </span>
      </div>

      <div className="relative h-3 rounded-full bg-black/40 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg,#8a4526,#facc15,#4ade80)',
          }}
        />
        {/* milestone ticks */}
        {TERRAFORM_MILESTONES.map((m) => (
          <div
            key={m}
            title={`Milestone at ${m} — scores VP`}
            className="absolute top-[-2px] bottom-[-2px] w-px bg-white/50"
            style={{ left: `${(m / MAX_TERRAFORM) * 100}%` }}
          />
        ))}
      </div>

      <p className="mt-2 text-[11px] text-white/45 leading-snug">
        Cross a milestone to score VP{ti < LAKE_THAW_TI ? `; lakes thaw at ${LAKE_THAW_TI}` : ' · lakes flowing'}.
        {mine > 0 && <span className="text-white/65"> You’ve raised it {mine}×.</span>}
      </p>
    </div>
  );
}
