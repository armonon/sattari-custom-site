// ServiceInquiryForm.jsx
import { useState } from 'react';

const SERVICE_OPTIONS = [
  { value: 'repairs', label: 'Repairs' },
  { value: 'rentals', label: 'Rentals' },
  { value: 'lessons', label: 'Lessons' },
  { value: 'studio', label: 'Studio Time' },
];

export default function ServiceInquiryForm() {
  const [form, setForm] = useState({
    service: '',
    name: '',
    email: '',
    phone: '',
    details: '',
  });
  const [submitted, setSubmitted] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    // TODO: Connect to Formspree/Netlify/Resend
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="service-form-glass">
        <p className="card-kicker">Inquiry sent</p>
        <h3>Thank you!</h3>
        <p>We’ve received your request and we’ll follow up soon with the next steps.</p>
      </div>
    );
  }

  return (
    <form className="service-form-glass" onSubmit={handleSubmit}>
      <p className="card-kicker">Local service request</p>
      <h3>Service Inquiry</h3>
      <p className="form-helper">
        Tell us what you need, when you need it, and any details that will help us guide you.
      </p>
      <label>
        <span>Service Type</span>
        <select name="service" value={form.service} onChange={handleChange} required>
          <option value="" disabled>
            Select a service
          </option>
          {SERVICE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Your Name</span>
        <input name="name" type="text" value={form.name} onChange={handleChange} required />
      </label>
      <label>
        <span>Email</span>
        <input name="email" type="email" value={form.email} onChange={handleChange} required />
      </label>
      <label>
        <span>Phone</span>
        <input name="phone" type="tel" value={form.phone} onChange={handleChange} />
      </label>
      <label>
        <span>Describe what you need</span>
        <textarea name="details" value={form.details} onChange={handleChange} rows={4} required />
      </label>
      <button className="button button-solid button-full" type="submit">
        Send service request
      </button>
    </form>
  );
}
