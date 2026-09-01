import { useState } from 'react';
import { CreateCharacter } from './components/CreateCharacter';
import { MainGame } from './components/MainGame';

interface OpeningOption {
  tag: string;
  text: string;
}
interface Opening {
  paragraphs: string[];
  options: OpeningOption[];
}

function App() {
  const [gameState, setGameState] = useState<'creating' | 'playing'>('creating');
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [opening, setOpening] = useState<Opening>({ paragraphs: [], options: [] });

  const handlePlayerCreated = (playerId: string, openingData: Opening) => {
    setCurrentPlayerId(playerId);
    setOpening(openingData);
    setGameState('playing');
  };

  return (
    <div>
      {gameState === 'creating' && <CreateCharacter onCreated={handlePlayerCreated} />}
      {gameState === 'playing' && currentPlayerId && <MainGame playerId={currentPlayerId} opening={opening} />}
    </div>
  );
}

export default App;
