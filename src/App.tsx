import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Add from './pages/Add';
import Containers from './pages/Containers';
import Settings from './pages/Settings';
import Collection from './pages/Collection';
import Stats from './pages/Stats';
import Admin from './pages/Admin';
import Park from './pages/Park';
import Friends from './pages/Friends';
import Leaderboard from './pages/Leaderboard';
import Teams from './pages/Teams';
import FriendPark from './pages/FriendPark';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/add" element={<Add />} />
      <Route path="/containers" element={<Containers />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/collection" element={<Collection />} />
      <Route path="/stats" element={<Stats />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/park" element={<Park />} />
      <Route path="/friends" element={<Friends />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/teams" element={<Teams />} />
      <Route path="/u/:username/park" element={<FriendPark />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
