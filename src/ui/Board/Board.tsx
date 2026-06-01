import { useMemo } from 'react';
import { buildBoardGraph } from '../../game/board';
import { useGame } from '../../store';
import { legalMoves, violatesDistanceRule } from '../../game/rules';
import { setupExpectation } from '../../game/reducer';
import Hex from './Hex';
import Edge from './Edge';
import Vertex from './Vertex';
import type { Move } from '../../game/types';

export default function Board() {
  const g = useMemo(() => buildBoardGraph(), []);
  const game = useGame((s) => s.game)!;
  const interaction = useGame((s) => s.interaction);
  const dispatch = useGame((s) => s.dispatch);

  const setup = game.phase === 'setup1' || game.phase === 'setup2';
  const exp = setup ? setupExpectation(game) : null;

  // Play-phase legal targets, derived from the reducer's own enumeration.
  const moves = setup ? [] : legalMoves(game, game.activePlayerId);
  const hasBuild = (b: string) =>
    new Set(
      moves
        .filter((m) => m.type === 'BUILD' && m.building === b)
        .map((m) => (m as Extract<Move, { type: 'BUILD' }>).locationId),
    );
  const legalHabitatV = hasBuild('HABITAT');
  const legalDomeV = hasBuild('DOME');
  const legalCommV = hasBuild('COMM_TOWER');
  const legalRouteE = new Set(
    moves
      .filter((m) => m.type === 'BUILD_ROUTE')
      .map((m) => (m as Extract<Move, { type: 'BUILD_ROUTE' }>).edgeId),
  );

  // Setup route targets: empty edges incident to the active player's newest habitat.
  const setupRouteEdges = new Set<string>();
  if (setup && exp?.kind === 'ROUTE') {
    const mine = game.buildings.filter((b) => b.ownerId === game.activePlayerId);
    const lastHab = mine[mine.length - 1];
    if (lastHab) {
      for (const e of g.vertexEdges[lastHab.vertexId]) {
        if (!game.routes.some((r) => r.edgeId === e)) setupRouteEdges.add(e);
      }
    }
  }

  const vertexMove = (vid: string): Move | null => {
    if (game.buildings.some((b) => b.vertexId === vid && interaction !== 'dome')) {
      // occupied vertices are only valid targets for a DOME upgrade
      if (interaction !== 'dome') return null;
    }
    if (setup) {
      if (exp?.kind !== 'HABITAT') return null;
      if (game.buildings.some((b) => b.vertexId === vid)) return null;
      if (violatesDistanceRule(g, game.buildings, vid)) return null;
      return { type: 'BUILD', building: 'HABITAT', locationId: vid };
    }
    if (interaction === 'habitat' && legalHabitatV.has(vid))
      return { type: 'BUILD', building: 'HABITAT', locationId: vid };
    if (interaction === 'dome' && legalDomeV.has(vid))
      return { type: 'BUILD', building: 'DOME', locationId: vid };
    if (interaction === 'commTower' && legalCommV.has(vid))
      return { type: 'BUILD', building: 'COMM_TOWER', locationId: vid };
    return null;
  };

  const edgeMove = (eid: string): Move | null => {
    if (game.routes.some((r) => r.edgeId === eid)) return null;
    if (setup) {
      if (exp?.kind === 'ROUTE' && setupRouteEdges.has(eid))
        return { type: 'BUILD_ROUTE', edgeId: eid };
      return null;
    }
    if (interaction === 'route' && legalRouteE.has(eid)) return { type: 'BUILD_ROUTE', edgeId: eid };
    return null;
  };

  const ownerOf = (id: string | undefined): 'p1' | 'p2' | null =>
    id === 'p1' ? 'p1' : id === 'p2' ? 'p2' : null;

  const corners = (hid: string): [number, number][] => {
    const [cx, cy] = g.hexPos[hid];
    const pts: [number, number][] = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 30);
      pts.push([cx + Math.cos(a), cy + Math.sin(a)]);
    }
    return pts;
  };

  const vb = g.viewBox;
  return (
    <svg
      viewBox={`${vb.minX} ${vb.minY} ${vb.width} ${vb.height}`}
      className="w-full h-full max-h-[78vh]"
      role="img"
      aria-label="Mars Frontier board"
    >
      {g.hexIds.map((hid) => {
        const hex = game.board.hexes.find((h) => h.id === hid)!;
        const [cx, cy] = g.hexPos[hid];
        const stormTarget = interaction === 'storm' && game.dustStormHexId !== hid;
        return (
          <g
            key={hid}
            className={stormTarget ? 'cursor-pointer' : ''}
            role={stormTarget ? 'button' : undefined}
            aria-label={stormTarget ? 'Move dust storm here' : undefined}
            onClick={stormTarget ? () => dispatch({ type: 'MOVE_DUST_STORM', hexId: hid }) : undefined}
          >
            <Hex hex={hex} cx={cx} cy={cy} corners={corners(hid)} hasStorm={game.dustStormHexId === hid} />
            {stormTarget && (
              <polygon points={corners(hid).map((p) => p.join(',')).join(' ')} fill="#facc15" opacity={0.15} />
            )}
          </g>
        );
      })}
      {g.edges.map((eid) => {
        const route = game.routes.find((r) => r.edgeId === eid);
        const [a, b] = g.edgeVertices[eid];
        const move = edgeMove(eid);
        return (
          <Edge
            key={eid}
            a={g.vertexPos[a]}
            b={g.vertexPos[b]}
            owner={ownerOf(route?.ownerId)}
            legal={!!move}
            onClick={() => move && dispatch(move)}
          />
        );
      })}
      {g.vertices.map((vid) => {
        const b = game.buildings.find((x) => x.vertexId === vid);
        const move = vertexMove(vid);
        return (
          <Vertex
            key={vid}
            pos={g.vertexPos[vid]}
            kind={b?.kind ?? null}
            owner={ownerOf(b?.ownerId)}
            legal={!!move}
            onClick={() => move && dispatch(move)}
          />
        );
      })}
    </svg>
  );
}
