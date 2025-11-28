import { Store, Link2, Rocket } from 'lucide-react';
import { Link } from 'react-router-dom';

const steps = [
  {
    icon: Store,
    step: '1',
    title: 'Conecta tu tienda Shopify',
    description: 'Ingresa a tu dashboard de Grumo y conecta tu tienda Shopify con un click. Autorizas el acceso y listo.',
    time: '2 min',
  },
  {
    icon: Link2,
    step: '2',
    title: 'Vincula Mercado Pago',
    description: 'Conecta tu cuenta de Mercado Pago para recibir los pagos de tus ventas directamente. Sin intermediarios.',
    time: '1 min',
  },
  {
    icon: Rocket,
    step: '3',
    title: 'Tu tienda está en la app',
    description: 'Tus productos se sincronizan automáticamente. Ya puedes enviar notificaciones push a tus clientes.',
    time: '¡Listo!',
  },
];

export default function HowItWorks() {
  return (
    <section id="como-funciona" className="py-20 md:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            En 5 minutos tu tienda está en la app
          </h2>
          <p className="text-lg text-gray-600">
            No necesitas conocimientos técnicos. Solo tu tienda Shopify y ganas de crecer.
          </p>
        </div>

        {/* Steps */}
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Connection line */}
            <div className="absolute top-24 left-1/2 -translate-x-1/2 w-0.5 h-[calc(100%-6rem)] bg-gray-200 hidden md:block"></div>

            <div className="space-y-12 md:space-y-0">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isEven = index % 2 === 1;

                return (
                  <div key={index} className="relative md:grid md:grid-cols-2 md:gap-8 md:items-center md:min-h-[200px]">
                    {/* Content */}
                    <div className={`${isEven ? 'md:order-2 md:text-left' : 'md:text-right'} mb-8 md:mb-0`}>
                      <div className={`inline-flex items-center gap-2 text-sm font-medium text-purple-600 mb-2 ${isEven ? '' : 'md:justify-end md:flex'}`}>
                        <span className="bg-purple-100 px-2 py-0.5 rounded">{step.time}</span>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{step.title}</h3>
                      <p className="text-gray-600">{step.description}</p>
                    </div>

                    {/* Icon */}
                    <div className={`flex ${isEven ? 'md:order-1 md:justify-end' : 'md:justify-start'} justify-center`}>
                      <div className="relative">
                        <div className="w-20 h-20 bg-purple-100 rounded-2xl flex items-center justify-center">
                          <Icon className="w-10 h-10 text-purple-600" />
                        </div>
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          {step.step}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <Link
            to="/admin"
            className="inline-flex items-center justify-center px-8 py-4 bg-purple-600 text-white rounded-xl font-semibold text-lg hover:bg-purple-700 transition-colors"
          >
            Empezar ahora - Es gratis
          </Link>
          <p className="text-sm text-gray-500 mt-3">
            Sin tarjeta de crédito requerida
          </p>
        </div>
      </div>
    </section>
  );
}
