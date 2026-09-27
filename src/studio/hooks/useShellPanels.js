import { useEffect, useRef, useState } from 'react';

/** The session inspector; closing it returns focus to the control that opened it. */
export function useInspector(activeView) {
  const [inspector, setInspector] = useState(null);
  const opener = useRef(null);
  useEffect(() => {
    setInspector(null);
  }, [activeView]);
  return {
    inspector,
    setInspector,
    close: () => {
      setInspector(null);
      opener.current?.focus();
    },
    toggle: (name, event) => {
      opener.current = event.currentTarget;
      setInspector((current) => (current === name ? null : name));
    },
  };
}

/** Live input connection state and the Add source dialog. */
export function useInputSource({ getEngine, setNotice, onConnected }) {
  const [microphoneActive, setMicrophoneActive] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  return {
    microphoneActive,
    setMicrophoneActive,
    chooserOpen,
    openChooser: () => setChooserOpen(true),
    closeChooser: () => setChooserOpen(false),
    toggleMicrophone: async () => {
      try {
        if (microphoneActive) {
          getEngine().closeMicrophone();
          setMicrophoneActive(false);
          setNotice('Live input disconnected.');
        } else {
          setChooserOpen(true);
        }
      } catch {
        setNotice('Microphone permission was not granted.');
      }
    },
    connect: async (deviceId, label) => {
      await getEngine().openMicrophone(deviceId);
      setMicrophoneActive(true);
      onConnected();
      setNotice(
        `${label} connected safely. Arm recording and enable monitoring separately in the Input strip.`
      );
    },
  };
}
