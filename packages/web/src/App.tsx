import { NavLink, Route, Routes } from 'react-router-dom';
import { Brand } from './pages/Brand.tsx';
import { Library } from './pages/Library.tsx';
import { Mascot } from './pages/Mascot.tsx';
import { ReelEditor } from './pages/ReelEditor.tsx';

const nav = [
  { to: '/', label: 'Reels', end: true },
  { to: '/brand', label: 'Brand', end: false },
  { to: '/mascot', label: 'Mascot', end: false },
];

export function App() {
  return (
    <div className="flex min-h-screen">
      <nav className="sticky top-0 flex h-screen w-44 shrink-0 flex-col gap-1 border-r border-ink-faint/60 px-4 py-6">
        <div className="mb-6 px-2 text-lg font-bold leading-tight">
          Reel
          <br />
          Maker
        </div>
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `rounded-md px-2 py-1.5 text-[15px] ${isActive ? 'bg-paper font-semibold text-ink' : 'text-ink-soft hover:text-ink'}`
            }
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
      <main className="min-w-0 flex-1 px-10 py-8">
        <Routes>
          <Route path="/" element={<Library />} />
          <Route path="/reels/:id/:step" element={<ReelEditor />} />
          <Route path="/brand" element={<Brand />} />
          <Route path="/mascot" element={<Mascot />} />
          <Route path="*" element={<p>This page does not exist.</p>} />
        </Routes>
      </main>
    </div>
  );
}
