import { Animal } from '../data/animals';
import Character from './Character';

type Props = {
  animal: Animal;
  size?: number;
  locked?: boolean;
};

export default function AnimalIcon({ animal, size = 56, locked = false }: Props) {
  const filter = locked ? 'brightness(0) opacity(0.15)' : undefined;
  return (
    <div style={{ display: 'inline-flex', filter }}>
      <Character id={animal.customArt} mood="idle" size={size} static />
    </div>
  );
}
