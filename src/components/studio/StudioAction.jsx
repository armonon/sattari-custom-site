/** Labels remain in the accessibility tree when the studio hides them visually. */
export default function StudioAction({ icon: Icon, label, className = '', ...props }) {
  return (
    <button
      type="button"
      title={props['aria-label'] || label}
      {...props}
      className={`sd-icon-action ${className}`.trim()}
    >
      <Icon size={17} aria-hidden="true" />
      <span className="sd-action-label">{label}</span>
    </button>
  );
}
