import './NavBar.css';

export default function NavBar({ items, active, onChange }) {
  return (
    <nav className="app-nav">
      {items.map(item => (
        <button
          key={item.key}
          className={active === item.key ? 'nav-active' : ''}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
