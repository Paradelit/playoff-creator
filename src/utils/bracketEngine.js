export const buildDynamicBracket = (initialMatches, roundsData = []) => {
  let state = {};

  let currentRound = initialMatches.map((m, i) => {
    let matchId = `R1-M${i}`;
    const rData = roundsData[0] || { dates: [], format: 'Partido único', gamesCount: 1 };

    state[matchId] = {
      id: matchId,
      title: m.title || `Partido ${i + 1}`,
      team1: m.team1,
      team2: m.team2,
      team1Origin: m.team1Origin,
      team2Origin: m.team2Origin,
      team1Options: m.team1Options || [],
      team2Options: m.team2Options || [],
      dates: rData.dates || [],
      format: rData.format || 'Partido único',
      gamesCount: rData.gamesCount || 1,
      scores: Array.from({ length: rData.gamesCount || 1 }, () => ({ s1: '', s2: '' })),
      winner: null,
      round: 1,
      nextId: null,
      slot: null,
      children: null,
    };
    return matchId;
  });

  let roundNum = 2;
  let previousRound = currentRound;

  while (previousRound.length > 1) {
    let nextRound = [];
    for (let i = 0; i < previousRound.length; i += 2) {
      let matchId = `R${roundNum}-M${i / 2}`;
      let child1 = previousRound[i];
      let child2 = previousRound[i + 1];

      const rData = roundsData[roundNum - 1] || { dates: [], format: 'Partido único', gamesCount: 1 };

      state[matchId] = {
        id: matchId,
        title: rData.name || (previousRound.length === 2 ? "FINAL" : (previousRound.length === 4 ? "SEMIFINALES" : (previousRound.length === 8 ? "CUARTOS DE FINAL" : `Ronda ${roundNum}`))),
        team1: null,
        team2: null,
        team1Origin: null,
        team2Origin: null,
        team1Options: [],
        team2Options: [],
        dates: rData.dates || [],
        format: rData.format || 'Partido único',
        gamesCount: rData.gamesCount || 1,
        scores: Array.from({ length: rData.gamesCount || 1 }, () => ({ s1: '', s2: '' })),
        winner: null,
        round: roundNum,
        children: [child1, child2],
        nextId: null,
        slot: null,
      };

      state[child1].nextId = matchId;
      state[child1].slot = 'team1';
      state[child2].nextId = matchId;
      state[child2].slot = 'team2';

      nextRound.push(matchId);
    }
    previousRound = nextRound;
    roundNum++;
  }

  return { state, rootId: previousRound[0] };
};

export const calculateMatchWinner = (match) => {
  let wins1 = 0, wins2 = 0, total1 = 0, total2 = 0, playedGames = 0;

  match.scores.forEach(g => {
    const s1 = parseInt(g.s1);
    const s2 = parseInt(g.s2);
    if (!isNaN(s1) && !isNaN(s2)) {
      playedGames++;
      total1 += s1;
      total2 += s2;
      if (s1 > s2) wins1++;
      else if (s2 > s1) wins2++;
    }
  });

  if (match.gamesCount === 3) {
    if (wins1 >= 2) return match.team1;
    else if (wins2 >= 2) return match.team2;
  } else if (match.gamesCount === 2) {
    if (playedGames === 2) {
      if (total1 > total2) return match.team1;
      else if (total2 > total1) return match.team2;
    }
  } else {
    if (playedGames >= 1) {
      if (wins1 > wins2) return match.team1;
      else if (wins2 > wins1) return match.team2;
    }
  }
  return null;
};
