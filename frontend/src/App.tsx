import { useState } from 'react';
import { CreateCharacter } from './components/CreateCharacter';
import { MainGame } from './components/MainGame';
import { SaveList } from './components/SaveList';

interface OpeningOption {
  tag: string;
  text: string;
}
interface Opening {
  paragraphs: string[];
  options: OpeningOption[];
}

type GameState = 'listing' | 'creating' | 'playing';

function App() {
  const [gameState, setGameState] = useState<GameState>('listing');
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [opening, setOpening] = useState<Opening>({ paragraphs: [], options: [] });

  const handlePlayerCreated = (playerId: string, openingData: Opening) => {
    setCurrentPlayerId(playerId);
    setOpening(openingData);
    setGameState('playing');
  };

  // 进入已有存档：无开场剧情，直接进入主界面
  const handleEnterSave = (playerId: string) => {
    setCurrentPlayerId(playerId);
    setOpening({ paragraphs: [], options: [] });
    setGameState('playing');
  };

  // 从局内「存档」指令返回存档列表页
  const handleExitToList = () => {
    setCurrentPlayerId(null);
    setOpening({ paragraphs: [], options: [] });
    setGameState('listing');
  };

  return (
    <div>
      {gameState === 'listing' && <SaveList onEnter={handleEnterSave} onCreate={() => setGameState('creating')} />}
      {gameState === 'creating' && <CreateCharacter onCreated={handlePlayerCreated} />}
      {gameState === 'playing' && currentPlayerId && (
        <MainGame playerId={currentPlayerId} opening={opening} onExitToList={handleExitToList} />
      )}
    </div>
  );
}

export default App;
