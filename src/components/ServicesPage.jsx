const services = [
  {
    title: 'Instrument repair',
    body: 'Use this section for drum repair, setup adjustments, hardware fixes, and any broader instrument repair work you want to keep available locally.',
  },
  {
    title: 'Rentals',
    body: 'Outline what can be rented, who it is for, how long the rental terms are, and how local customers can inquire.',
  },
  {
    title: 'Lessons or local support',
    body: 'If you want, this third slot can hold lessons, local consultations, event support, or a catch-all service inquiry form.',
  },
];

import ServiceInquiryForm from './ServiceInquiryForm';

export default function ServicesPage() {
  return (
    <section className="section page-header-offset">
      <div className="container section-header narrow">
        <p className="eyebrow">Local services</p>
        <h1>Keep services on their own page so the storefront stays focused</h1>
        <p>
          This is where you support your local market without confusing online buyers who came for drum products.
        </p>
      </div>

      <div className="container card-grid three-col">
        {services.map((service) => (
          <article className="info-card" key={service.title}>
            <h3>{service.title}</h3>
            <p>{service.body}</p>
          </article>
        ))}
      </div>

      <div className="container">
        <ServiceInquiryForm />
      </div>
    </section>
  );
}
