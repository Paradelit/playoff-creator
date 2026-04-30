import React from 'react';
import MatchCard from './MatchCard';

// Connector lines: 3px on the active path (your team), 2px elsewhere. When a
// team is selected we fade non-path lines to 40% opacity so the amber wayfinding
// reads in <2s even on a 16+ team bracket at low zoom.
const PATH_LINE = 'bg-amber-500';
const NEUTRAL_LINE = 'bg-slate-300';

const BracketNode = React.memo(
  ({ nodeId, bracketData, onScoreChange, onSelectSorteo, myTeam, readOnly, onDateClick }) => {
    if (!bracketData || !bracketData.state[nodeId]) return null;
    const node = bracketData.state[nodeId];
    const isLeaf = !node.children;
    const isRoot = node.nextId === null;

    const hasTeam = (id) => {
      if (!id || !myTeam) return false;
      const n = bracketData.state[id];
      return n && (n.team1 === myTeam || n.team2 === myTeam);
    };

    const nodeHasTeam = hasTeam(node.id);
    const child0HasTeam = !isLeaf && hasTeam(node.children[0]);
    const child1HasTeam = !isLeaf && hasTeam(node.children[1]);

    const dimNonPath = Boolean(myTeam);
    const pathClass = (active) => {
      const color = active ? PATH_LINE : NEUTRAL_LINE;
      const dim = !active && dimNonPath ? ' opacity-40' : '';
      const z = active ? ' z-10' : '';
      return `${color}${dim}${z}`;
    };
    const pathThickness = (active, axis) => {
      // Active lines render at 3px, neutral at 2px. axis: 'v' (vertical) | 'h' (horizontal).
      if (axis === 'v') return active ? 'w-[3px]' : 'w-[2px]';
      return active ? 'h-[3px]' : 'h-[2px]';
    };

    return (
      <div className="flex flex-col items-center">
        <MatchCard
          match={node}
          bracketData={bracketData}
          onScoreChange={onScoreChange}
          onSelectSorteo={onSelectSorteo}
          isFinal={isRoot}
          myTeam={myTeam}
          readOnly={readOnly}
          onDateClick={onDateClick}
        />
        {!isLeaf && (
          <>
            <div
              className={`${pathThickness(nodeHasTeam, 'v')} h-6 transition-colors duration-300 ${pathClass(nodeHasTeam)}`}
            ></div>
            <div className="flex items-start">
              <div className="flex flex-col items-center relative w-full">
                <div
                  className={`absolute top-0 right-0 w-1/2 ${pathThickness(child0HasTeam, 'h')} transition-colors duration-300 ${pathClass(child0HasTeam)}`}
                ></div>
                <div
                  className={`${pathThickness(child0HasTeam, 'v')} h-6 transition-colors duration-300 ${pathClass(child0HasTeam)}`}
                ></div>
                <div className="px-2 sm:px-4">
                  <BracketNode
                    nodeId={node.children[0]}
                    bracketData={bracketData}
                    onScoreChange={onScoreChange}
                    onSelectSorteo={onSelectSorteo}
                    myTeam={myTeam}
                    readOnly={readOnly}
                    onDateClick={onDateClick}
                  />
                </div>
              </div>
              <div className="flex flex-col items-center relative w-full">
                <div
                  className={`absolute top-0 left-0 w-1/2 ${pathThickness(child1HasTeam, 'h')} transition-colors duration-300 ${pathClass(child1HasTeam)}`}
                ></div>
                <div
                  className={`${pathThickness(child1HasTeam, 'v')} h-6 transition-colors duration-300 ${pathClass(child1HasTeam)}`}
                ></div>
                <div className="px-2 sm:px-4">
                  <BracketNode
                    nodeId={node.children[1]}
                    bracketData={bracketData}
                    onScoreChange={onScoreChange}
                    onSelectSorteo={onSelectSorteo}
                    myTeam={myTeam}
                    readOnly={readOnly}
                    onDateClick={onDateClick}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  },
);

export default BracketNode;
