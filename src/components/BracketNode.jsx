import React from 'react';
import MatchCard from './MatchCard';

const BracketNode = React.memo(({ nodeId, bracketData, onScoreChange, onSelectSorteo, myTeam, readOnly }) => {
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
      />
      {!isLeaf && (
        <>
          <div
            className={`w-[2px] h-6 transition-colors duration-300 ${nodeHasTeam ? 'bg-amber-500' : 'bg-slate-300'}`}
          ></div>
          <div className="flex items-start">
            <div className="flex flex-col items-center relative w-full">
              <div
                className={`absolute top-0 right-0 w-1/2 h-[2px] transition-colors duration-300 ${child0HasTeam ? 'bg-amber-500 z-10' : 'bg-slate-300'}`}
              ></div>
              <div
                className={`w-[2px] h-6 transition-colors duration-300 ${child0HasTeam ? 'bg-amber-500 z-10' : 'bg-slate-300'}`}
              ></div>
              <div className="px-2 sm:px-4">
                <BracketNode
                  nodeId={node.children[0]}
                  bracketData={bracketData}
                  onScoreChange={onScoreChange}
                  onSelectSorteo={onSelectSorteo}
                  myTeam={myTeam}
                  readOnly={readOnly}
                />
              </div>
            </div>
            <div className="flex flex-col items-center relative w-full">
              <div
                className={`absolute top-0 left-0 w-1/2 h-[2px] transition-colors duration-300 ${child1HasTeam ? 'bg-amber-500 z-10' : 'bg-slate-300'}`}
              ></div>
              <div
                className={`w-[2px] h-6 transition-colors duration-300 ${child1HasTeam ? 'bg-amber-500 z-10' : 'bg-slate-300'}`}
              ></div>
              <div className="px-2 sm:px-4">
                <BracketNode
                  nodeId={node.children[1]}
                  bracketData={bracketData}
                  onScoreChange={onScoreChange}
                  onSelectSorteo={onSelectSorteo}
                  myTeam={myTeam}
                  readOnly={readOnly}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

export default BracketNode;
