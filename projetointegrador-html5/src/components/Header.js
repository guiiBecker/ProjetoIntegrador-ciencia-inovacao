import './Header.css';

export default function Header({ title, subtitle, rightContent }) {
  return (
    <header className="app-header">
      <div className="app-header-copy">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {rightContent && <div className="app-header-actions">{rightContent}</div>}
    </header>
  );
}
