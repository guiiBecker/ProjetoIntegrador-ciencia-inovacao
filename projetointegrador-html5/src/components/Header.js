import logo from '../duck-schedule-logo.svg';
import './Header.css';

export default function Header({ title, subtitle, rightContent }) {
  return (
    <header className="app-header">
      <div className="app-header-brand">
        <img src={logo} alt="Duck Schedule" className="app-header-logo" />
        <div className="app-header-copy">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {rightContent && <div className="app-header-actions">{rightContent}</div>}
    </header>
  );
}
