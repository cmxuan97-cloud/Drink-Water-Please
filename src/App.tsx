import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Add from './pages/Add';
import Containers from './pages/Containers';
import Settings from './pages/Settings';
import Collection from './pages/Collection';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/add" element={<Add />} />
      <Route path="/containers" element={<Containers />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/collection" element={<Collection />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
