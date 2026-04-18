import './Button.css';

export default function Button({ variant = 'primary', children, className = '', ...props }) {
  return (
    <button className={`btn btn-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
