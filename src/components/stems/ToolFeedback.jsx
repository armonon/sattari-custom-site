import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import ServiceInquiryForm from '../ServiceInquiryForm';
import { trackSiteEvent } from '../../utils/siteMeasurement';

/**
 * Voluntary feedback through the existing service-inquiry route. Nothing is
 * sent unless the musician fills in and submits the form; audio and results
 * are never attached.
 */
export default function ToolFeedback({ tool, className = 'tool-feedback' }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className={className}
      open={open}
      onToggle={(event) => {
        const next = event.currentTarget.open;
        if (next && !open) trackSiteEvent('feedback_opened');
        setOpen(next);
      }}
    >
      <summary>
        <MessageSquare size={15} aria-hidden="true" /> Tell us what worked or what didn’t
      </summary>
      <p>
        Written feedback goes to the Sattari team by email. Do not include audio or private details.
        Your songs and results are not attached.
      </p>
      {open && (
        <ServiceInquiryForm
          service="tool-feedback"
          onServiceChange={() => {}}
          source={`${tool} feedback`}
          compact
        />
      )}
    </details>
  );
}
