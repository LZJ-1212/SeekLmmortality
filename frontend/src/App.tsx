import { useState } from 'react';
import { CreateCharacter } from './components/CreateCharacter';
import { MainGame } from './components/MainGame';

function App() {
  const [gameState, setGameState] = useState<'creating' | 'playing'>('creating');
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);

  const handlePlayerCreated = (playerId: string) => {
    setCurrentPlayerId(playerId);
    setGameState('playing');
  };

  return (
    <div>
      {gameState === 'creating' && <CreateCharacter onCreated={handlePlayerCreated} />}
      {gameState === 'playing' && currentPlayerId && <MainGame playerId={currentPlayerId} />}
    </div>
  );
}

export default App;