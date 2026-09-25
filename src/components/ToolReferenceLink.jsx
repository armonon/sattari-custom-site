import { Link } from 'react-router-dom';
export default function ToolReferenceLink({ tool }) {
  return (
    <nav className="tool-reference-link" aria-label="Tool information">
      <Link to={`/tools/${tool}`}>Formats, privacy & limits</Link>
      <Link to="/guides">Music guides</Link>
    </nav>
  );
}
