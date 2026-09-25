import { createContext, forwardRef, useContext, useId, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  PanelsTopLeft,
} from 'lucide-react';
import './StudioPanel.css';

const PanelLayout = createContext(null);

export function PanelLayoutProvider({ workspace, children }) {
  const [layouts, setLayouts] = useState({});
  const value = useMemo(
    () => ({
      layout: layouts[workspace] || {},
      setPanel: (id, collapsed) =>
        setLayouts((current) => ({
          ...current,
          [workspace]: { ...current[workspace], [id]: collapsed },
        })),
      setAll: (collapsed) =>
        setLayouts((current) => ({
          ...current,
          [workspace]: { defaultCollapsed: collapsed },
        })),
    }),
    [layouts, workspace]
  );
  return <PanelLayout.Provider value={value}>{children}</PanelLayout.Provider>;
}

export function useStudioPanel(panelId) {
  const context = useContext(PanelLayout);
  const [local, setLocal] = useState(false);
  const generatedId = useId();
  const collapsed = context
    ? (context.layout[panelId] ?? context.layout.defaultCollapsed ?? false)
    : local;
  return {
    collapsed,
    setCollapsed: (value) => (context ? context.setPanel(panelId, value) : setLocal(value)),
    attributes: { id: `studio-panel-${generatedId}`, 'data-panel-collapsed': collapsed },
  };
}

export function PanelToggle({ panel, label, children }) {
  const Icon = panel.collapsed ? ChevronRight : ChevronDown;
  return (
    <div className="sd-panel-collapse-bar" data-panel-summary>
      <button
        type="button"
        aria-label={`${panel.collapsed ? 'Expand' : 'Collapse'} ${label}`}
        aria-expanded={!panel.collapsed}
        aria-controls={panel.attributes.id}
        onClick={() => panel.setCollapsed(!panel.collapsed)}
      >
        <Icon size={16} aria-hidden="true" />
        <span>{label}</span>
      </button>
      {children && <div className="sd-panel-summary-content">{children}</div>}
    </div>
  );
}

export const StudioPanel = forwardRef(function StudioPanel(
  { panelId, label, summary, as: Tag = 'section', children, ...props },
  ref
) {
  const panel = useStudioPanel(panelId);
  return (
    <Tag {...props} {...panel.attributes} ref={ref}>
      <PanelToggle panel={panel} label={label}>
        {summary}
      </PanelToggle>
      {children}
    </Tag>
  );
});

export function PanelLayoutActions() {
  const context = useContext(PanelLayout);
  if (!context) return null;
  return (
    <details
      className="sd-panel-layout-menu"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.currentTarget.open = false;
          event.currentTarget.querySelector('summary').focus();
        }
      }}
    >
      <summary>
        <PanelsTopLeft size={16} aria-hidden="true" /> Layout{' '}
        <ChevronDown size={14} aria-hidden="true" />
      </summary>
      <div className="sd-panel-layout-actions" role="group" aria-label="Workspace panels">
        <button
          type="button"
          onClick={(event) => {
            context.setAll(true);
            const menu = event.currentTarget.closest('details');
            menu.open = false;
            menu.querySelector('summary').focus();
          }}
          title="Collapse panels in this workspace"
        >
          <ChevronsDownUp size={16} aria-hidden="true" /> Collapse all
        </button>
        <button
          type="button"
          onClick={(event) => {
            context.setAll(false);
            const menu = event.currentTarget.closest('details');
            menu.open = false;
            menu.querySelector('summary').focus();
          }}
          title="Expand panels in this workspace"
        >
          <ChevronsUpDown size={16} aria-hidden="true" /> Expand all
        </button>
      </div>
    </details>
  );
}
