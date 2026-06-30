import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Discover from './pages/Discover'
import SearchResults from './pages/SearchResults'
import Detail from './pages/Detail'
import PoetDetail from './pages/PoetDetail'
import PoetWorks from './pages/PoetWorks'
import Favorites from './pages/Favorites'
import Profile from './pages/Profile'
import Feihualing from './pages/Feihualing'
import PoetMap from './pages/PoetMap'
import Stats from './pages/Stats'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/detail/:id" element={<Detail />} />
          <Route path="/poet/:id" element={<PoetDetail />} />
          <Route path="/poet/:id/works" element={<PoetWorks />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/feihualing" element={<Feihualing />} />
          <Route path="/poet/:id/map" element={<PoetMap />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
